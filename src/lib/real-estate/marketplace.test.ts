import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  BATHROOM_FILTER_OPTIONS,
  BEDROOM_FILTER_OPTIONS,
  DEFAULT_LISTING_SORT,
  LISTING_SORTS,
  PRIMARY_CURRENCY,
  PROPERTY_CATEGORIES,
  applyCategory,
  buildListingQuery,
  categoryForFilters,
  hasActiveFilters,
  isListingSort,
  listingSortLabelKey,
  parseListingFilters,
  removeListingFilter,
  type ListingFilters,
} from "./search";

/**
 * The marketplace filter model.
 *
 * These are the rules that decide what a filter control means and which URL it
 * produces, so a regression here changes the result set a visitor sees — not
 * merely the way it looks. The categories, the sort set and the currency rule are
 * each asserted against the migration that backs them, because a filter option
 * the database cannot answer is a control that promises results it cannot show.
 */

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

function readMigration(nameFragment: string): string {
  const file = readdirSync(MIGRATIONS_DIR).find((f) =>
    f.includes(nameFragment),
  );
  if (!file) throw new Error(`No migration matching "${nameFragment}"`);
  return readFileSync(join(MIGRATIONS_DIR, file), "utf8");
}

describe("marketplace categories", () => {
  const migration = readMigration("publisher_verification_and_search_filters");

  it("maps every category bucket to a bucket the facet function returns", () => {
    // The sidebar renders a count per category from `listing_facets()`. A bucket
    // the function does not return has no count, and a bucket it returns that no
    // category maps to is a count nobody can see.
    for (const category of PROPERTY_CATEGORIES) {
      expect(
        migration.includes(`'${category.bucket}'`),
        `category bucket "${category.bucket}" is not a facet bucket`,
      ).toBe(true);
    }
  });

  it("backs every category with real database vocabulary", () => {
    // A category is a *named filter combination*, never a new taxonomy: its
    // fields must be values the enums accept.
    const listingTypes = ["sale", "rent", "short_term"];
    const propertyKinds = ["house", "apartment", "land", "commercial", "villa"];
    const propertyTypes = ["residential", "commercial", "industrial", "mixed"];
    for (const category of PROPERTY_CATEGORIES) {
      const { listingType, propertyKind, propertyType } = category.filters;
      if (listingType) expect(listingTypes).toContain(listingType);
      if (propertyKind) expect(propertyKinds).toContain(propertyKind);
      if (propertyType) expect(propertyTypes).toContain(propertyType);
    }
  });

  it("applies a category by clearing the fields it does not set", () => {
    const start: ListingFilters = {
      listingType: "rent",
      propertyKind: "land",
      propertyType: "commercial",
      minBedrooms: 2,
    };
    const applied = applyCategory(start, "for_sale");
    expect(applied.listingType).toBe("sale");
    expect(applied.propertyKind).toBeUndefined();
    expect(applied.propertyType).toBeUndefined();
    // An unrelated filter survives: a category is not a reset.
    expect(applied.minBedrooms).toBe(2);
    expect(applied.page).toBeUndefined();
  });

  it("reports the active category for a matching filter state", () => {
    expect(categoryForFilters({})).toBe("all");
    expect(categoryForFilters({ listingType: "sale" })).toBe("for_sale");
    expect(
      categoryForFilters({ listingType: "sale", propertyKind: "land" }),
    ).toBe("land_sale");
    // A category is only about the type/kind/type triple, so an unrelated filter
    // leaves the category at "all" rather than clearing it.
    expect(categoryForFilters({ minBedrooms: 2 })).toBe("all");
    // A triple no category stands for reports nothing.
    expect(
      categoryForFilters({ listingType: "short_term", propertyKind: "land" }),
    ).toBeUndefined();
  });
});

describe("listing sort", () => {
  const migration = readMigration("listing_sort_relevance");

  it("offers relevance first, then newest", () => {
    expect(LISTING_SORTS[0]).toBe("relevance");
    expect(LISTING_SORTS[1]).toBe("newest");
  });

  it("defaults to newest, which is never written to the URL", () => {
    // `relevance` with no query ranks every listing equally, so it is a poor
    // default for a browse; `newest` is the URL default and stays implicit.
    expect(DEFAULT_LISTING_SORT).toBe("newest");
    expect(buildListingQuery({})).toBe("");
  });

  it("has a label key for every sort option", () => {
    for (const sort of LISTING_SORTS) {
      expect(listingSortLabelKey(sort)).toMatch(/^realEstate\.search\./);
    }
  });

  it("adds the relevance value to the database enum", () => {
    expect(migration).toContain("add value if not exists 'relevance'");
  });

  it("rejects an unknown sort rather than passing it to the database", () => {
    expect(isListingSort("relevance")).toBe(true);
    expect(isListingSort("popularity")).toBe(false);
  });
});

describe("price currency", () => {
  it("uses XAF as the primary Cameroon currency", () => {
    expect(PRIMARY_CURRENCY).toBe("XAF");
  });

  it("never compares raw prices across currencies", () => {
    // A price bound is only ever applied together with a currency, so the two
    // numbers compared are the same unit. The parsed state carries both.
    const filters = parseListingFilters({ minPrice: "500000", currency: "xaf" });
    expect(filters.currency).toBe("XAF");
    expect(filters.minPrice).toBe(500000);
    const query = buildListingQuery(filters);
    expect(query).toContain("currency=XAF");
    expect(query).toContain("minPrice=500000");
  });

  it("drops a currency that is not an ISO-shaped code", () => {
    expect(parseListingFilters({ currency: "dollars" }).currency).toBeUndefined();
    expect(parseListingFilters({ currency: "" }).currency).toBeUndefined();
  });

  it("scopes the price sort to one currency in the database", () => {
    // The filter compares within a currency, but the *sort* is a separate claim:
    // `price_asc` ordering by the raw `price_minor` puts a XAF 85,000,000 listing
    // above a USD 300,000 one and reads as "cheaper". Migration 69 groups the
    // price sort by the currency code so prices are only ever ordered against
    // each other inside one unit. Asserted against the migration because this is
    // a property of the SQL, which no unit test exercises.
    const migration = readMigration("20260101000069");
    expect(migration).toContain("then v.currency end asc");
    expect(migration).toContain("position('then v.currency end asc' in v_body)");
  });
});

describe("characteristic filters", () => {
  it("offers a fixed bedroom and bathroom list", () => {
    // A fixed list rather than a range from the data: a filter whose options move
    // as listings come and go makes one URL mean different things over time.
    expect(BEDROOM_FILTER_OPTIONS.length).toBeGreaterThan(0);
    expect(BATHROOM_FILTER_OPTIONS.length).toBeGreaterThan(0);
  });

  it("truncates a fractional numeric filter to an integer", () => {
    // Prices are bigint, counts smallint and areas integer, so a fractional value
    // is refused by PostgREST and becomes a failed request rather than a filter.
    const filters = parseListingFilters({ minBedrooms: "1.5", minSize: "99.9" });
    expect(filters.minBedrooms).toBe(1);
    expect(filters.minSize).toBe(99);
  });

  it("parses amenities from a repeat and a comma-joined value alike", () => {
    expect(parseListingFilters({ amenity: ["pool", "solar"] }).amenities).toEqual(
      ["pool", "solar"],
    );
    expect(parseListingFilters({ amenity: "pool,solar" }).amenities).toEqual([
      "pool",
      "solar",
    ]);
    // An empty list reads as absent, not as "match nothing".
    expect(parseListingFilters({ amenity: "" }).amenities).toBeUndefined();
  });
});

describe("verified publishers", () => {
  it("treats the flag as a narrowing filter only when present", () => {
    expect(parseListingFilters({ verified: "true" }).verifiedOnly).toBe(true);
    expect(parseListingFilters({ verified: "false" }).verifiedOnly).toBeUndefined();
    expect(parseListingFilters({}).verifiedOnly).toBeUndefined();
  });

  it("counts as an active filter so the view is noindex", () => {
    expect(hasActiveFilters({ verifiedOnly: true })).toBe(true);
  });
});

describe("locality", () => {
  it("parses and round-trips the free-text neighbourhood", () => {
    const filters = parseListingFilters({ locality: "Bonaberi" });
    expect(filters.locality).toBe("Bonaberi");
    expect(buildListingQuery(filters)).toContain("locality=Bonaberi");
  });

  it("removes a locality without touching its siblings", () => {
    const next = removeListingFilter(
      { regionSlug: "littoral", locality: "Bonaberi" },
      "locality",
    );
    expect(next.locality).toBeUndefined();
    expect(next.regionSlug).toBe("littoral");
  });
});

describe("removeListingFilter cascade", () => {
  it("clears child geography when a parent is removed", () => {
    const next = removeListingFilter(
      {
        regionSlug: "southwest",
        divisionSlug: "fako",
        subdivisionSlug: "limbe-1",
      },
      "region",
    );
    expect(next.regionSlug).toBeUndefined();
    expect(next.divisionSlug).toBeUndefined();
    expect(next.subdivisionSlug).toBeUndefined();
  });

  it("resets the page so a shorter result set is not shown from page 4", () => {
    const next = removeListingFilter(
      { minBedrooms: 2, page: 4 },
      "minBedrooms",
    );
    expect(next.page).toBeUndefined();
  });
});
