import "server-only";

import { z } from "zod";
import { STORE_CURRENCY } from "@/lib/config/site";
import type { Database } from "@/lib/db/database.types";
import { PRODUCT_TRANSLATABLE_FIELDS } from "@/lib/translation/keys";

/**
 * Product input validation.
 *
 * This is the single schema the admin form and the Server Action both use, so a
 * value that passes in the browser cannot be rejected by the action for a
 * different reason — the browser validation is a convenience, and the action's is
 * the control.
 *
 * The rules mirror the database constraints deliberately, and where they differ
 * the database is stricter: `gtin` is validated here for a useful message, but
 * the `gtin_is_valid` check and the column type are what actually guarantee a
 * GTIN is well-formed.
 */

/**
 * A URL slug: lowercase words joined by single hyphens.
 *
 * Uppercase and underscores are rejected rather than normalized, because two
 * different inputs silently becoming one slug is how a product ends up at a URL
 * nobody typed. The caller is told to fix it instead.
 */
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * A GTIN: 8, 12, 13 or 14 digits.
 *
 * The check-digit itself is verified by the database's `gtin_is_valid` function,
 * which is the authoritative test; this only rejects an obviously wrong shape
 * early.
 */
const gtinPattern = /^\d{8}$|^\d{12,14}$/;

export const productInputSchema = z.object({
  title: z.string().trim().min(2).max(200),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(slugPattern, "Use lowercase words separated by hyphens."),
  sku: z.string().trim().min(1).max(64),
  categoryId: z.string().uuid(),
  shortDescription: z.string().trim().min(10).max(400),
  description: z.string().trim().min(20).max(20_000),
  brand: z.string().trim().max(120).optional().or(z.literal("")),
  gtin: z
    .string()
    .trim()
    .regex(gtinPattern, "A GTIN is 8, 12, 13 or 14 digits.")
    .optional()
    .or(z.literal("")),
  // Whole francs. A price must be positive: a zero-priced published product is a
  // free offer, which is not what an empty form field should mean.
  priceMinor: z.coerce.number().int().min(1).max(1_000_000_000),
  stock: z.coerce.number().int().min(0).max(1_000_000),
  seoTitle: z.string().trim().max(200).optional().or(z.literal("")),
  seoDescription: z.string().trim().max(400).optional().or(z.literal("")),
});

export type ProductInput = z.infer<typeof productInputSchema>;

/**
 * Flatten a Zod error into a field-keyed map for the form.
 *
 * The form shows a message per field rather than one summary, so a user fixing a
 * long form is not sent hunting for which input was wrong.
 */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in result)) {
      result[key] = issue.message;
    }
  }
  return result;
}

/**
 * Build the content_translations rows a new product needs.
 *
 * The product is created in English — the source locale — and a French row is
 * created for every translatable field in the `pending` state. That is what makes
 * the missing translation visible and queued rather than merely absent: a
 * translator can find the work, and the sync worker knows what to push.
 *
 * `value` is empty for the French rows. Seeding them with the English text would
 * mark the French as done when it is not, and the page would then show English
 * text as though it were a translation.
 *
 * The row type is taken from the generated database types rather than restated,
 * so a column added to the table makes this fail to compile instead of silently
 * inserting a row with a defaulted column.
 */
export type TranslationRow =
  Database["public"]["Tables"]["content_translations"]["Insert"];

export function buildPendingTranslationRows(input: {
  productId: string;
  values: Record<string, string | null | undefined>;
}): TranslationRow[] {
  const rows: TranslationRow[] = [];

  for (const field of PRODUCT_TRANSLATABLE_FIELDS) {
    const source = input.values[field];
    if (source === undefined || source === null || source.trim().length === 0) {
      // A field with no source value has nothing to translate; a row for it would
      // be permanent noise in the translation queue.
      continue;
    }

    rows.push({
      entity_type: "product",
      entity_id: input.productId,
      field_name: field,
      locale: "en",
      value: source,
      state: "translated",
    });

    rows.push({
      entity_type: "product",
      entity_id: input.productId,
      field_name: field,
      locale: "fr",
      value: "",
      state: "pending",
    });
  }

  return rows;
}

/** The store's configured currency, used for a newly created product. */
export const DEFAULT_PRODUCT_CURRENCY = STORE_CURRENCY.code;
