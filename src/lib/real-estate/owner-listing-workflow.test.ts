import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Guards the owner-listing review gate against being re-opened.
 *
 * The hole this migration closed was not a missing policy — it was a *default*.
 * `listing_source` defaults to `admin`, and the lifecycle trigger's review gate
 * keyed only on `source = 'owner_submission'`, so an approved landlord who named
 * no source got a listing the gate did not cover and could publish it directly.
 *
 * That defect was invisible to every application test: it lived in the interaction
 * between a column default, an RLS policy and a trigger, and only a real database
 * could reproduce it. The `do $$` block at the foot of the migration is the
 * behavioural proof, and it runs on every migration application. These assertions
 * are the cheaper, database-free complement: they pin the *shape* of the fix so a
 * later edit cannot quietly remove it — a redefinition of the trigger function
 * that drops the pin, or a fixture that stops naming an administrator.
 *
 * The migration is read as text, as the other mirror tests do, so this needs no
 * database.
 */

const MIGRATION = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260101000062_owner_listing_workflow.sql",
);

const sql = readFileSync(MIGRATION, "utf8");

/** The body of a `create or replace function` by name. */
function functionBody(source: string, name: string): string {
  const start = source.indexOf(`function public.${name}(`);
  expect(start, `${name} is not defined in the migration`).toBeGreaterThan(-1);
  const end = source.indexOf("$$;", start);
  return source.slice(start, end);
}

describe("owner listing workflow migration", () => {
  it("pins a non-administrator listing to the reviewed source", () => {
    const body = functionBody(sql, "enforce_listing_lifecycle");

    // The pin on insert: a landlord's row is born `owner_submission`.
    expect(body).toContain("new.source := 'owner_submission'");

    // The anti-stripping check on update.
    expect(body).toContain("new.source <> old.source");
    expect(body).toContain(
      "Only a real-estate administrator may set a listing source",
    );
  });

  it("keeps the approval gate for an owner submission", () => {
    const body = functionBody(sql, "enforce_listing_lifecycle");

    // The gate must still consult an approved submission row.
    expect(body).toContain("s.status = 'approved'");
    expect(body).toContain("s.reviewed_at is not null");
    expect(body).toContain(
      "cannot be published until an administrator has approved it",
    );
  });

  it("fires the trigger on a source change, not only on status", () => {
    // Without `source` in the trigger's column list, the anti-stripping check
    // would never run and a landlord could rewrite the source to `admin`.
    expect(sql).toMatch(
      /create trigger property_listings_enforce_lifecycle[\s\S]*?before insert or update of status, source on public\.property_listings/,
    );
  });

  it("trusts a session with no identity, as the codebase convention requires", () => {
    const body = functionBody(sql, "enforce_listing_lifecycle");

    // `auth.uid() is null` is the trusted-context case (service role, psql,
    // migration, harness) that `forbid_self_role_change` also uses. Without it a
    // migration or a harness that inserts a listing would be treated as an
    // untrusted browser session.
    expect(body).toContain("auth.uid() is null");
    expect(body).toContain("is_real_estate_admin()");
  });

  it("gives the owner the policies the dashboard needs", () => {
    // The three writes a landlord's dashboard performs, each of which was
    // admin- or agent-only before this migration.
    expect(sql).toContain(
      'create policy "listing_submissions_select_own_owner"',
    );
    expect(sql).toContain(
      'create policy "listing_submissions_insert_own_owner"',
    );
    expect(sql).toContain('create policy "listing_media_write_own_owner"');
  });

  it("reclassifies the redefined functions' EXECUTE grant", () => {
    // Supabase re-grants EXECUTE on `create or replace`, so a function redefined
    // in a later migration must be revoked again in the same migration.
    expect(sql).toContain(
      "revoke all on function public.enforce_listing_lifecycle() from anon, authenticated",
    );
    expect(sql).toContain(
      "revoke all on function public.enforce_listing_ownership() from anon, authenticated",
    );
  });

  it("proves the boundary behaviourally, as a real administrator", () => {
    // The fixture must promote the admin *after* `handle_new_user` has run, or the
    // assertion passes for the wrong reason: the admin would still be a customer
    // and case (d) would not test an administrator's write at all.
    expect(sql).toContain(
      "update public.profiles set role = 'real_estate_admin'",
    );
    expect(sql).toContain(
      "Phase 3 FAILED: a landlord published a listing without a review",
    );
    expect(sql).toContain(
      "Phase 3 FAILED: a landlord rewrote a listing source to admin",
    );
  });

  it("cleans up the translation rows the fixture inserts created", () => {
    // Inserting a listing fires `sync_listing_translation_index`, which writes
    // `translation_entries` / `content_translations` / `translation_sync_jobs`.
    // Those carry no foreign key to `property_listings`, so deleting the fixture
    // listings leaves them behind as orphans unless the block removes them too —
    // a durable queue of sync work for a listing that does not exist. Reproduced
    // on a fresh database: without this the block stranded 9 entries, 18
    // translations and 9 jobs per application.
    expect(sql).toContain("delete from public.translation_entries");
    expect(sql).toContain("delete from public.content_translations");

    // The deletes must run while the fixture listings still exist, or the
    // `entity_id in (select id … where slug in (…))` subquery matches nothing.
    const cleanup = sql.indexOf("delete from public.translation_entries");
    const listingDelete = sql.indexOf(
      "delete from public.property_listings where slug in ('phase3-owner-listing'",
    );
    expect(cleanup).toBeGreaterThan(-1);
    expect(listingDelete).toBeGreaterThan(-1);
    expect(cleanup).toBeLessThan(listingDelete);
  });
});
