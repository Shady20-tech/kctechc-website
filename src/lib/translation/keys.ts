import type { Locale } from "@/lib/i18n/locales";

/**
 * Deterministic Tolgee key generation.
 *
 * A key is derived from the entity it belongs to, never chosen by hand. That is
 * what makes the translation index safe to regenerate: running the generator
 * twice produces the same key, so a re-save updates the existing entry instead of
 * creating a second one for the same field.
 *
 * The format is `{entityType}.{entityId}.{field}.{locale}`, which is also the
 * shape enforced by the `translation_entries_key_format` check constraint and
 * produced by `build_translation_key()` in migration 12. The three
 * implementations must agree; `keys.test.ts` pins the format and the field list
 * so a change to one that is not mirrored in the others fails the build.
 */

export type TranslatableEntityType =
  | "product"
  | "product_media"
  | "product_category";

/**
 * The product fields that are indexed for translation.
 *
 * Mirrors `product_translatable_fields()` in the database. Order is not
 * significant, but the set is: a field missing here is a field that silently
 * never reaches Tolgee.
 */
export const PRODUCT_TRANSLATABLE_FIELDS = [
  "name",
  "short_description",
  "description",
  "slug",
  "seo_title",
  "seo_description",
] as const;

export type ProductTranslatableField =
  (typeof PRODUCT_TRANSLATABLE_FIELDS)[number];

/**
 * Build the key for one field of one entity in one locale.
 *
 * The locale is part of the key because Tolgee stores a key once and holds a
 * translation per language. Indexing the source locale's key and listing the
 * target locales in `translation_entries.target_locales` is what lets a single
 * key carry both the English source and the French translation.
 */
export function buildTranslationKey(
  entityType: TranslatableEntityType,
  entityId: string,
  field: string,
  locale: Locale,
): string {
  return `${entityType}.${entityId}.${field}.${locale}`;
}

/**
 * Build the full set of keys for a product's translatable fields.
 *
 * `fields` defaults to every product field, and the caller can narrow it to the
 * fields that actually have a value — a product with no SEO description should
 * not produce a key for an empty string.
 */
export function buildProductTranslationKeys(
  productId: string,
  locale: Locale,
  fields: readonly string[] = PRODUCT_TRANSLATABLE_FIELDS,
): string[] {
  return fields.map((field) =>
    buildTranslationKey("product", productId, field, locale),
  );
}

const KEY_PATTERN = /^[a-z_]+\.[0-9a-f-]{36}\.[a-z0-9_]+\.[a-z]{2}$/;

/**
 * True when a string is a well-formed translation key.
 *
 * Used by the admin surface to reject a hand-typed key before it reaches the
 * database, where the same rule is a constraint.
 */
export function isTranslationKey(value: string): boolean {
  return KEY_PATTERN.test(value);
}

/**
 * The locale a key belongs to, or null when it is malformed.
 *
 * Reading the locale back out of the key is how the sync worker decides whether
 * an entry is a source value to push or a target value to receive.
 */
export function localeFromTranslationKey(value: string): string | null {
  const segments = value.split(".");
  return segments.length === 4 ? (segments[3] ?? null) : null;
}

/** The entity id embedded in a key, or null when it is malformed. */
export function entityIdFromTranslationKey(value: string): string | null {
  const segments = value.split(".");
  return segments.length === 4 ? (segments[1] ?? null) : null;
}
