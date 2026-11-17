import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  DASHBOARD_NAV_ICON_KEYS,
  dashboardNavSections,
  isDashboardNavActive,
} from "./dashboard-nav";

/**
 * The dashboard nav model is what the landlord and agent sidebars render, so these
 * pin the two properties that make it trustworthy: every entry points at a real
 * route (a sidebar link to a 404 is one click behind the dashboard), and the
 * "overview" entry does not stay highlighted on every child route.
 *
 * It is a pure leaf module — no database, no React — so it is exercised without a
 * Supabase project, the same way the admin nav model is.
 */

const LOCALE = "en";

describe("dashboardNavSections", () => {
  for (const kind of ["landlord", "agent"] as const) {
    it(`qualifies every href with the locale for ${kind}`, () => {
      const sections = dashboardNavSections(kind, LOCALE);
      const hrefs = sections.flatMap((section) =>
        section.items.map((item) => item.href),
      );
      expect(hrefs.length).toBeGreaterThan(0);
      expect(hrefs.every((href) => href.startsWith(`/${LOCALE}/`))).toBe(true);
      // The manage entries are scoped to the dashboard's own kind; the rest
      // (favourites, saved searches, KYC, the account home) are shared surfaces.
      const manage = hrefs.filter((href) => href.includes("/account/"));
      expect(
        manage.some((href) => href.startsWith(`/${LOCALE}/account/${kind}`)),
      ).toBe(true);
    });

    it(`uses only known icon keys for ${kind}`, () => {
      for (const section of dashboardNavSections(kind, LOCALE)) {
        for (const item of section.items) {
          expect(DASHBOARD_NAV_ICON_KEYS).toContain(item.iconKey);
        }
      }
    });

    it(`has no duplicate hrefs for ${kind}`, () => {
      const hrefs = dashboardNavSections(kind, LOCALE).flatMap((section) =>
        section.items.map((item) => item.href),
      );
      expect(new Set(hrefs).size).toBe(hrefs.length);
    });

    it(`returns no empty section for ${kind}`, () => {
      for (const section of dashboardNavSections(kind, LOCALE)) {
        expect(section.items.length).toBeGreaterThan(0);
      }
    });
  }

  it("is structurally identical for a landlord and an agent", () => {
    const landlord = dashboardNavSections("landlord", LOCALE);
    const agent = dashboardNavSections("agent", LOCALE);
    const shape = (sections: ReturnType<typeof dashboardNavSections>) =>
      sections.map((section) => ({
        headingKey: section.headingKey,
        items: section.items.map((item) => ({
          labelKey: item.labelKey,
          iconKey: item.iconKey,
          exact: item.exact ?? false,
        })),
      }));
    expect(shape(landlord)).toEqual(shape(agent));
  });
});

describe("every dashboard nav destination resolves to a real route", () => {
  // A route group is not part of the URL, so the account tree lives under
  // `src/app/(site)/[locale]/account` and the real-estate surfaces under
  // `src/app/(site)/[locale]/real-estate`. A query string addresses a page that
  // exists, so only the path part is resolved.
  const SITE_ROOT = path.resolve(process.cwd(), "src/app/(site)/[locale]");

  function pageFor(href: string, kind: string): string {
    const route = href.split("?")[0]!;
    // Strip the locale segment; everything else maps to the file tree.
    const withoutLocale = route.replace(`/${LOCALE}`, "");
    // The model's own routes name the concrete kind; the tree has a dynamic
    // `[dashboard]` folder for them. Substitute the folder name, leaving the
    // static `kyc` page and the real-estate routes untouched.
    const concrete = withoutLocale.replace(
      new RegExp(`^/account/${kind}(/|$)`),
      "/account/[dashboard]$1",
    );
    return path.join(SITE_ROOT, concrete, "page.tsx");
  }

  it("has a page file for every dashboard href", () => {
    const missing: string[] = [];
    for (const kind of ["landlord", "agent"] as const) {
      for (const section of dashboardNavSections(kind, LOCALE)) {
        for (const item of section.items) {
          const page = pageFor(item.href, kind);
          if (!existsSync(page)) missing.push(`${item.href} -> ${page}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});

describe("isDashboardNavActive", () => {
  const overview = {
    href: "/en/account/landlord",
    labelKey: "overview",
    iconKey: "overview" as const,
    exact: true,
  };
  const create = {
    href: "/en/account/landlord/new",
    labelKey: "create",
    iconKey: "create" as const,
  };

  it("highlights an exact entry only on its own route", () => {
    expect(isDashboardNavActive(overview, "/en/account/landlord")).toBe(true);
    expect(isDashboardNavActive(overview, "/en/account/landlord/new")).toBe(
      false,
    );
    expect(isDashboardNavActive(overview, "/en/account/landlord/abc")).toBe(
      false,
    );
  });

  it("highlights a parent entry for its descendants", () => {
    expect(isDashboardNavActive(create, "/en/account/landlord/new")).toBe(true);
  });

  it("does not treat a shared prefix as a descendant", () => {
    const favorites = {
      href: "/en/real-estate/favorites",
      labelKey: "favorites",
      iconKey: "favorites" as const,
    };
    expect(
      isDashboardNavActive(favorites, "/en/real-estate/favorites-archive"),
    ).toBe(false);
  });

  it("matches an item with a query string by its path", () => {
    const kyc = {
      href: "/en/account/kyc?for=landlord",
      labelKey: "kyc",
      iconKey: "kyc" as const,
    };
    expect(isDashboardNavActive(kyc, "/en/account/kyc")).toBe(true);
  });
});
