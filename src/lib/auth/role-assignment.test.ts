import { describe, expect, it } from "vitest";

import en from "@/lib/i18n/messages/en.json";
import fr from "@/lib/i18n/messages/fr.json";
import { APP_ROLES } from "@/lib/auth/roles";
import {
  ASSIGNABLE_ROLES,
  isAssignableRole,
  roleChangeSchema,
} from "@/lib/auth/role-assignment";

/**
 * The role picker is a security boundary's user-facing half, so these assertions
 * pin the properties that keep it aligned with the database rather than the
 * wording of any one option.
 */
describe("assignable roles", () => {
  it("is exactly APP_ROLES minus visitor", () => {
    // Derived rather than restated: if a role is added to the app model and not
    // here, the console silently cannot grant it, which is the failure this
    // catches. `visitor` is the deliberate exception — it models an anonymous
    // request, so there is no account to hold it.
    const expected = APP_ROLES.filter((role) => role !== "visitor");
    expect([...ASSIGNABLE_ROLES]).toEqual([...expected]);
  });

  it("never offers visitor", () => {
    expect(ASSIGNABLE_ROLES).not.toContain("visitor");
    expect(isAssignableRole("visitor")).toBe(false);
  });

  it("has a label for every assignable role in both locales", () => {
    // A missing key is silent: the translator falls through to the raw key, so the
    // select would render `roleName.electrical_admin` as visible text.
    for (const role of ASSIGNABLE_ROLES) {
      expect(en.roleName, `en.roleName.${role}`).toHaveProperty(role);
      expect(fr.roleName, `fr.roleName.${role}`).toHaveProperty(role);
    }
  });

  it("labels visitor too, since a legacy row may hold it", () => {
    expect(en.roleName).toHaveProperty("visitor");
    expect(fr.roleName).toHaveProperty("visitor");
  });
});

describe("roleChangeSchema", () => {
  const id = "8f14e45f-ceea-467a-9b2e-1a1b2c3d4e5f";

  it("accepts an assignable role", () => {
    const result = roleChangeSchema.safeParse({
      profileId: id,
      role: "super_admin",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a role outside the assignable set", () => {
    // The database enum would refuse `owner` too, but as a Postgres error rather
    // than a message the caller can act on.
    for (const role of ["visitor", "owner", "admin", "", "SUPER_ADMIN"]) {
      expect(
        roleChangeSchema.safeParse({ profileId: id, role }).success,
        `role=${JSON.stringify(role)}`,
      ).toBe(false);
    }
  });

  it("rejects a non-uuid profile id", () => {
    for (const profileId of ["", "1", "not-a-uuid", "' or 1=1--"]) {
      expect(
        roleChangeSchema.safeParse({ profileId, role: "customer" }).success,
        `profileId=${JSON.stringify(profileId)}`,
      ).toBe(false);
    }
  });

  it("rejects a missing field rather than coercing it", () => {
    expect(roleChangeSchema.safeParse({ role: "customer" }).success).toBe(
      false,
    );
    expect(roleChangeSchema.safeParse({ profileId: id }).success).toBe(false);
  });
});
