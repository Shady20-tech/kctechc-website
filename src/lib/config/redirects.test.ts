import { describe, expect, it } from "vitest";
import { INSIGHTS_PATH, LEGACY_REDIRECTS } from "@/lib/config/redirects";
import { LOCALES } from "@/lib/i18n/locales";

describe("LEGACY_REDIRECTS", () => {
  const sources = LEGACY_REDIRECTS.map((redirect) => redirect.from);

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

  it("keeps each source unique so no redirect shadows another", () => {
    expect(new Set(sources).size).toBe(sources.length);
  });

  it("never redirects a path onto itself", () => {
    for (const { from, to } of LEGACY_REDIRECTS) {
      expect(from).not.toBe(to);
    }
  });

  it("targets the canonical insights path rather than the legacy one", () => {
    for (const { to } of LEGACY_REDIRECTS) {
      expect(to).toContain(INSIGHTS_PATH);
      expect(to).not.toContain("/blog");
    }
  });
});
