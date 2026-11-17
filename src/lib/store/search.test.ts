import { describe, expect, it } from "vitest";

import {
  activeStoreFilterKeys,
  buildStoreQuery,
  hasActiveStoreFilters,
  isStoreSort,
  parseStoreFilters,
  removeStoreFilter,
  sortLabelKey,
  STORE_SORTS,
} from "@/lib/store/search";

/**
 * The store's filter model and its URL contract.
 *
 * These are the properties a regression would silently break: that a bad URL
 * value reads as "no filter" rather than as a rejected request, that one filter
 * state is one address, and that a price bound always carries the currency it is
 * expressed in. Filtering itself is proven by `store-catalogue.test.ts` against
 * the RPC, not here.
 */

describe("parseStoreFilters", () => {
  it("returns an empty state for an empty URL", () => {
    expect(parseStoreFilters({})).toEqual({
      query: undefined,
      category: undefined,
      currency: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      inStock: undefined,
      brand: undefined,
      sort: undefined,
      page: undefined,
    });
  });

  it("reads a blank value as no filter, so ?q= and no q are one address", () => {
    expect(parseStoreFilters({ q: "   " }).query).toBeUndefined();
    expect(parseStoreFilters({ q: "" }).query).toBeUndefined();
  });

  it("floors a decimal price and rejects a non-numeric one", () => {
    // A decimal reaching PostgREST is a failed request rather than a filter, and
    // `price_minor` is an integer column.
    expect(parseStoreFilters({ minPrice: "1.5" }).minPrice).toBeUndefined();
    expect(parseStoreFilters({ minPrice: "abc" }).minPrice).toBeUndefined();
    expect(parseStoreFilters({ minPrice: "500000" }).minPrice).toBe(500000);
  });

  it("applies the primary currency to a price bound that omits one", () => {
    // Comparing a number against a price in an unknown unit is the cross-currency
    // comparison the brief forbids, so a bound always carries its currency.
    expect(parseStoreFilters({ maxPrice: "1000" }).currency).toBe("XAF");
  });

  it("keeps a currency on its own without inventing a price bound", () => {
    const parsed = parseStoreFilters({ currency: "usd" });
    expect(parsed.currency).toBe("USD");
    expect(parsed.minPrice).toBeUndefined();
  });

  it("treats inStock=false as no filter, not as out-of-stock-only", () => {
    expect(parseStoreFilters({ inStock: "false" }).inStock).toBeUndefined();
    expect(parseStoreFilters({ inStock: "true" }).inStock).toBe(true);
  });

  it("rejects an unknown sort so a hand-edited URL falls back to relevance", () => {
    expect(
      parseStoreFilters({ sort: "'; drop table products; --" }).sort,
    ).toBeUndefined();
    expect(parseStoreFilters({ sort: "price-asc" }).sort).toBe("price-asc");
  });

  it("rejects page 0 and a non-numeric page", () => {
    expect(parseStoreFilters({ page: "0" }).page).toBeUndefined();
    expect(parseStoreFilters({ page: "-2" }).page).toBeUndefined();
    expect(parseStoreFilters({ page: "3" }).page).toBe(3);
  });

  it("accepts a repeated parameter and takes the first value", () => {
    expect(parseStoreFilters({ q: ["hub", "laptop"] }).query).toBe("hub");
  });
});

describe("buildStoreQuery", () => {
  it("omits a default sort so one filter state has one URL", () => {
    expect(buildStoreQuery({ query: "hub", sort: "relevance" })).toBe("?q=hub");
  });

  it("keeps a non-default sort", () => {
    expect(buildStoreQuery({ sort: "price-asc" })).toBe("?sort=price-asc");
  });

  it("omits page 1 and writes a later page", () => {
    expect(buildStoreQuery({ page: 1 })).toBe("");
    expect(buildStoreQuery({ page: 4 })).toBe("?page=4");
  });

  it("omits a cleared value rather than carrying the old one", () => {
    expect(buildStoreQuery({ category: "laptops" })).toBe("?category=laptops");
    expect(buildStoreQuery({})).toBe("");
  });

  it("round-trips through the parser", () => {
    const filters = parseStoreFilters({
      q: "hub",
      category: "accessories",
      minPrice: "1000",
      inStock: "true",
      sort: "price-desc",
      page: "2",
    });
    const query = buildStoreQuery(filters);
    const params = Object.fromEntries(new URLSearchParams(query.slice(1)));
    expect(params).toMatchObject({
      q: "hub",
      category: "accessories",
      minPrice: "1000",
      currency: "XAF",
      inStock: "true",
      sort: "price-desc",
      page: "2",
    });
  });
});

describe("hasActiveStoreFilters", () => {
  it("is false for an empty state and a sort alone", () => {
    expect(hasActiveStoreFilters({})).toBe(false);
    // A sort is an ordering, not a filter: it must not make the page claim the
    // result set is narrowed.
    expect(hasActiveStoreFilters({ sort: "price-asc" })).toBe(false);
  });

  it("is true when any narrowing filter is set", () => {
    expect(hasActiveStoreFilters({ query: "hub" })).toBe(true);
    expect(hasActiveStoreFilters({ category: "laptops" })).toBe(true);
    expect(hasActiveStoreFilters({ brand: "Lenovo" })).toBe(true);
    expect(hasActiveStoreFilters({ inStock: true })).toBe(true);
    expect(hasActiveStoreFilters({ minPrice: 0 })).toBe(true);
    expect(hasActiveStoreFilters({ maxPrice: 100 })).toBe(true);
  });
});

describe("activeStoreFilterKeys", () => {
  it("lists the narrowing filters and never the sort", () => {
    const keys = activeStoreFilterKeys({
      query: "hub",
      category: "laptops",
      minPrice: 100,
      maxPrice: 500,
      inStock: true,
      sort: "price-asc",
    });
    expect(keys).toEqual(["q", "category", "inStock", "minPrice", "maxPrice"]);
  });
});

describe("removeStoreFilter", () => {
  it("removes exactly one filter and drops the page", () => {
    const next = removeStoreFilter(
      { query: "hub", category: "laptops", page: 3 },
      "category",
    );
    expect(next.query).toBe("hub");
    expect(next.category).toBeUndefined();
    // Page 3 of a wider result set is not a meaningful page.
    expect(next.page).toBeUndefined();
  });

  it("clears the currency when the last price bound goes", () => {
    // Otherwise removing "max price" leaves an orphaned `currency` in the URL.
    const next = removeStoreFilter(
      { minPrice: 100, currency: "XAF" },
      "minPrice",
    );
    expect(next.minPrice).toBeUndefined();
    expect(next.currency).toBeUndefined();
  });

  it("keeps the currency while another price bound remains", () => {
    const next = removeStoreFilter(
      { minPrice: 100, maxPrice: 500, currency: "XAF" },
      "minPrice",
    );
    expect(next.currency).toBe("XAF");
  });
});

describe("isStoreSort", () => {
  it("accepts the known sorts", () => {
    for (const value of STORE_SORTS) {
      expect(isStoreSort(value), value).toBe(true);
    }
  });

  it("rejects anything else", () => {
    expect(isStoreSort("price")).toBe(false);
    expect(isStoreSort(undefined)).toBe(false);
  });
});

describe("sortLabelKey", () => {
  it("maps each sort to a translation key", () => {
    expect(sortLabelKey("price-asc")).toBe("store.sortPriceAsc");
    expect(sortLabelKey("relevance")).toBe("store.sortRelevance");
    expect(sortLabelKey("newest")).toBe("store.sortNewest");
  });
});
