import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import {
  acquisitionPurposeSchema,
  listingInquirySchema,
  toListingInquiryFieldErrors,
} from "@/lib/validation/listing-inquiry";

/**
 * These exercise the real schema the property-enquiry action runs, so a
 * regression in the acquisition-purpose handling fails here rather than reaching
 * the database.
 */

const LISTING_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";

/**
 * The schema's purpose values are a mirror of the database enum, so they are
 * asserted against the migration that defines it — the same guard
 * `real-estate/enums.test.ts` applies to its mirrors. Without it a value added to
 * one and not the other fails as a constraint violation at insert time rather
 * than as a test.
 */
function enumMembersFromMigration(typeName: string): string[] {
  const dir = join(process.cwd(), "supabase", "migrations");
  const sql = readdirSync(dir)
    .sort()
    .map((file) => readFileSync(join(dir, file), "utf8"))
    .join("\n")
    .replace(/--[^\n]*/g, "");
  const body = sql.match(
    new RegExp(
      `create type public\\.${typeName} as enum\\s*\\(([^)]*)\\)`,
      "i",
    ),
  )?.[1];
  return [...(body ?? "").matchAll(/'([^']+)'/g)].flatMap((match) =>
    match[1] ? [match[1]] : [],
  );
}

const validSubmission = {
  listingId: LISTING_ID,
  fullName: "Ada Nkemayang",
  email: "ada@example.com",
  phone: "+237 6 77 12 34 56",
  message: "I would like to arrange a viewing of the property this weekend.",
  acquisitionPurpose: "residence",
  viewingRequest: true,
  locale: "en",
  consent: true,
  companyWebsite: "",
} as const;

describe("listingInquirySchema", () => {
  it("accepts a complete submission", () => {
    const result = listingInquirySchema.safeParse(validSubmission);
    expect(result.success).toBe(true);
  });

  it("keeps the chosen acquisition purpose", () => {
    const result = listingInquirySchema.safeParse(validSubmission);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.acquisitionPurpose).toBe("residence");
    }
  });

  it("normalises an unstated purpose to undefined rather than a blank value", () => {
    const result = listingInquirySchema.safeParse({
      ...validSubmission,
      acquisitionPurpose: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.acquisitionPurpose).toBeUndefined();
    }
  });

  it("accepts a submission with no purpose field at all", () => {
    const { acquisitionPurpose: _ignored, ...withoutPurpose } = validSubmission;
    const result = listingInquirySchema.safeParse(withoutPurpose);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.acquisitionPurpose).toBeUndefined();
    }
  });

  it("rejects a purpose outside the closed set", () => {
    const result = listingInquirySchema.safeParse({
      ...validSubmission,
      acquisitionPurpose: "speculation",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        toListingInquiryFieldErrors(result.error.issues).acquisitionPurpose,
      ).toBeDefined();
    }
  });

  it("does not require a purpose, so an enquiry is never blocked on it", () => {
    const result = listingInquirySchema.safeParse({
      ...validSubmission,
      acquisitionPurpose: undefined,
      consent: true,
    });
    expect(result.success).toBe(true);
  });

  it("mirrors the acquisition_purpose enum the migration defines", () => {
    expect([...acquisitionPurposeSchema.options]).toEqual(
      enumMembersFromMigration("acquisition_purpose"),
    );
  });
});
