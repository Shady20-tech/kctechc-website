import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  canAccessDepartment,
  getRoleDepartment,
  isAdminRole,
  isAppRole,
  isContentManagerRole,
  isElevatedRole,
  isRealEstateAdminRole,
  isStoreManagerRole,
  ADMIN_ROLES,
  APP_ROLES,
  CONTENT_MANAGER_ROLES,
  ELEVATED_ROLES,
  REAL_ESTATE_ADMIN_ROLES,
  STORE_MANAGER_ROLES,
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

describe("isStoreManagerRole and isContentManagerRole", () => {
  it("gives the store to both marketing departments", () => {
    // The store is the one surface shared between two departments. This is the
    // assertion that would fail if someone "simplified" the shared list into a
    // department comparison, which would give it to exactly one of its owners.
    expect(isStoreManagerRole("digital_marketing_admin")).toBe(true);
    expect(isStoreManagerRole("electrical_admin")).toBe(true);
  });

  it("excludes real estate from the store, despite it being elevated", () => {
    expect(isRealEstateAdminRole("real_estate_admin")).toBe(true);
    expect(isStoreManagerRole("real_estate_admin")).toBe(false);
  });

  it("excludes staff and agents, who do not administer either surface", () => {
    for (const role of [
      "digital_marketing_staff",
      "electrical_staff",
      "real_estate_agent",
    ] as const) {
      expect(isStoreManagerRole(role)).toBe(false);
      expect(isContentManagerRole(role)).toBe(false);
    }
  });

  it("includes department_staff, which is cross-department", () => {
    expect(isStoreManagerRole("department_staff")).toBe(true);
    expect(isContentManagerRole("department_staff")).toBe(true);
  });

  it("gives content to the same roles as the store, and neither to real estate", () => {
    for (const role of APP_ROLES) {
      expect(isContentManagerRole(role)).toBe(isStoreManagerRole(role));
      if (getRoleDepartment(role) === "real-estate") {
        expect(isStoreManagerRole(role)).toBe(false);
      }
    }
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

  it("ROLE_DEPARTMENTS matches current_user_department()", () => {
    // getRoleDepartment() and the SQL helper are read by different code paths —
    // the sidebar reads the former, RLS reads the latter — so they are asserted
    // equal here rather than trusted to stay in step.
    const fn = allSql.match(
      /create or replace function public\.current_user_department\(\)[\s\S]*?select case[\s\S]*?end;/i,
    );
    expect(fn, "current_user_department() not found").not.toBeNull();

    const body = fn?.[0] ?? "";
    const declared = new Map<string, string>();
    for (const m of body.matchAll(/when '([^']+)' then '([^']+)'/g)) {
      if (m[1] && m[2]) declared.set(m[1], m[2]);
    }

    for (const role of APP_ROLES) {
      const fromSql = declared.get(role) ?? null;
      const fromTs = getRoleDepartment(role);
      expect(fromSql, `department mismatch for ${role}`).toBe(fromTs);
    }
  });

  it("STORE_MANAGER_ROLES matches is_store_manager()", () => {
    const fn = allSql.match(
      /create or replace function public\.is_store_manager\(\)[\s\S]*?in \(\s*([\s\S]*?)\)\s*\)?/i,
    );
    const roleList = fn?.[1];
    expect(roleList, "is_store_manager() not found").toBeDefined();

    const roles: string[] = [];
    for (const m of (roleList as string).matchAll(/'([^']+)'/g)) {
      if (m[1]) roles.push(m[1]);
    }

    expect([...STORE_MANAGER_ROLES].sort()).toEqual(roles.sort());
  });

  it("CONTENT_MANAGER_ROLES matches is_content_manager()", () => {
    const fn = allSql.match(
      /create or replace function public\.is_content_manager\(\)[\s\S]*?in \(\s*([\s\S]*?)\)\s*\)?/i,
    );
    const roleList = fn?.[1];
    expect(roleList, "is_content_manager() not found").toBeDefined();

    const roles: string[] = [];
    for (const m of (roleList as string).matchAll(/'([^']+)'/g)) {
      if (m[1]) roles.push(m[1]);
    }

    expect([...CONTENT_MANAGER_ROLES].sort()).toEqual(roles.sort());
  });

  it("the department policies actually call the department helpers", () => {
    // The gap this whole phase closes: `can_access_department()` existed and was
    // unit-tested while no policy referenced it, so the separation was declared
    // and never enforced. This asserts the policies consume the scoping helpers.
    const policies = allSql.match(
      /create policy "[^"]+"\s+on public\.(inquiries|services|insights)[\s\S]*?;/gi,
    );
    expect(policies, "no department policies found").not.toBeNull();

    const joined = (policies ?? []).join("\n");
    expect(joined).toMatch(/can_read_department|can_manage_department/);
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
