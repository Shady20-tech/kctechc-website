import { z } from "zod";

import { emailSchema, localeSchema } from "./common";

/**
 * Property inquiry schema.
 *
 * A separate schema from the general contact inquiry, not a variation of it. A
 * property enquiry is always tied to a listing and is always addressed to that
 * listing's agent, so the listing reference is required rather than optional —
 * which is what lets the pipeline route it and record the listing event.
 *
 * The message minimum is lower than the contact form's. A property enquiry is
 * often a single line ("is this still available?"), and a length floor that
 * rejects it would push the reader to pad the message or abandon it.
 */

const optionalPhone = z
  .string()
  .trim()
  .max(40)
  .refine(
    (value) => value === "" || /^[+()\d\s.-]{6,40}$/.test(value),
    "invalidPhone",
  )
  .optional();

export const listingInquirySchema = z.object({
  listingId: z.uuid(),
  fullName: z.string().trim().min(1, "required").max(200, "tooLong"),
  email: emailSchema,
  phone: optionalPhone,
  message: z.string().trim().min(10, "tooShort").max(5000, "tooLong"),
  /** Some enquiries are a request to view, not only a question. */
  viewingRequest: z.boolean().default(false),
  locale: localeSchema,
  consent: z.literal(true, { error: "consentRequired" }),
  /** Honeypot: must stay empty. Bots fill it in. */
  companyWebsite: z.string().max(0, "spamDetected").optional(),
  verificationToken: z.string().max(4096).optional(),
});

export type ListingInquiryInput = z.infer<typeof listingInquirySchema>;

export type ListingInquiryFieldErrors = Partial<
  Record<"fullName" | "email" | "phone" | "message" | "consent", string>
>;

export type ListingInquiryState =
  | { status: "idle" }
  | { status: "success"; reference: string }
  | { status: "invalid"; errors: ListingInquiryFieldErrors }
  | { status: "rate_limited" }
  | { status: "verification_failed" }
  | { status: "unconfigured" }
  | { status: "error" };

export function toListingInquiryFieldErrors(
  issues: readonly { path: PropertyKey[]; message: string }[],
): ListingInquiryFieldErrors {
  const errors: ListingInquiryFieldErrors = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (typeof field !== "string") continue;
    const key = field as keyof ListingInquiryFieldErrors;
    if (key in errors) continue;
    errors[key] = issue.message;
  }
  return errors;
}
