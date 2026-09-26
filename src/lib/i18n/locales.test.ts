import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  LOCALE_SEO_TAGS,
  isLocale,
  resolveLocaleFromAcceptLanguage,
} from "@/lib/i18n/locales";

describe("isLocale", () => {
  it("accepts supported locales", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fr")).toBe(true);
  });

  it("rejects unsupported or malformed values", () => {
    for (const value of ["de", "EN", "", "english", "fr-CM"]) {
      expect(isLocale(value)).toBe(false);
    }
  });
});

describe("resolveLocaleFromAcceptLanguage", () => {
  it("returns null when the header is absent", () => {
    expect(resolveLocaleFromAcceptLanguage(null)).toBeNull();
  });

  it("maps a region-tagged preference to its base locale", () => {
    expect(resolveLocaleFromAcceptLanguage("fr-CM,fr;q=0.9")).toBe("fr");
    expect(resolveLocaleFromAcceptLanguage("en-US,en;q=0.9")).toBe("en");
  });

  it("honours quality values rather than header order", () => {
    // French is listed second but has the higher quality value.
    expect(resolveLocaleFromAcceptLanguage("en;q=0.3,fr;q=0.9")).toBe("fr");
  });

  it("ignores unsupported languages and falls through to a supported one", () => {
    expect(resolveLocaleFromAcceptLanguage("de;q=0.9,fr;q=0.5")).toBe("fr");
  });

  it("returns null when no supported language is present", () => {
    expect(resolveLocaleFromAcceptLanguage("de-DE,de;q=0.9")).toBeNull();
  });

  it("drops entries explicitly refused with q=0", () => {
    expect(resolveLocaleFromAcceptLanguage("fr;q=0,de;q=0.8")).toBeNull();
  });

  it("falls back to the default locale constant being valid", () => {
    expect(isLocale(DEFAULT_LOCALE)).toBe(true);
  });
});

describe("locale SEO tags", () => {
  it("annotates locales with Cameroon region codes", () => {
    expect(LOCALE_SEO_TAGS.en).toBe("en-CM");
    expect(LOCALE_SEO_TAGS.fr).toBe("fr-CM");
  });
});
