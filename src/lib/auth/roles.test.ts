import { describe, expect, it } from "vitest";
import {
  canAccessDepartment,
  getRoleDepartment,
  isAdminRole,
  isAppRole,
  isElevatedRole,
  ADMIN_ROLES,
  APP_ROLES,
} from "@/lib/auth/roles";

describe("isAppRole", () => {
  it("accepts every declared role", () => {
    for (const role of APP_ROLES) {
      expect(isAppRole(role)).toBe(true);
    }
  });

  it("rejects unknown roles", () => {
    expect(isAppRole("root")).toBe(false);
    expect(isAppRole("SUPER_ADMIN")).toBe(false);
  });
});

describe("isAdminRole", () => {
  it("grants the admin surface to staff and admin roles", () => {
    for (const role of ADMIN_ROLES) {
      expect(isAdminRole(role)).toBe(true);
    }
  });

  it("denies the admin surface to public roles", () => {
    expect(isAdminRole("visitor")).toBe(false);
    expect(isAdminRole("customer")).toBe(false);
  });
});

describe("isElevatedRole", () => {
  it("reserves elevated actions for admins", () => {
    expect(isElevatedRole("super_admin")).toBe(true);
    expect(isElevatedRole("digital_marketing_admin")).toBe(true);
    expect(isElevatedRole("electrical_admin")).toBe(true);
  });

  it("does not elevate staff roles", () => {
    expect(isElevatedRole("digital_marketing_staff")).toBe(false);
    expect(isElevatedRole("real_estate_agent")).toBe(false);
    expect(isElevatedRole("department_staff")).toBe(false);
  });
});

describe("getRoleDepartment", () => {
  it("maps department-scoped roles to their slug", () => {
    expect(getRoleDepartment("real_estate_agent")).toBe("real-estate");
    expect(getRoleDepartment("electrical_admin")).toBe("electrical-services");
    expect(getRoleDepartment("digital_marketing_staff")).toBe(
      "digital-marketing",
    );
  });

  it("returns null for cross-department roles", () => {
    expect(getRoleDepartment("super_admin")).toBeNull();
    expect(getRoleDepartment("department_staff")).toBeNull();
  });
});

describe("canAccessDepartment", () => {
  it("lets super_admin and department_staff act anywhere", () => {
    for (const slug of ["digital-marketing", "electrical-services", "real-estate"]) {
      expect(canAccessDepartment("super_admin", slug)).toBe(true);
      expect(canAccessDepartment("department_staff", slug)).toBe(true);
    }
  });

  it("confines a department role to its own department", () => {
    expect(canAccessDepartment("real_estate_agent", "real-estate")).toBe(true);
    expect(canAccessDepartment("real_estate_agent", "electrical-services")).toBe(
      false,
    );
  });

  it("denies public roles any department access", () => {
    expect(canAccessDepartment("customer", "real-estate")).toBe(false);
    expect(canAccessDepartment("visitor", "digital-marketing")).toBe(false);
  });
});
