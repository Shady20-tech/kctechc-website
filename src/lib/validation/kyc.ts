import { z } from "zod";

import { emailSchema } from "./common";
import {
  KYC_ID_TYPES,
  KYC_MEMBERSHIP_TYPES,
  KYC_RESIDENCY_STATUSES,
} from "@/lib/real-estate/kyc";

/**
 * Input schemas for the KYC workflow.
 *
 * Validated server-side before any write, per the project's input rule. The enums
 * are `z.enum` over the mirrored constants so a value outside the vocabulary is
 * refused here as well as by the database type.
 *
 * The identity number is deliberately NOT a field. The brief forbids storing a
 * complete identification number, so the form collects only the last four
 * characters (for the reviewer to cross-check) and the reviewer reads the full
 * number from the document image, which is the only place it is needed.
 */

/** The personal-information half of a KYC application. */
export const kycApplicationSchema = z.object({
  membershipType: z.enum(KYC_MEMBERSHIP_TYPES),
  fullLegalName: z.string().trim().min(2, "tooShort").max(200, "tooLong"),
  email: emailSchema,
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+ ()./-]{5,32}$/, "invalidPhone"),
  countryOfResidence: z.string().trim().min(2, "tooShort").max(80, "tooLong"),
  currentLocation: z
    .string()
    .trim()
    .max(200, "tooLong")
    .optional()
    .transform((value) => value || ""),
  residencyStatus: z.enum(KYC_RESIDENCY_STATUSES),
  // A date in the past. The 18+ rule is a database CHECK and a client check; this
  // only rejects a malformed or future date.
  dateOfBirth: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "invalidDate")
    .refine((value) => {
      const date = new Date(value);
      return !Number.isNaN(date.getTime()) && date.getTime() <= Date.now();
    }, "invalidDate"),
  idType: z.enum(KYC_ID_TYPES),
  idIssuingCountry: z.string().trim().min(2, "tooShort").max(80, "tooLong"),
  // Optional, and only ever four characters. Empty is allowed; anything else must
  // be exactly four alphanumerics, matching `kyc_id_number_last4_format`. The
  // `.optional()` is what makes the documented contract true for any caller: the
  // form action happens to always send the key, but a caller that omits it must
  // get an empty string rather than a validation failure.
  idNumberLast4: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{4}$/, "invalidLast4")
    .or(z.literal(""))
    .optional()
    .transform((value) => value || ""),
});

export type KycApplicationInput = z.infer<typeof kycApplicationSchema>;

/** Maps a KYC field to its message key, so a new field cannot be added silently. */
export const KYC_ERROR_KEYS = {
  membershipType: "invalidType",
  fullLegalName: "errFullLegalName",
  email: "errEmail",
  phone: "errPhone",
  countryOfResidence: "errCountry",
  currentLocation: "errCurrentLocation",
  residencyStatus: "errResidencyStatus",
  dateOfBirth: "errDateOfBirth",
  idType: "errIdType",
  idIssuingCountry: "errIdIssuingCountry",
  idNumberLast4: "errIdNumberLast4",
  // The two submission consents. The action reports them through this map too, so
  // a missing consent renders a message rather than its raw key.
  videoConsent: "errVideoConsent",
  declaration: "errDeclaration",
  form: "errorBody",
} as const satisfies Record<string, string>;

export type KycFieldErrors = Partial<
  Record<keyof typeof KYC_ERROR_KEYS, string>
>;

/**
 * The consent and declaration a submission requires.
 *
 * Both are `z.literal(true)`: consent to face-video processing and a declaration
 * that the documents are the applicant's own are preconditions of submitting, so
 * a missing or unchecked value must fail validation rather than being treated as
 * an optional courtesy. A draft may omit them; the database CHECK enforces that a
 * *submitted* application carries both.
 */
export const kycConsentSchema = z.object({
  videoConsent: z.literal(true, { message: "videoConsentRequired" }),
  declaration: z.literal(true, { message: "declarationRequired" }),
});

export type KycConsentInput = z.infer<typeof kycConsentSchema>;

/** A document upload: which kind it is, plus optional metadata. */
export const kycDocumentMetaSchema = z.object({
  kind: z.enum([
    "id_front",
    "id_back",
    "face_video",
    "proof_of_address",
    "other",
  ]),
  issuingCountry: z
    .string()
    .trim()
    .max(80, "tooLong")
    .optional()
    .transform((value) => value || ""),
  note: z
    .string()
    .trim()
    .max(1000, "tooLong")
    .optional()
    .transform((value) => value || ""),
});

export type KycDocumentMetaInput = z.infer<typeof kycDocumentMetaSchema>;

/** A super admin's decision on a KYC application. */
export const kycDecisionSchema = z.object({
  decision: z.enum(["approve", "reject", "request_changes"]),
  // Required for a refusal or a request for changes (the applicant must be told
  // why), optional for an approval. The action enforces which combinations are
  // acceptable; this only bounds the length.
  reason: z
    .string()
    .trim()
    .max(2000, "tooLong")
    .optional()
    .transform((value) => value || ""),
});

export type KycDecisionInput = z.infer<typeof kycDecisionSchema>;

/** An internal reviewer note. Never shown to the applicant. */
export const kycNoteSchema = z.object({
  note: z.string().trim().min(1, "required").max(4000, "tooLong"),
});

export type KycNoteInput = z.infer<typeof kycNoteSchema>;
