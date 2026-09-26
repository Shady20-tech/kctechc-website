import "server-only";

import { z } from "zod";
import { STORE_CURRENCY } from "@/lib/config/site";

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

/** The store's configured currency, used for a newly created product. */
export const DEFAULT_PRODUCT_CURRENCY = STORE_CURRENCY.code;
