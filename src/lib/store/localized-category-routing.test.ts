import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * A category's URL segment is the slug for the active locale, but the canonical
 * slug is the stable identifier the rest of the code addresses the category by.
 * Mixing the two is a silent failure: it works in English (where they are the
 * same) and breaks the moment a French slug exists, and it is invisible to
 * TypeScript because both are `string`.
 *
 * These assertions pin the split so a later edit cannot quietly re-conflate them.
 */
function read(relative: string): string {
  return readFileSync(join(process.cwd(), relative), "utf8");
}

const CATEGORY_PAGE =
  "src/app/(site)/[locale]/[department]/store/[category]/page.tsx";
const PRODUCT_PAGE =
  "src/app/(site)/[locale]/[department]/store/[category]/[slug]/page.tsx";
const STORE_INDEX = "src/app/(site)/[locale]/[department]/store/page.tsx";

describe("localized category routing", () => {
  it("resolves the category segment to a canonical record on the category page", () => {
    const source = read(CATEGORY_PAGE);
    expect(source).toMatch(/resolveBySlug\(records, segment, resolved\)/);
    // The catalogue is filtered by the canonical slug, never the URL segment.
    expect(source).toMatch(/categorySlug: record\.slug/);
    expect(source).not.toMatch(/categorySlug: category\.slug/);
  });

  it("compares canonical slugs on both sides on the product page", () => {
    const source = read(PRODUCT_PAGE);
    expect(source).toMatch(/categoryRecord\.slug !== product\.categorySlug/);
    // The localized category is used only for display, never for the comparison.
    expect(source).not.toMatch(/category\.slug !== product\.categorySlug/);
  });

  it("counts facets by canonical slug while linking by localized slug", () => {
    const source = read(STORE_INDEX);
    expect(source).toMatch(/facets\.categories\.get\(record\.slug\)/);
    expect(source).not.toMatch(/facets\.categories\.get\(category\.slug\)/);
    expect(source).toMatch(/buildStoreQuery\(\{ category: category\.slug \}\)/);
  });
});

/**
 * A filtered store view is a view of the catalogue, not a page of its own.
 * Indexing every price/brand/query permutation would flood the index with
 * near-duplicates of the bare store — the same duplicate-content concern that
 * makes Real Estate and the projects gallery mark a filtered view `noindex`.
 * The store index and category pages must derive their robots directive from the
 * parsed filter state, or the rule silently stops applying to one of them.
 */
describe("store indexability", () => {
  it("marks a filtered store index noindex and the bare index indexable", () => {
    const source = read(STORE_INDEX);
    expect(source).toMatch(/noindex: hasActiveStoreFilters\(filters\)/);
  });

  it("marks a filtered category view noindex", () => {
    const source = read(CATEGORY_PAGE);
    expect(source).toMatch(/noindex: hasActiveStoreFilters\(filters\)/);
    // The category segment is pinned, so it alone must not make the view filtered.
    expect(source).toMatch(
      /parseStoreFilters\(await searchParams\), category: undefined/,
    );
  });
});
