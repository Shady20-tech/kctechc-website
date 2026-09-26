import { describe, expect, it } from "vitest";
import {
  buildStoreQuery,
  filterProducts,
  isStoreSort,
  normalizeSearchTerm,
  sortLabelKey,
  sortProducts,
} from "@/lib/store/search";
import type { LocalizedProduct } from "@/lib/store/types";

function product(overrides: Partial<LocalizedProduct>): LocalizedProduct {
  return {
    id: "id",
    categorySlug: "laptops",
    slug: "slug",
    sku: "SKU",
    title: "Title",
    shortDescription: "Short",
    description: "Long",
    specifications: [],
    priceMinor: 1000,
    currency: "XAF",
    stock: 5,
    availability: "in_stock",
    condition: "new",
    images: [],
    hasFallback: false,
    seo: {},
    ...overrides,
  };
}

const CATALOGUE: LocalizedProduct[] = [
  product({
    id: "a",
    title: "ThinkPad X1 Carbon",
    sku: "KC-LAP-01",
    priceMinor: 850000,
    categorySlug: "laptops",
    stock: 4,
  }),
  product({
    id: "b",
    title: "Ordinateur portable Pro",
    sku: "KC-LAP-02",
    priceMinor: 450000,
    categorySlug: "laptops",
    stock: 0,
    availability: "out_of_stock",
  }),
  product({
    id: "c",
    title: "USB-C Hub",
    sku: "KC-ACC-01",
    priceMinor: 25000,
    categorySlug: "accessories",
    stock: 12,
  }),
];

describe("normalizeSearchTerm", () => {
  it("lowercases and trims", () => {
    expect(normalizeSearchTerm("  ThinkPad  ")).toBe("thinkpad");
  });

  it("strips diacritics so an accented term matches an unaccented one", () => {
    // A French visitor typing without accents must still find the product.
    expect(normalizeSearchTerm("électrique")).toBe("electrique");
    expect(normalizeSearchTerm("Ordinateur")).toBe("ordinateur");
  });
});

describe("filterProducts", () => {
  it("returns everything with no filters", () => {
    expect(filterProducts(CATALOGUE, {})).toHaveLength(3);
  });

  it("matches a term against the title", () => {
    const result = filterProducts(CATALOGUE, { query: "thinkpad" });
    expect(result.map((entry) => entry.id)).toEqual(["a"]);
  });

  it("matches a term against the SKU", () => {
    const result = filterProducts(CATALOGUE, { query: "KC-ACC-01" });
    expect(result.map((entry) => entry.id)).toEqual(["c"]);
  });

  it("matches a term case-insensitively", () => {
    expect(filterProducts(CATALOGUE, { query: "USB-C" })).toHaveLength(1);
  });

  it("matches an accented query against an unaccented title", () => {
    const result = filterProducts(CATALOGUE, { query: "ordinateur" });
    expect(result.map((entry) => entry.id)).toEqual(["b"]);
  });

  it("filters by category", () => {
    const result = filterProducts(CATALOGUE, { category: "accessories" });
    expect(result.map((entry) => entry.id)).toEqual(["c"]);
  });

  it("filters by in-stock availability", () => {
    const result = filterProducts(CATALOGUE, { availability: "in_stock" });
    expect(result.map((entry) => entry.id).sort()).toEqual(["a", "c"]);
  });

  it("filters by out-of-stock availability", () => {
    const result = filterProducts(CATALOGUE, { availability: "out_of_stock" });
    expect(result.map((entry) => entry.id)).toEqual(["b"]);
  });

  it("combines a term and a category", () => {
    const result = filterProducts(CATALOGUE, {
      query: "hub",
      category: "accessories",
    });
    expect(result.map((entry) => entry.id)).toEqual(["c"]);
  });

  it("returns nothing when nothing matches", () => {
    expect(filterProducts(CATALOGUE, { query: "printer" })).toEqual([]);
  });

  it("does not mutate the input list", () => {
    const before = CATALOGUE.map((entry) => entry.id);
    filterProducts(CATALOGUE, { sort: "price-desc" });
    expect(CATALOGUE.map((entry) => entry.id)).toEqual(before);
  });
});

describe("sortProducts", () => {
  it("sorts by ascending price", () => {
    const result = sortProducts(CATALOGUE, "price-asc");
    expect(result.map((entry) => entry.priceMinor)).toEqual([
      25000, 450000, 850000,
    ]);
  });

  it("sorts by descending price", () => {
    const result = sortProducts(CATALOGUE, "price-desc");
    expect(result.map((entry) => entry.priceMinor)).toEqual([
      850000, 450000, 25000,
    ]);
  });

  it("sorts by name", () => {
    const result = sortProducts(CATALOGUE, "name-asc");
    expect(result[0]?.title).toBe("Ordinateur portable Pro");
  });

  it("is stable for equal prices", () => {
    // An unstable order would differ between the server render and a client
    // re-render, which React reports as a hydration mismatch.
    const equal = [
      product({ id: "z", priceMinor: 100 }),
      product({ id: "a", priceMinor: 100 }),
    ];
    const first = sortProducts(equal, "price-asc").map((entry) => entry.id);
    const second = sortProducts([...equal].reverse(), "price-asc").map(
      (entry) => entry.id,
    );
    expect(first).toEqual(second);
    expect(first).toEqual(["a", "z"]);
  });

  it("ranks a title match above a description-only match on relevance", () => {
    const items = [
      product({ id: "desc", title: "Something", shortDescription: "hub here" }),
      product({ id: "title", title: "Hub", shortDescription: "nothing" }),
    ];
    const result = sortProducts(items, "relevance", "hub");
    expect(result[0]?.id).toBe("title");
  });

  it("leaves order untouched on relevance with no term", () => {
    expect(
      sortProducts(CATALOGUE, "relevance").map((entry) => entry.id),
    ).toEqual(["a", "b", "c"]);
  });
});

describe("isStoreSort", () => {
  it("accepts the known sorts", () => {
    for (const value of ["relevance", "price-asc", "price-desc", "name-asc"]) {
      expect(isStoreSort(value), value).toBe(true);
    }
  });

  it("rejects anything else", () => {
    // The sort arrives from a URL parameter a visitor can edit freely.
    expect(isStoreSort("price")).toBe(false);
    expect(isStoreSort(undefined)).toBe(false);
    expect(isStoreSort("'; drop table products; --")).toBe(false);
  });
});

describe("sortLabelKey", () => {
  it("maps each sort to a translation key", () => {
    expect(sortLabelKey("price-asc")).toBe("store.sortPriceAsc");
    expect(sortLabelKey("relevance")).toBe("store.sortRelevance");
  });
});

describe("buildStoreQuery", () => {
  it("omits a default sort so one filter state has one URL", () => {
    const query = buildStoreQuery({ query: "hub", sort: "relevance" });
    expect(query).toBe("?q=hub");
  });

  it("keeps a non-default sort", () => {
    const query = buildStoreQuery({ sort: "price-asc" });
    expect(query).toBe("?sort=price-asc");
  });

  it("omits a cleared value rather than carrying the old one", () => {
    // The filters object is the whole desired state, so a key that is absent is
    // absent from the URL — no stale `q` can survive.
    const query = buildStoreQuery({ category: "laptops" });
    expect(query).not.toContain("q=");
    expect(query).toBe("?category=laptops");
  });

  it("returns an empty string when nothing is set", () => {
    expect(buildStoreQuery({})).toBe("");
  });

  it("combines several filters", () => {
    const query = buildStoreQuery({
      query: "hub",
      category: "accessories",
      availability: "in_stock",
      sort: "price-desc",
    });
    const params = new URLSearchParams(query);
    expect(params.get("q")).toBe("hub");
    expect(params.get("category")).toBe("accessories");
    expect(params.get("availability")).toBe("in_stock");
    expect(params.get("sort")).toBe("price-desc");
  });
});
