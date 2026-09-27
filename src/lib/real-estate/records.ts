import type { Locale } from "@/lib/i18n/locales";

import {
  LISTING_PROPERTY_KINDS,
  LISTING_SOURCES,
  LISTING_STATUSES,
  LISTING_TYPES,
  PRICE_PERIODS,
  PROPERTY_TYPES,
  type ListingPropertyKind,
  type ListingSource,
  type ListingStatus,
  type ListingType,
  type PricePeriod,
  type PropertyType,
} from "./enums";
import type {
  ListingImage,
  ListingOverlay,
  PropertyListingRecord,
} from "./types";

/**
 * Pure row-to-record mapping and localization.
 *
 * Separated from `loaders.ts` so it can be tested without a database. This is the
 * same split the store uses between `defaults.ts` (resolution, testable) and
 * `loaders.ts` (I/O): everything in this file is a function of its arguments, so
 * a test can pin the behaviour of the mapping without a Supabase instance.
 *
 * The mapping is deliberately defensive. A row arrives from PostgREST as
 * `Record<string, unknown>`, and every field is narrowed rather than cast: a
 * column that is null, a jsonb value that is not the expected shape, or an enum
 * value from a newer migration than this build all degrade to a sensible default
 * instead of rendering `undefined` or throwing.
 */

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

export const asListingType = (value: unknown): ListingType =>
  asEnum(value, LISTING_TYPES, "sale");
export const asListingKind = (value: unknown): ListingPropertyKind =>
  asEnum(value, LISTING_PROPERTY_KINDS, "other");
export const asPropertyType = (value: unknown): PropertyType =>
  asEnum(value, PROPERTY_TYPES, "residential");
export const asListingStatus = (value: unknown): ListingStatus =>
  asEnum(value, LISTING_STATUSES, "draft");
export const asListingSource = (value: unknown): ListingSource =>
  asEnum(value, LISTING_SOURCES, "admin");
export const asPricePeriod = (value: unknown): PricePeriod =>
  asEnum(value, PRICE_PERIODS, "total");

/** A raw row from `property_listings`, as PostgREST returns it. */
export type ListingRow = Record<string, unknown>;

export function regionFromRow(row: ListingRow): { slug: string; name: string } {
  const region = row.regions as { slug?: unknown; name?: unknown } | null;
  return {
    slug: asString(region?.slug) ?? "",
    name: asString(region?.name) ?? "",
  };
}

function agentNameFromRow(row: ListingRow): string | undefined {
  const agent = row.agent_profiles as { display_name?: unknown } | null;
  return asString(agent?.display_name);
}

/** Map one row into the public record shape. */
export function toListingRecord(
  row: ListingRow,
  extras: {
    images?: readonly ListingImage[];
    publicLocation?: PropertyListingRecord["publicLocation"];
    localizedSlugs?: Partial<Record<Locale, string>>;
    translations?: Partial<Record<Locale, ListingOverlay>>;
  } = {},
): PropertyListingRecord {
  const region = regionFromRow(row);

  return {
    id: String(row.id),
    reference: asString(row.reference) ?? "",
    slug: asString(row.slug) ?? "",
    listingType: asListingType(row.listing_type),
    propertyKind: asListingKind(row.property_kind),
    propertyType: asPropertyType(row.property_type),
    status: asListingStatus(row.status),
    source: asListingSource(row.source),

    regionSlug: region.slug,
    regionName: region.name,
    locality: asString(row.locality),

    title: asString(row.title) ?? "",
    description: asString(row.description) ?? "",
    highlights: asStringArray(row.highlights),
    amenities: asStringArray(row.amenities),

    priceMinor: asNumber(row.price_minor) ?? null,
    currency: asString(row.currency) ?? "XAF",
    pricePeriod: asPricePeriod(row.price_period),
    priceOnRequest: row.price_on_request === true,

    landAreaSqm: asNumber(row.land_area_sqm),
    buildingAreaSqm: asNumber(row.building_area_sqm),
    bedrooms: asNumber(row.bedrooms),
    bathrooms: asNumber(row.bathrooms),
    yearBuilt: asNumber(row.year_built),

    images: extras.images ?? [],
    isFeatured: row.is_featured === true,
    viewCount: asNumber(row.view_count) ?? 0,
    inquiryCount: asNumber(row.inquiry_count) ?? 0,

    publishedAt: asString(row.published_at),
    closedAt: asString(row.closed_at),
    listedOn: asString(row.listed_on),
    agentId: asString(row.agent_id),
    agentName: agentNameFromRow(row),

    publicLocation: extras.publicLocation,
    localizedSlugs: extras.localizedSlugs,
    translations: extras.translations,

    createdAt: asString(row.created_at) ?? "",
    updatedAt: asString(row.updated_at) ?? "",
  };
}

/** Map a `listing_media` row into an image. */
export function toListingImage(row: ListingRow): ListingImage {
  return {
    id: String(row.id),
    storagePath: asString(row.storage_path) ?? "",
    alt: asString(row.alt_text) ?? "",
    caption: asString(row.caption),
    isPrimary: row.is_primary === true,
    position: asNumber(row.position) ?? 0,
    width: asNumber(row.width),
    height: asNumber(row.height),
  };
}

/**
 * Sort a gallery: the primary image leads, the rest keep their position order.
 *
 * A gallery is reordered by hand, so position is explicit rather than implied by
 * insertion order. The primary image is promoted rather than trusted to have
 * position 0, because the two are separate decisions and an editor can set either
 * without the other.
 */
export function sortGallery(images: readonly ListingImage[]): ListingImage[] {
  return [...images].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return a.position - b.position;
  });
}

export type TranslationRow = {
  entity_id: string;
  field_name: string;
  locale: string;
  value: string;
  state: string;
};

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

/**
 * Group listing translation rows into per-listing, per-locale overlays.
 *
 * Only `translated` and `reviewed` values are used, matching the store. A
 * `pending` row records that a translation is owed and holds an empty string; an
 * `outdated` row holds a superseded translation. Rendering either would show a
 * French reader a blank field or text that no longer matches the English, so both
 * are treated as absent and the canonical English is shown instead.
 *
 * English is skipped as a target: it is the source locale, and an `en` row would
 * be a translation of the original into itself.
 */
export function groupListingTranslations(
  rows: readonly TranslationRow[],
): Map<string, Partial<Record<Locale, ListingOverlay>>> {
  const byListing = new Map<string, Partial<Record<Locale, ListingOverlay>>>();

  for (const row of rows) {
    if (row.locale !== "fr") continue;
    if (row.state !== "translated" && row.state !== "reviewed") continue;

    const fields = (byListing.get(row.entity_id) ?? {}) as Partial<
      Record<Locale, ListingOverlay>
    >;
    const overlay = { ...(fields.fr ?? {}) };

    if (row.field_name === "title") {
      const text = asString(row.value);
      if (text) overlay.title = text;
    } else if (row.field_name === "description") {
      const text = asString(row.value);
      if (text) overlay.description = text;
    } else if (row.field_name === "highlights") {
      // Stored as a JSON array, matching how product specifications are stored.
      const parsed = safeJson(row.value);
      if (Array.isArray(parsed)) {
        const items = asStringArray(parsed);
        if (items.length > 0) overlay.highlights = items;
      }
    }

    fields.fr = overlay;
    byListing.set(row.entity_id, fields);
  }

  return byListing;
}

/**
 * Apply a locale to a record.
 *
 * Returns the record unchanged for the source locale. For French, each field the
 * overlay covers is replaced and `hasFallback` records whether anything was left
 * in English, so a page can say so rather than presenting a half-translated
 * listing as fully translated — the same contract the store uses.
 */
export function localizeListing(
  record: PropertyListingRecord,
  locale: Locale,
): PropertyListingRecord & { hasFallback: boolean } {
  if (locale === "en") return { ...record, hasFallback: false };

  const overlay = record.translations?.[locale];
  if (!overlay) {
    // No translation at all: everything the listing says is in English.
    const hasAnyContent =
      record.title.length > 0 ||
      record.description.length > 0 ||
      record.highlights.length > 0;
    return { ...record, hasFallback: hasAnyContent };
  }

  let hasFallback = false;

  const text = (canonical: string, translated?: string): string => {
    const candidate = translated?.trim();
    if (candidate && candidate.length > 0) return candidate;
    if (canonical.trim().length > 0) hasFallback = true;
    return canonical;
  };

  const highlights =
    overlay.highlights && overlay.highlights.length > 0
      ? [...overlay.highlights]
      : (() => {
          if (record.highlights.length > 0) hasFallback = true;
          return record.highlights;
        })();

  return {
    ...record,
    title: text(record.title, overlay.title),
    description: text(record.description, overlay.description),
    highlights,
    hasFallback,
  };
}

/**
 * Resolve a listing by the slug in the URL.
 *
 * A French URL carries the French slug, so the canonical slug alone is not
 * enough. The canonical slug is checked first: it is the one that always exists,
 * and a listing whose French slug happens to equal another listing's canonical
 * slug should resolve to the listing that owns it canonically.
 */
export function resolveListingBySlug(
  records: readonly PropertyListingRecord[],
  slug: string,
  locale: Locale,
): PropertyListingRecord | undefined {
  const canonical = records.find((record) => record.slug === slug);
  if (canonical) return canonical;

  if (locale === "en") return undefined;
  return records.find((record) => record.localizedSlugs?.[locale] === slug);
}

/**
 * The slug to build a link with for a locale.
 *
 * Falls back to the canonical slug, which is always valid — a missing French slug
 * means the French URL is the canonical one, not that there is no URL.
 */
export function listingSlugForLocale(
  record: PropertyListingRecord,
  locale: Locale,
): string {
  return record.localizedSlugs?.[locale] ?? record.slug;
}

/** Format a price for display, or the "on request" wording. */
export function formatListingPrice(
  record: Pick<
    PropertyListingRecord,
    "priceMinor" | "currency" | "pricePeriod" | "priceOnRequest"
  >,
  locale: Locale,
): string {
  if (record.priceOnRequest) {
    return locale === "fr" ? "Prix sur demande" : "Price on request";
  }
  if (record.priceMinor === null) {
    return locale === "fr" ? "Prix non communiqué" : "Price not stated";
  }

  const amount = new Intl.NumberFormat(locale === "fr" ? "fr-CM" : "en-CM", {
    style: "currency",
    currency: record.currency,
    maximumFractionDigits: 0,
  }).format(record.priceMinor);

  const suffix = PERIOD_SUFFIX[record.pricePeriod]?.[locale];
  return suffix ? `${amount} ${suffix}` : amount;
}

/** How a period reads after a figure, per locale. */
const PERIOD_SUFFIX: Record<PricePeriod, Record<Locale, string>> = {
  total: { en: "", fr: "" },
  monthly: { en: "/ month", fr: "/ mois" },
  quarterly: { en: "/ quarter", fr: "/ trimestre" },
  yearly: { en: "/ year", fr: "/ an" },
  weekly: { en: "/ week", fr: "/ semaine" },
  nightly: { en: "/ night", fr: "/ nuit" },
};

/** The primary image, or the first, for a card or a social preview. */
export function listingPrimaryImage(
  record: PropertyListingRecord,
): ListingImage | undefined {
  return record.images.find((image) => image.isPrimary) ?? record.images[0];
}
