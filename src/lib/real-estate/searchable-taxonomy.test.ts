import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Keyword search must reach a listing's *category*, not only its prose.
 *
 * The defect these pin: a visitor typed "land" into the marketplace search and
 * was told "No properties match your filters", while browsing listed land. The
 * listings existed; `search_vector` was generated from title, description,
 * locality and highlights only, so `property_kind = 'land'` was in no search path
 * at all. A listing titled "Titled plot in Buea" was unreachable by "land".
 *
 * These assertions read the migration text, because the behaviour lives in SQL
 * and no Vitest test can execute it without a database. They are deliberately
 * structural: each one names a property that, if removed, makes the bug return.
 */

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

function readMigration(nameFragment: string): string {
  const file = readdirSync(MIGRATIONS_DIR).find((f) => f.includes(nameFragment));
  if (!file) throw new Error(`No migration matching "${nameFragment}"`);
  return readFileSync(join(MIGRATIONS_DIR, file), "utf8");
}

/** The migration that owns the searchable-taxonomy fix. */
const migration = readMigration("searchable_taxonomy");

describe("searchable taxonomy", () => {
  it("puts every taxonomy column into the generated search vector", () => {
    // The root cause. If any of these three is missing, that category is again
    // unfilterable by keyword and the reported bug returns for it.
    const vectorStart = migration.indexOf("add column search_vector tsvector");
    expect(vectorStart).toBeGreaterThan(-1);
    const vector = migration.slice(vectorStart, migration.indexOf(") stored;"));

    expect(vector).toContain("replace(property_kind::text, '_', ' ')");
    expect(vector).toContain("replace(listing_type::text, '_', ' ')");
    expect(vector).toContain("replace(property_type::text, '_', ' ')");

    // The prose fields must still be there; the change is additive.
    expect(vector).toContain("coalesce(title, '')");
    expect(vector).toContain("coalesce(description, '')");
    expect(vector).toContain("coalesce(locality, '')");
    expect(vector).toContain("immutable_array_to_string(highlights)");
  });

  it("turns an underscored enum value into the phrase a person types", () => {
    // `short_term` in the vector would never match the query "short term", which
    // is the whole point of including the taxonomy.
    expect(migration).toContain("replace(property_kind::text, '_', ' ')");
    expect(migration).toContain("replace(listing_type::text, '_', ' ')");
  });

  it("recreates the vector index that dropping the column takes with it", () => {
    // `drop column` cascades to `property_listings_search_idx`. Without the
    // recreate, keyword search loses its index and every search is a scan.
    expect(migration).toContain("drop column if exists search_vector");
    expect(migration).toContain(
      "create index if not exists property_listings_search_idx",
    );
    expect(migration).toContain("using gin (search_vector)");
  });

  it("adds the synonym arm to both the predicate and the rank", () => {
    // A synonym that filters but does not rank sorts below everything, which
    // reads as "irrelevant" for an exact category match.
    expect(migration).toContain("or p.property_kind::text = (select syn_kind from params)");
    expect(migration).toContain(
      "or p.listing_type::text = (select syn_listing_type from params)",
    );
    expect(migration).toContain("when p.property_kind::text = (select syn_kind from params)");
  });

  it("maps the words a visitor actually types to real enum values", () => {
    // "land" is the reported case. The French equivalents matter because the
    // site serves /fr and `property_kind` has no translation overlay to search.
    for (const term of ["'land'", "'plot'", "'parcel'", "'terrain'", "'parcelle'"]) {
      expect(migration).toContain(term);
    }
    // The listing-type words, which describe the offer rather than the building.
    for (const term of ["'sale'", "'rent'", "'vente'", "'louer'"]) {
      expect(migration).toContain(term);
    }
  });

  it("keeps the keyword predicate a plain single-table comparison", () => {
    // Migration 77 measured a `cross join params` in the keyword predicate at
    // 470ms vs 30ms, because it turns the OR into an un-indexable Join Filter.
    // The synonyms are scalars on `params` for exactly this reason.
    const keywordBranch = migration.slice(
      migration.indexOf("when v_has_query then $q$"),
      migration.indexOf("    else $q$"),
    );
    expect(keywordBranch).not.toContain("cross join vocab");
    expect(keywordBranch).not.toContain("from vocab v\n    where");
    expect(keywordBranch).toContain("(select syn_kind from params)");
  });

  it("makes a place name typed into the keyword box find its listings", () => {
    // "Southwest", "Fako" and "Limbe" are region, division and subdivision
    // names. None is a listing column, so a keyword search could not reach them
    // unless the advert happened to repeat the name in its locality text.
    for (const col of ["geo_region_id", "geo_division_id", "geo_subdivision_id"]) {
      expect(migration).toContain(`as ${col}`);
    }
    // Resolved once per call into ids, so the predicate is an indexable equality
    // rather than a correlated name lookup per row.
    expect(migration).toContain("or p.region_id = (select geo_region_id from params)");
    expect(migration).toContain("or p.division_id = (select geo_division_id from params)");
    expect(migration).toContain(
      "or p.subdivision_id = (select geo_subdivision_id from params)",
    );
    // And it must rank, or an exact place match sorts below a fuzzy prose hit.
    expect(migration).toContain(
      "when p.region_id = (select geo_region_id from params)\n            or p.division_id",
    );
  });

  it("only names enum values the database actually defines", () => {
    // A synonym pointing at a value the enum does not have would filter to zero
    // rows for every visitor and look like an empty market, not a bug.
    const kinds = new Set([
      "house", "apartment", "villa", "duplex", "studio", "bungalow", "land",
      "farm", "office", "shop", "warehouse", "hotel", "guesthouse",
      "restaurant", "mixed_use", "other",
    ]);
    const listingTypes = new Set(["sale", "rent", "lease", "short_term"]);

    const vocab = migration.slice(
      migration.indexOf("select * from (values"),
      migration.indexOf(") as v(kind, listing_type, term)"),
    );
    const rows = [
      ...vocab.matchAll(/\(\s*('([a-z_]+)'|null)\s*,\s*('([a-z_]+)'|null)\s*,\s*'([^']+)'\s*\)/g),
    ];
    expect(rows.length).toBeGreaterThan(30);

    for (const row of rows) {
      const kind = row[2];
      const listingType = row[4];
      if (kind !== undefined) expect(kinds).toContain(kind);
      if (listingType !== undefined) expect(listingTypes).toContain(listingType);
      // A row with neither would match nothing and is dead vocabulary.
      expect(kind ?? listingType).toBeDefined();
    }
  });

  it("matches the whole phrase, so 'island' does not select land", () => {
    // The comparison must be equality against the trimmed, lower-cased query.
    // A substring match would make every search containing a category word as a
    // substring return that whole category.
    const predicate = migration.slice(
      migration.indexOf("select v.kind from vocab v"),
    );
    expect(predicate.slice(0, 300)).toContain("v.term = lower(btrim($1))");
  });

  it("replaces the function instead of dropping it", () => {
    // `drop function` would take the Phase 12 browser grant with it and the
    // listings page would stop working for every visitor.
    expect(migration).toContain(
      "create or replace function public.search_property_listings(",
    );
    // An actual statement, not the word: the migration's own comment explains
    // why it is not used, and a plain substring check would fail on that.
    const statements = migration.replace(/--[^\n]*/g, "");
    expect(statements).not.toMatch(/\bdrop\s+function\b/i);
    // The grant is restated, which is what documents that it survives.
    expect(migration).toContain("to anon, authenticated");
  });

  it("keeps the currency-scoped price sort and the visibility predicate", () => {
    // Both are earlier, separately-tested fixes that a rewrite could silently
    // undo. The price sort groups by currency so two currencies are never
    // compared; the visibility set is the security control.
    expect(migration).toContain("order by v.currency asc");
    expect(migration).toContain(
      "array['published', 'under_offer', 'sold', 'rented']::public.listing_status[]",
    );
  });

  it("does not widen the visibility set when a keyword is present", () => {
    // The keyword branch must carry the same status predicate as the browse
    // branch. A search that returned drafts would be a data leak, and it would
    // look like a search improvement.
    const keywordBranch = migration.slice(
      migration.indexOf("when v_has_query then $q$"),
      migration.indexOf("    else $q$"),
    );
    expect(keywordBranch).toContain(
      "p.status = any (\n        array['published', 'under_offer', 'sold', 'rented']::public.listing_status[]\n      )",
    );
  });
});
