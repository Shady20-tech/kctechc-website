import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  ADMIN_NAV,
  ADMIN_NAV_ICON_KEYS,
  isNavItemActive,
  navItemsForRole,
  navSectionsForRole,
  navSectionsForRoleClient,
} from "@/lib/admin/navigation";
import { APP_ROLES, type AppRole } from "@/lib/auth/roles";

/**
 * The navigation model is a permission decision rendered as UI, so the tests pin
 * the two properties that make it trustworthy: a role never sees a destination it
 * may not open, and the super-admin surfaces are not reachable by any other role.
 */

describe("navSectionsForRole", () => {
  it("never returns an empty section", () => {
    for (const role of APP_ROLES) {
      for (const section of navSectionsForRole(role)) {
        expect(section.items.length).toBeGreaterThan(0);
      }
    }
  });

  it("gives every admin role at least one destination", () => {
    for (const role of APP_ROLES) {
      if (role === "visitor" || role === "customer") continue;
      expect(navItemsForRole(role).length).toBeGreaterThan(0);
    }
  });

  it("hides system logs from everyone but super_admin", () => {
    for (const role of APP_ROLES) {
      const hasLogs = navItemsForRole(role).some((item) => item.href === "/admin/logs");
      expect(hasLogs).toBe(role === "super_admin");
    }
  });

  it("hides user management from everyone but super_admin", () => {
    for (const role of APP_ROLES) {
      const items = navItemsForRole(role).map((item) => item.href);
      const restricted = ["/admin/users"];
      for (const href of restricted) {
        expect(items.includes(href)).toBe(role === "super_admin");
      }
    }
  });

  it("does not offer the store to a non-elevated admin", () => {
    const agentItems = navItemsForRole("real_estate_agent").map((item) => item.href);
    expect(agentItems.includes("/admin/store")).toBe(false);
    const adminItems = navItemsForRole("super_admin").map((item) => item.href);
    expect(adminItems.includes("/admin/store")).toBe(true);
  });

  it("gives every admin the profile-bearing surfaces (settings)", () => {
    for (const role of APP_ROLES) {
      if (role === "visitor" || role === "customer") continue;
      const items = navItemsForRole(role as AppRole).map((item) => item.href);
      expect(items.includes("/admin/settings")).toBe(true);
    }
  });

  it("offers property listings only to the real-estate admin roles", () => {
    for (const role of APP_ROLES) {
      const items = navItemsForRole(role).map((item) => item.href);
      const hasListings = items.includes("/admin/real-estate/listings");
      const expected =
        role === "real_estate_admin" || role === "department_staff" || role === "super_admin";
      expect(hasListings).toBe(expected);
    }
  });
});

describe("navItemsForRole", () => {
  it("is a flat projection of the visible sections", () => {
    for (const role of APP_ROLES) {
      const flat = navItemsForRole(role).map((item) => item.href);
      const fromSections = navSectionsForRole(role).flatMap((section) =>
        section.items.map((item) => item.href),
      );
      expect(flat).toEqual(fromSections);
    }
  });

  it("has no duplicate hrefs for any role", () => {
    for (const role of APP_ROLES) {
      const hrefs = navItemsForRole(role).map((item) => item.href);
      expect(new Set(hrefs).size).toBe(hrefs.length);
    }
  });
});

describe("ADMIN_NAV integrity", () => {
  it("has unique hrefs across the whole model", () => {
    const hrefs = ADMIN_NAV.flatMap((section) => section.items.map((item) => item.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("uses internal absolute paths", () => {
    for (const section of ADMIN_NAV) {
      for (const item of section.items) {
        expect(item.href.startsWith("/admin")).toBe(true);
      }
    }
  });
});

describe("AdminNavItemClient serializability", () => {
  /**
   * The console layout is a Server Component and the sidebar is a Client Component,
   * so the nav crosses the boundary as props. React refuses to serialize a function
   * and throws at render time — which is how the whole console 500'd. These assert
   * the projection contains nothing but strings, so that failure cannot come back.
   */
  it("sends only serializable values for every role", () => {
    for (const role of APP_ROLES) {
      const sections = navSectionsForRoleClient(role);
      const roundTripped = JSON.parse(JSON.stringify(sections));
      expect(roundTripped).toEqual(sections);
    }
  });

  it("carries no function values", () => {
    for (const role of APP_ROLES) {
      const walk = (value: unknown): void => {
        if (value && typeof value === "object") {
          for (const nested of Object.values(value)) walk(nested);
          return;
        }
        expect(typeof value).not.toBe("function");
      };
      walk(navSectionsForRoleClient(role));
    }
  });

  it("preserves the same destinations as the server projection", () => {
    for (const role of APP_ROLES) {
      const server = navSectionsForRole(role).flatMap((section) =>
        section.items.map((item) => item.href),
      );
      const client = navSectionsForRoleClient(role).flatMap((section) =>
        section.items.map((item) => item.href),
      );
      expect(client).toEqual(server);
    }
  });

  it("every iconKey resolves to a known icon", () => {
    for (const section of ADMIN_NAV) {
      for (const item of section.items) {
        expect(ADMIN_NAV_ICON_KEYS).toContain(item.iconKey);
      }
    }
  });

  it("uses a distinct iconKey per href", () => {
    const keys = ADMIN_NAV.flatMap((section) =>
      section.items.map((item) => item.iconKey),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("every nav destination resolves to a real route", () => {
  /**
   * A sidebar entry pointing at a route that does not exist is a 404 one click
   * behind the console — which is exactly how `/admin/store` shipped, because
   * only `/admin/store/new` had a page. Checking the file tree is enough here:
   * App Router folders map to paths, so the page file existing is the condition
   * for the route rendering at all.
   */
  const CONSOLE_ROOT = path.resolve(
    process.cwd(),
    "src/app/(static)/admin/(console)",
  );

  it("has a page file for every ADMIN_NAV href", () => {
    const missing: string[] = [];
    for (const section of ADMIN_NAV) {
      for (const item of section.items) {
        const relative = item.href.replace(/^\/admin/, "") || "/";
        const page = path.join(CONSOLE_ROOT, relative, "page.tsx");
        if (!existsSync(page)) missing.push(`${item.href} -> ${page}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe("isNavItemActive", () => {
  it("highlights the dashboard only on the exact dashboard route", () => {
    expect(isNavItemActive("/admin", "/admin")).toBe(true);
    expect(isNavItemActive("/admin", "/admin/orders")).toBe(false);
  });

  it("highlights a parent route for its descendants", () => {
    expect(isNavItemActive("/admin/crm", "/admin/crm")).toBe(true);
    expect(isNavItemActive("/admin/crm", "/admin/crm/abc")).toBe(true);
    expect(isNavItemActive("/admin/crm", "/admin/content")).toBe(false);
  });

  it("does not treat a shared prefix as a descendant", () => {
    expect(isNavItemActive("/admin/logs", "/admin/logs-archive")).toBe(false);
  });
});
