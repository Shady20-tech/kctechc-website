import type { LocalizedProduct } from "./types";

/**
 * Store search, filtering and sorting.
 *
 * Kept as pure functions over an already-localized product list so the behaviour
 * is testable without a database, and so the store page and the category page
 * cannot implement subtly different filtering.
 *
 * Search is done in application code rather than in SQL because the catalogue is
 * small and the searchable text is the *localized* text, which lives in
 * `content_translations` rather than on the product row. A SQL trigram search
 * would only ever match the English canonical title, so a French visitor
 * searching "ordinateur" would find nothing. The trigram index on
 * `products.title` remains useful for the admin search, which is canonical-only.
 */

export type StoreSort = "relevance" | "price-asc" | "price-desc" | "name-asc";

export const STORE_SORTS: readonly StoreSort[] = [
  "relevance",
  "price-asc",
  "price-desc",
  "name-asc",
];

export function isStoreSort(value: string | undefined): value is StoreSort {
  return STORE_SORTS.includes(value as StoreSort);
}

/** Translation key for a sort option's label. */
export function sortLabelKey(sort: StoreSort): string {
  switch (sort) {
    case "price-asc":
      return "store.sortPriceAsc";
    case "price-desc":
      return "store.sortPriceDesc";
    case "name-asc":
      return "store.sortNameAsc";
    default:
      return "store.sortRelevance";
  }
}

export type StoreFilters = {
  query?: string;
  category?: string;
  availability?: "in_stock" | "out_of_stock";
  sort?: StoreSort;
};

/**
 * Normalize a search term for matching.
 *
 * Diacritics are stripped so "électrique" matches "electrique" and vice versa —
 * a French visitor typing without accents, or an English one typing a product
 * name that contains them, should still find the product. Case and surrounding
 * whitespace are removed for the same reason.
 */
export function normalizeSearchTerm(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** The text a search term is matched against for one product. */
function searchableText(product: LocalizedProduct): string {
  return normalizeSearchTerm(
    [
      product.title,
      product.sku,
      product.brand ?? "",
      product.shortDescription,
    ].join(" "),
  );
}

/**
 * Filter and sort a localized product list.
 *
 * An unrecognised sort falls back to relevance rather than throwing, because the
 * sort arrives from a URL query parameter that a visitor can edit freely.
 */
export function filterProducts(
  products: readonly LocalizedProduct[],
  filters: StoreFilters,
): LocalizedProduct[] {
  const term = filters.query ? normalizeSearchTerm(filters.query) : "";
  const category = filters.category?.trim().toLowerCase() ?? "";

  const filtered = products.filter((product) => {
    if (category && product.categorySlug.toLowerCase() !== category) {
      return false;
    }

    if (filters.availability === "in_stock" && product.stock <= 0) return false;
    if (filters.availability === "out_of_stock" && product.stock > 0) {
      return false;
    }

    if (term.length > 0 && !searchableText(product).includes(term)) {
      return false;
    }

    return true;
  });

  return sortProducts(filtered, filters.sort ?? "relevance", term);
}

/**
 * Sort a product list.
 *
 * Price and name are compared with a locale-independent tiebreak on id, so the
 * order is stable: two products at the same price must not swap places between
 * the server render and a client re-render, which would be a hydration mismatch.
 */
export function sortProducts(
  products: readonly LocalizedProduct[],
  sort: StoreSort,
  term = "",
): LocalizedProduct[] {
  const list = [...products];

  switch (sort) {
    case "price-asc":
      return list.sort(
        (a, b) => a.priceMinor - b.priceMinor || a.id.localeCompare(b.id),
      );
    case "price-desc":
      return list.sort(
        (a, b) => b.priceMinor - a.priceMinor || a.id.localeCompare(b.id),
      );
    case "name-asc":
      return list.sort(
        (a, b) =>
          a.title.localeCompare(b.title, undefined, { sensitivity: "base" }) ||
          a.id.localeCompare(b.id),
      );
    default:
      // Relevance: a product whose title contains the term ranks above one that
      // only matches on its description, then in-stock before out-of-stock.
      // With no term this degrades to the catalogue's own order.
      if (term.length === 0) return list;
      return list.sort((a, b) => {
        const aTitle = normalizeSearchTerm(a.title).includes(term) ? 0 : 1;
        const bTitle = normalizeSearchTerm(b.title).includes(term) ? 0 : 1;
        if (aTitle !== bTitle) return aTitle - bTitle;
        const aStock = a.stock > 0 ? 0 : 1;
        const bStock = b.stock > 0 ? 0 : 1;
        return aStock - bStock || a.id.localeCompare(b.id);
      });
  }
}

/**
 * Serialize a filter state as a store query string.
 *
 * The filters object is the complete desired state, so a key absent from it is
 * absent from the URL. That is what keeps one filter state to one URL: an empty
 * or default value never appears, so `/store` and `/store?sort=relevance&q=` are
 * not two addresses for the same page — the duplicate-content concern that also
 * governs locale routing.
 *
 * Built from scratch rather than by patching the incoming params, so a stale
 * value cannot survive a filter change and a tracking parameter is not carried
 * into an internal link.
 */
export function buildStoreQuery(filters: StoreFilters): string {
  const params = new URLSearchParams();

  if (filters.query && filters.query.length > 0) params.set("q", filters.query);
  if (filters.category && filters.category.length > 0) {
    params.set("category", filters.category);
  }
  if (filters.availability) params.set("availability", filters.availability);
  // `relevance` is the default, so it is omitted rather than written out.
  if (filters.sort && filters.sort !== "relevance") {
    params.set("sort", filters.sort);
  }

  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}
