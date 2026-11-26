import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { isSuperAdminRole } from "@/lib/auth/roles";

/**
 * Guards the Phase 7 administrative deletion boundary.
 *
 * The defect this closes was that every content table carried a `for all` write
 * policy, and `for all` includes DELETE — so a department editor could hard-delete
 * a listing and cascade away its media, translation rows and analytics with no
 * record of the removal. The fix is a BEFORE DELETE trigger plus a super-admin-only
 * RPC. That lives in the database, so the behavioural proof is
 * `supabase/validate/110_admin_deletion_behaviour.sql`; these assertions are the
 * database-free complement that pins the *shape* of the fix so a later edit cannot
 * quietly remove it.
 *
 * The migration is read as text, as the repo's other mirror tests do.
 */

const MIGRATION = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260101000067_admin_content_lifecycle_and_deletion.sql",
);

const sql = readFileSync(MIGRATION, "utf8");

/** The body of a `create or replace function` by name. */
function functionBody(source: string, name: string): string {
  const start = source.indexOf(`function public.${name}(`);
  expect(start, `${name} is not defined in the migration`).toBeGreaterThan(-1);
  const end = source.indexOf("$$;", start);
  return source.slice(start, end);
}

describe("admin content lifecycle migration", () => {
  it("adds a reason column to the audit trail", () => {
    expect(sql).toContain("alter table public.audit_logs");
    expect(sql).toContain("add column if not exists reason text");
  });

  it("refuses an unsanctioned hard delete on every content table", () => {
    const body = functionBody(sql, "forbid_unsanctioned_delete");

    // Super admin and trusted context are the two admitted callers; everything
    // else raises.
    expect(body).toContain("auth.uid() is null or public.is_super_admin()");
    expect(body).toContain("insufficient_privilege");

    for (const table of [
      "property_listings",
      "products",
      "electrical_projects",
      "insights",
    ]) {
      expect(sql).toContain(
        `create trigger ${table}_forbid_delete\n  before delete on public.${table}`,
      );
    }
  });

  it("records a permanent deletion with the prior state", () => {
    const body = functionBody(sql, "audit_listing_deletion");
    expect(body).toContain("'property_deleted'");
    expect(body).toContain("'fromStatus', old.status::text");
  });

  it("archives with a required reason and an admin guard", () => {
    const body = functionBody(sql, "archive_listing");
    expect(body).toContain("is_real_estate_admin()");
    expect(body).toContain("requires a reason");
    expect(body).toContain("set_config('kc.audit_reason'");
  });

  it("gates permanent deletion on the super admin and on retention", () => {
    const body = functionBody(sql, "delete_listing_permanently");

    expect(body).toContain("is_super_admin()");
    expect(body).toContain("at least 10 characters");

    // Every retention source the gate consults.
    for (const table of [
      "listing_events",
      "listing_submissions",
      "listing_owner_authorizations",
      "listing_legal_documents",
    ]) {
      expect(body).toContain(`from public.${table}`);
    }

    // The FK-less translation and SEO rows are cleared explicitly.
    expect(body).toContain("delete from public.translation_entries");
    expect(body).toContain("delete from public.content_translations");
    expect(body).toContain("delete from public.entity_seo");
  });

  it("classifies the new functions for the EXECUTE surface", () => {
    // A new function keeps Supabase's browser grant unless it is revoked in the
    // same migration; the two RPCs are then re-granted to authenticated only.
    expect(sql).toContain(
      "revoke all on function public.archive_listing(uuid, text) from public, anon, authenticated",
    );
    expect(sql).toContain(
      "grant execute on function public.archive_listing(uuid, text) to authenticated, service_role",
    );
    expect(sql).toContain(
      "grant execute on function public.delete_listing_permanently(uuid, text) to authenticated, service_role",
    );
  });
});

describe("isSuperAdminRole", () => {
  it("admits only super_admin", () => {
    expect(isSuperAdminRole("super_admin")).toBe(true);
    for (const role of [
      "real_estate_admin",
      "real_estate_agent",
      "department_staff",
      "digital_marketing_admin",
      "customer",
      "visitor",
    ] as const) {
      expect(isSuperAdminRole(role)).toBe(false);
    }
  });
});

describe("EXECUTE hardening allow-list", () => {
  it("lists the new RPCs so the subset assertion passes", () => {
    const allowList = readFileSync(
      join(
        process.cwd(),
        "supabase",
        "validate",
        "30_function_execute_hardening.sql",
      ),
      "utf8",
    );
    expect(allowList).toContain(
      "'archive_listing', 'delete_listing_permanently'",
    );
    // Migration 68 grants `authenticated` EXECUTE on this one, so omitting it
    // from the subset allow-list makes the harness fail on a fresh database.
    expect(allowList).toContain("'delete_content_permanently'");
  });
});

describe("department-scoped content deletion", () => {
  const migration = readFileSync(
    join(
      process.cwd(),
      "supabase",
      "migrations",
      "20260101000084_department_content_deletion.sql",
    ),
    "utf8",
  );

  it("lets the owning department editor delete authored content", () => {
    const body = functionBody(migration, "delete_content_permanently");
    expect(body).toContain("public.is_department_editor");
    expect(body).toContain("product_categories");
    expect(body).toContain("electrical_projects");
    expect(body).toContain("insights");
  });

  it("keeps a direct DELETE closed to a department editor", () => {
    const body = functionBody(migration, "forbid_unsanctioned_delete");
    expect(body).toContain("current_setting('kc.content_deletion', true)");
    expect(body).toContain("public.is_department_editor");
  });

  it("marks the RPC transaction before its own delete", () => {
    const body = functionBody(migration, "delete_content_permanently");
    expect(body).toContain("set_config('kc.content_deletion', 'on', true)");
    expect(body).toContain("set_config('kc.audit_reason'");
  });

  it.each([
    [
      "store/admin-actions.ts",
      "deleteProductAction",
      'redirect("/admin/store")',
    ],
    [
      "content/project-admin-actions.ts",
      "deleteProjectAction",
      'redirect("/admin/work")',
    ],
    [
      "content/admin-actions.ts",
      "deleteInsightAction",
      'redirect("/admin/content")',
    ],
  ])(
    "lets a department editor delete through %s and returns to the list",
    (file, action, redirectCall) => {
      const source = readFileSync(
        join(process.cwd(), "src", "lib", file),
        "utf8",
      );
      const start = source.indexOf(`export async function ${action}(`);
      expect(start, `${action} is missing`).toBeGreaterThan(-1);
      const body = source.slice(start, source.indexOf("\n}", start));
      expect(body).toContain("isDepartmentEditorRole");
      expect(body).toContain(redirectCall);
    },
  );
});

describe("existing listing CRUD is preserved", () => {
  const actions = readFileSync(
    join(process.cwd(), "src", "lib", "real-estate", "admin-actions.ts"),
    "utf8",
  );

  it("keeps updateListingAction", () => {
    expect(actions).toContain("export async function updateListingAction(");
  });

  it("adds the archive and delete actions", () => {
    expect(actions).toContain("export async function archiveListingAction(");
    expect(actions).toContain("export async function deleteListingAction(");
  });

  it("gates the delete action on the super admin before any write", () => {
    const start = actions.indexOf("export async function deleteListingAction(");
    const body = actions.slice(start, actions.indexOf("\n}", start));
    expect(body).toContain("isSuperAdminRole");
    expect(body).toContain('"forbidden"');
  });
});

/**
 * The permanent-deletion RPCs authorize inside the database with
 * `is_super_admin()`, which reads `auth.uid()`. That only resolves for a call
 * carrying the caller's JWT, so the RPC must go through the cookie-bound session
 * client. A service-role call carries no JWT subject and the guard would refuse
 * every deletion — a defect no type check or unit test can see, because the
 * Supabase client type is identical for both.
 */
describe("permanent deletion calls the session client, not the service-role one", () => {
  function rpcCallerClient(source: string, actionName: string): string {
    const start = source.indexOf(`export async function ${actionName}(`);
    expect(start, `${actionName} is not defined`).toBeGreaterThan(-1);
    const body = source.slice(start, source.indexOf("\n}", start));
    const rpc = body.indexOf('.rpc("delete_content_permanently"');
    expect(rpc, `${actionName} does not call the deletion RPC`).toBeGreaterThan(
      -1,
    );
    // The client variable is the one the RPC is invoked on, read back from the
    // statement that opens the call.
    const before = body.slice(0, rpc);
    const last = before.lastIndexOf("await ");
    return (
      before
        .slice(last + "await ".length)
        .trim()
        .split(/[.;\s]/)[0] ?? ""
    );
  }

  it("uses the session client in deleteProductAction", () => {
    const source = readFileSync(
      join(process.cwd(), "src", "lib", "store", "admin-actions.ts"),
      "utf8",
    );
    expect(rpcCallerClient(source, "deleteProductAction")).toBe("supabase");
    const start = source.indexOf("export async function deleteProductAction(");
    const body = source.slice(start, source.indexOf("\n}", start));
    expect(body).toContain("await createClient()");
  });

  it("uses the session client in deleteInsightAction", () => {
    const source = readFileSync(
      join(process.cwd(), "src", "lib", "content", "admin-actions.ts"),
      "utf8",
    );
    expect(rpcCallerClient(source, "deleteInsightAction")).toBe("session");
    const start = source.indexOf("export async function deleteInsightAction(");
    const body = source.slice(start, source.indexOf("\n}", start));
    expect(body).toContain('await import("@/lib/supabase/server")');
  });

  it("uses the session client in deleteProjectAction", () => {
    const source = readFileSync(
      join(process.cwd(), "src", "lib", "content", "project-admin-actions.ts"),
      "utf8",
    );
    expect(rpcCallerClient(source, "deleteProjectAction")).toBe("supabase");
    const start = source.indexOf("export async function deleteProjectAction(");
    const body = source.slice(start, source.indexOf("\n}", start));
    expect(body).toContain("await createClient()");
  });
});
