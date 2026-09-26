import "server-only";

import type { Locale } from "@/lib/i18n/locales";
import { createClient } from "@/lib/supabase/server";
import { STORE_CURRENCY } from "@/lib/config/site";
import {
  allCategoryRecords,
  allProductRecords,
  localizeCategory,
  localizeProduct,
} from "./defaults";
import { resolveBySlug, slugForLocale } from "./slug-resolution";
import {
  parseSpecifications,
  type CategoryRecord,
  type LocalizedCategory,
  type LocalizedProduct,
  type ProductAvailability,
  type ProductCondition,
  type ProductImage,
  type ProductOverlay,
  type ProductRecord,
  type ProductSeo,
} from "./types";

/**
 * Store content loading.
 *
 * Follows the contract established by `src/lib/content/loaders.ts`:
 *
 *   - Read through the anonymous, RLS-bound client, so "draft products are not
 *     public" is enforced by the database rather than by a filter this code could
 *     forget to apply.
 *   - On any failure — unconfigured, unreachable, empty, malformed — fall back to
 *     the bundled catalogue instead of throwing. The bundled catalogue is empty,
 *     so the visible result of a database outage is the store's empty state, not
 *     an error page.
 *
 * The site reads localized product content from Supabase. Tolgee is the
 * translation-management and sync layer: it is where a translator works and how
 * the index stays in step, but a request for a page never depends on Tolgee being
 * reachable.
 */

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

/** Narrow a database enum value to the availability union, defaulting safely. */
function asAvailability(value: unknown): ProductAvailability {
  const allowed: ProductAvailability[] = [
    "in_stock",
    "out_of_stock",
    "preorder",
    "backorder",
    "discontinued",
  ];
  return allowed.includes(value as ProductAvailability)
    ? (value as ProductAvailability)
    : "out_of_stock";
}

function asCondition(value: unknown): ProductCondition {
  const allowed: ProductCondition[] = ["new", "refurbished", "used"];
  return allowed.includes(value as ProductCondition)
    ? (value as ProductCondition)
    : "new";
}

type TranslationRow = {
  entity_id: string;
  field_name: string;
  locale: string;
  value: string;
  state: string;
};

/**
 * Group product translation rows into per-product, per-locale overlays.
 *
 * Only `translated` and `reviewed` values are used. A `pending` row exists to
 * record that a translation is owed and holds an empty string; a `outdated` row
 * holds a superseded translation. Rendering either would show French readers a
 * blank field or text that no longer matches the English, so both are treated as
 * absent and the canonical English is shown instead — with `hasFallback` telling
 * the page to say so.
 */
function groupProductTranslations(
  rows: readonly TranslationRow[],
): Map<string, Partial<Record<Locale, ProductOverlay>>> {
  const byProduct = new Map<string, Partial<Record<Locale, ProductOverlay>>>();

  for (const row of rows) {
    if (row.locale !== "en" && row.locale !== "fr") continue;
    if (row.locale === "en") continue;
    if (row.state !== "translated" && row.state !== "reviewed") continue;

    const locale = row.locale as Locale;
    const fields = (byProduct.get(row.entity_id) ?? {}) as Partial<
      Record<Locale, ProductOverlay>
    >;
    const overlay = { ...(fields[locale] ?? {}) };

    if (row.field_name === "name") {
      const text = asString(row.value);
      if (text) overlay.title = text;
    } else if (row.field_name === "short_description") {
      const text = asString(row.value);
      if (text) overlay.shortDescription = text;
    } else if (row.field_name === "description") {
      const text = asString(row.value);
      if (text) overlay.description = text;
    } else if (row.field_name === "specifications") {
      const specs = parseSpecifications(safeJson(row.value));
      if (specs.length > 0) overlay.specifications = specs;
    }

    fields[locale] = overlay;
    byProduct.set(row.entity_id, fields);
  }

  return byProduct;
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function seoFromRow(row: {
  locale: string;
  title: string | null;
  description: string | null;
  canonical_override: string | null;
  og_image_path: string | null;
  noindex: boolean;
}): ProductSeo {
  return {
    title: asString(row.title),
    description: asString(row.description),
    canonicalOverride: asString(row.canonical_override),
    ogImagePath: asString(row.og_image_path),
    noindex: row.noindex,
  };
}

/**
 * Load every published product, canonical form.
 *
 * Returns canonical records rather than localized ones because the caller usually
 * needs to resolve a slug first and localize afterwards, and localizing the whole
 * catalogue to answer one request would do six times the necessary work.
 */
export async function loadProductRecords(): Promise<readonly ProductRecord[]> {
  const fallback = allProductRecords();

  try {
    const supabase = await createClient();
    if (!supabase) return fallback;

    // The department is looked up rather than assumed, so the store is scoped to
    // the Digital Marketing department instead of showing a product from another
    // department if one were ever created.
    const { data: department } = await supabase
      .from("departments")
      .select("id")
      .eq("slug", "digital-marketing")
      .maybeSingle();

    if (!department) return fallback;

    const { data: categories, error: categoryError } = await supabase
      .from("product_categories")
      .select("id, slug")
      .eq("department_id", department.id)
      .eq("publish_state", "published")
      .eq("is_active", true);

    if (categoryError || !categories || categories.length === 0) return fallback;

    const categoryIdBySlug = new Map(
      categories.map((category) => [category.id, category.slug]),
    );
    const categoryIds = categories.map((category) => category.id);

    const { data: rows, error } = await supabase
      .from("products")
      .select(
        "id, category_id, slug, sku, brand, gtin, title, short_description, description, specifications, price_minor, currency, stock, availability, condition, published_at, updated_at",
      )
      .in("category_id", categoryIds)
      .eq("publish_state", "published")
      .order("title", { ascending: true });

    if (error || !rows || rows.length === 0) return fallback;

    const ids = rows.map((row) => row.id);

    const [
      { data: translations },
      { data: slugs },
      { data: media },
      { data: seoRows },
    ] = await Promise.all([
      supabase
        .from("content_translations")
        .select("entity_id, field_name, locale, value, state")
        .eq("entity_type", "product")
        .in("entity_id", ids),
      supabase
        .from("product_slugs")
        .select("product_id, locale, slug")
        .in("product_id", ids),
      supabase
        .from("product_media")
        .select("product_id, storage_path, alt_text, is_primary, position")
        .in("product_id", ids)
        .order("position", { ascending: true }),
      supabase
        .from("entity_seo")
        .select(
          "entity_id, locale, title, description, canonical_override, og_image_path, noindex",
        )
        .eq("entity_type", "product")
        .in("entity_id", ids),
    ]);

    const overlays = groupProductTranslations(translations ?? []);

    const localizedSlugs = new Map<
      string,
      Partial<Record<Locale, string>>
    >();
    for (const row of slugs ?? []) {
      if (row.locale !== "en" && row.locale !== "fr") continue;
      const locale = row.locale as Locale;
      const forProduct = localizedSlugs.get(row.product_id) ?? {};
      forProduct[locale] = row.slug;
      localizedSlugs.set(row.product_id, forProduct);
    }

    const mediaByProduct = new Map<string, ProductImage[]>();
    for (const row of media ?? []) {
      const list = mediaByProduct.get(row.product_id) ?? [];
      list.push({
        storagePath: row.storage_path,
        alt: row.alt_text,
        isPrimary: row.is_primary,
        position: row.position,
      });
      mediaByProduct.set(row.product_id, list);
    }

    const seoByProduct = new Map<string, Partial<Record<Locale, ProductSeo>>>();
    for (const row of seoRows ?? []) {
      if (row.locale !== "en" && row.locale !== "fr") continue;
      const locale = row.locale as Locale;
      const forProduct = seoByProduct.get(row.entity_id) ?? {};
      forProduct[locale] = seoFromRow(row);
      seoByProduct.set(row.entity_id, forProduct);
    }

    return rows.map((row) => {
      const record: ProductRecord = {
        id: row.id,
        categorySlug: categoryIdBySlug.get(row.category_id) ?? "",
        slug: row.slug,
        sku: row.sku,
        brand: asString(row.brand),
        gtin: asString(row.gtin),
        title: row.title,
        shortDescription: row.short_description,
        description: row.description,
        specifications: parseSpecifications(row.specifications),
        priceMinor: row.price_minor,
        currency: row.currency,
        stock: row.stock,
        availability: asAvailability(row.availability),
        condition: asCondition(row.condition),
        images: mediaByProduct.get(row.id) ?? [],
        localizedSlugs: localizedSlugs.get(row.id),
        translations: overlays.get(row.id),
        seo: seoByProduct.get(row.id),
        publishedAt: asString(row.published_at),
        updatedAt: asString(row.updated_at),
      };
      return record;
    });
  } catch {
    return fallback;
  }
}

/** Load published categories, canonical form. */
export async function loadCategoryRecords(): Promise<
  readonly CategoryRecord[]
> {
  const fallback = allCategoryRecords();

  try {
    const supabase = await createClient();
    if (!supabase) return fallback;

    const { data: department } = await supabase
      .from("departments")
      .select("id")
      .eq("slug", "digital-marketing")
      .maybeSingle();
    if (!department) return fallback;

    const { data: rows, error } = await supabase
      .from("product_categories")
      .select("id, slug, name, description")
      .eq("department_id", department.id)
      .eq("publish_state", "published")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error || !rows || rows.length === 0) return fallback;

    const ids = rows.map((row) => row.id);

    const [{ data: translations }, { data: slugs }] = await Promise.all([
      supabase
        .from("content_translations")
        .select("entity_id, field_name, locale, value, state")
        .eq("entity_type", "category")
        .in("entity_id", ids),
      supabase
        .from("product_category_slugs")
        .select("category_id, locale, slug")
        .in("category_id", ids),
    ]);

    const localizedSlugs = new Map<string, Partial<Record<Locale, string>>>();
    for (const row of slugs ?? []) {
      if (row.locale !== "en" && row.locale !== "fr") continue;
      const locale = row.locale as Locale;
      const forCategory = localizedSlugs.get(row.category_id) ?? {};
      forCategory[locale] = row.slug;
      localizedSlugs.set(row.category_id, forCategory);
    }

    const overlayByName = new Map<
      string,
      Partial<Record<Locale, { name?: string; description?: string }>>
    >();
    for (const row of translations ?? []) {
      if (row.locale !== "fr") continue;
      if (row.state !== "translated" && row.state !== "reviewed") continue;
      const text = asString(row.value);
      if (!text) continue;

      const fields = overlayByName.get(row.entity_id) ?? {};
      const forLocale = { ...(fields.fr ?? {}) };
      if (row.field_name === "name") forLocale.name = text;
      if (row.field_name === "description") forLocale.description = text;
      fields.fr = forLocale;
      overlayByName.set(row.entity_id, fields);
    }

    return rows.map((row) => ({
      slug: row.slug,
      name: row.name,
      description: asString(row.description),
      localizedSlugs: localizedSlugs.get(row.id),
      translations: overlayByName.get(row.id),
    }));
  } catch {
    return fallback;
  }
}

/** Load every published product, localized for one locale. */
export async function loadProducts(locale: Locale): Promise<LocalizedProduct[]> {
  const records = await loadProductRecords();
  return records.map((record) => localizeProduct(record, locale));
}

/** Load the published products in one category, localized. */
export async function loadProductsInCategory(
  categorySlug: string,
  locale: Locale,
): Promise<LocalizedProduct[]> {
  const records = await loadProductRecords();
  return records
    .filter((record) => record.categorySlug === categorySlug)
    .map((record) => localizeProduct(record, locale));
}

/**
 * Load published categories with their database ids.
 *
 * The storefront loaders deliberately drop the id: nothing on a public page needs
 * it, and not carrying it means a template cannot accidentally render it. The
 * admin form does need it — a product references its category by id — so this
 * loader exists separately rather than widening `CategoryRecord` for everyone.
 *
 * Returns an empty list rather than a fallback when the database is unavailable.
 * A form that silently offers a fabricated category id would let an editor submit
 * a product pointing at a row that does not exist.
 */
export async function loadCategoryOptions(): Promise<
  readonly { id: string; name: string }[]
> {
  try {
    const supabase = await createClient();
    if (!supabase) return [];

    const { data: department } = await supabase
      .from("departments")
      .select("id")
      .eq("slug", "digital-marketing")
      .maybeSingle();
    if (!department) return [];

    const { data: rows, error } = await supabase
      .from("product_categories")
      .select("id, name")
      .eq("department_id", department.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error || !rows) return [];
    return rows.map((row) => ({ id: row.id, name: row.name }));
  } catch {
    return [];
  }
}

/** Load published categories, localized. */
export async function loadCategories(
  locale: Locale,
): Promise<LocalizedCategory[]> {
  const records = await loadCategoryRecords();
  return records.map((record) => localizeCategory(record, locale));
}

/**
 * Resolve a product by the slug that appears in the URL for this locale.
 *
 * This is the lookup the product detail page uses. A French URL carries a French
 * slug, so the canonical slug alone is not enough to answer the request; see
 * `slug-resolution.ts` for the matching rules.
 */
export async function loadProductBySlug(
  slug: string,
  locale: Locale,
): Promise<LocalizedProduct | null> {
  const records = await loadProductRecords();
  const record = resolveBySlug(records, slug, locale);
  return record ? localizeProduct(record, locale) : null;
}

/** Resolve a category by the segment that appears in the URL for this locale. */
export async function loadCategoryBySlug(
  segment: string,
  locale: Locale,
): Promise<LocalizedCategory | null> {
  const records = await loadCategoryRecords();
  const record = resolveBySlug(records, segment, locale);
  return record ? localizeCategory(record, locale) : null;
}

/**
 * The canonical slug for a product, for links that must address it stably.
 *
 * Used by the sitemap and the feed, which need one URL per product rather than
 * one per locale.
 */
export async function canonicalSlugForProduct(id: string): Promise<string | null> {
  const records = await loadProductRecords();
  return records.find((record) => record.id === id)?.slug ?? null;
}

/**
 * Every locale-specific URL segment for each published product.
 *
 * `generateStaticParams` needs the localized slugs too, or the French product
 * pages would only ever be rendered on demand.
 */
export async function productSlugMatrix(): Promise<
  { canonical: string; localized: Partial<Record<Locale, string>> }[]
> {
  const records = await loadProductRecords();
  return records.map((record) => ({
    canonical: record.slug,
    localized: record.localizedSlugs ?? {},
  }));
}

/** Re-exported so callers do not need to import the slug module separately. */
export { slugForLocale, resolveBySlug };

/** The store's primary currency, used when a product does not carry one. */
export const STORE_CURRENCY_CODE = STORE_CURRENCY.code;
