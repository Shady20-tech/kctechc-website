import {
  LISTING_PROPERTY_KINDS,
  LISTING_TYPES,
  type ListingPropertyKind,
  type ListingType,
} from "./enums";
import type { PropertyListingRecord } from "./types";

/**
 * Real-estate search, sorting and URL serialization.
 *
 * Kept as pure functions over an already-localized listing list, matching the
 * store: the searchable text is the *localized* text, which lives in
 * `content_translations` rather than on the listing row. A SQL search over
 * `property_listings.title` can only ever match the English canonical title, so a
 * French visitor searching "terrain" would find nothing.
 *
 * `search_property_listings` remains the right tool for the ranked full-text case
 * — it handles relevance and typo tolerance that are not worth rebuilding — and
 * the search page uses it when there is a query term. These functions handle the
 * structured filters (region, type, kind, price, bedrooms) and the ordering, and
 * they are what makes the URL serialization testable: one filter state to one
 * URL, with no default written out, so `/properties` and
 * `/properties?sort=newest&` are not two addresses for one page.
 */

export type ListingSort = "newest" | "price-asc" | "price-desc";

export const LISTING_SORTS: readonly ListingSort[] = [
  "newest",
  "price-asc",
  "price-desc",
];

export function isListingSort(value: string | undefined): value is ListingSort {
  return LISTING_SORTS.includes(value as ListingSort);
}

/** Translation key for a sort option's label. */
export function listingSortLabelKey(sort: ListingSort): string {
  switch (sort) {
    case "price-asc":
      return "realEstate.search.sortPriceAsc";
    case "price-desc":
      return "realEstate.search.sortPriceDesc";
    default:
      return "realEstate.search.sortNewest";
  }
}

export type ListingFilters = {
  query?: string;
  regionSlug?: string;
  listingType?: ListingType;
  propertyKind?: ListingPropertyKind;
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  sort?: ListingSort;
};

/** The recognized query parameters, for parsing without accepting extras. */
export const LISTING_FILTER_PARAMS = [
  "q",
  "region",
  "type",
  "kind",
  "minPrice",
  "maxPrice",
  "minBedrooms",
  "sort",
] as const;

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

function searchableText(record: PropertyListingRecord): string {
  return normalizeSearchTerm(
    [
      record.title,
      record.reference,
      record.locality ?? "",
      record.regionName,
      record.description,
      record.highlights.join(" "),
    ].join(" "),
  );
}

/** Parse an integer query parameter, rejecting anything that is not a number. */
export function parseNumberParam(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  const parsed = Number(value.replace(/[\s\u00a0,]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Parse the listing type filter, ignoring an unknown value. */
export function parseListingType(
  value: string | null,
): ListingType | undefined {
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

/**
 * A price for comparison.
 *
 * A listing whose price is on request, or not stated, has no number to compare.
 * It is excluded from a bounded price filter and sorted last, rather than being
 * treated as zero — treating it as zero would make "price on request" the
 * cheapest property in every ascending sort, which is a claim the listing does
 * not make.
 */
function priceForComparison(record: PropertyListingRecord): number | null {
  if (record.priceOnRequest) return null;
  return record.priceMinor;
}

/**
 * Filter a localized listing list.
 *
 * An unknown sort, type or kind falls back rather than throwing, because these
 * arrive from URL query parameters a visitor can edit freely.
 */
export function filterListings(
  listings: readonly PropertyListingRecord[],
  filters: ListingFilters,
): PropertyListingRecord[] {
  const term = filters.query ? normalizeSearchTerm(filters.query) : "";

  const filtered = listings.filter((record) => {
    if (filters.regionSlug && record.regionSlug !== filters.regionSlug) {
      return false;
    }
    if (filters.listingType && record.listingType !== filters.listingType) {
      return false;
    }
    if (filters.propertyKind && record.propertyKind !== filters.propertyKind) {
      return false;
    }
    if (
      filters.minBedrooms !== undefined &&
      (record.bedrooms ?? 0) < filters.minBedrooms
    ) {
      return false;
    }

    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      const price = priceForComparison(record);
      // An unpriced listing cannot satisfy a price bound, so it drops out of a
      // bounded filter rather than passing as zero.
      if (price === null) return false;
      if (filters.minPrice !== undefined && price < filters.minPrice) {
        return false;
      }
      if (filters.maxPrice !== undefined && price > filters.maxPrice) {
        return false;
      }
    }

    if (term.length > 0 && !searchableText(record).includes(term)) {
      return false;
    }

    return true;
  });

  return sortListings(filtered, filters.sort ?? "newest", term);
}

/**
 * Sort a listing list.
 *
 * Ties break on the reference, which is unique and stable, so two listings at the
 * same price do not swap places between the server render and a client re-render.
 * That would be a hydration mismatch, and it is the same reason the store breaks
 * ties on id.
 *
 * Listings with no comparable price always sort last, whatever the direction:
 * "price on request" is not a number and should never be presented as the
 * lowest.
 */
export function sortListings(
  listings: readonly PropertyListingRecord[],
  sort: ListingSort,
  term = "",
): PropertyListingRecord[] {
  const list = [...listings];
  const byReference = (
    a: PropertyListingRecord,
    b: PropertyListingRecord,
  ) => a.reference.localeCompare(b.reference);

  switch (sort) {
    case "price-asc":
      return list.sort((a, b) => {
        const aPrice = priceForComparison(a);
        const bPrice = priceForComparison(b);
        if (aPrice === null && bPrice === null) return byReference(a, b);
        if (aPrice === null) return 1;
        if (bPrice === null) return -1;
        return aPrice - bPrice || byReference(a, b);
      });
    case "price-desc":
      return list.sort((a, b) => {
        const aPrice = priceForComparison(a);
        const bPrice = priceForComparison(b);
        if (aPrice === null && bPrice === null) return byReference(a, b);
        if (aPrice === null) return 1;
        if (bPrice === null) return -1;
        return bPrice - aPrice || byReference(a, b);
      });
    default: {
      // Newest first: featured lead, then most recently published. With a search
      // term, a title match ranks above a description-only match.
      if (term.length === 0) {
        return list.sort(
          (a, b) =>
            Number(b.isFeatured) - Number(a.isFeatured) ||
            publishedTime(b) - publishedTime(a) ||
            byReference(a, b),
        );
      }
      return list.sort((a, b) => {
        const aTitle = normalizeSearchTerm(a.title).includes(term) ? 0 : 1;
        const bTitle = normalizeSearchTerm(b.title).includes(term) ? 0 : 1;
        return (
          aTitle - bTitle ||
          Number(b.isFeatured) - Number(a.isFeatured) ||
          publishedTime(b) - publishedTime(a) ||
          byReference(a, b)
        );
      });
    }
  }
}

/** A comparable timestamp. A listing with no published date sorts oldest. */
function publishedTime(record: PropertyListingRecord): number {
  const value = record.publishedAt ?? record.createdAt;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
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

/**
 * Serialize a filter state as a properties query string.
 *
 * The filters object is the complete desired state, so a key absent from it is
 * absent from the URL. Defaults are omitted: `newest` is the default sort and
 * never appears, and an empty query is not written. That is what keeps one filter
 * state to one URL and avoids the duplicate-content problem that also governs
 * locale routing.
 *
 * Built from scratch rather than by patching the incoming params, so a tracking
 * parameter is not carried into an internal link.
 */
export function buildListingQuery(filters: ListingFilters): string {
  const params = new URLSearchParams();

  if (filters.query && filters.query.length > 0) params.set("q", filters.query);
  if (filters.regionSlug) params.set("region", filters.regionSlug);
  if (filters.listingType) params.set("type", filters.listingType);
  if (filters.propertyKind) params.set("kind", filters.propertyKind);
  if (filters.minPrice !== undefined) {
    params.set("minPrice", String(filters.minPrice));
  }
  if (filters.maxPrice !== undefined) {
    params.set("maxPrice", String(filters.maxPrice));
  }
  if (filters.minBedrooms !== undefined) {
    params.set("minBedrooms", String(filters.minBedrooms));
  }
  if (filters.sort && filters.sort !== "newest") params.set("sort", filters.sort);

  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

/**
 * True when a filter state differs from the default.
 *
 * Used to decide whether to offer "clear filters", and to keep the results
 * counter honest about whether it is showing a filtered view.
 */
export function hasActiveFilters(filters: ListingFilters): boolean {
  return (
    Boolean(filters.query) ||
    Boolean(filters.regionSlug) ||
    Boolean(filters.listingType) ||
    Boolean(filters.propertyKind) ||
    filters.minPrice !== undefined ||
    filters.maxPrice !== undefined ||
    filters.minBedrooms !== undefined ||
    (filters.sort !== undefined && filters.sort !== "newest")
  );
}

/**
 * The bedroom counts offered as filters.
 *
 * A short fixed list rather than a range derived from the data: a filter that
 * changes as listings come and go makes the same URL mean different things over
 * time, which is bad for caching and worse for a shared link.
 */
export const BEDROOM_FILTER_OPTIONS = [1, 2, 3, 4, 5] as const;
