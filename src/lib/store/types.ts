import type { Locale } from "@/lib/i18n/locales";
import { STORE_CURRENCY } from "@/lib/config/site";

/**
 * Product content contracts.
 *
 * The same shape is produced whether a product came from Supabase or from the
 * bundled defaults, so a page renders through one code path regardless of where
 * the data lives — the convention established by the Phase 3 service layer.
 */

/** Availability mirrors the `product_availability` enum. */
export type ProductAvailability =
  | "in_stock"
  | "out_of_stock"
  | "preorder"
  | "backorder"
  | "discontinued";

export type ProductCondition = "new" | "refurbished" | "used";

export type ProductSpecification = {
  label: string;
  value: string;
};

export type ProductImage = {
  storagePath: string;
  alt: string;
  isPrimary: boolean;
  position: number;
};

/**
 * A localized overlay for one locale.
 *
 * `specifications` is included because specification labels ("Weight") are
 * language-specific even when the value ("1.1 kg") is not.
 */
export type ProductOverlay = Partial<{
  title: string;
  shortDescription: string;
  description: string;
  specifications: readonly ProductSpecification[];
}>;

export type ProductSeo = {
  title?: string;
  description?: string;
  canonicalOverride?: string;
  ogImagePath?: string;
  noindex?: boolean;
};

export type ProductRecord = {
  id: string;
  categorySlug: string;
  /** Canonical (source-locale) slug. */
  slug: string;
  sku: string;
  brand?: string;
  gtin?: string;

  title: string;
  shortDescription: string;
  description: string;
  specifications: readonly ProductSpecification[];

  priceMinor: number;
  currency: string;

  stock: number;
  availability: ProductAvailability;
  condition: ProductCondition;

  images: readonly ProductImage[];

  /** Localized slugs for target locales, keyed by locale. */
  localizedSlugs?: Partial<Record<Locale, string>>;
  translations?: Partial<Record<Locale, ProductOverlay>>;
  seo?: Partial<Record<Locale, ProductSeo>>;
  publishedAt?: string;
  updatedAt?: string;
};

/** A product resolved for one locale: every display field is populated. */
export type LocalizedProduct = {
  id: string;
  categorySlug: string;
  slug: string;
  sku: string;
  brand?: string;
  gtin?: string;
  title: string;
  shortDescription: string;
  description: string;
  specifications: readonly ProductSpecification[];
  priceMinor: number;
  currency: string;
  stock: number;
  availability: ProductAvailability;
  condition: ProductCondition;
  images: readonly ProductImage[];
  /** True when at least one field fell back to canonical for this locale. */
  hasFallback: boolean;
  seo: ProductSeo;
  publishedAt?: string;
  updatedAt?: string;
};

export type LocalizedCategory = {
  slug: string;
  name: string;
  description?: string;
};

export type CategoryRecord = {
  slug: string;
  name: string;
  description?: string;
  localizedSlugs?: Partial<Record<Locale, string>>;
  translations?: Partial<
    Record<Locale, { name?: string; description?: string }>
  >;
};

/** The primary image, or the first one, for cards and social previews. */
export function primaryImage(
  images: readonly ProductImage[],
): ProductImage | undefined {
  return images.find((image) => image.isPrimary) ?? images[0];
}

/**
 * Human-readable availability label key.
 *
 * A key rather than a sentence so the label is translated like every other piece
 * of UI text; the value itself comes from the database enum.
 */
export function availabilityLabelKey(
  availability: ProductAvailability,
): string {
  return `store.availability.${availability}`;
}

export function conditionLabelKey(condition: ProductCondition): string {
  return `store.condition.${condition}`;
}

/**
 * True when the product can be added to a cart.
 *
 * Preorder and backorder items are orderable — that is the point of those states
 * — while a discontinued or out-of-stock item is not. Kept as a function so the
 * page, the cart action and the feed all answer the question the same way.
 */
export function isPurchasable(availability: ProductAvailability): boolean {
  return (
    availability === "in_stock" ||
    availability === "preorder" ||
    availability === "backorder"
  );
}

/**
 * Format a minor-unit price for display.
 *
 * `priceMinor` is in the currency's smallest unit. XAF has no subdivision, so the
 * value is whole francs; dividing by 100 for every currency would show a product
 * priced at 850000 XAF as 8,500.00. `minorUnitDivisor` therefore reads the
 * currency's own exponent rather than assuming two decimal places.
 */
export function formatPrice(
  priceMinor: number,
  currency: string,
  locale: Locale,
): string {
  const divisor = minorUnitDivisor(currency);
  const amount = priceMinor / divisor;
  const intlLocale = STORE_CURRENCY.locales[locale];

  try {
    return new Intl.NumberFormat(intlLocale, {
      style: "currency",
      currency,
      // Zero-decimal currencies must not render a fractional part.
      minimumFractionDigits: divisor === 1 ? 0 : 2,
      maximumFractionDigits: divisor === 1 ? 0 : 2,
    }).format(amount);
  } catch {
    // An unrecognised currency code should degrade to a readable number rather
    // than throw inside a render.
    return `${new Intl.NumberFormat(intlLocale).format(amount)} ${currency}`;
  }
}

/**
 * The number of minor units in one major unit for a currency.
 *
 * Only zero-decimal currencies are special-cased because they are the ones the
 * catalogue actually uses; everything else follows the ISO 4217 default of two.
 */
export function minorUnitDivisor(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 1 : 100;
}

/** ISO 4217 currencies with no minor unit, per the standard's "exponent 0". */
const ZERO_DECIMAL_CURRENCIES = new Set([
  "XAF",
  "XOF",
  "XPF",
  "JPY",
  "KRW",
  "VND",
  "CLP",
  "GNF",
  "KMF",
  "PYG",
  "RWF",
  "UGX",
  "VUV",
  "DJF",
  "BIF",
  "ISK",
]);

/** An exact price string for structured data and the feed (e.g. "850000"). */
export function priceForFeed(priceMinor: number, currency: string): string {
  const divisor = minorUnitDivisor(currency);
  // Merchant Center expects a decimal string with a period, not a localised one.
  return (priceMinor / divisor).toFixed(divisor === 1 ? 0 : 2);
}

/**
 * Parse a `specifications` jsonb column, discarding anything malformed.
 *
 * A specification is only rendered when it has both a label and a value; a
 * half-populated pair would produce a blank row.
 */
export function parseSpecifications(value: unknown): ProductSpecification[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const record = entry as Record<string, unknown>;
    const label = typeof record.label === "string" ? record.label.trim() : "";
    const specValue =
      typeof record.value === "string" ? record.value.trim() : "";
    return label && specValue ? [{ label, value: specValue }] : [];
  });
}
