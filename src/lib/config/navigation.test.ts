import { describe, expect, it } from "vitest";
import { NAV_PATHS, buildPrimaryNav } from "@/lib/config/navigation";
import { createTranslator } from "@/lib/i18n/translator";
import { DEPARTMENTS } from "@/lib/config/site";

const t = createTranslator("en").t;
const nav = buildPrimaryNav("en", t);

describe("buildPrimaryNav", () => {
  it("produces the requested order", () => {
    expect(nav.map((entry) => entry.label)).toEqual([
      "Home",
      "About us",
      "Departments",
      "Services",
      "Gallery",
      "Contact",
      "Insights",
    ]);
  });

  it("points the articles entry at the canonical insights path", () => {
    const link = nav.find(
      (entry) => entry.kind === "link" && entry.label === "Insights",
    );
    expect(link).toBeDefined();
    // `/blog` is a legacy path that redirects here; the nav must advertise the
    // canonical URL so crawlers and visitors are sent to one place.
    expect(link?.kind === "link" ? link.href : null).toBe("/en/insights");
  });

  it("exposes departments as a single menu entry rather than top-level links", () => {
    const menus = nav.filter((entry) => entry.kind === "menu");
    expect(menus).toHaveLength(1);

    const topLevelHrefs = nav
      .filter((entry) => entry.kind === "link")
      .map((entry) => entry.href);
    for (const department of DEPARTMENTS) {
      expect(topLevelHrefs).not.toContain(`/en/${department.slug}`);
    }
  });

  it("keeps every department reachable inside the menu", () => {
    const menu = nav.find((entry) => entry.kind === "menu");
    if (menu?.kind !== "menu") throw new Error("menu entry missing");
    expect(menu.items.map((item) => item.href)).toEqual(
      DEPARTMENTS.map((department) => `/en/${department.slug}`),
    );
    expect(menu.items).toHaveLength(DEPARTMENTS.length);
  });

  it("qualifies every href with the requested locale", () => {
    const frNav = buildPrimaryNav("fr", createTranslator("fr").t);
    const hrefs: string[] = [];
    for (const entry of frNav) {
      if (entry.kind === "link") hrefs.push(entry.href);
      else hrefs.push(...entry.items.map((item) => item.href));
    }
    expect(hrefs.every((href) => href.startsWith("/fr"))).toBe(true);
  });

  it("only links to paths the sitemap also advertises", () => {
    const sitemapPaths = new Set<string>([...NAV_PATHS, "/"]);
    for (const entry of nav) {
      if (entry.kind !== "link") continue;
      const pathWithoutLocale = entry.href.replace(/^\/en/, "") || "/";
      expect(sitemapPaths.has(pathWithoutLocale)).toBe(true);
    }
  });

  it("resolves a real label for every entry in both locales", () => {
    for (const locale of ["en", "fr"] as const) {
      const entries = buildPrimaryNav(locale, createTranslator(locale).t);
      for (const entry of entries) {
        // A missing key falls through to the raw key, which would be visible
        // as a dotted identifier in the header.
        expect(entry.label).not.toMatch(/^nav\./);
        expect(entry.label.length).toBeGreaterThan(0);
      }
    }
  });
});
