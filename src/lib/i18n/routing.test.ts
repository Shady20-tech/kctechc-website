import { describe, expect, it } from "vitest";
import {
  buildLocaleAlternates,
  buildLocaleSwitchHref,
  filterSwitchableSearchParams,
  isNonLocalizedPath,
  stripLocaleFromPath,
  withLocale,
} from "@/lib/i18n/routing";

describe("isNonLocalizedPath", () => {
  it("treats admin, api and auth trees as non-localized", () => {
    for (const path of ["/admin", "/admin/login", "/api/health", "/auth/callback"]) {
      expect(isNonLocalizedPath(path)).toBe(true);
    }
  });

  it("treats public paths as localized", () => {
    for (const path of ["/", "/en", "/fr/real-estate", "/digital-marketing"]) {
      expect(isNonLocalizedPath(path)).toBe(false);
    }
  });

  it("does not match a path that merely starts with an admin-like prefix", () => {
    expect(isNonLocalizedPath("/administrators")).toBe(false);
  });
});

describe("stripLocaleFromPath", () => {
  it("separates a leading locale from the remaining path", () => {
    expect(stripLocaleFromPath("/fr/real-estate")).toEqual({
      locale: "fr",
      pathWithoutLocale: "/real-estate",
    });
  });

  it("treats a bare locale as the locale root", () => {
    expect(stripLocaleFromPath("/en")).toEqual({
      locale: "en",
      pathWithoutLocale: "/",
    });
  });

  it("reports no locale for an unprefixed path", () => {
    expect(stripLocaleFromPath("/real-estate")).toEqual({
      locale: null,
      pathWithoutLocale: "/real-estate",
    });
  });

  it("normalizes the empty path to the root", () => {
    expect(stripLocaleFromPath("")).toEqual({
      locale: null,
      pathWithoutLocale: "/",
    });
  });
});

describe("withLocale", () => {
  it("builds a locale-prefixed path", () => {
    expect(withLocale("fr", "/real-estate")).toBe("/fr/real-estate");
  });

  it("collapses the root without a trailing slash", () => {
    expect(withLocale("en", "/")).toBe("/en");
  });

  it("tolerates a missing leading slash", () => {
    expect(withLocale("en", "real-estate")).toBe("/en/real-estate");
  });
});

describe("filterSwitchableSearchParams", () => {
  it("keeps user-intent parameters", () => {
    const result = filterSwitchableSearchParams(
      new URLSearchParams("q=villa&page=2&sort=price"),
    );
    expect(result).toContain("q=villa");
    expect(result).toContain("page=2");
    expect(result).toContain("sort=price");
  });

  it("drops tracking parameters so they cannot create duplicate URLs", () => {
    const result = filterSwitchableSearchParams(
      new URLSearchParams("utm_source=news&gclid=abc&q=villa"),
    );
    expect(result).toBe("?q=villa");
  });

  it("returns an empty string when nothing is preserved", () => {
    expect(filterSwitchableSearchParams(new URLSearchParams("utm_medium=x"))).toBe(
      "",
    );
  });
});

describe("buildLocaleSwitchHref", () => {
  it("preserves the current route when switching language", () => {
    expect(buildLocaleSwitchHref("/en/real-estate", "", "fr")).toBe(
      "/fr/real-estate",
    );
  });

  it("preserves allowed query parameters", () => {
    expect(buildLocaleSwitchHref("/en/real-estate", "q=villa&utm_source=x", "fr")).toBe(
      "/fr/real-estate?q=villa",
    );
  });

  it("switches the root without a trailing slash", () => {
    expect(buildLocaleSwitchHref("/en", "", "fr")).toBe("/fr");
  });
});

describe("buildLocaleAlternates", () => {
  const siteUrl = new URL("https://example.com");

  it("emits one absolute alternate per supported locale", () => {
    const alternates = buildLocaleAlternates("/real-estate", siteUrl);
    expect(alternates.en).toBe("https://example.com/en/real-estate");
    expect(alternates.fr).toBe("https://example.com/fr/real-estate");
  });

  it("points x-default at the language-neutral gateway", () => {
    const alternates = buildLocaleAlternates("/real-estate", siteUrl);
    expect(alternates["x-default"]).toBe("https://example.com/");
  });
});
