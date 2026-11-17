import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ACTIVE_MEMBERSHIP_STATUSES,
  APPLICANT_SETTABLE_STATUSES,
  MEMBERSHIP_STATUSES,
  MEMBERSHIP_TYPES,
  REAPPLICABLE_MEMBERSHIP_STATUSES,
  summariseMemberships,
  type MembershipRecord,
} from "./memberships";

/**
 * Guards the capability model against drifting from the database.
 *
 * `memberships.ts` mirrors two Postgres enums so a form can offer them
 * synchronously, and mirrors the applicant-settable subset so the application and
 * the RLS policy agree about which states a user may write. All three would go
 * stale silently: a value added to a migration but not to the mirror is a form
 * that rejects a value the database accepts, and a status added to the applicant
 * subset but not to the policy is a write the application offers and the database
 * refuses.
 *
 * The migrations are read as text, as the other mirror tests do, so this needs no
 * database.
 */

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

function enumMembers(sql: string, typeName: string): string[] {
  const create = sql.match(
    new RegExp(
      `create type public\\.${typeName} as enum\\s*\\(([^)]*)\\)`,
      "i",
    ),
  );
  const members: string[] = [];
  if (create?.[1]) {
    for (const match of create[1].matchAll(/'([^']+)'/g)) {
      if (match[1]) members.push(match[1]);
    }
  }
  return members;
}

function stripSqlComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, "");
}

/**
 * The most recent definition of the owner-update policy, across all migrations.
 *
 * The policy is dropped and recreated by `…59_membership_owner_update_scope.sql`,
 * so reading a single file would test the superseded version. Concatenating the
 * migrations in filename order and taking the last definition mirrors what the
 * database ends up with.
 */
function ownerUpdatePolicySql(): string {
  const sql = stripSqlComments(
    readdirSync(MIGRATIONS_DIR)
      .sort()
      .map((file) => readFileSync(join(MIGRATIONS_DIR, file), "utf8"))
      .join("\n"),
  );
  const matches = [
    ...sql.matchAll(
      /create policy "real_estate_memberships_update_own"[\s\S]*?;/g,
    ),
  ];
  return matches.at(-1)?.[0] ?? "";
}

const membershipMigration = stripSqlComments(
  readFileSync(
    join(
      MIGRATIONS_DIR,
      readdirSync(MIGRATIONS_DIR).find((f) =>
        f.includes("real_estate_memberships"),
      )!,
    ),
    "utf8",
  ),
);

describe("membership mirrors match the migration", () => {
  it("membership_type", () => {
    expect([...MEMBERSHIP_TYPES]).toEqual(
      enumMembers(membershipMigration, "membership_type"),
    );
  });

  it("membership_status", () => {
    expect([...MEMBERSHIP_STATUSES]).toEqual(
      enumMembers(membershipMigration, "membership_status"),
    );
  });

  it("the applicant-settable statuses are the ones the insert policy allows", () => {
    // The policy's `with check` names the states a user may write; the mirror must
    // name the same ones, or the application offers a write the database refuses.
    for (const status of APPLICANT_SETTABLE_STATUSES) {
      expect(membershipMigration).toContain(`'${status}'`);
    }
    // An approved row is never applicant-settable — that is the self-escalation
    // guard.
    expect([...APPLICANT_SETTABLE_STATUSES]).not.toContain("approved");
  });

  it("only `approved` is a live capability", () => {
    expect([...ACTIVE_MEMBERSHIP_STATUSES]).toEqual(["approved"]);
  });

  it("only a refusal or a request for changes may be re-applied", () => {
    // These are the source states `applyForMembershipAction` accepts a
    // re-application from; an approved or suspended row must not offer the form.
    // The re-application always writes `pending_review`, which is itself
    // applicant-settable, so the update policy admits the write.
    expect([...REAPPLICABLE_MEMBERSHIP_STATUSES]).toEqual([
      "rejected",
      "changes_requested",
    ]);
    expect(APPLICANT_SETTABLE_STATUSES).toContain("pending_review");
    expect(REAPPLICABLE_MEMBERSHIP_STATUSES).not.toContain("approved");
    expect(REAPPLICABLE_MEMBERSHIP_STATUSES).not.toContain("suspended");
  });

  it("the owner update policy allows exactly the states the applicant may answer", () => {
    // The policy's `using` clause is the SOURCE-state guard: it decides which rows
    // an owner may target. It must admit the pending states (edit/withdraw) and the
    // two decided states a re-application answers — and nothing else. A missing
    // source guard is what let an owner reset an approved membership and lift a
    // suspension before `20260101000059_membership_owner_update_scope.sql`.
    const updatePolicy = ownerUpdatePolicySql();
    const usingClause = updatePolicy.match(
      /using\s*\(([^;]*?)\)\s*with check/is,
    );
    expect(
      usingClause,
      "the owner update policy must have a using clause",
    ).toBeTruthy();

    const allowed = new Set(
      [...(usingClause![1] ?? "").matchAll(/'([a-z_]+)'/g)].map((m) => m[1]),
    );

    expect(allowed).toEqual(
      new Set([
        ...APPLICANT_SETTABLE_STATUSES,
        ...REAPPLICABLE_MEMBERSHIP_STATUSES,
      ]),
    );
    // The states the owner must never target, because each is a staff decision.
    expect(allowed.has("approved")).toBe(false);
    expect(allowed.has("suspended")).toBe(false);
  });
});

describe("summariseMemberships", () => {
  const record = (
    type: MembershipRecord["membershipType"],
    status: MembershipRecord["status"],
  ): MembershipRecord => ({
    id: `id-${type}`,
    userId: "u1",
    membershipType: type,
    status,
    kycReference: null,
    approvedAt: null,
    reviewNotes: null,
    suspendedAt: null,
    suspensionReason: null,
    verifiedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  it("returns one entry per capability, including the absent ones", () => {
    const summary = summariseMemberships([record("landlord", "approved")]);
    expect(summary).toHaveLength(MEMBERSHIP_TYPES.length);
    expect(summary.map((entry) => entry.type)).toEqual([...MEMBERSHIP_TYPES]);
  });

  it("marks an approved capability active and not applicable", () => {
    const landlord = summariseMemberships([
      record("landlord", "approved"),
    ]).find((entry) => entry.type === "landlord")!;

    expect(landlord.isActive).toBe(true);
    // A row exists, so there is nothing to apply for — the unique constraint
    // means a second application is an update of this row.
    expect(landlord.canApply).toBe(false);
  });

  it("marks a pending capability as not yet active but also not applicable", () => {
    const agent = summariseMemberships([
      record("agent", "pending_review"),
    ]).find((entry) => entry.type === "agent")!;

    expect(agent.isActive).toBe(false);
    expect(agent.canApply).toBe(false);
  });

  it("marks an absent capability as applicable", () => {
    const summary = summariseMemberships([]);
    expect(summary.every((entry) => entry.canApply)).toBe(true);
    expect(summary.every((entry) => entry.isActive)).toBe(false);
  });

  it("supports a user holding both capabilities at once", () => {
    const summary = summariseMemberships([
      record("landlord", "approved"),
      record("agent", "approved"),
    ]);
    expect(summary.filter((entry) => entry.isActive)).toHaveLength(2);
  });

  it("a suspended capability is not active", () => {
    const landlord = summariseMemberships([
      record("landlord", "suspended"),
    ]).find((entry) => entry.type === "landlord")!;
    expect(landlord.isActive).toBe(false);
  });

  it("offers re-application for a refusal and a request for changes", () => {
    const summary = summariseMemberships([
      record("landlord", "rejected"),
      record("agent", "changes_requested"),
    ]);
    expect(summary.every((entry) => entry.canReapply)).toBe(true);
    // A re-application is not a first application: a row exists.
    expect(summary.every((entry) => entry.canApply)).toBe(false);
  });

  it("does not offer re-application for an approved or suspended capability", () => {
    for (const status of ["approved", "suspended", "pending_review"] as const) {
      const entry = summariseMemberships([record("landlord", status)]).find(
        (item) => item.type === "landlord",
      )!;
      expect(entry.canReapply).toBe(false);
    }
  });

  it("an absent capability is applicable but not re-applicable", () => {
    const entry = summariseMemberships([]).find(
      (item) => item.type === "landlord",
    )!;
    expect(entry.canApply).toBe(true);
    expect(entry.canReapply).toBe(false);
  });
});
