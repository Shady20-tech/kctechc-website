import type { Locale } from "@/lib/i18n/locales";

import { localizeListing, listingSlugForLocale } from "./records";
import type { PropertyListingRecord } from "./types";

/**
 * A listing prepared for a public surface.
 *
 * The record, localized, together with the localized slug, the href for the
 * current locale and the fallback flag. Assembled once here rather than in each
 * page, so the landing page, the search page and a detail page cannot disagree
 * about which slug a locale uses or about whether a French page is partially
 * English.
 *
 * `hasFallback` is carried rather than recomputed: `localizeListing` already
 * decided it while applying the overlay, and recomputing it from the result
 * would be a second implementation that could drift from the first.
 */
export type QualifiedListing = {
  record: PropertyListingRecord & { hasFallback: boolean };
  slug: string;
  href: string;
  isFeatured: boolean;
};

export function qualifyListing(
  record: PropertyListingRecord,
  locale: Locale,
  pathPrefix = "/real-estate/properties",
): QualifiedListing {
  const localized = localizeListing(record, locale);
  const slug = listingSlugForLocale(record, locale);
  return {
    record: localized,
    slug,
    href: `/${locale}${pathPrefix}/${slug}`,
    isFeatured: record.isFeatured,
  };
}

/** Qualify a list of listings for one locale. */
export function qualifyListings(
  records: readonly PropertyListingRecord[],
  locale: Locale,
  pathPrefix = "/real-estate/properties",
): QualifiedListing[] {
  return records.map((record) => qualifyListing(record, locale, pathPrefix));
}
