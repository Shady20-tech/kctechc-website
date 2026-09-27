import { describe, expect, it } from "vitest";

import {
  ADMIN_NAV,
  isNavItemActive,
  navItemsForRole,
  navSectionsForRole,
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

  it("hides user management and security from everyone but super_admin", () => {
    for (const role of APP_ROLES) {
      const items = navItemsForRole(role).map((item) => item.href);
      const restricted = ["/admin/users", "/admin/security"];
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
