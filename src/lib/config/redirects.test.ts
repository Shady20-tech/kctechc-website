import { describe, expect, it } from "vitest";
import {
  INSIGHTS_PATH,
  LEGACY_REDIRECTS,
  PROPERTY_SEARCH_PATH,
} from "@/lib/config/redirects";
import { LOCALES } from "@/lib/i18n/locales";

describe("LEGACY_REDIRECTS", () => {
  const sources = LEGACY_REDIRECTS.map((redirect) => redirect.from);
  const insightsRedirects = LEGACY_REDIRECTS.filter(
    (redirect) => redirect.from.includes("/blog"),
  );
  const propertyRedirects = LEGACY_REDIRECTS.filter((redirect) =>
    redirect.from.includes("/real-estate/properties"),
  );

  it("redirects the bare legacy path to the canonical one", () => {
    expect(LEGACY_REDIRECTS).toContainEqual({
      from: "/blog",
      to: INSIGHTS_PATH,
    });
  });

  // Phase 2 linked to the section as `/${locale}/blog`, so the localized URLs
  // were live and may be indexed. Redirecting only the bare path left every one
  // of them returning 404 — this pins all of them.
  it("redirects every locale-prefixed legacy path", () => {
    for (const locale of LOCALES) {
      expect(sources).toContain(`/${locale}/blog`);
      expect(LEGACY_REDIRECTS).toContainEqual({
        from: `/${locale}/blog`,
        to: `/${locale}${INSIGHTS_PATH}`,
      });
    }
  });

  // The browse surface moved from `/real-estate/properties` to
  // `/real-estate/listings`. The detail route moved with it, so both the bare
  // and the locale-prefixed *subtree* have to redirect, not just the index.
  it("redirects the property browser's former path and its detail subtree", () => {
    expect(LEGACY_REDIRECTS).toContainEqual({
      from: "/real-estate/properties",
      to: PROPERTY_SEARCH_PATH,
    });
    expect(LEGACY_REDIRECTS).toContainEqual({
      from: "/real-estate/properties/:slug",
      to: `${PROPERTY_SEARCH_PATH}/:slug`,
    });

    for (const locale of LOCALES) {
      expect(LEGACY_REDIRECTS).toContainEqual({
        from: `/${locale}/real-estate/properties`,
        to: `/${locale}${PROPERTY_SEARCH_PATH}`,
      });
      expect(LEGACY_REDIRECTS).toContainEqual({
        from: `/${locale}/real-estate/properties/:slug`,
        to: `/${locale}${PROPERTY_SEARCH_PATH}/:slug`,
      });
    }
  });

  it("keeps each source unique so no redirect shadows another", () => {
    expect(new Set(sources).size).toBe(sources.length);
  });

  it("never redirects a path onto itself", () => {
    for (const { from, to } of LEGACY_REDIRECTS) {
      expect(from).not.toBe(to);
    }
  });

  it("targets the canonical insights path rather than the legacy one", () => {
    for (const { to } of insightsRedirects) {
      expect(to).toContain(INSIGHTS_PATH);
      expect(to).not.toContain("/blog");
    }
  });

  it("targets the canonical listings path rather than the legacy one", () => {
    for (const { to } of propertyRedirects) {
      expect(to).toContain(PROPERTY_SEARCH_PATH);
      expect(to).not.toContain("/real-estate/properties");
    }
  });
});
