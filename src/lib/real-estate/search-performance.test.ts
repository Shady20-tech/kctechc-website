import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Search performance invariants.
 *
 * These are the two Phase 8 fixes that no runtime test can see, because both live
 * in SQL and in the shape of a loader:
 *
 *   - the translation overlay must only be built when a keyword is present, or
 *     every browse pays a full grouped scan of `content_translations`;
 *   - the region index must count in the database, never by reading the whole
 *     portfolio into Node (which also truncates silently past PostgREST's row
 *     cap).
 *
 * They are asserted against the migration text and the loader source, so a later
 * edit that quietly reverts either one fails here.
 */

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

function readMigration(nameFragment: string): string {
  const file = readdirSync(MIGRATIONS_DIR).find((f) =>
    f.includes(nameFragment),
  );
  if (!file) throw new Error(`No migration matching "${nameFragment}"`);
  return readFileSync(join(MIGRATIONS_DIR, file), "utf8");
}

const SEARCH_FN = "public.search_property_listings";

describe("search performance migration", () => {
  const migration = readMigration("search_performance");

  it("gates the translation overlay on a keyword search", () => {
    // The overlay CTE must depend on `params` and short-circuit when there is no
    // query term. Without both, the planner builds it for every search.
    expect(migration).toContain("cross join params");
    expect(migration).toContain("params.q is not null");

    // The gate must sit inside the `localized` CTE, not somewhere else.
    const localizedStart = migration.indexOf("localized as (");
    const matchedStart = migration.indexOf("matched as (");
    expect(localizedStart).toBeGreaterThan(-1);
    expect(matchedStart).toBeGreaterThan(localizedStart);
    const overlay = migration.slice(localizedStart, matchedStart);
    expect(overlay).toContain("cross join params");
    expect(overlay).toContain("params.q is not null");
  });

  it("replaces the existing function rather than declaring a new signature", () => {
    // `create or replace` keeps the Phase 12 ACL. A `drop` + `create` would drop
    // the browser grant with it, and the search page would stop working.
    expect(migration).toContain(`create or replace function ${SEARCH_FN}(`);
    expect(migration).not.toContain(`drop function ${SEARCH_FN}`);
  });

  it("keeps the currency-scoped price sort from migration 69", () => {
    // The performance rewrite re-emits the whole function; losing the currency
    // grouping here would silently restore the cross-currency price sort.
    expect(migration).toContain("then v.currency end asc");
  });

  it("adds a covering index for the overlay read", () => {
    expect(migration).toContain("content_translations_localized_idx");
    const idx = migration.slice(
      migration.indexOf("create index if not exists content_translations_localized_idx"),
    );
    expect(idx).toContain("(entity_type, locale, field_name)");
    expect(idx).toContain("include (entity_id, value)");
  });

  it("does not add indexes that the planner proved useless", () => {
    // Each of these was created and measured against the real function on a
    // skewed 6k-listing portfolio and changed nothing. Asserting their absence
    // keeps a future "just add more indexes" change from re-adding write cost.
    for (const name of [
      "property_listings_division_filter_idx",
      "property_listings_subdivision_filter_idx",
      "property_listings_currency_price_idx",
      "property_listings_view_count_idx",
    ]) {
      expect(migration, `${name} should not be added`).not.toContain(name);
    }
  });
});

describe("region index loader", () => {
  const source = readFileSync(
    join(process.cwd(), "src", "lib", "real-estate", "loaders.ts"),
    "utf8",
  );

  function loaderBody(): string {
    const start = source.indexOf("export async function loadListingRegionOptions(");
    expect(start).toBeGreaterThan(-1);
    const end = source.indexOf("\n}", start);
    return source.slice(start, end);
  }

  it("does not read the listing table to count regions", () => {
    // The bug: selecting every published listing and tallying in JS. It reads the
    // whole portfolio on each render and truncates past the PostgREST row cap.
    const body = loaderBody();
    expect(body).not.toContain('from("property_listings")');
  });

  it("counts through the shared geography-count RPC", () => {
    expect(loaderBody()).toContain("loadListingGeographyCounts()");
  });
});
