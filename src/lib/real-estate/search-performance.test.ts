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

describe("listing search indexes migration", () => {
  // Part 1 of 2 is indexes only: additive, no table/column/function change, so it
  // can be applied to production before the function that consumes it.
  const migration = readMigration("listing_search_indexes");

  /**
   * The visibility predicate. Every index below is partial on this exact set, and
   * a partial index is only usable when the query predicate *implies* the index
   * predicate. Predicating the index on `status = 'published'` alone made all four
   * unreachable, because `status = any(4 values)` does not imply `status =
   * 'published'`.
   */
  const VISIBILITY = `array['published', 'under_offer', 'sold', 'rented']`;

  it("changes nothing but indexes", () => {
    // This is what makes the file safe to run against a live database: no table,
    // column, constraint or function is touched, and no row is written.
    for (const forbidden of [
      "alter table",
      "drop table",
      "drop column",
      "drop function",
      "truncate",
      "delete from",
      "insert into",
    ]) {
      expect(
        migration.toLowerCase(),
        `${forbidden} must not appear in the indexes-only migration`,
      ).not.toContain(forbidden);
    }
    expect(migration).not.toContain("create or replace function");
  });

  it("declares every visibility index over the real visibility set", () => {
    for (const name of [
      "property_listings_visible_recent_idx",
      "property_listings_visible_price_idx",
      "property_listings_visible_price_desc_idx",
      "property_listings_visible_viewed_idx",
      "property_listings_visible_published_idx",
      "property_listings_visible_region_idx",
    ]) {
      expect(migration, `${name} must exist`).toContain(name);
    }
    // Every one is partial on the same four-value set.
    expect(migration.split(VISIBILITY).length - 1).toBeGreaterThanOrEqual(6);
  });

  it("is idempotent so a partial apply can be re-run", () => {
    // `if not exists` makes a re-run a no-op rather than an error. Count only
    // statement-initial occurrences: the prose also says "create index".
    const creates = migration.match(/^create index/gm) ?? [];
    const guarded = migration.match(/^create index if not exists/gm) ?? [];
    expect(creates.length).toBe(6);
    expect(guarded.length).toBe(creates.length);
  });

  it("covers the relevance sort that carries no keyword", () => {
    // `p_sort => 'relevance'` with no query orders by `published_at, reference`
    // (`rank` is 0.0 on every row), so it needs its own index — the featured-first
    // one cannot answer it.
    expect(migration).toContain("property_listings_visible_published_idx");
    // Slice to the end of that statement, not to the next index name: ordering
    // within the file is not part of the contract.
    const start = migration.indexOf(
      "create index if not exists property_listings_visible_published_idx",
    );
    const published = migration.slice(start, migration.indexOf(";", start));
    expect(published).toContain("published_at desc nulls last");
    expect(published).toContain("reference asc");
    expect(published).not.toContain("is_featured");
  });

  it("matches each index to the ORDER BY it must answer", () => {
    // A `desc` column in an index defaults to NULLS FIRST, but every ORDER BY is
    // `nulls last`. Postgres will not use an index whose null placement differs,
    // so a bare `published_at desc` index silently forced a sort.
    expect(migration).toContain("published_at desc nulls last");

    // A `price_minor desc` sort cannot read a `price_minor asc` index, so the
    // descending price sort needs its own index rather than relying on a backward
    // scan of the ascending one.
    expect(migration).toContain("price_minor asc nulls last");
    expect(migration).toContain("price_minor desc nulls last");
  });
});

describe("listing search statement-build migration", () => {
  // Part 2 of 2 replaces the function so the planner can use those indexes.
  const migration = readMigration("listing_search_statement_build");

  it("replaces the function rather than declaring a new signature", () => {
    // `create or replace` keeps the Phase 12 ACL. A `drop` + `create` would drop
    // the browser grant and every search page would stop working.
    expect(migration).toContain(`create or replace function ${SEARCH_FN}(`);
    expect(migration).not.toContain(`drop function ${SEARCH_FN}`);
  });

  it("keeps the parameter list identical so no overload is created", () => {
    // A changed signature would leave the old function in place and create a
    // second one, so the app would keep calling the slow version. Count the
    // declaration's parameter lines only: the prose also names parameters.
    const start = migration.indexOf(
      `create or replace function ${SEARCH_FN}(`,
    );
    const end = migration.indexOf("returns table", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const declaration = migration.slice(start, end);
    const params = declaration
      .split("\n")
      .filter((line) => /^\s+p_[a-z_]+ /.test(line));
    expect(params.length).toBe(22);
    expect(params.join("\n")).toContain("p_locality text default null");
  });

  it("builds the statement per call so ORDER BY is a literal", () => {
    // A `case when p_sort = ...` ORDER BY is opaque to the planner and no index
    // can answer it. The body must therefore assemble SQL and execute it.
    // The prose in the header explains *why* it is no longer `language sql`, so
    // assert against the declaration rather than the whole file.
    expect(migration).toContain("language plpgsql");
    const declaration = migration.slice(
      migration.indexOf(`create or replace function ${SEARCH_FN}(`),
      migration.indexOf("as $function$"),
    );
    expect(declaration).not.toContain("language sql");
    expect(migration).toContain("return query execute v_sql using");

    // The body is the shared head plus a per-sort ORDER BY tail, concatenated.
    // Asserting the concatenation (rather than ten inlined copies) is what keeps
    // the file honest: an earlier revision inlined the whole body per sort, and a
    // later edit to one copy would silently diverge from the others.
    expect(migration).toContain("v_sql := v_head || v_tail");

    // Each sort gets its own literal ORDER BY clause.
    for (const sort of ["price_asc", "price_desc", "most_viewed", "relevance"]) {
      expect(migration).toContain(`p_sort = '${sort}'`);
    }
  });

  it("includes the keyword predicate only when a query was given", () => {
    // The `q is null or ...` guard a static body needs becomes a Join Filter over
    // `cross join params`, which re-tests every row and defeats the FTS and
    // trigram indexes. The clause must therefore be conditional.
    expect(migration).toContain("v_has_query :=");
    expect(migration).toContain("when v_has_query = true");
    expect(migration).toContain("when v_has_query = false");

    // The trigram operator is what the GIN indexes can answer; the
    // `word_similarity()` function form is opaque to the planner.
    expect(migration).toContain("p.title %> $1");
    expect(migration).toContain("p.locality %> $1");
  });

  it("keeps the visibility predicate in every branch", () => {
    // This is the security control: a caller may narrow within the public set but
    // never widen it. A dynamic body could silently lose it.
    const predicate =
      "array['published', 'under_offer', 'sold', 'rented']::public.listing_status[]";
    expect(migration).toContain(predicate);

    // The body is one statement per keyword variant (with and without a query),
    // each assembled from a shared head, so the predicate must appear in both.
    const body = migration.slice(
      migration.indexOf(`create or replace function ${SEARCH_FN}(`),
    );
    const occurrences = body.split(predicate).length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it("reads the region slug without a join over every matched row", () => {
    // The inner join was a hash join over the whole matched set, materialising it
    // before the LIMIT and destroying the index order.
    expect(migration).not.toContain("join public.regions r on r.id = v.region_id");
    expect(migration).toContain(
      "(select r.slug from public.regions r where r.id = v.region_id)",
    );
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
