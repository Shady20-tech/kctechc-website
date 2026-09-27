import { describe, expect, it } from "vitest";

import type { PropertyListingRecord } from "./types";
import {
  activeFilterKeys,
  buildListingQuery,
  hasActiveFilters,
  normalizeSearchQuery,
  parseListingFilters,
  removeListingFilter,
  selectRelatedListings,
} from "./search";

/**
 * Tests for related-listing selection.
 *
 * The behaviour worth pinning is the scoring and the exclusion rules: a listing
 * that shares nothing must not be shown, and the strip's order must be stable so
 * the server render and any re-render agree.
 */

function listing(
  overrides: Partial<PropertyListingRecord> & { id: string },
): PropertyListingRecord {
  return {
    reference: `KC-RE-${overrides.id.padStart(6, "0")}`,
    slug: `listing-${overrides.id}`,
    listingType: "sale",
    propertyKind: "villa",
    propertyType: "residential",
    status: "published",
    source: "admin",
    regionSlug: "littoral",
    regionName: "Littoral",
    title: `Listing ${overrides.id}`,
    description: "A property.",
    highlights: [],
    amenities: [],
    priceMinor: null,
    currency: "XAF",
    pricePeriod: "total",
    priceOnRequest: false,
    images: [],
    isFeatured: false,
    viewCount: 0,
    inquiryCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("selectRelatedListings", () => {
  const subject = listing({ id: "1" });

  it("never includes the subject listing itself", () => {
    const result = selectRelatedListings([subject], subject);
    expect(result).toEqual([]);
  });

  it("excludes listings that share nothing with the subject", () => {
    const unrelated = listing({
      id: "2",
      regionSlug: "centre",
      propertyKind: "land",
      listingType: "rent",
    });
    expect(selectRelatedListings([subject, unrelated], subject)).toEqual([]);
  });

  it("ranks a same-region and same-kind match above a same-kind-only match", () => {
    const sameRegionAndKind = listing({ id: "2" });
    const sameKindOnly = listing({ id: "3", regionSlug: "centre" });

    const result = selectRelatedListings(
      [subject, sameKindOnly, sameRegionAndKind],
      subject,
    );

    expect(result.map((entry) => entry.id)).toEqual(["2", "3"]);
  });

  it("honours the limit", () => {
    const candidates = ["2", "3", "4", "5"].map((id) => listing({ id }));
    expect(selectRelatedListings([subject, ...candidates], subject, 2)).toHaveLength(
      2,
    );
  });

  it("is stable between renders when scores tie", () => {
    const a = listing({ id: "2" });
    const b = listing({ id: "3" });

    const first = selectRelatedListings([subject, a, b], subject);
    const second = selectRelatedListings([subject, b, a], subject);

    // Ties break on the reference, so the input order cannot leak into the render.
    expect(first.map((entry) => entry.id)).toEqual(second.map((entry) => entry.id));
  });

  it("prefers the more recently published listing on a score tie", () => {
    const older = listing({ id: "2", publishedAt: "2025-01-01T00:00:00.000Z" });
    const newer = listing({ id: "3", publishedAt: "2026-06-01T00:00:00.000Z" });

    const result = selectRelatedListings([subject, older, newer], subject);
    expect(result.map((entry) => entry.id)).toEqual(["3", "2"]);
  });
});

/**
 * Tests for filter parsing, serialization and normalization.
 *
 * These pin the round trip rather than each function in isolation: the listings
 * page parses a URL into filters, the panel serializes filters back into a URL,
 * and a saved search stores that string to be parsed again later. Any asymmetry
 * between the two directions is a bug that only shows up as a filter quietly
 * disappearing when a customer reopens a saved search, so it is asserted here.
 */

describe("parseListingFilters", () => {
  it("reads the full filter set from a query record", () => {
    const filters = parseListingFilters({
      q: "villa",
      region: "south-west",
      division: "fako",
      subdivision: "limbe",
      type: "sale",
      kind: "villa",
      propertyType: "residential",
      status: ["published", "under_offer"],
      minPrice: "10000000",
      maxPrice: "90000000",
      minBedrooms: "3",
      minBathrooms: "2",
      minSize: "500",
      maxSize: "2000",
      sort: "price-asc",
      page: "3",
    });

    expect(filters).toEqual({
      query: "villa",
      regionSlug: "south-west",
      divisionSlug: "fako",
      subdivisionSlug: "limbe",
      listingType: "sale",
      propertyKind: "villa",
      propertyType: "residential",
      statuses: ["published", "under_offer"],
      minPrice: 10000000,
      maxPrice: 90000000,
      minBedrooms: 3,
      minBathrooms: 2,
      minSize: 500,
      maxSize: 2000,
      sort: "price-asc",
      page: 3,
    });
  });

  it("ignores an unknown enum value rather than passing it to the query", () => {
    // A value the enum does not contain would be rejected by Postgres and surface
    // as a 500. Dropping it means a hand-edited URL degrades to a broader result.
    const filters = parseListingFilters({
      type: "not-a-type",
      kind: "not-a-kind",
      propertyType: "not-a-class",
      sort: "not-a-sort",
    });

    expect(filters.listingType).toBeUndefined();
    expect(filters.propertyKind).toBeUndefined();
    expect(filters.propertyType).toBeUndefined();
    expect(filters.sort).toBeUndefined();
  });

  it("ignores a non-numeric or negative numeric bound", () => {
    const filters = parseListingFilters({
      minPrice: "abc",
      maxPrice: "-5",
      minBedrooms: "0",
    });

    expect(filters.minPrice).toBeUndefined();
    expect(filters.maxPrice).toBeUndefined();
    expect(filters.minBedrooms).toBeUndefined();
  });

  it("keeps only the statuses a visitor may filter by", () => {
    // `archived` is a real status but not a public one, so a link naming it must
    // not narrow the search to a set the visitor cannot browse.
    const filters = parseListingFilters({
      status: ["published", "archived", "nonsense"],
    });
    expect(filters.statuses).toEqual(["published"]);
  });

  it("truncates a fractional count rather than sending it to the RPC", () => {
    // The columns are integers, so `1.5` would be refused by PostgREST and become
    // a failed request rather than a filter.
    expect(parseListingFilters({ minBedrooms: "1.5" }).minBedrooms).toBe(1);
    expect(parseListingFilters({ minPrice: "1000.9" }).minPrice).toBe(1000);
  });

  it("drops a page of one, because page one is the absence of the parameter", () => {
    expect(parseListingFilters({ page: "1" }).page).toBeUndefined();
    expect(parseListingFilters({ page: "2" }).page).toBe(2);
  });

  it("reads a single value and an array for the same key identically", () => {
    const single = parseListingFilters({ type: "sale" });
    const array = parseListingFilters({ type: ["sale"] });
    expect(single.listingType).toBe(array.listingType);
  });
});

describe("buildListingQuery", () => {
  it("round-trips every filter through serialize and parse", () => {
    const original = parseListingFilters({
      q: "terrain",
      region: "south-west",
      type: "rent",
      kind: "house",
      propertyType: "commercial",
      status: ["published", "under_offer"],
      minPrice: "100000",
      maxPrice: "500000",
      minBedrooms: "2",
      minBathrooms: "1",
      minSize: "100",
      maxSize: "900",
      sort: "most-viewed",
      page: "4",
    });

    const serialized = buildListingQuery(original);
    const reparsed = parseListingFilters(
      Object.fromEntries(new URLSearchParams(serialized.replace(/^\?/, ""))),
    );

    expect(reparsed).toEqual(original);
  });

  it("produces an empty string when there is nothing to serialize", () => {
    expect(buildListingQuery({})).toBe("");
  });

  it("writes the statuses comma-joined in the offered order", () => {
    // One parameter rather than a repeat, and always in `LISTING_STATUS_FILTERS`
    // order, so the same set of statuses produces one URL regardless of the order
    // the visitor ticked them in.
    const query = buildListingQuery({
      statuses: ["under_offer", "published"],
    });
    const params = new URLSearchParams(query.replace(/^\?/, ""));
    expect(params.getAll("status")).toEqual(["published,under_offer"]);
  });

  it("round-trips a comma-joined status list through parse", () => {
    const filters = parseListingFilters({ status: "published,under_offer" });
    expect(filters.statuses).toEqual(["published", "under_offer"]);
  });
});

describe("normalizeSearchQuery", () => {
  it("drops the page and view parameters", () => {
    // A saved search is a description of the filters, not of one visit to them.
    // Storing a page number would reopen the search on page 4 of a result set that
    // has since changed.
    const normalized = normalizeSearchQuery(
      "?type=sale&region=south-west&page=4&view=map",
    );
    expect(normalized).not.toContain("page=");
    expect(normalized).not.toContain("view=");
    expect(normalized).toContain("type=sale");
    expect(normalized).toContain("region=south-west");
  });

  it("is idempotent", () => {
    const once = normalizeSearchQuery("?type=rent&status=published&page=2");
    expect(normalizeSearchQuery(once)).toBe(once);
  });

  it("normalizes an unnormalized query to the canonical form", () => {
    // The same filters written in a different order and with a page of one must
    // produce one string, so two customers saving the same view store one search.
    const a = normalizeSearchQuery("?type=sale&region=south-west&page=1");
    const b = normalizeSearchQuery("?region=south-west&type=sale");
    expect(a).toBe(b);
  });

  it("discards unknown parameters and invalid values", () => {
    const normalized = normalizeSearchQuery("?type=nonsense&tracking=abc");
    expect(normalized).toBe("");
  });
});

describe("activeFilterKeys and removeListingFilter", () => {
  it("lists only the filters that are set", () => {
    const filters = parseListingFilters({ type: "sale", minPrice: "1000" });
    expect(activeFilterKeys(filters)).toEqual(["type", "minPrice"]);
  });

  it("removes one filter and leaves the rest untouched", () => {
    const filters = parseListingFilters({
      type: "sale",
      region: "south-west",
      minPrice: "1000",
    });
    const without = removeListingFilter(filters, "type");

    expect(without.listingType).toBeUndefined();
    expect(without.regionSlug).toBe("south-west");
    expect(without.minPrice).toBe(1000);
  });

  it("clears the page when a filter is removed", () => {
    // Removing a filter widens the result set, so the current page number may no
    // longer exist. Resetting to page one is what keeps the URL valid.
    const filters = parseListingFilters({ type: "sale", page: "4" });
    expect(removeListingFilter(filters, "type").page).toBeUndefined();
  });
});

describe("hasActiveFilters", () => {
  it("is false for an empty filter set and for a page on its own", () => {
    expect(hasActiveFilters({})).toBe(false);
    expect(hasActiveFilters({ page: 3 })).toBe(false);
  });

  it("is true as soon as one filter is set", () => {
    expect(hasActiveFilters({ listingType: "sale" })).toBe(true);
    expect(hasActiveFilters({ minBedrooms: 2 })).toBe(true);
  });
});
