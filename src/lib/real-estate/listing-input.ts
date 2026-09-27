import { z } from "zod";

import {
  LISTING_PROPERTY_KINDS,
  LISTING_TYPES,
  PRICE_PERIODS,
  PRICE_PERIODS_BY_LISTING_TYPE,
  PROPERTY_TYPES,
} from "./enums";

/**
 * Listing input validation for the admin form.
 *
 * The single schema the form and the Server Action both use, so a value that
 * passes in the browser cannot be rejected by the action for a different reason.
 *
 * The rules mirror the database constraints deliberately, and where they differ
 * the database is stricter. Two of them are worth stating because they are the
 * ones a form is tempted to soften:
 *
 *   - `price` and `priceOnRequest` are contradictory, matching
 *     `property_listings_price_consistency`. A form that allows both would make
 *     the card's price depend on which field a renderer happened to check.
 *   - `pricePeriod` must suit the `listingType`, matching
 *     `property_listings_period_matches_type`. A nightly rate on a freehold sale
 *     is a data-entry error, not a legitimate offering.
 */

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * A whole-franc price.
 *
 * Accepts a thousands separator because the field is filled from a spreadsheet as
 * often as it is typed, and "25,000,000" should not be rejected as non-numeric.
 */
const priceCell = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s\u00a0,]/g, ""))
  .refine((value) => value === "" || /^\d+$/.test(value), {
    message: "Enter a whole number of francs.",
  });

const optionalInteger = (min: number, max: number) =>
  z
    .string()
    .trim()
    .refine((value) => value === "" || /^\d+$/.test(value), {
      message: "Enter a whole number.",
    })
    .refine(
      (value) => value === "" || (Number(value) >= min && Number(value) <= max),
      { message: `Must be between ${min} and ${max}.` },
    );

export const listingInputSchema = z
  .object({
    title: z.string().trim().min(4, "Enter at least 4 characters.").max(200),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(160)
      .regex(slugPattern, "Use lowercase words separated by hyphens."),
    description: z
      .string()
      .trim()
      .min(20, "Enter at least 20 characters.")
      .max(20_000),

    listingType: z.enum(LISTING_TYPES),
    propertyKind: z.enum(LISTING_PROPERTY_KINDS),
    propertyType: z.enum(PROPERTY_TYPES),

    regionId: z.string().uuid("Choose a region."),
    divisionId: z.string().uuid().optional().or(z.literal("")),
    subdivisionId: z.string().uuid().optional().or(z.literal("")),
    locality: z.string().trim().max(160).optional().or(z.literal("")),

    // Newline-separated in the form; split apart by the action. A textarea is the
    // right control for a short list, and requiring the operator to learn a
    // separator for one field is friction without benefit.
    highlights: z.string().trim().max(4000).optional().or(z.literal("")),
    amenities: z.string().trim().max(2000).optional().or(z.literal("")),

    price: priceCell,
    pricePeriod: z.enum(PRICE_PERIODS),
    priceOnRequest: z
      .union([z.literal("on"), z.literal("")])
      .optional()
      .transform((value) => value === "on"),

    landAreaSqm: optionalInteger(1, 10_000_000),
    buildingAreaSqm: optionalInteger(1, 1_000_000),
    bedrooms: optionalInteger(0, 50),
    bathrooms: optionalInteger(0, 50),
    yearBuilt: optionalInteger(1800, 2100),

    // Coordinates, entered only by an administrator or the owning agent. Both or
    // neither: one coordinate without the other is unusable.
    longitude: z.string().trim().optional().or(z.literal("")),
    latitude: z.string().trim().optional().or(z.literal("")),
    exactAddress: z.string().trim().max(300).optional().or(z.literal("")),
    ownerName: z.string().trim().max(200).optional().or(z.literal("")),
    ownerPhone: z.string().trim().max(40).optional().or(z.literal("")),
    ownerEmail: z.string().trim().max(254).optional().or(z.literal("")),
    internalNotes: z.string().trim().max(4000).optional().or(z.literal("")),
  })
  .superRefine((value, ctx) => {
    // A price and "on request" cannot both be stated.
    if (value.priceOnRequest && value.price !== "") {
      ctx.addIssue({
        code: "custom",
        path: ["price"],
        message: "Leave the price blank when it is on request.",
      });
    }

    if (!value.priceOnRequest && value.price === "") {
      ctx.addIssue({
        code: "custom",
        path: ["price"],
        message: "Enter a price, or mark it as on request.",
      });
    }

    // The period must suit the listing type.
    if (
      !PRICE_PERIODS_BY_LISTING_TYPE[value.listingType].includes(
        value.pricePeriod,
      )
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["pricePeriod"],
        message: `A "${value.listingType}" listing cannot use the "${value.pricePeriod}" period.`,
      });
    }

    // A subdivision requires its division, matching the import validator and the
    // composite foreign key.
    if (value.subdivisionId && value.subdivisionId !== "" && !value.divisionId) {
      ctx.addIssue({
        code: "custom",
        path: ["divisionId"],
        message: "Choose a division before choosing a subdivision.",
      });
    }

    // Coordinates: both or neither.
    const hasLongitude = value.longitude !== "" && value.longitude !== undefined;
    const hasLatitude = value.latitude !== "" && value.latitude !== undefined;
    if (hasLongitude !== hasLatitude) {
      ctx.addIssue({
        code: "custom",
        path: [hasLongitude ? "latitude" : "longitude"],
        message: "Enter both coordinates, or neither.",
      });
    }

    for (const [field, raw] of [
      ["longitude", value.longitude],
      ["latitude", value.latitude],
    ] as const) {
      if (raw === "" || raw === undefined) continue;
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) {
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: "Enter a decimal number.",
        });
      } else if (field === "longitude" && (parsed < 8.0 || parsed > 17.0)) {
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: "Longitude must be between 8.0 and 17.0 for Cameroon.",
        });
      } else if (field === "latitude" && (parsed < 1.0 || parsed > 13.5)) {
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: "Latitude must be between 1.0 and 13.5 for Cameroon.",
        });
      }
    }
  });

export type ListingInput = z.infer<typeof listingInputSchema>;

/**
 * Split a textarea into list entries.
 *
 * One entry per line, with blank lines dropped. Newline rather than a comma so a
 * highlight can contain a comma without being split — "sea view, west facing" is
 * one highlight.
 */
export function splitListInput(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
}
