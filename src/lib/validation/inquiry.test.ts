import { describe, expect, it } from "vitest";
import { inquirySchema, toFieldErrors } from "@/lib/validation/inquiry";

/**
 * These exercise the real schema the server action runs, not a stand-in, so a
 * regression in the validation rules fails here rather than silently reaching the
 * database.
 */

const validSubmission = {
  fullName: "Ada Nkemayang",
  email: "ada@example.com",
  phone: "+237 6 77 12 34 56",
  department: "real-estate",
  subject: "Viewing request",
  message: "I would like to arrange a viewing of the property this weekend.",
  consent: true,
  locale: "en",
  companyWebsite: "",
} as const;

describe("inquirySchema", () => {
  it("accepts a complete submission", () => {
    const result = inquirySchema.safeParse(validSubmission);
    expect(result.success).toBe(true);
  });

  it("treats an empty department as a general corporate inquiry", () => {
    const result = inquirySchema.safeParse({ ...validSubmission, department: "" });
    expect(result.success).toBe(true);
  });

  it("rejects a department slug that is not in the allowlist", () => {
    const result = inquirySchema.safeParse({
      ...validSubmission,
      department: "hr",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(toFieldErrors(result.error.issues).department).toBe(
        "invalidDepartment",
      );
    }
  });

  it("requires consent to be explicitly true", () => {
    const result = inquirySchema.safeParse({ ...validSubmission, consent: false });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(toFieldErrors(result.error.issues).consent).toBe("consentRequired");
    }
  });

  it("rejects a filled honeypot field", () => {
    const result = inquirySchema.safeParse({
      ...validSubmission,
      companyWebsite: "http://spam.example",
    });
    expect(result.success).toBe(false);
  });

  it("enforces the message minimum that the database constraint expects", () => {
    const result = inquirySchema.safeParse({
      ...validSubmission,
      message: "too short",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(toFieldErrors(result.error.issues).message).toBe("tooShort");
    }
  });

  it("rejects a message longer than the database column allows", () => {
    const result = inquirySchema.safeParse({
      ...validSubmission,
      message: "x".repeat(5001),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(toFieldErrors(result.error.issues).message).toBe("tooLong");
    }
  });

  it("rejects an invalid email address", () => {
    const result = inquirySchema.safeParse({
      ...validSubmission,
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("treats an empty phone as not provided", () => {
    const result = inquirySchema.safeParse({ ...validSubmission, phone: "" });
    expect(result.success).toBe(true);
  });

  it("rejects a phone that is not a plausible number", () => {
    const result = inquirySchema.safeParse({
      ...validSubmission,
      phone: "call me maybe",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(toFieldErrors(result.error.issues).phone).toBe("invalidPhone");
    }
  });

  it("rejects an unsupported locale", () => {
    const result = inquirySchema.safeParse({ ...validSubmission, locale: "de" });
    expect(result.success).toBe(false);
  });
});

describe("toFieldErrors", () => {
  it("keeps only the first error per field", () => {
    const errors = toFieldErrors([
      { path: ["fullName"], message: "required" },
      { path: ["fullName"], message: "tooLong" },
      { path: ["email"], message: "invalidEmail" },
    ]);
    expect(errors).toEqual({
      fullName: "required",
      email: "invalidEmail",
    });
  });

  it("ignores issues without a string field name", () => {
    expect(toFieldErrors([{ path: [0], message: "required" }])).toEqual({});
  });
});
