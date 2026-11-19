
import { describe, expect, it } from "vitest";

import { KYC_DOCUMENT_KINDS, KYC_ID_TYPES, KYC_RESIDENCY_STATUSES } from "@/lib/real-estate/kyc";
import {
  KYC_ERROR_KEYS,
  kycApplicationSchema,
  kycConsentSchema,
  kycDecisionSchema,
  kycDocumentMetaSchema,
  kycNoteSchema,
} from "./kyc";

/**
 * The KYC input schemas are the first gate on identity evidence, and two of their
 * rules are load-bearing rather than cosmetic:
 *
 *  * the identity number is deliberately absent — only the last four characters
 *    are collected, because storing a complete identification number is forbidden;
 *  * a submission must carry both consents, so a missing one fails validation
 *    instead of being treated as an optional courtesy.
 *
 * A field-error key that no dictionary defines renders as its raw key in the
 * applicant's form, so the key map is asserted against the schema's own field set.
 */

const validApplication = {
  membershipType: "landlord" as const,
  fullLegalName: "Ngwa Emmanuel",
  email: "applicant@example.com",
  phone: "+237 679-202-265",
  countryOfResidence: "Cameroon",
  currentLocation: "Limbe",
  residencyStatus: "permanent" as const,
  dateOfBirth: "1990-05-14",
  idType: "national_id_card" as const,
  idIssuingCountry: "Cameroon",
  idNumberLast4: "4821",
};

describe("kycApplicationSchema", () => {
  it("accepts a complete application", () => {
    const result = kycApplicationSchema.safeParse(validApplication);
    expect(result.success).toBe(true);
  });

  it("does not collect a full identity number", () => {
    // The brief forbids storing a complete identification number; only the last
    // four characters exist, and the reviewer reads the rest from the document.
    const shape = Object.keys(kycApplicationSchema.shape);
    expect(shape).not.toContain("idNumber");
    expect(shape).toContain("idNumberLast4");
  });

  it("accepts an omitted or empty last-four", () => {
    // The field is documented as optional, so a caller that omits it must get an
    // empty string rather than a validation failure. The form action happens to
    // always send the key; this asserts the contract independent of that.
    expect(
      kycApplicationSchema.safeParse({ ...validApplication, idNumberLast4: "" }).success,
    ).toBe(true);
    const { idNumberLast4: _omit, ...without } = validApplication;
    const result = kycApplicationSchema.safeParse(without);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.idNumberLast4).toBe("");
  });

  it("refuses a last-four that is not exactly four alphanumerics", () => {
    for (const bad of ["123", "12345", "12a", "abcd!", " 123"]) {
      const result = kycApplicationSchema.safeParse({
        ...validApplication,
        idNumberLast4: bad,
      });
      expect(result.success, `expected ${JSON.stringify(bad)} to be refused`).toBe(false);
    }
  });

  it("refuses a membership type outside the vocabulary", () => {
    const result = kycApplicationSchema.safeParse({
      ...validApplication,
      membershipType: "super_admin",
    });
    expect(result.success).toBe(false);
  });

  it("refuses a residency status outside the vocabulary", () => {
    for (const status of KYC_RESIDENCY_STATUSES) {
      expect(
        kycApplicationSchema.safeParse({ ...validApplication, residencyStatus: status }).success,
      ).toBe(true);
    }
    expect(
      kycApplicationSchema.safeParse({ ...validApplication, residencyStatus: "tourist" }).success,
    ).toBe(false);
  });

  it("refuses an id type outside the vocabulary", () => {
    for (const idType of KYC_ID_TYPES) {
      expect(
        kycApplicationSchema.safeParse({ ...validApplication, idType }).success,
      ).toBe(true);
    }
    expect(
      kycApplicationSchema.safeParse({ ...validApplication, idType: "library_card" }).success,
    ).toBe(false);
  });

  it("refuses a malformed or future date of birth", () => {
    for (const bad of ["14/05/1990", "1990-5-4", "not-a-date"]) {
      expect(
        kycApplicationSchema.safeParse({ ...validApplication, dateOfBirth: bad }).success,
      ).toBe(false);
    }
    const future = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    expect(
      kycApplicationSchema.safeParse({ ...validApplication, dateOfBirth: future }).success,
    ).toBe(false);
  });

  it("refuses an invalid email or a too-short name", () => {
    expect(
      kycApplicationSchema.safeParse({ ...validApplication, email: "nope" }).success,
    ).toBe(false);
    expect(
      kycApplicationSchema.safeParse({ ...validApplication, fullLegalName: "N" }).success,
    ).toBe(false);
  });

  it("normalizes an omitted current location to an empty string", () => {
    const { currentLocation: _omit, ...without } = validApplication;
    const result = kycApplicationSchema.safeParse(without);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.currentLocation).toBe("");
  });
});

describe("kycConsentSchema", () => {
  it("requires both consents for a submission", () => {
    expect(kycConsentSchema.safeParse({ videoConsent: true, declaration: true }).success).toBe(true);
  });

  it("refuses a missing consent rather than treating it as optional", () => {
    // Consent to face-video processing and a declaration of ownership are
    // preconditions of submitting, not courtesies.
    expect(kycConsentSchema.safeParse({ videoConsent: true }).success).toBe(false);
    expect(kycConsentSchema.safeParse({ declaration: true }).success).toBe(false);
    expect(kycConsentSchema.safeParse({ videoConsent: false, declaration: true }).success).toBe(false);
    expect(kycConsentSchema.safeParse({}).success).toBe(false);
  });
});

describe("kycDocumentMetaSchema", () => {
  it("accepts every document kind the database stores", () => {
    for (const kind of KYC_DOCUMENT_KINDS) {
      expect(kycDocumentMetaSchema.safeParse({ kind }).success).toBe(true);
    }
  });

  it("refuses a document kind outside the vocabulary", () => {
    expect(kycDocumentMetaSchema.safeParse({ kind: "selfie" }).success).toBe(false);
    expect(kycDocumentMetaSchema.safeParse({}).success).toBe(false);
  });

  it("normalizes absent optional metadata to empty strings", () => {
    const result = kycDocumentMetaSchema.safeParse({ kind: "id_front" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.issuingCountry).toBe("");
      expect(result.data.note).toBe("");
    }
  });
});

describe("kycDecisionSchema", () => {
  it("accepts the three reviewer decisions", () => {
    for (const decision of ["approve", "reject", "request_changes"]) {
      expect(kycDecisionSchema.safeParse({ decision }).success).toBe(true);
    }
  });

  it("refuses an unknown decision", () => {
    expect(kycDecisionSchema.safeParse({ decision: "escalate" }).success).toBe(false);
  });

  it("normalizes an absent reason to an empty string", () => {
    const result = kycDecisionSchema.safeParse({ decision: "approve" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.reason).toBe("");
  });
});

describe("kycNoteSchema", () => {
  it("requires a non-empty note", () => {
    expect(kycNoteSchema.safeParse({ note: "Looks good" }).success).toBe(true);
    expect(kycNoteSchema.safeParse({ note: "" }).success).toBe(false);
    expect(kycNoteSchema.safeParse({ note: "   " }).success).toBe(false);
  });
});

describe("KYC_ERROR_KEYS", () => {
  it("names a message key for every application field", () => {
    // A field with no key renders its raw key in the form, which is silent until
    // an applicant sees it. Every schema field must be present.
    for (const field of Object.keys(kycApplicationSchema.shape)) {
      expect(KYC_ERROR_KEYS).toHaveProperty(field);
    }
  });

  it("covers the two consents and the form-level fallback", () => {
    expect(KYC_ERROR_KEYS).toHaveProperty("videoConsent");
    expect(KYC_ERROR_KEYS).toHaveProperty("declaration");
    expect(KYC_ERROR_KEYS).toHaveProperty("form");
  });

  it("maps every field to a non-empty key", () => {
    for (const [field, key] of Object.entries(KYC_ERROR_KEYS)) {
      expect(key, `${field} has an empty message key`).toBeTruthy();
    }
  });
});
