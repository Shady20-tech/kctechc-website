import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { isPriceSort } from "@/lib/store/catalogue";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");
const VALIDATE_DIR = join(process.cwd(), "supabase", "validate");

function readMigration(nameFragment: string): string {
  const file = readdirSync(MIGRATIONS_DIR).find((entry) =>
    entry.includes(nameFragment),
  );
  if (!file) {
    throw new Error(`No migration matching "${nameFragment}"`);
  }
  return readFileSync(join(MIGRATIONS_DIR, file), "utf8");
}

function readValidate(name: string): string {
  return readFileSync(join(VALIDATE_DIR, name), "utf8");
}

/**
 * The store's database-side catalogue query.
 *
 * Filtering, counting and pagination moved into `search_products`, so the
 * guarantees that used to be enforced by a TypeScript filter now live in SQL and
 * are invisible to every other test. These assertions pin the ones that matter:
 * that the public visibility set is pinned inside the SECURITY DEFINER function
 * rather than trusted from the caller, that price is compared within one currency,
 * and that the new functions are classified in the EXECUTE allow-list so a browser
 * key cannot reach anything else.
 */
describe("product search and facets migration", () => {
  const sql = readMigration("product_search_and_facets");

  it("pins the public visibility set inside the function", () => {
    // A SECURITY DEFINER function bypasses RLS, so "published only" must be a
    // predicate in the function itself. If either check is dropped, the storefront
    // could serve a draft product.
    expect(sql).toMatch(/p\.publish_state = 'published'/);
    expect(sql).toMatch(/c\.publish_state = 'published'/);
    expect(sql).toMatch(/c\.is_active/);
  });

  it("compares a price bound only within the currency it was given in", () => {
    // The brief forbids comparing raw numbers from different currencies.
    expect(sql).toMatch(/p_currency is null or p\.currency = p_currency/);
    expect(sql).toMatch(/p_min_price is null or p\.price_minor >= p_min_price/);
    expect(sql).toMatch(/p_max_price is null or p\.price_minor <= p_max_price/);
  });

  it("returns the total count from the same predicate as the rows", () => {
    // A window function over the matched set is what keeps the count shown and
    // the rows returned from disagreeing.
    expect(sql).toMatch(/count\(\*\) over \(\) as total_count/);
  });

  it("matches the localized text as well as the canonical vector", () => {
    // A French visitor searching "ordinateur" must find an English-titled product.
    expect(sql).toMatch(/entity_type = 'product'/);
    expect(sql).toMatch(/t\.locale = p_locale/);
    expect(sql).toMatch(/loc\.value ilike/);
  });

  it("is SECURITY DEFINER with a pinned search_path", () => {
    expect(sql).toMatch(/security definer/);
    expect(sql).toMatch(/set search_path = public, extensions, pg_temp/);
  });

  it("asserts the boundary on every migration application", () => {
    // The database-free test cannot prove the boundary; the migration's own
    // `do $$` block does, so a regression aborts the migration rather than ships.
    expect(sql).toMatch(/VALIDATION FAIL/);
    expect(sql).toMatch(/draft must be hidden/);
    expect(sql).toMatch(/a USD price filter matched an XAF product/);
  });

  it("cleans up its fixture's translation rows", () => {
    // `content_translations` and `translation_entries` have no FK to `products`,
    // so deleting the product alone would strand queued Tolgee work.
    expect(sql).toMatch(/delete from public\.translation_entries/);
    expect(sql).toMatch(/delete from public\.content_translations/);
  });
});

describe("EXECUTE classification", () => {
  const hardening = readMigration("function_execute_hardening");
  const validate = readValidate("30_function_execute_hardening.sql");

  it("allow-lists both storefront RPCs in the migration and the assertion", () => {
    // `search_products` and `product_facets` are called with the anonymous key, so
    // they must be on the allow-list in BOTH places: the migration that grants and
    // the validation script that proves nothing outside the list is reachable.
    for (const source of [hardening, validate]) {
      expect(source).toMatch(/'search_products'/);
      expect(source).toMatch(/'product_facets'/);
    }
  });

  it("classifies the new functions in the migration that creates them", () => {
    const sql = readMigration("product_search_and_facets");
    expect(sql).toMatch(/revoke all on function public\.search_products/);
    expect(sql).toMatch(/revoke all on function public\.product_facets/);
    expect(sql).toMatch(/grant execute on function public\.search_products/);
    expect(sql).toMatch(/to anon, authenticated/);
  });
});

describe("catalogue query module", () => {
  const source = readFileSync(
    join(process.cwd(), "src", "lib", "store", "catalogue.ts"),
    "utf8",
  );

  it("pins a currency for a price sort so units are never compared across currencies", () => {
    expect(isPriceSort("price-asc")).toBe(true);
    expect(isPriceSort("price-desc")).toBe(true);
    expect(isPriceSort("relevance")).toBe(false);
    expect(isPriceSort("newest")).toBe(false);
    expect(isPriceSort(undefined)).toBe(false);
    expect(source).toMatch(
      /isPriceSort\(params\.sort\) \? STORE_PRIMARY_CURRENCY : undefined/,
    );
  });

  it("reads through the stateless client, never the session client", () => {
    // A cookie-bound read here would make every store page dynamic.
    expect(source).toMatch(/from "@\/lib\/supabase\/public"/);
    expect(source).not.toMatch(/from "@\/lib\/supabase\/server"/);
  });

  it("returns an empty page on failure instead of throwing", () => {
    // A database outage must degrade the store to its empty state.
    expect(source).toMatch(/catch \{\s*return empty;\s*\}/s);
  });

  it("treats a missing category slug as a miss, not as the whole catalogue", () => {
    // Otherwise a filtered URL would claim a filter it is not applying.
    expect(source).toMatch(
      /if \(params\.categorySlug && !categoryId\) return empty;/,
    );
  });

  it("resolves a localized category segment before filtering", () => {
    // The URL segment is the slug for the active locale, so a French URL carries
    // `ordinateurs` while the column says `laptops`. Matching the raw segment
    // against the canonical column would return nothing for every translated
    // category, so the segment goes through `resolveBySlug` first.
    expect(source).toMatch(/resolveBySlug\(/);
    expect(source).toMatch(/loadCategoryRecords\(departmentSlug\)/);
    expect(source).toMatch(/\.eq\("slug", record\.slug\)/);
  });
});
