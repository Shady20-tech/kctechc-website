import type { Locale } from "@/lib/i18n/locales";
import type { ProductRecord, CategoryRecord } from "./types";
import { primaryImage } from "./types";
import { slugForLocale } from "./slug-resolution";

/**
 * Store content resolution.
 *
 * Mirrors `src/lib/content/defaults.ts`: the bundled catalogue is the fallback
 * when Supabase is unconfigured or unreachable, and the database overrides it
 * when it is present.
 *
 * The bundled catalogue is deliberately EMPTY. No product photography, pricing or
 * stock figures were supplied with the business brief, and inventing a product
 * with a price and a stock level would put a fabricated commercial offer on a
 * production path — the exact thing the brief rules out. The store therefore
 * renders an honest empty state until a real product is published, and the
 * routes, schema and feed are all exercised by tests instead.
 */

const CATEGORIES: readonly CategoryRecord[] = [];
const PRODUCTS: readonly ProductRecord[] = [];

export function allCategoryRecords(): readonly CategoryRecord[] {
  return CATEGORIES;
}

export function allProductRecords(): readonly ProductRecord[] {
  return PRODUCTS;
}

export function productsInCategory(
  categorySlug: string,
): readonly ProductRecord[] {
  return PRODUCTS.filter((product) => product.categorySlug === categorySlug);
}

export function findCategoryRecord(
  slug: string,
): CategoryRecord | undefined {
  return CATEGORIES.find((category) => category.slug === slug);
}

export function findProductRecord(id: string): ProductRecord | undefined {
  return PRODUCTS.find((product) => product.id === id);
}

function hasContent(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/** Canonical content exists but the translation does not. */
function missingTranslation(
  canonical: unknown,
  translated: unknown,
): boolean {
  return hasContent(canonical) && !hasContent(translated);
}

/** Merge a localized overlay onto the canonical product fields, per field. */
export function localizeProduct(
  record: ProductRecord,
  locale: Locale,
): import("./types").LocalizedProduct {
  const overlay = record.translations?.[locale];

  const text = (canonical: string, translated?: string): string => {
    const candidate = translated?.trim();
    return candidate && candidate.length > 0 ? candidate : canonical;
  };

  const translatedSpecs = overlay?.specifications;
  const specifications =
    translatedSpecs && translatedSpecs.length > 0
      ? translatedSpecs
      : record.specifications;

  // Only fields that have canonical content but no translation count as a
  // fallback; an optional field absent everywhere is not a translation gap.
  const hasFallback =
    locale !== "en" &&
    (missingTranslation(record.title, overlay?.title) ||
      missingTranslation(record.shortDescription, overlay?.shortDescription) ||
      missingTranslation(record.description, overlay?.description) ||
      (record.specifications.length > 0 && !hasContent(translatedSpecs)));

  return {
    id: record.id,
    categorySlug: record.categorySlug,
    // The URL slug is the locale's own: a French visitor is linked to and served
    // the French slug, not the English one.
    slug: slugForLocale(record, locale),
    sku: record.sku,
    brand: record.brand,
    gtin: record.gtin,
    title: text(record.title, overlay?.title),
    shortDescription: text(
      record.shortDescription,
      overlay?.shortDescription,
    ),
    description: text(record.description, overlay?.description),
    specifications,
    priceMinor: record.priceMinor,
    currency: record.currency,
    stock: record.stock,
    availability: record.availability,
    condition: record.condition,
    images: record.images,
    hasFallback,
    seo: record.seo?.[locale] ?? {},
    publishedAt: record.publishedAt,
    updatedAt: record.updatedAt,
  };
}

export function localizeCategory(
  record: CategoryRecord,
  locale: Locale,
): import("./types").LocalizedCategory {
  const overlay = record.translations?.[locale];
  const name = overlay?.name?.trim();
  const description = overlay?.description?.trim();
  return {
    // The localized slug is the URL segment; the canonical slug stays the stable
    // identifier the rest of the code uses.
    slug: slugForLocale(record, locale),
    name: name && name.length > 0 ? name : record.name,
    description:
      description && description.length > 0 ? description : record.description,
  };
}

/** The image used for cards, OG previews and the feed. */
export function productPrimaryImage(record: ProductRecord) {
  return primaryImage(record.images);
}
