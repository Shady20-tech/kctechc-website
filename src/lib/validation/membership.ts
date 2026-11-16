import { z } from "zod";

import { MEMBERSHIP_TYPES } from "@/lib/real-estate/memberships";

/**
 * Input schemas for the account capability model.
 *
 * Validated server-side before any write, per the project's input rule. The
 * capability type is an enum rather than a free string so a value outside the
 * vocabulary is refused here as well as by the database type, and the KYC
 * reference is length-bounded so a caller cannot store an unbounded blob in a
 * column the admin review queue reads.
 */

export const membershipApplicationSchema = z.object({
  membershipType: z.enum(MEMBERSHIP_TYPES),
  /** The KYC provider reference, if the applicant has one. Optional. */
  kycReference: z
    .string()
    .trim()
    .max(200, "tooLong")
    .optional()
    .transform((value) => value || ""),
  /** Anything the applicant wants the reviewer to know. */
  notes: z
    .string()
    .trim()
    .max(2000, "tooLong")
    .optional()
    .transform((value) => value || ""),
});

export type MembershipApplicationInput = z.infer<
  typeof membershipApplicationSchema
>;

/**
 * The residency and contact fields a customer maintains on their own profile.
 *
 * Country is free text with a length bound, the ISO code is the two-letter form
 * or blank, and the region is a UUID or blank. The region/country relationship is
 * NOT re-checked here: it is a database constraint
 * (`profiles_region_requires_cameroon`), and duplicating it in the schema would be
 * a second copy of the rule that can disagree with the first. The form narrows the
 * options so the constraint is rarely reached, and the constraint is what enforces
 * it.
 */
export const profileResidencySchema = z.object({
  fullName: z.string().trim().min(1, "required").max(200, "tooLong"),
  phone: z
    .string()
    .trim()
    .max(32, "tooLong")
    .regex(/^[0-9+ ()./-]{5,32}$/, "invalidPhone")
    .or(z.literal("")),
  countryOfResidence: z.string().trim().min(2, "tooShort").max(80, "tooLong"),
  countryIsoCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "invalidCountryCode")
    .or(z.literal("")),
  city: z.string().trim().max(120, "tooLong").or(z.literal("")),
  regionId: z.uuid().or(z.literal("")),
  permanentResidency: z.boolean(),
});

export type ProfileResidencyInput = z.infer<typeof profileResidencySchema>;
