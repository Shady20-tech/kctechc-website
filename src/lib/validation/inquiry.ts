import { z } from "zod";
import { DEPARTMENTS } from "@/lib/config/site";
import { emailSchema, localeSchema } from "./common";

/**
 * Inquiry submission schema.
 *
 * Validated on the server before any write, per the project's input rule. The
 * client may reuse this schema for instant feedback, but the server result is
 * authoritative.
 */

const departmentSlugs = DEPARTMENTS.map((department) => department.slug) as [
  string,
  ...string[],
];

/** Optional phone: empty string from a form means "not provided". */
const optionalPhone = z
  .string()
  .trim()
  .max(40)
  .refine(
    (value) => value === "" || /^[+()\d\s.-]{6,40}$/.test(value),
    "invalidPhone",
  )
  .optional();

export const inquirySchema = z.object({
  fullName: z.string().trim().min(1, "required").max(200, "tooLong"),
  email: emailSchema,
  phone: optionalPhone,
  /** A department slug, or empty for a general corporate inquiry. */
  department: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || departmentSlugs.includes(value),
      "invalidDepartment",
    ),
  subject: z.string().trim().min(1, "required").max(200, "tooLong"),
  message: z.string().trim().min(10, "tooShort").max(5000, "tooLong"),
  consent: z.literal(true, { error: "consentRequired" }),
  locale: localeSchema,
  /** Honeypot: must stay empty. Bots fill it in. */
  companyWebsite: z.string().max(0, "spamDetected").optional(),
});

export type InquiryInput = z.infer<typeof inquirySchema>;

export type InquiryFieldErrors = Partial<
  Record<
    | "fullName"
    | "email"
    | "phone"
    | "department"
    | "subject"
    | "message"
    | "consent",
    string
  >
>;

export type InquiryState =
  | { status: "idle" }
  | { status: "success"; reference: string }
  | { status: "invalid"; errors: InquiryFieldErrors }
  | { status: "rate_limited" }
  | { status: "unconfigured" }
  | { status: "error" };

/**
 * Flatten Zod issues into one message key per field, so the form can show the
 * first problem per field without repeating itself.
 */
export function toFieldErrors(
  issues: readonly { path: PropertyKey[]; message: string }[],
): InquiryFieldErrors {
  const errors: InquiryFieldErrors = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (typeof field !== "string") continue;
    const key = field as keyof InquiryFieldErrors;
    if (key in errors) continue;
    errors[key] = issue.message;
  }
  return errors;
}
