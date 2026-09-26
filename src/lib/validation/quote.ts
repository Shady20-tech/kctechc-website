import { z } from "zod";
import { isRegionSlug } from "@/lib/content/regions";
import { emailSchema, localeSchema } from "./common";

/**
 * Quote / site-visit request schema.
 *
 * Validated on the server before any write, per the project's input rule. The
 * client may reuse this schema for instant feedback, but the server result is
 * authoritative — the form is a convenience, not the control.
 *
 * The phase requires a specific set of fields, and each one is here:
 *   name · location · region/town · service needed ·
 *   property type (residential/commercial/industrial) · contact method ·
 *   preferred contact details · description · optional photo/file upload.
 *
 * Validation choices worth noting:
 *
 *   - `region` is validated against the ten seeded regions rather than as free
 *     text. The project filter and the CRM both group by region, and a free-text
 *     region would produce "SW", "South-West" and "Southwest" as three regions.
 *     The locality (town) is the free-text part, which is where that belongs.
 *
 *   - `propertyType` is validated against the enum. It is a required choice
 *     because a quote is scoped differently for a home, a business and a plant,
 *     and "unspecified" would push that question to a later phone call.
 *
 *   - `appointmentDate` is optional and validated as a real calendar date that is
 *     not in the past. A past date is a request the business cannot act on, so
 *     accepting it would create a lead that is already unworkable. The comparison
 *     is done in the schema's own `refine` against a caller-supplied "today" so
 *     the rule is testable without mocking the clock.
 *
 *   - Files are NOT validated here. Their content is checked by
 *     `validateUpload`, which inspects bytes — something a Zod schema cannot do.
 *     This schema validates the text fields only.
 */

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

/**
 * An ISO calendar date (YYYY-MM-DD) that is not in the past.
 *
 * `today` is injected rather than read from `Date.now()` inside the refine, so
 * the boundary is testable deterministically instead of depending on when the
 * suite happens to run.
 */
function appointmentDateSchema(today: string) {
  return z
    .string()
    .trim()
    .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), {
      message: "invalidDate",
    })
    .refine(
      (value) => {
        if (value === "") return true;
        // Reject a syntactically valid date that does not exist, e.g. 2026-02-31.
        const parsed = new Date(`${value}T00:00:00Z`);
        if (Number.isNaN(parsed.getTime())) return false;
        return parsed.toISOString().slice(0, 10) === value;
      },
      { message: "invalidDate" },
    )
    .refine((value) => value === "" || value >= today, {
      message: "dateInPast",
    })
    .optional();
}

export function quoteRequestSchema(today: string) {
  return z.object({
    fullName: z.string().trim().min(1, "required").max(200, "tooLong"),
    email: emailSchema,
    phone: optionalPhone,

    /** Town, area or landmark. The free-text half of the location. */
    location: z.string().trim().min(1, "invalidLocation").max(160, "tooLong"),

    /** One of the ten seeded regions. */
    region: z
      .string()
      .trim()
      .refine(
        (value) => value === "" || isRegionSlug(value),
        "invalidRegion",
      ),

    /** Service slug, or empty for "not sure yet". */
    service: z
      .string()
      .trim()
      .max(120)
      .refine(
        (value) => value === "" || /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value),
        "invalidService",
      )
      .optional(),

    /**
     * A required property type. Validated as the exact enum, so the parsed value
     * is one of the three the database accepts and the action needs no cast. An
     * empty value fails the required message rather than the enum message.
     */
    propertyType: z
      .string()
      .trim()
      .pipe(
        z.enum(["residential", "commercial", "industrial"], {
          error: "invalidPropertyType",
        }),
      ),

    /**
     * A required contact method, validated as the exact enum.
     */
    contactMethod: z
      .string()
      .trim()
      .pipe(
        z.enum(["email", "phone", "whatsapp"], {
          error: "invalidContactMethod",
        }),
      ),

    /** The address or number to use when it differs from email/phone. */
    contactDetails: z
      .string()
      .trim()
      .max(254, "tooLong")
      .optional(),

    description: z.string().trim().min(10, "tooShort").max(5000, "tooLong"),

    /** Site-visit request. Optional: not every quote needs a visit. */
    appointmentRequested: z.boolean(),
    appointmentDate: appointmentDateSchema(today),
    /**
     * The preferred time of day. Optional: an empty value becomes `undefined`
     * rather than the empty string, so the column receives either a real enum
     * member or nothing at all.
     */
    appointmentWindow: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value === "" ? undefined : value))
      .pipe(
        z
          .enum(["morning", "afternoon", "anytime"], {
            error: "invalidAppointmentWindow",
          })
          .optional(),
      ),
    appointmentNotes: z.string().trim().max(2000, "tooLong").optional(),

    consent: z.literal(true, { error: "consentRequired" }),
    locale: localeSchema,
    /** Honeypot: must stay empty. Bots fill it in. */
    companyWebsite: z.string().max(0, "spamDetected").optional(),
    /** Provider-issued bot-verification token, when a provider is configured. */
    verificationToken: z.string().max(4096).optional(),
  });
}

export type QuoteRequestInput = z.infer<
  ReturnType<typeof quoteRequestSchema>
>;

export type QuoteFieldErrors = Partial<
  Record<
    | "fullName"
    | "email"
    | "phone"
    | "location"
    | "region"
    | "service"
    | "propertyType"
    | "contactMethod"
    | "contactDetails"
    | "description"
    | "appointmentDate"
    | "appointmentWindow"
    | "appointmentNotes"
    | "consent"
    | "attachments",
    string
  >
>;

export type QuoteFormState =
  | { status: "idle" }
  | { status: "success"; reference: string; appointmentRequested: boolean }
  | { status: "invalid"; errors: QuoteFieldErrors }
  | { status: "rate_limited" }
  | { status: "verification_failed" }
  | { status: "unconfigured" }
  | { status: "error" };

/**
 * Flatten Zod issues into one message key per field.
 *
 * Only the first problem per field is kept, so the form shows one actionable
 * message rather than repeating itself.
 */
export function toQuoteFieldErrors(
  issues: readonly { path: PropertyKey[]; message: string }[],
): QuoteFieldErrors {
  const errors: QuoteFieldErrors = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (typeof field !== "string") continue;
    const key = field as keyof QuoteFieldErrors;
    if (key in errors) continue;
    errors[key] = issue.message;
  }
  return errors;
}

/** Today's date as an ISO calendar date, in UTC. */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
