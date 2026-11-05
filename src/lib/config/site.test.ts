import { describe, expect, it } from "vitest";

import { BRAND_COLORS, DEPARTMENTS, SITE } from "@/lib/config/site";

/**
 * Corporate facts.
 *
 * `SITE` is described in its own header as "authoritative corporate facts ...
 * supplied by the business brief; nothing in this file may be invented". The
 * footer and contact page render it directly, so a typo here is a public claim
 * about how to reach the company. `info@kctectc.com` did ship as a transposed
 * domain and rendered verbatim, which is the failure this file exists to catch:
 * every address must share one domain, and the primary inbox must remain the
 * first entry of `emails` (the contract `site-content.ts` documents).
 */

const BRIEF = {
  legalName: "KC Technology Corporation",
  email: "kctechc@gmail.com",
  phones: ["+237 679-202-265", "656-218-651"],
  address: {
    street: "Half-Mile",
    city: "Limbe",
    region: "Southwest Region",
    country: "Cameroon",
  },
} as const;

describe("SITE corporate facts", () => {
  it("keeps the legal name, phone numbers and address the brief supplies", () => {
    expect(SITE.legalName).toBe(BRIEF.legalName);
    expect(SITE.phones).toEqual(BRIEF.phones);
    expect(SITE.address).toMatchObject(BRIEF.address);
  });

  it("keeps SITE.email equal to the first public address", () => {
    expect(SITE.email).toBe(BRIEF.email);
    expect(SITE.emails[0]).toBe(SITE.email);
  });

  it("publishes only addresses on the company's own domain", () => {
    expect(SITE.emails).toEqual([
      "kctechc@gmail.com",
      "info@kctechc.com",
      "support@kctechc.com",
    ]);
    for (const email of SITE.emails) {
      expect(email).toMatch(/^[^@]+@(kctechc\.com|gmail\.com)$/);
    }
  });

  it("never repeats an address", () => {
    expect(new Set(SITE.emails).size).toBe(SITE.emails.length);
  });
});

describe("department accents", () => {
  it("gives each department a distinct, well-formed hex colour", () => {
    const accents = DEPARTMENTS.map((department) => department.accent);
    expect(new Set(accents).size).toBe(accents.length);
    for (const accent of accents) {
      expect(accent).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("keeps the sampled brand colours in hex form", () => {
    for (const value of Object.values(BRAND_COLORS)) {
      expect(value).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
