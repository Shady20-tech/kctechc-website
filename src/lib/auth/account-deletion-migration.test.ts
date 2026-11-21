import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Guards the account-deletion boundary without a database.
 *
 * The behavioural proof is `supabase/validate/150_account_deletion_behaviour.sql`,
 * which runs against a freshly migrated database. These assertions are the
 * cheaper complement: they pin the *shape* of the migration so a later edit
 * cannot quietly remove the boundary — the super-admin guard, the last-super-admin
 * guard, the archive-before-delete ordering, or the EXECUTE revoke.
 *
 * Each of those is the kind of control that stays invisible to TypeScript: it
 * lives in SQL, so only a test that reads the SQL catches its removal.
 */

const MIGRATION = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260101000073_account_deletion.sql",
);

const sql = readFileSync(MIGRATION, "utf8");

/** The body of the migration's one function, from its header to its terminator. */
function functionBody(): string {
  const start = sql.indexOf("function public.detach_and_archive_user_content(");
  expect(start, "the cleanup function is not defined").toBeGreaterThan(-1);
  const end = sql.indexOf("$$;", start);
  return sql.slice(start, end);
}

describe("account deletion migration", () => {
  it("refuses a browser caller that is not a super administrator", () => {
    const body = functionBody();
    // The trusted-context escape hatch and the refusal must both be present: the
    // `auth.uid() is null` half is what lets the service role, a migration and
    // the harness run, and the `is_super_admin()` half is the control.
    expect(body).toContain("auth.uid() is not null");
    expect(body).toContain("not public.is_super_admin()");
    expect(body).toContain("insufficient_privilege");
  });

  it("refuses to delete the last active super administrator", () => {
    const body = functionBody();
    // Counting *active* admins matters: an inactive one cannot sign in to
    // restore the role, so counting them would let the guard be defeated.
    expect(body).toContain("p.role = 'super_admin' and p.is_active");
    expect(body).toContain("last super administrator cannot be deleted");
  });

  it("archives only the listings the account owns", () => {
    const body = functionBody();
    expect(body).toContain("where owner_id = p_user_id");
    // A manager's listing belongs to a different account and must not be
    // archived by deleting the manager.
    expect(body).not.toContain("managed_by = p_user_id");
  });

  it("steps a pending submission back to draft before archiving it", () => {
    const body = functionBody();
    // `pending_review -> archived` is not a legal transition, so the archive
    // would be refused by enforce_listing_lifecycle without this step.
    expect(body).toContain("v_listing.status = 'pending_review'");
    expect(body).toContain("set status = 'draft'");
    expect(body).toContain("set status = 'archived'");
  });

  it("removes the account's agent profile", () => {
    // `agent_profiles.user_id` is `on delete set null`, so the row would survive
    // the account as a ghost the public agent policy still exposes.
    expect(functionBody()).toContain(
      "delete from public.agent_profiles where user_id = p_user_id",
    );
  });

  it("captures storage paths before the rows are deleted", () => {
    const body = functionBody();
    // Both buckets must be reported, and both reads must happen inside this
    // function: after the auth user is gone the KYC rows cascade away and the
    // paths cannot be recovered.
    expect(body).toContain("p.avatar_path");
    expect(body).toContain("public.real_estate_kyc_documents");
    expect(body).toContain("'kyc-documents'::text");
  });

  it("is service-role only, never browser-executable", () => {
    // Supabase grants EXECUTE to anon/authenticated on every new function by
    // default, so the revoke must be in the same migration that creates it.
    expect(sql).toMatch(
      /revoke all on function public\.detach_and_archive_user_content\(uuid\)\s+from public, anon, authenticated;/,
    );
    expect(sql).toMatch(
      /grant execute on function public\.detach_and_archive_user_content\(uuid\)\s+to service_role;/,
    );
  });

  it("never deletes the auth user itself, which is the Admin API's job", () => {
    // The `auth` schema is not ours to write; `auth.admin.deleteUser` is the
    // supported path and the Server Action calls it. A migration that deleted
    // from auth.users would be reaching outside its schema.
    expect(sql).not.toMatch(/delete\s+from\s+auth\.users/i);
  });
});

describe("account deletion is not a soft delete", () => {
  it("does not introduce a deleted_at column that would leave the account live", () => {
    // The requirement is that the account is removed from the database. A
    // soft-delete column would leave the auth user able to sign in.
    expect(sql).not.toContain("deleted_at");
  });
});
