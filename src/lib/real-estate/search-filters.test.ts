import { describe, expect, it } from "vitest";

import {
  activeFilterKeys,
  buildListingQuery,
  hasActiveFilters,
  parseAmenities,
  parseCurrency,
  parseListingFilters,
  parseVerifiedOnly,
  removeListingFilter,
} from "./search";

/**
 * The Phase 4 marketplace filters: currency, verified publishers and amenities.
 *
 * These are the three filters the redesign added on top of the Phase 7 search
 * layer, and each carries a rule that a plain round-trip test would not catch:
 * a price bound is only meaningful inside one currency, a currency is dropped
 * when it is not a real code rather than sent to a CHECK constraint, and the
 * verified flag is off unless it is explicitly asked for. The parsers are the
 * boundary where a hand-typed URL meets the database, so each degrades rather
 * than trusting its input.
 */

describe("parseCurrency", () => {
  it("accepts a three-letter code in any case", () => {
    expect(parseCurrency("XAF")).toBe("XAF");
    expect(parseCurrency("xaf")).toBe("XAF");
    expect(parseCurrency(" ngn ")).toBe("NGN");
  });

  it("drops anything that is not an ISO-shaped code", () => {
    // The database has a `property_listings_currency_format` check; sending a
    // bad value would surface as a failed request, so it is dropped here.
    expect(parseCurrency("franc")).toBeUndefined();
    expect(parseCurrency("XA")).toBeUndefined();
    expect(parseCurrency("")).toBeUndefined();
    expect(parseCurrency(null)).toBeUndefined();
  });
});

describe("parseVerifiedOnly", () => {
  it("is true only when explicitly asked for", () => {
    expect(parseVerifiedOnly("true")).toBe(true);
    expect(parseVerifiedOnly("1")).toBe(true);
  });

  it("treats an empty, false or absent value as off", () => {
    // A bare `?verified=` is a checkbox that was not ticked, not a request to
    // filter — enabling it would hide listings for a visitor who cleared it.
    expect(parseVerifiedOnly("")).toBeUndefined();
    expect(parseVerifiedOnly("false")).toBeUndefined();
    expect(parseVerifiedOnly("0")).toBeUndefined();
    expect(parseVerifiedOnly(null)).toBeUndefined();
  });
});

describe("parseAmenities", () => {
  it("accepts a repeat and a comma-joined list", () => {
    expect(parseAmenities(["pool", "solar"])).toEqual(["pool", "solar"]);
    expect(parseAmenities("pool,solar")).toEqual(["pool", "solar"]);
  });

  it("normalizes and de-duplicates", () => {
    expect(parseAmenities(" Pool , pool , SOLAR ")).toEqual(["pool", "solar"]);
  });

  it("returns undefined for an empty selection rather than an empty array", () => {
    expect(parseAmenities("")).toBeUndefined();
    expect(parseAmenities(undefined)).toBeUndefined();
  });
});

describe("listing filters round trip", () => {
  it("parses the three new filters from a URL", () => {
    const filters = parseListingFilters({
      currency: "xaf",
      verified: "true",
      amenity: "pool,solar",
    });
    expect(filters.currency).toBe("XAF");
    expect(filters.verifiedOnly).toBe(true);
    expect(filters.amenities).toEqual(["pool", "solar"]);
  });

  it("serializes them back to the same URL, with amenities sorted", () => {
    const query = buildListingQuery(
      parseListingFilters({
        currency: "XAF",
        verified: "true",
        amenity: "solar,pool",
      }),
    );
    const params = new URLSearchParams(query.replace(/^\?/, ""));
    expect(params.get("currency")).toBe("XAF");
    expect(params.get("verified")).toBe("true");
    // Sorted so two links to the same set serialize identically.
    expect(params.get("amenity")).toBe("pool,solar");
  });

  it("counts each new filter as active", () => {
    expect(
      activeFilterKeys(
        parseListingFilters({
          currency: "XAF",
          verified: "true",
          amenity: "pool",
        }),
      ),
    ).toEqual(["currency", "verified", "amenity"]);
  });

  it("clearing the currency clears the price bounds with it", () => {
    // A bound expressed in XAF has no meaning once the currency is gone.
    const filters = parseListingFilters({
      currency: "XAF",
      minPrice: "1000000",
      maxPrice: "5000000",
    });
    const without = removeListingFilter(filters, "currency");
    expect(without.currency).toBeUndefined();
    expect(without.minPrice).toBeUndefined();
    expect(without.maxPrice).toBeUndefined();
  });

  it("does not treat a bare page or sort as an active filter", () => {
    expect(hasActiveFilters({ page: 2, sort: "price-asc" })).toBe(false);
  });
});
