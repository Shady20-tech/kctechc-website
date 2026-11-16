import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ACCOUNT_TYPES,
  KYC_DECISION_STATUS,
  KYC_DOCUMENT_KINDS,
  KYC_ID_TYPES,
  KYC_MEMBERSHIP_TYPES,
  KYC_MINIMUM_AGE,
  KYC_REAPPLICABLE_STATUSES,
  KYC_REQUIRED_DOCUMENT_KINDS,
  KYC_RESIDENCY_STATUSES,
  KYC_STATUSES,
  KYC_APPLICANT_VISIBLE_NOTE_ACTIONS,
  ageInYears,
  capabilityForAccountType,
  isApplicantVisibleNote,
  isOldEnoughToApply,
  kycDocumentKindLabelKey,
  kycIdTypeLabelKey,
  kycStatusLabelKey,
  missingRequiredDocuments,
} from "./kyc";

/**
 * Guards the KYC model against drifting from the database, and asserts the
 * phase's central rule.
 *
 * The mirror values are read from the migration text, as the other mirror tests
 * do, so this needs no database. The rule — "a user-selected account type must
 * never grant posting permissions" — is asserted twice: structurally, that no
 * policy in the schema reads the declaration column; and by the migration's own
 * self-check, which is what actually runs on a real database.
 */

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

function allMigrationSql(): string {
  return readdirSync(MIGRATIONS_DIR)
    .sort()
    .map((file) => readFileSync(join(MIGRATIONS_DIR, file), "utf8"))
    .join("\n");
}

function stripSqlComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, "");
}

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

const kycMigration = stripSqlComments(
  readFileSync(
    join(MIGRATIONS_DIR, "20260101000060_kyc_verification.sql"),
    "utf8",
  ),
);

const signupMigration = stripSqlComments(
  readFileSync(
    join(MIGRATIONS_DIR, "20260101000061_signup_account_type.sql"),
    "utf8",
  ),
);

describe("KYC mirrors match the migration", () => {
  it("kyc_membership_type", () => {
    expect([...KYC_MEMBERSHIP_TYPES]).toEqual(
      enumMembers(kycMigration, "kyc_membership_type"),
    );
  });

  it("kyc_status", () => {
    expect([...KYC_STATUSES]).toEqual(
      enumMembers(kycMigration, "kyc_status"),
    );
  });

  it("kyc_id_type", () => {
    expect([...KYC_ID_TYPES]).toEqual(enumMembers(kycMigration, "kyc_id_type"));
  });

  it("kyc_document_kind", () => {
    expect([...KYC_DOCUMENT_KINDS]).toEqual(
      enumMembers(kycMigration, "kyc_document_kind"),
    );
  });

  it("account_type", () => {
    expect([...ACCOUNT_TYPES]).toEqual(
      enumMembers(signupMigration, "account_type"),
    );
  });

  it("residency_status is a CHECK, not an enum, and the mirror names its members", () => {
    // The column is `text` with a CHECK; the mirror exists so a form can offer
    // the values. Each mirrored member must appear in the constraint.
    const constraint = kycMigration.match(
      /kyc_residency_status_valid check \(([\s\S]*?)\)/,
    );
    expect(constraint).not.toBeNull();
    for (const status of KYC_RESIDENCY_STATUSES) {
      expect(constraint![1]).toContain(`'${status}'`);
    }
  });
});

describe("the account-type declaration is never a capability", () => {
  const sql = stripSqlComments(allMigrationSql());

  it("no RLS policy reads declared_account_type", () => {
    // Every `create policy … using/with check ( … )` body in the schema. If any
    // read the declaration column, the declaration would be a permission — the
    // exact thing the brief forbids.
    const policies = [...sql.matchAll(/create policy[\s\S]*?;/gi)].map(
      (match) => match[0],
    );
    expect(policies.length).toBeGreaterThan(0);
    for (const policy of policies) {
      expect(policy).not.toContain("declared_account_type");
    }
  });

  it("declaring landlord or agent maps to an application, not an approval", () => {
    expect(capabilityForAccountType("landlord")).toBe("landlord");
    expect(capabilityForAccountType("agent")).toBe("agent");
    // A buyer has no capability to apply for.
    expect(capabilityForAccountType("buyer")).toBeNull();
  });

  it("the signup migration asserts a declaration grants no capability", () => {
    // The migration's own self-check must call `user_has_membership` and require
    // it to be false after a signup that declared `landlord`.
    expect(signupMigration).toContain("user_has_membership");
    expect(signupMigration).toContain("granted a landlord capability");
  });
});

describe("the approval function is the only capability writer", () => {
  it("is security definer with a pinned search_path", () => {
    const fn = kycMigration.match(
      /create or replace function public\.approve_kyc_application[\s\S]*?as \$\$/,
    );
    expect(fn).not.toBeNull();
    expect(fn![0]).toContain("security definer");
    expect(fn![0]).toContain("set search_path");
  });

  it("guards on is_super_admin, not is_real_estate_admin", () => {
    const fn = kycMigration.match(
      /create or replace function public\.approve_kyc_application[\s\S]*?end;\s*\$\$/,
    );
    expect(fn).not.toBeNull();
    expect(fn![0]).toContain("is_super_admin()");
    // A plain real-estate administrator must not reach the decision.
    expect(fn![0]).not.toContain("is_real_estate_admin()");
  });

  it("is not granted to a browser key", () => {
    // Supabase grants EXECUTE to anon/authenticated by default; the migration must
    // revoke from both and re-grant only the service role.
    expect(kycMigration).toContain(
      "revoke all on function public.approve_kyc_application(uuid, uuid, text) from anon, authenticated",
    );
    expect(kycMigration).toContain(
      "grant execute on function public.approve_kyc_application(uuid, uuid, text) to service_role",
    );
  });
});

describe("the applicant may only set the states they may answer", () => {
  it("resubmittable statuses exclude approved", () => {
    expect(KYC_REAPPLICABLE_STATUSES).not.toContain("approved");
    expect([...KYC_REAPPLICABLE_STATUSES]).toEqual([
      "submitted",
      "rejected",
      "changes_requested",
    ]);
  });

  it("a decision maps to a decided status", () => {
    expect(KYC_DECISION_STATUS.approve).toBe("approved");
    expect(KYC_DECISION_STATUS.reject).toBe("rejected");
    expect(KYC_DECISION_STATUS.request_changes).toBe("changes_requested");
  });
});

describe("age gate", () => {
  const reference = new Date("2026-06-15T00:00:00Z");

  it("computes whole years", () => {
    expect(ageInYears("2000-06-15", reference)).toBe(26);
    expect(ageInYears("2000-06-16", reference)).toBe(25);
  });

  it("refuses an applicant one day short of 18", () => {
    expect(isOldEnoughToApply("2008-06-16", reference)).toBe(false);
    expect(isOldEnoughToApply("2008-06-15", reference)).toBe(true);
  });

  it("uses the documented minimum", () => {
    expect(KYC_MINIMUM_AGE).toBe(18);
  });
});

describe("required documents", () => {
  it("requires an identity document and a face video", () => {
    expect([...KYC_REQUIRED_DOCUMENT_KINDS]).toEqual([
      "id_front",
      "face_video",
    ]);
  });

  it("reports what is missing", () => {
    expect(missingRequiredDocuments([])).toEqual(["id_front", "face_video"]);
    expect(missingRequiredDocuments(["id_front"])).toEqual(["face_video"]);
    expect(missingRequiredDocuments(["id_front", "face_video"])).toEqual([]);
    // A back-of-document image does not satisfy the front requirement.
    expect(missingRequiredDocuments(["id_back", "face_video"])).toEqual([
      "id_front",
    ]);
  });
});

describe("the applicant history hides internal notes", () => {
  it("shows the note only for a refusal or a request for changes", () => {
    // The approval's note is documented as internal, so it must not reach the
    // applicant's history; a refusal's and a request-for-changes note must.
    expect(isApplicantVisibleNote("rejected")).toBe(true);
    expect(isApplicantVisibleNote("changes_requested")).toBe(true);
    expect(isApplicantVisibleNote("approved")).toBe(false);
    expect(isApplicantVisibleNote("note_added")).toBe(false);
    expect(isApplicantVisibleNote("submitted")).toBe(false);
    expect(isApplicantVisibleNote("document_viewed")).toBe(false);
  });

  it("keeps the visible set minimal and explicit", () => {
    expect([...KYC_APPLICANT_VISIBLE_NOTE_ACTIONS]).toEqual([
      "rejected",
      "changes_requested",
    ]);
  });
});

describe("label keys", () => {
  it("are namespaced under account.kyc", () => {
    expect(kycStatusLabelKey("approved")).toBe("account.kyc.status.approved");
    expect(kycIdTypeLabelKey("international_passport")).toBe(
      "account.kyc.idType.international_passport",
    );
    expect(kycDocumentKindLabelKey("face_video")).toBe(
      "account.kyc.documentKind.face_video",
    );
  });
});
