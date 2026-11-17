import {
  cleanParam,
  firstParam,
  parseCurrencyCode,
  parsePositiveInt,
  serializeQuery,
} from "@/lib/marketplace/query";

/**
 * The store's typed filter model and URL contract.
 *
 * Every value is parsed defensively out of the URL, because a query parameter is
 * text a visitor can edit: a bad price bound must read as "no bound" rather than
 * as a request PostgREST rejects, and an unknown sort must fall back to relevance
 * rather than throw. The parsed object is the complete desired state, so the
 * serializer can be built from it alone — a key absent here is absent from the
 * URL, which is what keeps one filter state to one address.
 *
 * Filtering itself happens in the database (`search_products`, see
 * `./catalogue`), not here. This module deliberately holds no matching logic: a
 * second implementation in TypeScript would drift from the SQL, and loading the
 * catalogue to filter it in React is the approach the brief rules out.
 */

export type StoreSort =
  | "relevance"
  | "newest"
  | "price-asc"
  | "price-desc"
  | "name-asc";

export const STORE_SORTS: readonly StoreSort[] = [
  "relevance",
  "newest",
  "price-asc",
  "price-desc",
  "name-asc",
];

export const DEFAULT_STORE_SORT: StoreSort = "relevance";

export function isStoreSort(value: string | undefined): value is StoreSort {
  return STORE_SORTS.includes(value as StoreSort);
}

/** Translation key for a sort option's label. */
export function sortLabelKey(sort: StoreSort): string {
  switch (sort) {
    case "newest":
      return "store.sortNewest";
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

/** The store's primary currency, matching the brief (XAF/FCFA). */
export const STORE_PRIMARY_CURRENCY = "XAF";

/** One page of the catalogue, at this size. */
export const STORE_PAGE_SIZE = 12;

export type StoreFilters = {
  query?: string;
  /** A category's canonical slug. */
  category?: string;
  /** The currency the price bounds are expressed in. */
  currency?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  brand?: string;
  sort?: StoreSort;
  page?: number;
};

export const STORE_FILTER_PARAMS = [
  "q",
  "category",
  "currency",
  "minPrice",
  "maxPrice",
  "inStock",
  "brand",
  "sort",
  "page",
] as const;

export type StoreFilterKey = (typeof STORE_FILTER_PARAMS)[number];

/** Parse a store filter state from raw URL search params. */
export function parseStoreFilters(
  query: Record<string, string | string[] | undefined>,
): StoreFilters {
  const minPrice = parsePositiveInt(firstParam(query.minPrice), { min: 0 });
  const maxPrice = parsePositiveInt(firstParam(query.maxPrice), { min: 0 });
  const currency = parseCurrencyCode(firstParam(query.currency));

  // A price bound without a currency is applied in the store's primary currency
  // rather than in an unknown unit. Comparing a number against a price in a
  // currency the visitor never chose is exactly the cross-currency comparison the
  // brief forbids, so the bound always carries the currency it is expressed in.
  const hasPrice = minPrice !== undefined || maxPrice !== undefined;
  const resolvedCurrency = hasPrice
    ? (currency ?? STORE_PRIMARY_CURRENCY)
    : currency;

  return {
    query: cleanParam(firstParam(query.q)),
    category: cleanParam(firstParam(query.category)),
    currency: resolvedCurrency,
    minPrice,
    maxPrice,
    // Only `true` is a filter. `?inStock=false` is not "out of stock only" — that
    // would be a second, unsupported filter — it is simply "no filter".
    //
    // `?availability=in_stock` is the shape this page shipped with, so it is read
    // as the same filter rather than silently dropped: an inbound link or bookmark
    // written before the redesign must keep working. `out_of_stock` is not offered
    // and is not accepted, because there is no "out of stock only" filter.
    inStock:
      firstParam(query.inStock) === "true" ||
      firstParam(query.availability) === "in_stock"
        ? true
        : undefined,
    brand: cleanParam(firstParam(query.brand)),
    sort: isStoreSort(firstParam(query.sort))
      ? (firstParam(query.sort) as StoreSort)
      : undefined,
    page: parsePositiveInt(firstParam(query.page), { min: 1 }),
  };
}

/** Serialize a store filter state as a query string. */
export function buildStoreQuery(filters: StoreFilters): string {
  return serializeQuery({
    q: filters.query,
    category: filters.category,
    currency: filters.currency,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    inStock: filters.inStock ? "true" : undefined,
    brand: filters.brand,
    // The default is omitted rather than written out, so `/store` and
    // `/store?sort=relevance` are not two addresses for the same page.
    sort:
      filters.sort && filters.sort !== DEFAULT_STORE_SORT
        ? filters.sort
        : undefined,
    page: filters.page && filters.page > 1 ? filters.page : undefined,
  });
}

/** True when at least one filter narrows the catalogue. */
export function hasActiveStoreFilters(filters: StoreFilters): boolean {
  return (
    Boolean(filters.query) ||
    Boolean(filters.category) ||
    Boolean(filters.brand) ||
    filters.minPrice !== undefined ||
    filters.maxPrice !== undefined ||
    filters.inStock === true
  );
}

/** The active filters, in the order the chips are rendered. */
export function activeStoreFilterKeys(filters: StoreFilters): StoreFilterKey[] {
  const keys: StoreFilterKey[] = [];
  if (filters.query) keys.push("q");
  if (filters.category) keys.push("category");
  if (filters.brand) keys.push("brand");
  if (filters.inStock) keys.push("inStock");
  if (filters.minPrice !== undefined) keys.push("minPrice");
  if (filters.maxPrice !== undefined) keys.push("maxPrice");
  return keys;
}

/**
 * Remove one filter, returning the new state.
 *
 * Page is dropped on every removal: page 4 of a narrower result set is not a
 * meaningful page. A price bound also clears the currency when it was the only
 * reason the currency was present, so removing "max price" does not leave an
 * orphaned `currency` in the URL.
 */
export function removeStoreFilter(
  filters: StoreFilters,
  key: StoreFilterKey,
): StoreFilters {
  const next: StoreFilters = { ...filters, page: undefined };
  switch (key) {
    case "q":
      next.query = undefined;
      break;
    case "category":
      next.category = undefined;
      break;
    case "brand":
      next.brand = undefined;
      break;
    case "inStock":
      next.inStock = undefined;
      break;
    case "minPrice":
      next.minPrice = undefined;
      break;
    case "maxPrice":
      next.maxPrice = undefined;
      break;
    default:
      break;
  }
  if (next.minPrice === undefined && next.maxPrice === undefined) {
    next.currency = undefined;
  }
  return next;
}
