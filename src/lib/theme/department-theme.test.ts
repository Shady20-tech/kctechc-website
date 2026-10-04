import { describe, expect, it } from "vitest";
import { DEPARTMENT_SLUGS } from "@/lib/config/site";
import { THEME_ATTRIBUTE, themeSlugFromPathname } from "./department-theme";

/**
 * Theme resolution contract.
 *
 * The active theme is derived from the path, and three consumers depend on this
 * one function agreeing: the pre-paint bootstrap, the client controller and the
 * pages' mobile `theme-color`. These cases pin the mapping and, more importantly,
 * the fallback: an unrecognised path must resolve to the corporate theme rather
 * than to a half-applied department palette.
 */
describe("themeSlugFromPathname", () => {
  it("resolves a bare department path", () => {
    expect(themeSlugFromPathname("/digital-marketing")).toBe(
      "digital-marketing",
    );
    expect(themeSlugFromPathname("/electrical-services")).toBe(
      "electrical-services",
    );
    expect(themeSlugFromPathname("/real-estate")).toBe("real-estate");
  });

  it("resolves a locale-prefixed department path", () => {
    expect(themeSlugFromPathname("/en/digital-marketing")).toBe(
      "digital-marketing",
    );
    expect(themeSlugFromPathname("/fr/real-estate")).toBe("real-estate");
  });

  it("resolves a nested department path", () => {
    expect(
      themeSlugFromPathname("/en/digital-marketing/store/cart"),
    ).toBe("digital-marketing");
    expect(
      themeSlugFromPathname("/fr/electrical-services/services/wiring"),
    ).toBe("electrical-services");
    expect(
      themeSlugFromPathname("/en/real-estate/listings/limbe-plot-1"),
    ).toBe("real-estate");
  });

  it("falls back to corporate for corporate and unknown paths", () => {
    for (const pathname of [
      "/",
      "/en",
      "/fr",
      "/en/about",
      "/en/contact",
      "/en/insights",
      "/en/services",
      "/en/gallery",
      "/admin",
      "/admin/store",
      "/en/digital",
      "/en/digital-marketing-extra",
      "/digitalmarketing",
    ]) {
      expect(themeSlugFromPathname(pathname), pathname).toBeNull();
    }
  });

  it("never resolves a department from a deeper segment alone", () => {
    // The department must be the first segment under the locale; a corporate
    // page that happens to contain a department word later must stay corporate.
    expect(themeSlugFromPathname("/en/about/real-estate")).toBeNull();
  });

  it("tolerates a trailing slash and a query-free pathname", () => {
    expect(themeSlugFromPathname("/en/real-estate/")).toBe("real-estate");
  });

  it("every department slug resolves through the attribute name", () => {
    for (const slug of DEPARTMENT_SLUGS) {
      expect(themeSlugFromPathname(`/en/${slug}`)).toBe(slug);
    }
    expect(THEME_ATTRIBUTE).toBe("data-theme");
  });
});
