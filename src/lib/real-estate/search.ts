import {
  LISTING_PROPERTY_KINDS,
  LISTING_STATUSES,
  LISTING_TYPES,
  PROPERTY_TYPES,
  PUBLIC_LISTING_STATUSES,
  type ListingPropertyKind,
  type ListingStatus,
  type ListingType,
  type PropertyType,
} from "./enums";
import type { Database } from "@/lib/db/database.types";
import type { PropertyListingRecord } from "./types";

/**
 * Real-estate filter parsing, URL serialization and related-listing selection.
 *
 * The filtering itself is NOT here. It lives in `search_property_listings`, the
 * SQL function, and the reason is worth stating because this file used to hold a
 * TypeScript implementation and no longer does.
 *
 * The browser filters, counts and paginates in one query. A TypeScript filter over
 * a loaded list cannot do that: it can only filter the rows that happened to be
 * fetched, so its result count describes the fetched page rather than the market,
 * and paginating it would mean loading the whole catalogue into the browser —
 * which the brief forbids. `filterListings` and `sortListings` were deleted along
 * with the surface that used them, rather than kept as an unused second
 * implementation that would drift from the SQL that actually runs.
 *
 * What remains here is the part that is genuinely presentation logic: turning a
 * query string into a typed filter state, turning a filter state back into a
 * canonical query string, and describing which filters are active. Those are pure,
 * so the "one filter state, one URL" rule is unit-testable without a database.
 */

/**
 * The orderings the browser offers.
 *
 * `most-viewed` is included because view counts are already recorded
 * (`record_listing_view`) and a visitor looking for a popular property is a real
 * use. It is not the default: a default that surfaces whatever is most-viewed
 * would be a ranking the company did not choose.
 */
export type ListingSort =
  | "relevance"
  | "newest"
  | "price-asc"
  | "price-desc"
  | "most-viewed";

/** The sort options, in the order the toolbar offers them. */
export const LISTING_SORTS: readonly ListingSort[] = [
  "relevance",
  "newest",
  "price-asc",
  "price-desc",
  "most-viewed",
];

/**
 * The default ordering.
 *
 * "Most relevant" is first in the toolbar because it is the most useful default
 * when a keyword is present, but it is not the URL default: an unfiltered browse
 * has no query to rank against, so `relevance` would rank every listing equally
 * and degrade to `newest`. The page therefore defaults to `newest` and never
 * writes it to the URL, keeping one filter state to one URL.
 */
export const DEFAULT_LISTING_SORT: ListingSort = "newest";

export function isListingSort(value: string | undefined): value is ListingSort {
  return LISTING_SORTS.includes(value as ListingSort);
}

/** Translation key for a sort option's label. */
export function listingSortLabelKey(sort: ListingSort): string {
  switch (sort) {
    case "relevance":
      return "realEstate.search.sortRelevance";
    case "price-asc":
      return "realEstate.search.sortPriceAsc";
    case "price-desc":
      return "realEstate.search.sortPriceDesc";
    case "most-viewed":
      return "realEstate.search.sortMostViewed";
    default:
      return "realEstate.search.sortNewest";
  }
}

/**
 * Map a URL sort to the database enum.
 *
 * The URL uses hyphens (`price-asc`) because that is the readable form; the enum
 * uses underscores because that is the SQL convention. Keeping the two spellings
 * separate means neither has to be the awkward one, but it does mean this mapping
 * has to exist — and it is asserted exhaustively by `search.test.ts` against
 * `listing_sort_order` in the migration, so a new sort cannot be added to one side
 * only.
 *
 * Typed as the generated enum rather than as `string`, so a value that is not a
 * member of `listing_sort_order` is a type error here rather than a runtime
 * rejection from the RPC.
 */
export const LISTING_SORT_TO_SQL: Record<
  ListingSort,
  Database["public"]["Enums"]["listing_sort_order"]
> = {
  relevance: "relevance",
  newest: "newest",
  "price-asc": "price_asc",
  "price-desc": "price_desc",
  "most-viewed": "most_viewed",
};

/**
 * The listing statuses a visitor may filter by, in the order they are offered.
 *
 * The four public statuses, derived from `PUBLIC_LISTING_STATUSES` and the enum's
 * own order rather than retyped, so this list cannot contain a status the database
 * would refuse to return and cannot miss one it would.
 */
export const LISTING_STATUS_FILTERS: readonly ListingStatus[] =
  LISTING_STATUSES.filter((status) =>
    (PUBLIC_LISTING_STATUSES as readonly string[]).includes(status),
  );

export function listingStatusLabelKey(status: ListingStatus): string {
  // The labels live under `statuses`, beside the other enum labels, so a status
  // reads the same here as it does on a card. A second copy under `search` would
  // be a translation an editor has to remember to update twice.
  return `realEstate.statuses.${status}`;
}

export type ListingFilters = {
  query?: string;
  regionSlug?: string;
  divisionSlug?: string;
  subdivisionSlug?: string;
  /** Free-text city or neighbourhood, matched against the stored locality. */
  locality?: string;
  listingType?: ListingType;
  propertyKind?: ListingPropertyKind;
  propertyType?: PropertyType;
  statuses?: readonly ListingStatus[];
  /**
   * ISO 4217 code to filter prices by.
   *
   * Prices are compared within ONE currency only. The database stores a currency
   * per listing and there is no exchange-rate feed, so comparing a XAF price to a
   * NGN price would be comparing two different units as though they were equal.
   * When this is unset the price bounds still apply, but only among listings
   * whose currency matches the visitor's chosen one once they pick one — see the
   * note on `buildListingQuery`.
   */
  currency?: string;
  /** Restrict to listings whose landlord or agent holds a verified capability. */
  verifiedOnly?: boolean;
  /**
   * Amenity slugs the listing must have (all of them).
   *
   * The slugs are free text in the database, so the sidebar offers only the ones
   * that actually occur — see `loadListingFacets`. Offering a fixed list would
   * risk a checkbox that matches nothing.
   */
  amenities?: readonly string[];
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  minBathrooms?: number;
  minSize?: number;
  maxSize?: number;
  sort?: ListingSort;
  /** 1-based. Page 1 is the default and is never written to a URL. */
  page?: number;
};

/** The recognized query parameters, for parsing without accepting extras. */
export const LISTING_FILTER_PARAMS = [
  "q",
  "region",
  "division",
  "subdivision",
  "locality",
  "type",
  "kind",
  "propertyType",
  "status",
  "currency",
  "verified",
  "amenity",
  "minPrice",
  "maxPrice",
  "minBedrooms",
  "minBathrooms",
  "minSize",
  "maxSize",
  "sort",
  "page",
  "view",
] as const;

/**
 * The primary Cameroon currency, and the default the price controls state.
 *
 * XAF has no minor unit (`minorUnitDivisor("XAF") === 1`), so a price is already
 * a whole franc. The currency is presented because a listing may be priced in
 * another currency, and a price filter must say which unit it applies to.
 */
export const PRIMARY_CURRENCY = "XAF";

/**
 * Parse a currency code, accepting only a three-letter ISO-shaped value.
 *
 * Uppercased so `?currency=xaf` and `?currency=XAF` are one filter state. A value
 * that is not three letters is dropped rather than passed to the database, whose
 * `property_listings_currency_format` check would reject it and surface as a
 * failed request.
 */
export function parseCurrency(value: string | null): string | undefined {
  if (value === null) return undefined;
  const trimmed = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(trimmed) ? trimmed : undefined;
}

/** Parse the verified-only flag. Present and not `"false"` means true. */
export function parseVerifiedOnly(value: string | null): boolean | undefined {
  if (value === null) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "" || normalized === "false" || normalized === "0") {
    return undefined;
  }
  return true;
}

/**
 * Parse the amenity filter.
 *
 * Accepts a repeat (`amenity=pool&amenity=solar`) and a comma-joined single value,
 * the same two forms `parseListingStatuses` accepts and for the same reason: a
 * link built by this application and one pasted by hand should mean the same
 * thing. Slugs are lowercased and trimmed, and an empty list is `undefined` rather
 * than `[]` so the filter reads as absent.
 */
export function parseAmenities(
  value: string | string[] | undefined,
): string[] | undefined {
  if (value === undefined) return undefined;
  const raw = Array.isArray(value) ? value : [value];
  const values = raw
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);

  const unique = [...new Set(values)];
  return unique.length > 0 ? unique : undefined;
}

/**
 * How many listings one page of results holds.
 *
 * Fixed rather than a parameter. A `perPage` the visitor can set is a second way
 * to express the same result set, which multiplies the URL space and the cache
 * keys for no benefit to someone browsing property.
 */
export const LISTINGS_PAGE_SIZE = 12;

/**
 * Normalize a search term for matching.
 *
 * Diacritics are stripped so "électrique" matches "electrique", matching the
 * store's behaviour and its reason: a French visitor typing without accents
 * should still find the listing.
 */
export function normalizeSearchTerm(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Parse an integer query parameter, rejecting anything that is not a number. */
export function parseNumberParam(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  const parsed = Number(value.replace(/[\s\u00a0,]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Parse the listing type filter, ignoring an unknown value. */
export function parseListingType(value: string | null): ListingType | undefined {
  return (LISTING_TYPES as readonly string[]).includes(value ?? "")
    ? (value as ListingType)
    : undefined;
}

/** Parse the property kind filter, ignoring an unknown value. */
export function parsePropertyKind(
  value: string | null,
): ListingPropertyKind | undefined {
  return (LISTING_PROPERTY_KINDS as readonly string[]).includes(value ?? "")
    ? (value as ListingPropertyKind)
    : undefined;
}

/** Parse the property class filter, ignoring an unknown value. */
export function parsePropertyType(value: string | null): PropertyType | undefined {
  return (PROPERTY_TYPES as readonly string[]).includes(value ?? "")
    ? (value as PropertyType)
    : undefined;
}

/**
 * Normalize a filter query string into its canonical form.
 *
 * `page` and `view` are dropped: neither is a filter, and storing either would
 * make a saved search reopen a specific page of a result set that has since
 * changed, or a view of it the customer did not ask for. The remaining parameters
 * are parsed and re-serialized through this module's own functions, so the result
 * is byte-identical to what the listings page produces for the same filters —
 * which is what makes a stored search reopen exactly the view it was saved from.
 */
export function normalizeSearchQuery(queryString: string): string {
  const params = new URLSearchParams(queryString.replace(/^\?/, ""));
  const record: Record<string, string | string[]> = {};
  for (const [key, value] of params) {
    if (key === "page" || key === "view") continue;
    const existing = record[key];
    if (existing === undefined) {
      record[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      record[key] = [existing, value];
    }
  }
  return buildListingQuery(parseListingFilters(record));
}

/** Parse the sort parameter, ignoring an unknown value. */
export function parseListingSort(value: string | null): ListingSort | undefined {
  return isListingSort(value ?? undefined) ? (value as ListingSort) : undefined;
}

/**
 * Parse a repeated status parameter.
 *
 * Accepts repeats (`status=published&status=sold`) and a comma-joined single
 * value, because both forms reach here depending on whether the link was built by
 * this application or pasted. Unknown values are dropped rather than rejecting the
 * whole filter: a stale bookmark naming a status that no longer exists should show
 * the rest of the search, not an error.
 */
export function parseListingStatuses(
  value: string | string[] | undefined,
): ListingStatus[] | undefined {
  if (value === undefined) return undefined;
  const raw = Array.isArray(value) ? value : [value];
  const values = raw
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.trim())
    .filter((entry) =>
      (LISTING_STATUS_FILTERS as readonly string[]).includes(entry),
    );

  const unique = [...new Set(values)] as ListingStatus[];
  return unique.length > 0 ? unique : undefined;
}

/**
 * Parse a positive integer, dropping zero and negatives.
 *
 * The fractional part is dropped rather than preserved. Every filter this guards
 * is an integer column — `bigint` for prices, `smallint` for counts and `integer`
 * for areas — so `?minBedrooms=1.5` would be refused by PostgREST and surface as a
 * failed request. Truncating keeps the filter the visitor asked for at its whole
 * part instead of turning a typo into an error page.
 */
function parsePositive(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  const whole = Math.floor(value);
  return whole > 0 ? whole : undefined;
}

/** Parse a 1-based page number. Page 1 is the default, so it is not returned. */
export function parsePageNumber(value: string | null): number | undefined {
  const parsed = parseNumberParam(value);
  if (parsed === undefined) return undefined;
  const page = Math.floor(parsed);
  return page > 1 ? page : undefined;
}

/**
 * The filter keys a visitor can remove, in the order the chips are shown.
 *
 * Sort and page are deliberately absent: neither is a filter, and a "chip" for
 * them would read as a constraint on the results when it only changes their order
 * or position.
 */
export const FILTER_KEYS = [
  "q",
  "region",
  "division",
  "subdivision",
  "locality",
  "type",
  "kind",
  "propertyType",
  "status",
  "currency",
  "verified",
  "amenity",
  "minPrice",
  "maxPrice",
  "minBedrooms",
  "minBathrooms",
  "minSize",
  "maxSize",
] as const;

export type FilterKey = (typeof FILTER_KEYS)[number];

/** True when a single filter key is set. */
export function isFilterActive(filters: ListingFilters, key: FilterKey): boolean {
  switch (key) {
    case "q":
      return Boolean(filters.query && filters.query.length > 0);
    case "region":
      return Boolean(filters.regionSlug);
    case "division":
      return Boolean(filters.divisionSlug);
    case "subdivision":
      return Boolean(filters.subdivisionSlug);
    case "locality":
      return Boolean(filters.locality);
    case "type":
      return Boolean(filters.listingType);
    case "kind":
      return Boolean(filters.propertyKind);
    case "propertyType":
      return Boolean(filters.propertyType);
    case "status":
      return Boolean(filters.statuses && filters.statuses.length > 0);
    case "currency":
      return Boolean(filters.currency);
    case "verified":
      return filters.verifiedOnly === true;
    case "amenity":
      return Boolean(filters.amenities && filters.amenities.length > 0);
    case "minPrice":
      return filters.minPrice !== undefined;
    case "maxPrice":
      return filters.maxPrice !== undefined;
    case "minBedrooms":
      return filters.minBedrooms !== undefined;
    case "minBathrooms":
      return filters.minBathrooms !== undefined;
    case "minSize":
      return filters.minSize !== undefined;
    case "maxSize":
      return filters.maxSize !== undefined;
  }
}

/** The active filter keys, in chip order. */
export function activeFilterKeys(filters: ListingFilters): FilterKey[] {
  return FILTER_KEYS.filter((key) => isFilterActive(filters, key));
}

/**
 * Remove one filter, returning a new state.
 *
 * Page resets to 1 by omission. Removing a filter changes the result set, and
 * staying on page 4 of a now-shorter list is how a visitor lands on an empty page
 * and concludes there are no results.
 *
 * Removing a region also removes its division and subdivision, because a division
 * without its region is not a state the cascading selector can display — it has no
 * option for it. Leaving them behind would produce a filter the visitor cannot see
 * and therefore cannot clear.
 */
export function removeListingFilter(
  filters: ListingFilters,
  key: FilterKey,
): ListingFilters {
  const next: ListingFilters = { ...filters, page: undefined };
  switch (key) {
    case "q":
      next.query = undefined;
      break;
    case "region":
      next.regionSlug = undefined;
      next.divisionSlug = undefined;
      next.subdivisionSlug = undefined;
      break;
    case "division":
      next.divisionSlug = undefined;
      next.subdivisionSlug = undefined;
      break;
    case "subdivision":
      next.subdivisionSlug = undefined;
      break;
    case "locality":
      next.locality = undefined;
      break;
    case "type":
      next.listingType = undefined;
      break;
    case "kind":
      next.propertyKind = undefined;
      break;
    case "propertyType":
      next.propertyType = undefined;
      break;
    case "status":
      next.statuses = undefined;
      break;
    case "currency":
      // Clearing the currency also clears the price bounds: a bound expressed in
      // one currency has no meaning once the currency is gone, and leaving it
      // would apply a number the visitor can no longer see to a unit they did not
      // choose.
      next.currency = undefined;
      next.minPrice = undefined;
      next.maxPrice = undefined;
      break;
    case "verified":
      next.verifiedOnly = undefined;
      break;
    case "amenity":
      next.amenities = undefined;
      break;
    case "minPrice":
      next.minPrice = undefined;
      break;
    case "maxPrice":
      next.maxPrice = undefined;
      break;
    case "minBedrooms":
      next.minBedrooms = undefined;
      break;
    case "minBathrooms":
      next.minBathrooms = undefined;
      break;
    case "minSize":
      next.minSize = undefined;
      break;
    case "maxSize":
      next.maxSize = undefined;
      break;
  }
  return next;
}

/**
 * Serialize a filter state as a listings query string.
 *
 * The filters object is the complete desired state, so a key absent from it is
 * absent from the URL. Defaults are omitted: `newest` is the default sort and
 * never appears, page 1 is never written, and an empty query is not written. That
 * is what keeps one filter state to one URL, which is the duplicate-content rule
 * the locale routing already follows — `/listings` and `/listings?sort=newest`
 * must not be two indexable addresses for one page.
 *
 * Built from scratch rather than by patching the incoming params, so a tracking
 * parameter is not carried into an internal link.
 *
 * Status values are written in the enum's declaration order rather than the order
 * they were supplied, so two links to the same set of statuses serialize
 * identically.
 */
export function buildListingQuery(filters: ListingFilters): string {
  const params = new URLSearchParams();

  if (filters.query && filters.query.length > 0) params.set("q", filters.query);
  if (filters.regionSlug) params.set("region", filters.regionSlug);
  if (filters.divisionSlug) params.set("division", filters.divisionSlug);
  if (filters.subdivisionSlug) params.set("subdivision", filters.subdivisionSlug);
  if (filters.locality) params.set("locality", filters.locality);
  if (filters.listingType) params.set("type", filters.listingType);
  if (filters.propertyKind) params.set("kind", filters.propertyKind);
  if (filters.propertyType) params.set("propertyType", filters.propertyType);
  if (filters.statuses && filters.statuses.length > 0) {
    const ordered = LISTING_STATUS_FILTERS.filter((status) =>
      filters.statuses?.includes(status),
    );
    params.set("status", ordered.join(","));
  }
  // The currency is written whenever a price bound is present, even if it is the
  // primary one, because a bare number with no unit is what the brief forbids.
  // It is written even when the visitor never changed the selector, so a shared
  // link states the unit its price bounds are in.
  if (filters.currency) params.set("currency", filters.currency);
  if (filters.verifiedOnly === true) params.set("verified", "true");
  if (filters.amenities && filters.amenities.length > 0) {
    // Sorted so two links to the same set of amenities serialize identically.
    params.set("amenity", [...filters.amenities].sort().join(","));
  }
  if (filters.minPrice !== undefined) {
    params.set("minPrice", String(filters.minPrice));
  }
  if (filters.maxPrice !== undefined) {
    params.set("maxPrice", String(filters.maxPrice));
  }
  if (filters.minBedrooms !== undefined) {
    params.set("minBedrooms", String(filters.minBedrooms));
  }
  if (filters.minBathrooms !== undefined) {
    params.set("minBathrooms", String(filters.minBathrooms));
  }
  if (filters.minSize !== undefined) {
    params.set("minSize", String(filters.minSize));
  }
  if (filters.maxSize !== undefined) {
    params.set("maxSize", String(filters.maxSize));
  }
  if (filters.sort && filters.sort !== "newest") params.set("sort", filters.sort);
  if (filters.page !== undefined && filters.page > 1) {
    params.set("page", String(filters.page));
  }

  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

/**
 * True when a filter state differs from the default.
 *
 * Used to decide whether to offer "clear filters", and — more importantly — to
 * decide whether the page may be indexed. An arbitrary filter combination is a
 * view of the catalogue, not a page with its own content, so a filtered URL is
 * `noindex, follow`. This is the single place that question is answered for both
 * purposes.
 *
 * Sort and page are excluded on purpose: neither changes *which* properties match,
 * and treating a sort as a filter would make the default ordering look unfiltered
 * while `?sort=newest` looked filtered.
 */
export function hasActiveFilters(filters: ListingFilters): boolean {
  return activeFilterKeys(filters).length > 0;
}

/** The value of the first occurrence of a possibly-repeated query parameter. */
export function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/**
 * Build a typed filter state from a route's `searchParams`.
 *
 * Every value is parsed defensively, because these arrive from a URL a visitor
 * can edit freely: an unknown type, kind or sort is dropped rather than throwing,
 * and a non-numeric price is ignored rather than becoming NaN. A `NaN` reaching
 * the RPC would be sent as null and silently disable the filter, which is a worse
 * failure than ignoring it — the visitor would see results their filter was meant
 * to exclude.
 *
 * A subdivision without a division, or a division without a region, is preserved
 * rather than discarded: the RPC filters on each independently, so
 * `?subdivision=limbe` alone is a valid way to ask for Limbe.
 */
export function parseListingFilters(
  searchParams: Record<string, string | string[] | undefined>,
): ListingFilters {
  const filters: ListingFilters = {
    query: firstParam(searchParams.q)?.trim() || undefined,
    regionSlug: firstParam(searchParams.region)?.trim() || undefined,
    divisionSlug: firstParam(searchParams.division)?.trim() || undefined,
    subdivisionSlug: firstParam(searchParams.subdivision)?.trim() || undefined,
    locality: firstParam(searchParams.locality)?.trim() || undefined,
    listingType: parseListingType(firstParam(searchParams.type)),
    propertyKind: parsePropertyKind(firstParam(searchParams.kind)),
    propertyType: parsePropertyType(firstParam(searchParams.propertyType)),
    statuses: parseListingStatuses(searchParams.status),
    currency: parseCurrency(firstParam(searchParams.currency)),
    verifiedOnly: parseVerifiedOnly(firstParam(searchParams.verified)),
    amenities: parseAmenities(searchParams.amenity),
    minPrice: parsePositive(parseNumberParam(firstParam(searchParams.minPrice))),
    maxPrice: parsePositive(parseNumberParam(firstParam(searchParams.maxPrice))),
    minBedrooms: parsePositive(
      parseNumberParam(firstParam(searchParams.minBedrooms)),
    ),
    minBathrooms: parsePositive(
      parseNumberParam(firstParam(searchParams.minBathrooms)),
    ),
    minSize: parsePositive(parseNumberParam(firstParam(searchParams.minSize))),
    maxSize: parsePositive(parseNumberParam(firstParam(searchParams.maxSize))),
    sort: parseListingSort(firstParam(searchParams.sort)),
    page: parsePageNumber(firstParam(searchParams.page)),
  };

  // A price range written backwards is a typo, not an empty result set. Swapping
  // it shows the properties between the two numbers the visitor actually typed,
  // which is what they meant.
  if (
    filters.minPrice !== undefined &&
    filters.maxPrice !== undefined &&
    filters.minPrice > filters.maxPrice
  ) {
    const { minPrice, maxPrice } = filters;
    filters.minPrice = maxPrice;
    filters.maxPrice = minPrice;
  }

  // The same for size.
  if (
    filters.minSize !== undefined &&
    filters.maxSize !== undefined &&
    filters.minSize > filters.maxSize
  ) {
    const { minSize, maxSize } = filters;
    filters.minSize = maxSize;
    filters.maxSize = minSize;
  }

  return filters;
}

/**
 * The bedroom and bathroom counts offered as filters.
 *
 * A short fixed list rather than a range derived from the data: a filter that
 * changes as listings come and go makes the same URL mean different things over
 * time, which is bad for caching and worse for a shared link.
 */
export const BEDROOM_FILTER_OPTIONS = [1, 2, 3, 4, 5] as const;
export const BATHROOM_FILTER_OPTIONS = [1, 2, 3, 4] as const;

/**
 * The property categories the marketplace navigation offers.
 *
 * Each category is a *named filter combination*, not a new taxonomy: the
 * database's own `listing_type`, `listing_property_kind` and `property_type`
 * values are what back these, and the sidebar's count for a category comes from
 * the matching bucket in `listing_facets()`. That is what keeps a category link
 * and its count from disagreeing — both are the same predicate.
 *
 * `bucket` is the identifier the facet function returns and the URL carries, so
 * adding a category means adding a bucket in SQL and an entry here; the two are
 * asserted to agree by `search.test.ts` against the migration.
 */
export type PropertyCategoryBucket =
  | "all"
  | "for_sale"
  | "for_rent"
  | "short_term"
  | "land_sale"
  | "land_rent"
  | "commercial"
  | "house"
  | "apartment";

export type PropertyCategory = {
  bucket: PropertyCategoryBucket;
  /** The filter state this category stands for. */
  filters: Pick<ListingFilters, "listingType" | "propertyKind" | "propertyType">;
  /** The message key for its label, under `realEstate.categories.*`. */
  labelKey: string;
};

export const PROPERTY_CATEGORIES: readonly PropertyCategory[] = [
  { bucket: "all", filters: {}, labelKey: "realEstate.categories.all" },
  {
    bucket: "for_sale",
    filters: { listingType: "sale" },
    labelKey: "realEstate.categories.forSale",
  },
  {
    bucket: "for_rent",
    filters: { listingType: "rent" },
    labelKey: "realEstate.categories.forRent",
  },
  {
    bucket: "land_sale",
    filters: { listingType: "sale", propertyKind: "land" },
    labelKey: "realEstate.categories.landSale",
  },
  {
    bucket: "land_rent",
    filters: { listingType: "rent", propertyKind: "land" },
    labelKey: "realEstate.categories.landRent",
  },
  {
    bucket: "short_term",
    filters: { listingType: "short_term" },
    labelKey: "realEstate.categories.shortTerm",
  },
  {
    bucket: "commercial",
    filters: { propertyType: "commercial" },
    labelKey: "realEstate.categories.commercial",
  },
  {
    bucket: "house",
    filters: { propertyKind: "house" },
    labelKey: "realEstate.categories.house",
  },
  {
    bucket: "apartment",
    filters: { propertyKind: "apartment" },
    labelKey: "realEstate.categories.apartment",
  },
];

/** The category whose filter state matches, for marking the active one. */
export function categoryForFilters(
  filters: ListingFilters,
): PropertyCategoryBucket | undefined {
  const match = PROPERTY_CATEGORIES.find(
    (category) =>
      (category.filters.listingType ?? undefined) === filters.listingType &&
      (category.filters.propertyKind ?? undefined) === filters.propertyKind &&
      (category.filters.propertyType ?? undefined) === filters.propertyType,
  );
  // `all` matches the empty filter state, so an unfiltered browse reports it.
  return match?.bucket;
}

/** Apply a category to a filter state, clearing the fields it does not set. */
export function applyCategory(
  filters: ListingFilters,
  bucket: PropertyCategoryBucket,
): ListingFilters {
  const category =
    PROPERTY_CATEGORIES.find((entry) => entry.bucket === bucket) ??
    PROPERTY_CATEGORIES[0]!;
  return {
    ...filters,
    listingType: category.filters.listingType,
    propertyKind: category.filters.propertyKind,
    propertyType: category.filters.propertyType,
    page: undefined,
  };
}

/**
 * Pick listings related to one listing, for the "more properties" strip.
 *
 * Relatedness is a weighted score rather than an equality: a listing in the same
 * region and of the same kind is more relevant than one that merely shares a
 * kind, and a same-region listing with a different kind is still more useful than
 * an unrelated one. A listing that scores nothing is never shown — filling the
 * strip with arbitrary properties would present unrelated inventory as a
 * recommendation, which is a claim the page cannot support.
 *
 * Ties break on the reference so the order is stable between the server render
 * and any re-render.
 */
export function selectRelatedListings(
  all: readonly PropertyListingRecord[],
  subject: PropertyListingRecord,
  limit = 3,
): PropertyListingRecord[] {
  const scored = all
    .filter((candidate) => candidate.id !== subject.id)
    .map((candidate) => {
      let score = 0;
      if (candidate.regionSlug === subject.regionSlug) score += 2;
      if (candidate.propertyKind === subject.propertyKind) score += 1;
      if (candidate.listingType === subject.listingType) score += 1;
      return { candidate, score };
    })
    .filter((entry) => entry.score > 0);

  return scored
    .sort(
      (a, b) =>
        b.score - a.score ||
        publishedTime(b.candidate) - publishedTime(a.candidate) ||
        a.candidate.reference.localeCompare(b.candidate.reference),
    )
    .slice(0, limit)
    .map((entry) => entry.candidate);
}

/** A comparable timestamp. A listing with no published date sorts oldest. */
function publishedTime(record: PropertyListingRecord): number {
  const value = record.publishedAt ?? record.createdAt;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
