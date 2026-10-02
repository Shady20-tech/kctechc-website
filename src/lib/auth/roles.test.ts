import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  canAccessDepartment,
  getRoleDepartment,
  isAdminRole,
  isAppRole,
  isDepartmentEditorRole,
  isElevatedRole,
  isRealEstateAdminRole,
  ADMIN_ROLES,
  APP_ROLES,
  DEPARTMENT_EDITOR_ROLES,
  ELEVATED_ROLES,
  REAL_ESTATE_ADMIN_ROLES,
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

describe("isRealEstateAdminRole", () => {
  it("grants cross-listing access to the real-estate admin roles", () => {
    expect(isRealEstateAdminRole("real_estate_admin")).toBe(true);
    expect(isRealEstateAdminRole("department_staff")).toBe(true);
    expect(isRealEstateAdminRole("super_admin")).toBe(true);
  });

  it("does NOT grant it to an agent, who is scoped to their own listings", () => {
    // The distinction the phase's access rule rests on. An agent reaches the
    // admin surface but must not manage the whole portfolio.
    expect(isRealEstateAdminRole("real_estate_agent")).toBe(false);
  });

  it("is not implied by elevation in another department", () => {
    // A store or electrical admin is elevated for their own remit, which does not
    // make them an administrator of the property portfolio.
    expect(isElevatedRole("digital_marketing_admin")).toBe(true);
    expect(isRealEstateAdminRole("digital_marketing_admin")).toBe(false);
    expect(isElevatedRole("electrical_admin")).toBe(true);
    expect(isRealEstateAdminRole("electrical_admin")).toBe(false);
  });
});

describe("role model matches the database", () => {
  const migrationsDir = join(process.cwd(), "supabase", "migrations");
  const allSql = readdirSync(migrationsDir)
    .sort()
    .map((f) => readFileSync(join(migrationsDir, f), "utf8"))
    .join("\n")
    .replace(/--[^\n]*/g, "");

  /** Members of `create type public.user_role`, plus any added by `alter type`. */
  const declaredRoles = (() => {
    const roles: string[] = [];
    const create = allSql.match(
      /create type public\.user_role as enum\s*\(([^)]*)\)/i,
    );
    const createBody = create?.[1];
    if (createBody) {
      for (const m of createBody.matchAll(/'([^']+)'/g)) {
        if (m[1]) roles.push(m[1]);
      }
    }
    for (const m of allSql.matchAll(
      /alter type public\.user_role add value(?: if not exists)? '([^']+)'/gi,
    )) {
      if (m[1] && !roles.includes(m[1])) roles.push(m[1]);
    }
    return roles;
  })();

  it("APP_ROLES is exactly the database enum", () => {
    expect([...APP_ROLES].sort()).toEqual([...declaredRoles].sort());
  });

  it("REAL_ESTATE_ADMIN_ROLES matches is_real_estate_admin()", () => {
    const fn = allSql.match(
      /create or replace function public\.is_real_estate_admin\(\)[\s\S]*?in \(\s*([\s\S]*?)\)\s*\)?/i,
    );
    const roleList = fn?.[1];
    expect(roleList, "is_real_estate_admin() not found").toBeDefined();

    const roles: string[] = [];
    for (const m of (roleList as string).matchAll(/'([^']+)'/g)) {
      if (m[1]) roles.push(m[1]);
    }

    expect([...REAL_ESTATE_ADMIN_ROLES].sort()).toEqual(roles.sort());
  });

  it("ELEVATED_ROLES is a subset of ADMIN_ROLES", () => {
    for (const role of ELEVATED_ROLES) {
      expect(ADMIN_ROLES).toContain(role);
    }
  });

  it("DEPARTMENT_EDITOR_ROLES matches is_department_editor()", () => {
    // The predicate is written as a CASE over role names, so the agreement is
    // asserted by executing the same mapping in the test rather than by scraping
    // a role list out of the SQL. A role added to the function and forgotten here
    // (or the reverse) fails this, which is the drift that matters: the nav link,
    // the action's guard and the RLS policy must all name the same roles.
    const fn = allSql.match(
      /create or replace function public\.is_department_editor\([\s\S]*?\$\$;/i,
    );
    const body = fn?.[0];
    expect(body, "is_department_editor() not found").toBeDefined();

    const roles: string[] = [];
    for (const m of (body as string).matchAll(/when\s+'([^']+)'/g)) {
      if (m[1]) roles.push(m[1]);
    }

    expect([...DEPARTMENT_EDITOR_ROLES].sort()).toEqual(roles.sort());
  });

  it("confines a department editor to a department it may access", () => {
    // A role is an editor only for a department `canAccessDepartment` allows.
    // `real_estate_agent` reaches the console but authors no work, and a
    // Digital Marketing editor is not an editor of Electrical Services.
    expect(isDepartmentEditorRole("real_estate_agent")).toBe(false);
    expect(isDepartmentEditorRole("customer")).toBe(false);
    expect(isDepartmentEditorRole("electrical_staff")).toBe(true);
    expect(canAccessDepartment("electrical_staff", "digital-marketing")).toBe(
      false,
    );
  });

  it("no new account can be provisioned with a privileged role", () => {
    // Guards the fix. `handle_new_user` is replaced, not amended, so the LAST
    // definition is the one the database uses — checking the first would test
    // the version that was fixed rather than the one in force.
    const definitions = [
      ...allSql.matchAll(
        /create or replace function public\.handle_new_user\(\)([\s\S]*?)\$\$;/gi,
      ),
    ];
    expect(definitions.length).toBeGreaterThan(0);

    const effective = definitions.at(-1)?.[1] ?? "";

    expect(effective).not.toMatch(/raw_user_meta_data\s*->>\s*'role'/);
    expect(effective).toMatch(/'customer'::public\.user_role/);
  });
});
