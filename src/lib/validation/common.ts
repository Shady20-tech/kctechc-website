import { z } from "zod";
import { LOCALES } from "@/lib/i18n/locales";

/**
 * Reusable primitives. Every write path validates with these before touching
 * the database, per the project's input-validation rule.
 */

export const localeSchema = z.enum(LOCALES);

export const uuidSchema = z.uuid();

/** URL-safe slug used by departments and localized content routes. */
export const slugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "invalidSlug");

export const emailSchema = z.email().max(254);

/**
 * Rejects absolute and protocol-relative URLs so a `next` parameter can never
 * turn a sign-in redirect into an open redirector.
 */
export const safeRedirectPathSchema = z
  .string()
  .startsWith("/")
  .refine((value) => !value.startsWith("//"), "open redirect")
  .refine((value) => !value.includes("\\"), "open redirect");

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(24),
});
