import "server-only";

import type { Locale } from "@/lib/i18n/locales";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";

import type {
  ListingPropertyKind,
  ListingStatus,
  ListingType,
  PropertyType,
} from "./enums";
import {
  groupListingTranslations,
  regionFromRow,
  toListingImage,
  toListingRecord,
  type ListingRow,
} from "./records";
import {
  LISTINGS_PAGE_SIZE,
  LISTING_SORT_TO_SQL,
  type ListingSort,
} from "./search";
import type {
  AdminListingRecord,
  AgentRecord,
  ListingImage,
  ListingOverlay,
  PropertyListingRecord,
} from "./types";

/**
 * Real-estate content loading.
 *
 * Follows the contract established by the store and service loaders:
 *
 *   - Public reads go through the anonymous, RLS-bound client, so "a draft is not
 *     public" is enforced by the database rather than by a filter this code could
 *     forget. Admin reads use the session client, where the policies grant the
 *     caller their own listings or the whole portfolio according to their role.
 *   - On any failure — unconfigured, unreachable, malformed — a loader returns an
 *     empty result rather than throwing, so a database outage shows the empty
 *     state instead of an error page.
 *
 * The private detail is loaded through a SEPARATE function from the public
 * record, and never joined into it. That is the point of the two-table design: a
 * component rendering a public card receives a type with no field that could hold
 * an owner's phone number.
 */

/** Small local narrowing helpers, matching those in `records.ts`. */
function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

/** Narrow a database enum value, defaulting rather than trusting the cast. */
function asEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** Fetch translation overlays and localized slugs for a set of listings. */
async function loadListingTranslations(
  listingIds: readonly string[],
): Promise<{
  translations: Map<string, Partial<Record<Locale, ListingOverlay>>>;
  slugs: Map<string, Partial<Record<Locale, string>>>;
}> {
  const translations = new Map<
    string,
    Partial<Record<Locale, ListingOverlay>>
  >();
  const slugs = new Map<string, Partial<Record<Locale, string>>>();
  if (listingIds.length === 0) return { translations, slugs };

  try {
    const supabase = createPublicClient();
    if (!supabase) return { translations, slugs };

    const { data: entries } = await supabase
      .from("content_translations")
      .select("entity_id, field_name, locale, value, state")
      .eq("entity_type", "property_listing")
      .in("entity_id", listingIds);

    if (entries) {
      for (const [id, overlay] of groupListingTranslations(entries)) {
        translations.set(id, overlay);
      }
    }

    // Localized slugs live in their own table so a French URL segment can be
    // resolved without reading the translation index.
    const { data: slugRows } = await supabase
      .from("listing_slugs")
      .select("listing_id, locale, slug")
      .in("listing_id", listingIds);

    if (slugRows) {
      for (const row of slugRows) {
        if (row.locale !== "fr") continue;
        const existing = slugs.get(row.listing_id) ?? {};
        existing.fr = row.slug;
        slugs.set(row.listing_id, existing);
      }
    }
  } catch {
    // A translation failure must not lose the listing: the canonical English is
    // rendered with `hasFallback`, so this is a degraded result, not an error.
  }

  return { translations, slugs };
}

/** Fetch the images for a set of listings, grouped by listing id. */
async function loadListingImages(
  listingIds: readonly string[],
): Promise<Map<string, ListingImage[]>> {
  const byListing = new Map<string, ListingImage[]>();
  if (listingIds.length === 0) return byListing;

  try {
    const supabase = createPublicClient();
    if (!supabase) return byListing;

    const { data } = await supabase
      .from("listing_media")
      .select("id, listing_id, storage_path, alt_text, caption, position, is_primary, width, height")
      .in("listing_id", listingIds)
      .order("position", { ascending: true });

    for (const row of data ?? []) {
      const list = byListing.get(row.listing_id) ?? [];
      list.push(toListingImage(row));
      byListing.set(row.listing_id, list);
    }

    // The primary image must lead the gallery. Sorting here rather than in the
    // query keeps the position order intact for the rest.
    for (const list of byListing.values()) {
      list.sort((a, b) => {
        if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
        return a.position - b.position;
      });
    }
  } catch {
    // Images are additive; a listing without them still renders.
  }

  return byListing;
}

/** Fetch coarsened public positions for a set of listings. */
async function loadPublicLocations(
  listingIds: readonly string[],
): Promise<Map<string, PropertyListingRecord["publicLocation"]>> {
  const byListing = new Map<string, PropertyListingRecord["publicLocation"]>();
  if (listingIds.length === 0) return byListing;

  try {
    const supabase = createPublicClient();
    if (!supabase) return byListing;

    // The API view, not the table: it exposes the geometry as longitude and
    // latitude numbers, which is what a browser map needs.
    const { data } = await supabase
      .from("listing_locations_api")
      .select("listing_id, longitude, latitude, precision_metres")
      .in("listing_id", listingIds);

    for (const row of data ?? []) {
      if (row.listing_id && row.longitude !== null && row.latitude !== null) {
        byListing.set(row.listing_id, {
          longitude: row.longitude,
          latitude: row.latitude,
          precisionMetres: row.precision_metres ?? 1000,
        });
      }
    }
  } catch {
    // A missing map point is not a missing listing.
  }

  return byListing;
}

/**
 * The listing columns every public read selects.
 *
 * Declared once because the same projection appeared four times, and a column
 * added to one call site and not the others is a field that is populated on some
 * pages and undefined on others — which surfaces as a card missing a bedroom count
 * only on the map view. Keeping it in one place makes the public projection the
 * same everywhere by construction.
 *
 * It deliberately lists columns rather than using `*`: `select("*")` on this table
 * would pull the owner-facing columns into the public record, and the private
 * table exists precisely so that cannot happen by accident.
 */
const LISTING_SELECT =
  "id, reference, slug, listing_type, property_kind, property_type, status, source, locality, title, description, highlights, amenities, price_minor, currency, price_period, price_on_request, land_area_sqm, building_area_sqm, bedrooms, bathrooms, year_built, is_featured, view_count, inquiry_count, published_at, closed_at, listed_on, agent_id, created_at, updated_at, regions (slug, name), agent_profiles (display_name)";

/** Attach images, translations and public positions to a set of rows. */
async function enrich(
  rows: readonly ListingRow[],
): Promise<PropertyListingRecord[]> {
  const ids = rows.map((row) => String(row.id));

  const [images, locations, translations] = await Promise.all([
    loadListingImages(ids),
    loadPublicLocations(ids),
    loadListingTranslations(ids),
  ]);

  return rows.map((row) => {
    const id = String(row.id);
    return toListingRecord(row, {
      images: images.get(id) ?? [],
      publicLocation: locations.get(id),
      localizedSlugs: translations.slugs.get(id),
      translations: translations.translations.get(id),
    });
  });
}

/** A listing location is public only when the listing itself is. */
const DEFAULT_SEARCH_LIMIT = 24;
const MAX_SEARCH_LIMIT = 48;

export interface ListingSearchParams {
  query?: string;
  regionSlug?: string;
  listingType?: ListingType;
  propertyKind?: ListingPropertyKind;
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  amenities?: readonly string[];
  limit?: number;
  offset?: number;
}

/**
 * Search published listings.
 *
 * Uses the `search_property_listings` RPC rather than a chain of PostgREST
 * filters. Two reasons, both of which the earlier phases established:
 *
 *   - Relevance and typo tolerance are expressed in SQL. `websearch_to_tsquery`
 *     plus a trigram fallback is what makes "villa limbe" and "vill limbe" both
 *     find the listing, and rebuilding that from the client would mean a second
 *     implementation that drifts.
 *   - The RPC is `security definer` but selects only the public columns and
 *     filters to publicly-visible statuses, so it cannot be used to read a draft.
 *
 * Returns an empty list on any failure, matching the other loaders.
 */
export async function searchListings(
  params: ListingSearchParams = {},
): Promise<PropertyListingRecord[]> {
  try {
    const supabase = createPublicClient();
    if (!supabase) return [];

    const limit = Math.min(
      Math.max(params.limit ?? DEFAULT_SEARCH_LIMIT, 1),
      MAX_SEARCH_LIMIT,
    );
    const offset = Math.max(params.offset ?? 0, 0);

    const { data: matches, error } = await supabase.rpc(
      "search_property_listings",
      {
        p_query: params.query?.trim() || undefined,
        // The RPC takes a region id, but a URL carries a slug; resolving it here
        // keeps the caller from having to know the id.
        p_region_id: params.regionSlug
          ? ((await resolveRegionId(params.regionSlug)) ?? undefined)
          : undefined,
        p_listing_type: params.listingType ?? undefined,
        p_property_kind: params.propertyKind ?? undefined,
        p_min_price: params.minPrice ?? undefined,
        p_max_price: params.maxPrice ?? undefined,
        p_min_bedrooms: params.minBedrooms ?? undefined,
        p_amenities:
          params.amenities && params.amenities.length > 0
            ? [...params.amenities]
            : undefined,
        p_limit: limit,
        p_offset: offset,
      },
    );

    if (error || !matches || matches.length === 0) return [];

    // The RPC returns the searchable columns; the rest — images, translations,
    // full description — are read for the matched ids only, so a search returns
    // exactly what the cards need without a join per row.
    const ids = matches.map((match) => match.id).filter(Boolean);
    const { data: rows } = await supabase
      .from("property_listings")
      .select(LISTING_SELECT)
      .in("id", ids);

    if (!rows) return [];

    // Preserve the RPC's ranking. A database returning rows in a different order
    // than the relevance order would undo the ranking entirely.
    const rank = new Map(matches.map((match, index) => [match.id, index]));
    const ordered = [...rows].sort(
      (a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0),
    );

    return enrich(ordered);
  } catch {
    return [];
  }
}

/** Resolve a region slug to its id, for the search RPC which takes an id. */
async function resolveRegionId(slug: string): Promise<string | null> {
  try {
    const supabase = createPublicClient();
    if (!supabase) return null;
    const { data } = await supabase
      .from("regions")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    return data?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * A page of listings for the browser, with the total for the filter state.
 *
 * This is the function the listings page uses, and it is deliberately different
 * from `searchListings` above. `searchListings` returns a list and nothing else,
 * which is enough for a teaser strip but cannot support a results count or a
 * "next page" control: a caller has no way to know whether more results exist, and
 * inferring it from `items.length === pageSize` is wrong on the last page whenever
 * the total is an exact multiple of the page size.
 *
 * `total` comes from the same query as the rows (`count(*) over ()`), so the number
 * shown to the visitor and the number of rows returned cannot disagree. A separate
 * count query would be a second evaluation of the same predicate, and the two would
 * eventually differ under concurrent writes — the visitor would see "48 results"
 * above a grid that could not reach 48.
 */
export interface ListingPage {
  items: PropertyListingRecord[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface ListingQueryParams {
  query?: string;
  regionSlug?: string;
  divisionSlug?: string;
  subdivisionSlug?: string;
  listingType?: ListingType;
  propertyKind?: ListingPropertyKind;
  propertyType?: PropertyType;
  statuses?: readonly ListingStatus[];
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  minBathrooms?: number;
  minSize?: number;
  maxSize?: number;
  sort?: ListingSort;
  page?: number;
  locale: Locale;
  pageSize?: number;
}

const EMPTY_PAGE = (page: number, pageSize: number): ListingPage => ({
  items: [],
  total: 0,
  page,
  pageSize,
  pageCount: 0,
});

/**
 * Query one page of published listings.
 *
 * The RPC does the filtering, counting and pagination; this function resolves the
 * geography slugs to ids, then loads the full records for the returned ids. Two
 * round trips rather than one, because the RPC returns only the columns a card
 * needs to be ranked and this keeps the enrichment (images, translations,
 * coarsened positions) out of a query that runs over every matching row.
 *
 * Returns an empty page on any failure, matching the other loaders: a database
 * outage shows the empty state rather than an error page.
 */
export async function queryListings(
  params: ListingQueryParams,
): Promise<ListingPage> {
  const pageSize = params.pageSize ?? LISTINGS_PAGE_SIZE;
  const page = Math.max(params.page ?? 1, 1);

  try {
    const supabase = createPublicClient();
    if (!supabase) return EMPTY_PAGE(page, pageSize);

    // The geography hierarchy is resolved through one map rather than three
    // lookups, and a slug that resolves to nothing is passed as undefined so the
    // RPC ignores it. Passing an id-shaped value that does not exist would filter
    // to zero results and look like an empty market rather than a bad link.
    const geo = await resolveGeographyIds({
      regionSlug: params.regionSlug,
      divisionSlug: params.divisionSlug,
      subdivisionSlug: params.subdivisionSlug,
    });

    const { data: matches, error } = await supabase.rpc(
      "search_property_listings",
      {
        p_query: params.query?.trim() || undefined,
        p_region_id: geo.regionId,
        p_division_id: geo.divisionId,
        p_subdivision_id: geo.subdivisionId,
        p_listing_type: params.listingType ?? undefined,
        p_property_kind: params.propertyKind ?? undefined,
        p_property_type: params.propertyType ?? undefined,
        p_min_price: params.minPrice ?? undefined,
        p_max_price: params.maxPrice ?? undefined,
        p_min_bedrooms: params.minBedrooms ?? undefined,
        p_min_bathrooms: params.minBathrooms ?? undefined,
        p_min_size: params.minSize ?? undefined,
        p_max_size: params.maxSize ?? undefined,
        p_statuses:
          params.statuses && params.statuses.length > 0
            ? [...params.statuses]
            : undefined,
        p_locale: params.locale,
        p_sort: LISTING_SORT_TO_SQL[params.sort ?? "newest"],
        p_limit: pageSize,
        p_offset: (page - 1) * pageSize,
      },
    );

    if (error || !matches) return EMPTY_PAGE(page, pageSize);

    // The total is carried on every row, so it is read from the first one. An
    // empty page has no row and therefore no total, which is correct: there is
    // nothing to count.
    const first = matches[0];
    const total = Number(first?.total_count ?? 0);
    if (matches.length === 0) return EMPTY_PAGE(page, pageSize);

    const ids = matches.map((match) => match.id).filter(Boolean);
    const { data: rows } = await supabase
      .from("property_listings")
      .select(LISTING_SELECT)
      .in("id", ids);

    if (!rows) return { ...EMPTY_PAGE(page, pageSize), total };

    // Preserve the RPC's ranking. A database returning rows in a different order
    // than the relevance order would undo the ranking entirely.
    const rank = new Map(matches.map((match, index) => [match.id, index]));
    const ordered = [...rows].sort(
      (a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0),
    );

    const items = await enrich(ordered);

    return {
      items,
      total,
      page,
      pageSize,
      pageCount: Math.max(Math.ceil(total / pageSize), 0),
    };
  } catch {
    return EMPTY_PAGE(page, pageSize);
  }
}

/**
 * Resolve the three geography slugs to ids in one pass.
 *
 * One query over each table rather than a lookup per slug, because the browser
 * page needs this on every render and three sequential round trips would be three
 * chances to be slow. A slug that matches nothing yields null, and the RPC treats
 * null as "no filter" — which is the right behaviour for a stale link: the visitor
 * sees the unfiltered results rather than an empty page with no explanation.
 */
async function resolveGeographyIds(slugs: {
  regionSlug?: string;
  divisionSlug?: string;
  subdivisionSlug?: string;
}): Promise<{
  regionId: string | undefined;
  divisionId: string | undefined;
  subdivisionId: string | undefined;
}> {
  try {
    const supabase = createPublicClient();
    if (!supabase) {
      return {
        regionId: undefined,
        divisionId: undefined,
        subdivisionId: undefined,
      };
    }

    const [region, division, subdivision] = await Promise.all([
      slugs.regionSlug
        ? supabase
            .from("regions")
            .select("id")
            .eq("slug", slugs.regionSlug)
            .maybeSingle()
        : null,
      slugs.divisionSlug
        ? supabase
            .from("divisions")
            .select("id")
            .eq("slug", slugs.divisionSlug)
            .maybeSingle()
        : null,
      slugs.subdivisionSlug
        ? supabase
            .from("subdivisions")
            .select("id")
            .eq("slug", slugs.subdivisionSlug)
            .maybeSingle()
        : null,
    ]);

    return {
      regionId: region?.data?.id ?? undefined,
      divisionId: division?.data?.id ?? undefined,
      subdivisionId: subdivision?.data?.id ?? undefined,
    };
  } catch {
    return {
      regionId: undefined,
      divisionId: undefined,
      subdivisionId: undefined,
    };
  }
}

/**
 * The published listing counts per geography level, for the cascading filter and
 * the landing pages.
 *
 * The counts come from `listing_geography_counts()`, which applies the same
 * predicate as the search function. That matters more than it looks: if the
 * cascading filter offered a division because a draft existed there, the visitor
 * would click it and find nothing, and the count beside a region would not match
 * the number of results they get.
 */
export type GeographyCounts = {
  regions: Map<string, number>;
  divisions: Map<string, number>;
  subdivisions: Map<string, number>;
};

export async function loadListingGeographyCounts(): Promise<GeographyCounts> {
  const empty: GeographyCounts = {
    regions: new Map(),
    divisions: new Map(),
    subdivisions: new Map(),
  };

  try {
    const supabase = createPublicClient();
    if (!supabase) return empty;

    const { data } = await supabase.rpc("listing_geography_counts");
    if (!data) return empty;

    const result: GeographyCounts = {
      regions: new Map(),
      divisions: new Map(),
      subdivisions: new Map(),
    };

    for (const row of data) {
      if (!row.geo_id) continue;
      const total = Number(row.total ?? 0);
      if (row.level === "region") result.regions.set(row.geo_id, total);
      else if (row.level === "division") result.divisions.set(row.geo_id, total);
      else if (row.level === "subdivision") {
        result.subdivisions.set(row.geo_id, total);
      }
    }

    return result;
  } catch {
    return empty;
  }
}

/**
 * The geography tree, with listing counts, for the cascading filter.
 *
 * Only levels that have listings are returned. A selector offering all ten regions
 * when two have property is offering eight dead ends, and the count beside each
 * option is what tells the visitor which is which. The counts come from the same
 * function the browser counts with, so the two agree.
 */
export type GeographyOption = {
  id: string;
  slug: string;
  name: string;
  count: number;
  divisions: readonly GeographyDivisionOption[];
};

export type GeographyDivisionOption = {
  id: string;
  slug: string;
  name: string;
  count: number;
  subdivisions: readonly GeographySubdivisionOption[];
};

export type GeographySubdivisionOption = {
  id: string;
  slug: string;
  name: string;
  count: number;
};

export async function loadListingGeographyTree(): Promise<
  readonly GeographyOption[]
> {
  try {
    const supabase = createPublicClient();
    if (!supabase) return [];

    const [counts, regions, divisions, subdivisions] = await Promise.all([
      loadListingGeographyCounts(),
      supabase
        .from("regions")
        .select("id, slug, name")
        .order("sort_order", { ascending: true }),
      supabase
        .from("divisions")
        .select("id, region_id, slug, name")
        .order("name", { ascending: true }),
      supabase
        .from("subdivisions")
        .select("id, division_id, slug, name")
        .order("name", { ascending: true }),
    ]);

    if (!regions.data) return [];

    // The tree is built from the counts down, not the geography down, so a level
    // with no published listing never appears. That is what keeps the cascading
    // selector from offering an option that leads to an empty result set.
    const divisionsByRegion = new Map<string, GeographyDivisionOption[]>();
    for (const division of divisions.data ?? []) {
      const count = counts.divisions.get(division.id);
      if (!count) continue;
      const children = (subdivisions.data ?? [])
        .filter((subdivision) => subdivision.division_id === division.id)
        .flatMap((subdivision) => {
          const subCount = counts.subdivisions.get(subdivision.id);
          if (!subCount) return [];
          return [
            {
              id: subdivision.id,
              slug: subdivision.slug,
              name: subdivision.name,
              count: subCount,
            },
          ];
        });

      const list = divisionsByRegion.get(division.region_id) ?? [];
      list.push({
        id: division.id,
        slug: division.slug,
        name: division.name,
        count,
        subdivisions: children,
      });
      divisionsByRegion.set(division.region_id, list);
    }

    return regions.data.flatMap((region) => {
      const count = counts.regions.get(region.id);
      if (!count) return [];
      return [
        {
          id: region.id,
          slug: region.slug,
          name: region.name,
          count,
          divisions: divisionsByRegion.get(region.id) ?? [],
        },
      ];
    });
  } catch {
    return [];
  }
}

/**
 * The curated content for a geographic landing page, if an editor published any.
 *
 * The return value is what decides indexability, and the absence of a row is a
 * meaningful answer rather than a failure: it means the page renders as a filtered
 * view and carries `noindex, follow`. See `20260101000029_geo_landing_content.sql`
 * for why indexability is a property of editorial content rather than of a listing
 * count.
 *
 * Only `published` rows are requested. The RLS policy already restricts an
 * anonymous reader to them, but asking explicitly means the intent survives a
 * future policy change.
 */
export type GeoLandingContent = {
  heading?: string;
  intro: string;
  seoTitle?: string;
  seoDescription?: string;
};

export async function loadGeoLandingContent(
  level: "region" | "division" | "subdivision",
  geoId: string,
  locale: Locale,
): Promise<GeoLandingContent | null> {
  try {
    const supabase = createPublicClient();
    if (!supabase) return null;

    const column =
      level === "region"
        ? "region_id"
        : level === "division"
          ? "division_id"
          : "subdivision_id";

    const { data } = await supabase
      .from("geo_landing_content")
      .select("heading, intro, seo_title, seo_description")
      .eq("level", level)
      .eq(column, geoId)
      .eq("locale", locale)
      .eq("state", "published")
      .maybeSingle();

    if (!data) return null;

    return {
      heading: asString(data.heading),
      intro: data.intro,
      seoTitle: asString(data.seo_title),
      seoDescription: asString(data.seo_description),
    };
  } catch {
    return null;
  }
}

/**
 * Resolve one geography level by slug, for a landing page route.
 *
 * Returns the geography's own row plus its parent slugs, because a subdivision
 * landing page needs to build a breadcrumb that names its region and division, and
 * a canonical URL that is the full hierarchy rather than the leaf alone.
 */
export type GeoLandingTarget = {
  id: string;
  slug: string;
  name: string;
  level: "region" | "division" | "subdivision";
  regionSlug?: string;
  regionName?: string;
  divisionSlug?: string;
  divisionName?: string;
  subdivisionSlug?: string;
  subdivisionName?: string;
};

export async function loadGeoLandingTarget(
  level: "region" | "division" | "subdivision",
  slug: string,
): Promise<GeoLandingTarget | null> {
  try {
    const supabase = createPublicClient();
    if (!supabase) return null;

    if (level === "region") {
      const { data } = await supabase
        .from("regions")
        .select("id, slug, name")
        .eq("slug", slug)
        .maybeSingle();
      if (!data) return null;
      return {
        id: data.id,
        slug: data.slug,
        name: data.name,
        level,
        regionSlug: data.slug,
        regionName: data.name,
      };
    }

    if (level === "division") {
      const { data } = await supabase
        .from("divisions")
        .select("id, slug, name, regions (slug, name)")
        .eq("slug", slug)
        .maybeSingle();
      if (!data) return null;
      const region = data.regions as { slug: string; name: string } | null;
      return {
        id: data.id,
        slug: data.slug,
        name: data.name,
        level,
        regionSlug: region?.slug,
        regionName: region?.name,
        divisionSlug: data.slug,
        divisionName: data.name,
      };
    }

    // `subdivisions` carries two foreign keys to `divisions` — `division_id`, and
    // the composite `(division_id, region_id)` that enforces the hierarchy — so
    // PostgREST cannot infer which one an embed means and returns an error rather
    // than a row. The hint names the column, which is what disambiguates it.
    //
    // The region is read from the subdivision's own `region_id` in a second query
    // instead of nested through the division. Two small queries are cheaper than
    // the four-level embed this would otherwise need, and the region slug has to be
    // the subdivision's own parent anyway: reading it through the division would
    // return the same value only because the composite FK guarantees they agree.
    const { data } = await supabase
      .from("subdivisions")
      .select("id, slug, name, region_id, divisions!division_id (slug, name)")
      .eq("slug", slug)
      .maybeSingle();
    if (!data) return null;

    const division = data.divisions as { slug: string; name: string } | null;

    const { data: region } = data.region_id
      ? await supabase
          .from("regions")
          .select("slug, name")
          .eq("id", data.region_id)
          .maybeSingle()
      : { data: null };

    return {
      id: data.id,
      slug: data.slug,
      name: data.name,
      level,
      regionSlug: region?.slug,
      regionName: region?.name,
      divisionSlug: division?.slug,
      divisionName: division?.name,
      subdivisionSlug: data.slug,
      subdivisionName: data.name,
    };
  } catch {
    return null;
  }
}

/** Load the published listings, newest first, for a browse page. */
export async function loadPublishedListings(
  options: { limit?: number; featuredOnly?: boolean } = {},
): Promise<PropertyListingRecord[]> {
  try {
    const supabase = createPublicClient();
    if (!supabase) return [];

    let query = supabase
      .from("property_listings")
      .select(LISTING_SELECT)
      .in("status", ["published", "under_offer", "sold", "rented"])
      .order("is_featured", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(options.limit ?? 24);

    if (options.featuredOnly) query = query.eq("is_featured", true);

    const { data, error } = await query;
    if (error || !data) return [];
    return enrich(data);
  } catch {
    return [];
  }
}

/** Region slugs that currently have at least one published listing. */
export async function loadListingRegionOptions(): Promise<
  readonly { slug: string; name: string; count: number }[]
> {
  try {
    const supabase = createPublicClient();
    if (!supabase) return [];

    const { data } = await supabase
      .from("property_listings")
      .select("regions (slug, name)")
      .in("status", ["published", "under_offer", "sold", "rented"]);

    const counts = new Map<string, { slug: string; name: string; count: number }>();
    for (const row of data ?? []) {
      const region = regionFromRow(row as ListingRow);
      if (!region.slug) continue;
      const existing = counts.get(region.slug);
      if (existing) existing.count += 1;
      else counts.set(region.slug, { ...region, count: 1 });
    }

    return [...counts.values()].sort((a, b) => b.count - a.count);
  } catch {
    return [];
  }
}

/**
 * Resolve a published listing by the slug in the URL.
 *
 * Accepts either the canonical slug or a localized one, the same way the store
 * resolves a product: a French URL carries a French slug.
 */
export async function loadListingBySlug(
  slug: string,
): Promise<PropertyListingRecord | null> {
  try {
    const supabase = createPublicClient();
    if (!supabase) return null;

    let listingId: string | null = null;

    const { data: canonical } = await supabase
      .from("property_listings")
      .select("id")
      .eq("slug", slug)
      .in("status", ["published", "under_offer", "sold", "rented"])
      .maybeSingle();

    if (canonical) {
      listingId = canonical.id;
    } else {
      const { data: localized } = await supabase
        .from("listing_slugs")
        .select("listing_id")
        .eq("slug", slug)
        .maybeSingle();
      listingId = localized?.listing_id ?? null;
    }

    if (!listingId) return null;

    const { data: row } = await supabase
      .from("property_listings")
      .select(LISTING_SELECT)
      .eq("id", listingId)
      .in("status", ["published", "under_offer", "sold", "rented"])
      .maybeSingle();

    if (!row) return null;

    const [record] = await enrich([row]);
    return record ?? null;
  } catch {
    return null;
  }
}

/** All published slugs, for `generateStaticParams`. */
export async function loadPublishedListingSlugs(): Promise<string[]> {
  try {
    const supabase = createPublicClient();
    if (!supabase) return [];

    const { data } = await supabase
      .from("property_listings")
      .select("slug")
      .in("status", ["published", "under_offer", "sold", "rented"]);

    return (data ?? []).map((row) => row.slug).filter(Boolean);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Admin surface.
//
// These use the session client, so the policies decide what the caller sees: an
// agent gets their own listings, an administrator gets the portfolio. Nothing
// here filters by role in TypeScript, because doing so would put the access rule
// in two places and the policy is the one that cannot be bypassed.
// ---------------------------------------------------------------------------

/** Map an admin row, including the flags the list view shows. */
function toAdminRecord(
  row: ListingRow,
  media: readonly ListingRow[] = [],
): AdminListingRecord {
  const base = toListingRecord(row, {
    images: media.map((m) => toListingImage(m)),
  });
  const submission = row.listing_submissions as
    | { id?: unknown; status?: unknown }[]
    | null;

  const firstSubmission = submission?.[0];

  return {
    ...base,
    regionId: asString(row.region_id) ?? null,
    divisionId: asString(row.division_id) ?? null,
    subdivisionId: asString(row.subdivision_id) ?? null,
    hasExactLocation: row.has_exact_location === true,
    hasOwnerContact: row.has_owner_contact === true,
    submissionStatus: firstSubmission
      ? asEnum(
          firstSubmission.status,
          ["pending_review", "approved", "rejected", "changes_requested"] as const,
          "pending_review",
        )
      : null,
    submissionId: firstSubmission ? asString(firstSubmission.id) ?? null : null,
  };
}

/**
 * Load the listings the current caller may manage.
 *
 * No role filter is applied here. The RLS policies do it: `select_admin` gives an
 * administrator the portfolio and `select_own_agent` gives an agent their own
 * rows. Repeating the rule here would be a second implementation that could
 * disagree with the policy — and the policy is the one that holds for every
 * writer, including a migration.
 */
export async function loadAdminListings(
  options: { status?: ListingStatus; limit?: number } = {},
): Promise<AdminListingRecord[]> {
  try {
    const supabase = await createClient();
    if (!supabase) return [];

    let query = supabase
      .from("property_listings")
      .select(
        "id, reference, slug, listing_type, property_kind, property_type, status, source, locality, title, description, highlights, amenities, price_minor, currency, price_period, price_on_request, land_area_sqm, building_area_sqm, bedrooms, bathrooms, year_built, is_featured, view_count, inquiry_count, published_at, closed_at, listed_on, agent_id, created_at, updated_at, region_id, division_id, subdivision_id, regions (slug, name), agent_profiles (display_name), listing_submissions (id, status)",
      )
      .order("updated_at", { ascending: false })
      .limit(options.limit ?? 100);

    if (options.status) query = query.eq("status", options.status);

    const { data, error } = await query;
    if (error || !data) return [];
    return data.map((row) => toAdminRecord(row as ListingRow));
  } catch {
    return [];
  }
}

/** Load one listing for editing, or null when the caller may not see it. */
export async function loadAdminListingById(
  id: string,
): Promise<AdminListingRecord | null> {
  try {
    const supabase = await createClient();
    if (!supabase) return null;

    const { data } = await supabase
      .from("property_listings")
      .select(
        "id, reference, slug, listing_type, property_kind, property_type, status, source, locality, title, description, highlights, amenities, price_minor, currency, price_period, price_on_request, land_area_sqm, building_area_sqm, bedrooms, bathrooms, year_built, is_featured, view_count, inquiry_count, published_at, closed_at, listed_on, agent_id, created_at, updated_at, region_id, division_id, subdivision_id, regions (slug, name), agent_profiles (display_name), listing_submissions (id, status)",
      )
      .eq("id", id)
      .maybeSingle();

    if (!data) return null;

    // The gallery is read through the session client, whose policies give an
    // administrator the listings they may manage and an agent only their own —
    // the same rule the listing row above is subject to. `listing_media` is a
    // child table, so it carries its own policies rather than inheriting them.
    const { data: media } = await supabase
      .from("listing_media")
      .select("id, storage_path, alt_text, caption, position, is_primary, width, height")
      .eq("listing_id", id)
      .order("position", { ascending: true });

    return toAdminRecord(data as ListingRow, media ?? []);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Registered-customer surface.
//
// These use the session client, not the public one, because every one of them is
// about a specific signed-in person. The policies on the three tables restrict
// each to `auth.uid() = user_id`, so a loader that forgot to filter by user would
// still be unable to read another customer's data — the database is the control,
// and the filters here are for correctness rather than for security.
// ---------------------------------------------------------------------------

/**
 * The ids of the listings the signed-in customer has saved.
 *
 * Returned as a Set rather than as records, because its use is a membership test
 * per card on a results page. Loading the full records here would duplicate what
 * the grid already has.
 *
 * An anonymous visitor gets an empty set rather than an error: the save control is
 * rendered for everyone, and for a signed-out visitor it links to sign-in. A
 * loader that threw would turn that into a broken page.
 */
export async function loadFavoriteListingIds(): Promise<ReadonlySet<string>> {
  try {
    const supabase = await createClient();
    if (!supabase) return new Set();

    const { data } = await supabase.from("listing_favorites").select("listing_id");
    if (!data) return new Set();

    return new Set(data.map((row) => row.listing_id).filter(Boolean));
  } catch {
    return new Set();
  }
}

/** The saved listings themselves, for the favourites page. */
export async function loadFavoriteListings(): Promise<PropertyListingRecord[]> {
  try {
    const supabase = await createClient();
    if (!supabase) return [];

    const { data: favorites } = await supabase
      .from("listing_favorites")
      .select("listing_id, created_at")
      .order("created_at", { ascending: false });

    if (!favorites || favorites.length === 0) return [];

    const ids = favorites.map((row) => row.listing_id).filter(Boolean);
    const { data: rows } = await supabase
      .from("property_listings")
      .select(LISTING_SELECT)
      .in("id", ids);

    if (!rows) return [];

    // The saved order, not the database's. A favourite list is a list the customer
    // built, so it is shown in the order they added to it.
    const order = new Map(ids.map((id, index) => [id, index]));
    const ordered = [...rows].sort(
      (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
    );

    return enrich(ordered);
  } catch {
    return [];
  }
}

/**
 * A saved search, with the query string already parsed.
 *
 * The stored string is the canonical filter query the customer was on, so it is
 * parsed with the same function the listings page uses. That is what makes the
 * link work: a saved search is only meaningful if it reopens the same view, and
 * parsing it any other way would be a second interpretation of the same syntax.
 */
export type SavedSearchRecord = {
  id: string;
  label: string;
  queryString: string;
  locale: Locale;
  createdAt: string;
  alertEnabled: boolean;
  alertFrequency: AlertFrequency | null;
};

export type AlertFrequency = "instant" | "daily" | "weekly";

export async function loadSavedSearches(): Promise<SavedSearchRecord[]> {
  try {
    const supabase = await createClient();
    if (!supabase) return [];

    const { data: searches } = await supabase
      .from("saved_searches")
      .select("id, label, query_string, locale, created_at")
      .order("created_at", { ascending: false });

    if (!searches) return [];

    // The alert preferences are read in one query and joined in memory rather
    // than embedded, because a customer with no preference row is the common case
    // and an inner join would hide those searches entirely.
    const { data: preferences } = await supabase
      .from("search_alert_preferences")
      .select("saved_search_id, enabled, frequency");

    const bySearch = new Map(
      (preferences ?? []).map((row) => [row.saved_search_id, row]),
    );

    return searches.map((search) => {
      const preference = bySearch.get(search.id);
      return {
        id: search.id,
        label: search.label,
        queryString: search.query_string,
        locale: search.locale as Locale,
        createdAt: search.created_at,
        alertEnabled: preference?.enabled ?? false,
        alertFrequency:
          preference?.enabled === true
            ? (preference.frequency as AlertFrequency)
            : null,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Load the exact coordinates and owner contact for a listing.
 *
 * A separate call, and a separate type, from `loadAdminListingById`. Even on the
 * admin surface the two are not merged into one query, so a component that
 * renders the ordinary fields has nothing to leak — and the anonymous role would
 * receive zero rows here even if it called this, because the underlying table has
 * no anonymous policy.
 */
export async function loadListingPrivateDetails(listingId: string) {
  try {
    const supabase = await createClient();
    if (!supabase) return null;

    const { data } = await supabase
      .from("listing_private_details_api")
      .select(
        "listing_id, exact_address, exact_longitude, exact_latitude, owner_name, owner_phone, owner_email, owner_notes, internal_notes, updated_at",
      )
      .eq("listing_id", listingId)
      .maybeSingle();

    if (!data) return null;

    return {
      listingId: data.listing_id ?? listingId,
      exactAddress: asString(data.exact_address),
      exactLongitude: asNumber(data.exact_longitude),
      exactLatitude: asNumber(data.exact_latitude),
      ownerName: asString(data.owner_name),
      ownerPhone: asString(data.owner_phone),
      ownerEmail: asString(data.owner_email),
      ownerNotes: asString(data.owner_notes),
      internalNotes: asString(data.internal_notes),
      updatedAt: data.updated_at ?? "",
    };
  } catch {
    return null;
  }
}

/**
 * Load the submission queue.
 *
 * Ordered oldest first, because a review queue is worked front to back and the
 * oldest waiting item is the one at risk of breaching a response time.
 */
export async function loadListingSubmissions(
  status: "pending_review" | "approved" | "rejected" | "changes_requested" = "pending_review",
) {
  try {
    const supabase = await createClient();
    if (!supabase) return [];

    const { data } = await supabase
      .from("listing_submissions")
      .select(
        "id, listing_id, status, submitter_name, submitter_email, submitter_phone, notes, reviewed_at, review_notes, created_at, property_listings (reference, title, slug)",
      )
      .eq("status", status)
      .order("created_at", { ascending: true });

    return (data ?? []).map((row) => {
      const listing = row.property_listings as {
        reference?: unknown;
        title?: unknown;
        slug?: unknown;
      } | null;

      return {
        id: row.id,
        listingId: row.listing_id,
        listingReference: asString(listing?.reference) ?? "",
        listingTitle: asString(listing?.title) ?? "",
        listingSlug: asString(listing?.slug) ?? "",
        status: row.status,
        submitterName: asString(row.submitter_name) ?? "",
        submitterEmail: asString(row.submitter_email),
        submitterPhone: asString(row.submitter_phone),
        notes: asString(row.notes),
        reviewedAt: asString(row.reviewed_at),
        reviewNotes: asString(row.review_notes),
        createdAt: row.created_at ?? "",
      };
    });
  } catch {
    return [];
  }
}

/** Load the agents the caller may see. */
export async function loadAgents(): Promise<AgentRecord[]> {
  try {
    const supabase = await createClient();
    if (!supabase) return [];

    const { data } = await supabase
      .from("agent_profiles")
      .select(
        "id, user_id, display_name, slug, title, bio, public_email, public_phone, photo_path, license_number, region_id, service_areas, is_active, created_at, regions (name)",
      )
      .order("display_name", { ascending: true });

    if (!data) return [];

    // The listing count per agent, read in one pass rather than per agent.
    const { data: counts } = await supabase
      .from("property_listings")
      .select("agent_id")
      .not("agent_id", "is", null);

    const byAgent = new Map<string, number>();
    for (const row of counts ?? []) {
      if (!row.agent_id) continue;
      byAgent.set(row.agent_id, (byAgent.get(row.agent_id) ?? 0) + 1);
    }

    return data.map((row) => {
      const region = row.regions as { name?: unknown } | null;
      return {
        id: row.id,
        displayName: asString(row.display_name) ?? "",
        slug: asString(row.slug) ?? "",
        title: asString(row.title),
        bio: asString(row.bio),
        publicEmail: asString(row.public_email),
        publicPhone: asString(row.public_phone),
        photoPath: asString(row.photo_path),
        licenseNumber: asString(row.license_number),
        regionId: asString(row.region_id),
        regionName: asString(region?.name),
        serviceAreas: asStringArray(row.service_areas),
        isActive: row.is_active === true,
        userId: asString(row.user_id),
        listingCount: byAgent.get(row.id) ?? 0,
        createdAt: row.created_at ?? "",
      };
    });
  } catch {
    return [];
  }
}

/**
 * The counts for the admin dashboard.
 *
 * Read as a handful of `count` queries rather than by loading every listing: the
 * dashboard needs the totals and nothing else, and a portfolio of a few thousand
 * listings should not be transferred to answer six numbers.
 */
export async function loadRealEstateOverview() {
  const empty = {
    total: 0,
    drafts: 0,
    pendingReview: 0,
    published: 0,
    archived: 0,
    pendingSubmissions: 0,
    activeAgents: 0,
  };

  try {
    const supabase = await createClient();
    if (!supabase) return empty;

    const countIn = (status: readonly ListingStatus[]) =>
      supabase
        .from("property_listings")
        .select("id", { count: "exact", head: true })
        .in("status", [...status]);

    const [
      total,
      drafts,
      pending,
      published,
      archived,
      submissions,
      agents,
    ] = await Promise.all([
      supabase.from("property_listings").select("id", { count: "exact", head: true }),
      countIn(["draft"]),
      countIn(["pending_review"]),
      countIn(["published", "under_offer"]),
      countIn(["archived", "sold", "rented"]),
      supabase
        .from("listing_submissions")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending_review"),
      supabase
        .from("agent_profiles")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
    ]);

    return {
      total: total.count ?? 0,
      drafts: drafts.count ?? 0,
      pendingReview: pending.count ?? 0,
      published: published.count ?? 0,
      archived: archived.count ?? 0,
      pendingSubmissions: submissions.count ?? 0,
      activeAgents: agents.count ?? 0,
    };
  } catch {
    return empty;
  }
}

/** The region, division and subdivision options the listing form needs. */
export async function loadGeographyOptions(): Promise<
  readonly {
    id: string;
    name: string;
    code: string;
    divisions: readonly {
      id: string;
      name: string;
      code: string;
      subdivisions: readonly { id: string; name: string; code: string }[];
    }[];
  }[]
> {
  try {
    const supabase = await createClient();
    if (!supabase) return [];

    const [{ data: regions }, { data: divisions }, { data: subdivisions }] =
      await Promise.all([
        supabase
          .from("regions")
          .select("id, code, name")
          .order("sort_order", { ascending: true }),
        supabase
          .from("divisions")
          .select("id, region_id, code, name")
          .order("name", { ascending: true }),
        supabase
          .from("subdivisions")
          .select("id, division_id, code, name")
          .order("name", { ascending: true }),
      ]);

    if (!regions) return [];

    return regions.map((region) => ({
      id: region.id,
      name: region.name,
      code: region.code,
      divisions: (divisions ?? [])
        .filter((division) => division.region_id === region.id)
        .map((division) => ({
          id: division.id,
          name: division.name,
          code: division.code,
          subdivisions: (subdivisions ?? [])
            .filter((subdivision) => subdivision.division_id === division.id)
            .map((subdivision) => ({
              id: subdivision.id,
              name: subdivision.name,
              code: subdivision.code,
            })),
        })),
    }));
  } catch {
    return [];
  }
}

/**
 * Build the geography index the CSV import validator uses.
 *
 * Codes are uppercased so a lowercase or mixed-case file still resolves, matching
 * what the validator does when it reads a cell.
 */
export async function loadGeographyIndex() {
  try {
    const supabase = await createClient();
    if (!supabase) return null;

    const [{ data: regions }, { data: divisions }, { data: subdivisions }] =
      await Promise.all([
        supabase.from("regions").select("id, code"),
        supabase.from("divisions").select("id, region_id, code"),
        supabase.from("subdivisions").select("id, division_id, region_id, code"),
      ]);

    if (!regions) return null;

    return {
      regions: new Map(regions.map((r) => [r.code.toUpperCase(), r.id])),
      divisions: new Map(
        (divisions ?? []).map((d) => [
          d.code.toUpperCase(),
          { id: d.id, regionId: d.region_id },
        ]),
      ),
      subdivisions: new Map(
        (subdivisions ?? []).map((s) => [
          s.code.toUpperCase(),
          { id: s.id, divisionId: s.division_id, regionId: s.region_id },
        ]),
      ),
    };
  } catch {
    return null;
  }
}
