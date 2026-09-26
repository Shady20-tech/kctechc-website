import type { Locale } from "@/lib/i18n/locales";

/**
 * Localized slug resolution.
 *
 * A product's URL uses its slug *in the active locale*:
 *
 *   /en/digital-marketing/store/laptops/thinkpad-x1
 *   /fr/digital-marketing/store/ordinateurs/ordinateur-thinkpad-x1
 *
 * The French URL therefore carries a slug that is not the canonical one, so a
 * request cannot simply be matched against `products.slug`. Resolution has to map
 * a localized slug back to the product it belongs to.
 *
 * The rules that make that safe:
 *
 *   1. The source locale resolves against the canonical slug. There is no
 *      `product_slugs` row for 'en' — the database constraint forbids it — so
 *      treating English as "canonical slug only" is the same rule the schema
 *      enforces, not a second interpretation of it.
 *   2. A target locale resolves against its localized slug, and falls back to the
 *      canonical slug. The fallback matters: a product published before its
 *      French slug was written must still be reachable at its English slug under
 *      /fr, or it would 404 for a French visitor who followed an English link.
 *   3. Slugs are compared after normalization (lowercase, trimmed), because a
 *      trailing space or mixed case should not turn into a 404.
 *
 * Resolution returns `null` rather than throwing: a slug that matches nothing is
 * an ordinary 404, not an error condition.
 */

export type SlugResolverInput = {
  /**
   * The canonical slug — the source-locale URL segment, and the stable
   * identifier the rest of the code addresses the record by. Named `slug` to
   * match the database column, so a record can be passed in without remapping.
   */
  slug: string;
  /** Localized slugs for target locales. */
  localizedSlugs?: Partial<Record<Locale, string>>;
};

/** Normalize a URL segment for comparison. */
export function normalizeSlug(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * The slug a product should be linked to in a given locale.
 *
 * Falls back to the canonical slug when no localized slug exists, which is what
 * keeps every product reachable in every locale.
 */
export function slugForLocale(
  input: SlugResolverInput,
  locale: Locale,
): string {
  return input.localizedSlugs?.[locale]?.trim() || input.slug;
}

/**
 * True when a URL segment addresses this record in this locale.
 *
 * Both the locale's own slug and the canonical slug match. Accepting the
 * canonical slug is what stops an inbound English link from 404-ing for a French
 * visitor; the page then redirects it to the locale's canonical URL, so there is
 * still exactly one indexable address per product per locale.
 */
export function matchesSlugForLocale(
  input: SlugResolverInput,
  slug: string,
  locale: Locale,
): boolean {
  const target = normalizeSlug(slug);
  if (target.length === 0) return false;
  if (normalizeSlug(slugForLocale(input, locale)) === target) return true;
  // The canonical slug is a second, temporary address for a target locale.
  return locale !== "en" && normalizeSlug(input.slug) === target;
}

/**
 * Resolve a URL segment to the record that owns it in this locale.
 *
 * Matching is scoped to the locale on purpose. A French slug must not resolve
 * under /en: the canonical English URL is the one search engines index, and
 * letting a French slug answer under /en would create two URLs for one product.
 * The reverse is allowed — see `matchesSlugForLocale` — because the canonical
 * slug is the record's identity and a link to it should not break.
 *
 * Returns the record whose slug matches, or null.
 */
export function resolveBySlug<T extends SlugResolverInput>(
  records: readonly T[],
  slug: string,
  locale: Locale,
): T | null {
  if (normalizeSlug(slug).length === 0) return null;
  for (const record of records) {
    if (matchesSlugForLocale(record, slug, locale)) return record;
  }
  return null;
}

/**
 * True when a segment is the record's canonical URL slug for this locale.
 *
 * A page uses this to decide whether the URL it was reached by is the one it
 * should be indexed under. A false result means the request arrived at the
 * record's canonical slug rather than its localized one, so the page redirects to
 * the localized URL instead of serving the same content at a second address.
 */
export function isCanonicalUrlSlug(
  input: SlugResolverInput,
  slug: string,
  locale: Locale,
): boolean {
  return normalizeSlug(slugForLocale(input, locale)) === normalizeSlug(slug);
}

/**
 * All slugs a product answers to in a locale, canonical included.
 *
 * Used by `generateStaticParams` so both the canonical and the localized URL are
 * prerendered — otherwise the French slug would only ever be served dynamically.
 */
export function slugsForLocale(
  input: SlugResolverInput,
  locale: Locale,
): string[] {
  const localized = input.localizedSlugs?.[locale]?.trim();
  const canonical = input.slug;
  if (!localized || normalizeSlug(localized) === normalizeSlug(canonical)) {
    return [canonical];
  }
  return [canonical, localized];
}

/**
 * Resolve a category segment to a category slug in this locale.
 *
 * Categories are matched the same way products are, and for the same reason: the
 * French URL carries a French category segment. Returning the canonical category
 * slug lets the rest of the code address the category by one stable identifier
 * regardless of which locale's URL it arrived through.
 */
export function resolveCategoryBySlug<T extends SlugResolverInput>(
  records: readonly T[],
  segment: string,
  locale: Locale,
): T | null {
  return resolveBySlug(records, segment, locale);
}
