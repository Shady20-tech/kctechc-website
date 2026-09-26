import { describe, expect, it } from "vitest";
import { quoteRequestSchema, toQuoteFieldErrors } from "@/lib/validation/quote";

/**
 * These exercise the real schema the server action runs, not a stand-in. The
 * enum fields matter most: the database columns are Postgres enums, so a value
 * that is merely "a string" would be accepted by a loose validator and then fail
 * at insert time. The assertions below pin the parsed value to an actual member.
 */

const TODAY = "2026-06-15";

const validSubmission = {
  fullName: "Ada Nkemayang",
  email: "ada@example.com",
  phone: "+237 6 77 12 34 56",
  location: "Buea, Molyko",
  region: "southwest",
  service: "electrical-installation",
  propertyType: "residential",
  contactMethod: "whatsapp",
  contactDetails: "+237 6 77 12 34 56",
  description: "I need a full rewire of a three-bedroom house before July.",
  appointmentRequested: true,
  appointmentDate: "2026-06-20",
  appointmentWindow: "morning",
  appointmentNotes: "Weekday mornings are best.",
  consent: true,
  locale: "en",
  companyWebsite: "",
} as const;

function parse(overrides: Record<string, unknown> = {}) {
  return quoteRequestSchema(TODAY).safeParse({
    ...validSubmission,
    ...overrides,
  });
}

describe("quoteRequestSchema", () => {
  it("accepts a complete submission", () => {
    const result = parse();
    expect(result.success).toBe(true);
    if (result.success) {
      // The parsed value is the enum member itself, not a widened string, which
      // is what lets the action store it without a cast.
      expect(result.data.propertyType).toBe("residential");
      expect(result.data.contactMethod).toBe("whatsapp");
      expect(result.data.appointmentWindow).toBe("morning");
    }
  });

  it.each(["residential", "commercial", "industrial"] as const)(
    "accepts property type %s",
    (propertyType) => {
      const result = parse({ propertyType });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.propertyType).toBe(propertyType);
    },
  );

  it.each(["email", "phone", "whatsapp"] as const)(
    "accepts contact method %s",
    (contactMethod) => {
      const result = parse({ contactMethod });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.contactMethod).toBe(contactMethod);
    },
  );

  it("rejects an unknown property type", () => {
    const result = parse({ propertyType: "agricultural" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(toQuoteFieldErrors(result.error.issues).propertyType).toBe(
        "invalidPropertyType",
      );
    }
  });

  it("rejects an unknown contact method", () => {
    const result = parse({ contactMethod: "carrier-pigeon" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(toQuoteFieldErrors(result.error.issues).contactMethod).toBe(
        "invalidContactMethod",
      );
    }
  });

  it("rejects an empty property type", () => {
    const result = parse({ propertyType: "" });
    expect(result.success).toBe(false);
  });

  it("turns an empty appointment window into undefined", () => {
    const result = parse({ appointmentWindow: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.appointmentWindow).toBeUndefined();
  });

  it("leaves the appointment window undefined when it is omitted", () => {
    const { appointmentWindow: _omitted, ...rest } = validSubmission;
    const result = quoteRequestSchema(TODAY).safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.appointmentWindow).toBeUndefined();
  });

  it("rejects an unknown appointment window", () => {
    const result = parse({ appointmentWindow: "midnight" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(toQuoteFieldErrors(result.error.issues).appointmentWindow).toBe(
        "invalidAppointmentWindow",
      );
    }
  });

  it("rejects a region that is not one of the ten", () => {
    const result = parse({ region: "atlantis" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(toQuoteFieldErrors(result.error.issues).region).toBe(
        "invalidRegion",
      );
    }
  });

  it("accepts an empty region as not-yet-known", () => {
    const result = parse({ region: "" });
    expect(result.success).toBe(true);
  });

  it("requires consent to be explicitly true", () => {
    const result = parse({ consent: false });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(toQuoteFieldErrors(result.error.issues).consent).toBe(
        "consentRequired",
      );
    }
  });

  it("rejects a date in the past", () => {
    const result = parse({ appointmentDate: "2026-06-01" });
    expect(result.success).toBe(false);
  });

  it("rejects a filled honeypot field", () => {
    const result = parse({ companyWebsite: "http://spam.example" });
    expect(result.success).toBe(false);
  });

  it("rejects a description that is too short to act on", () => {
    const result = parse({ description: "help" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(toQuoteFieldErrors(result.error.issues).description).toBe(
        "tooShort",
      );
    }
  });
});
