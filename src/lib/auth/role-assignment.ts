import { z } from "zod";

/**
 * The roles an administrator may grant through the console.
 *
 * Spelled out as a tuple rather than derived from `APP_ROLES` so `z.enum` gets
 * the literal types it needs. `role-assignment.test.ts` asserts this list is
 * exactly `APP_ROLES` minus `visitor`, and that every entry has a `roleName.*`
 * translation key, so the duplication cannot drift.
 *
 * `visitor` is excluded on purpose: it models an anonymous request rather than a
 * person, so there is no account to give it to.
 *
 * This module has no `"use server"` directive and imports nothing server-only,
 * because the role picker is a Client Component and needs the same list the
 * action validates against. One list, both sides.
 */
export const ASSIGNABLE_ROLES = [
  "customer",
  "real_estate_agent",
  "real_estate_admin",
  "digital_marketing_staff",
  "digital_marketing_admin",
  "electrical_staff",
  "electrical_admin",
  "department_staff",
  "super_admin",
] as const;

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export function isAssignableRole(value: string): value is AssignableRole {
  return (ASSIGNABLE_ROLES as readonly string[]).includes(value);
}

/**
 * A role change request.
 *
 * `role` is an enum, not a string, so a value outside the assignable set is
 * refused before any query runs. The database enum would reject it too, but as a
 * Postgres error rather than a message the caller can act on.
 */
export const roleChangeSchema = z.object({
  profileId: z.string().uuid(),
  role: z.enum(ASSIGNABLE_ROLES),
});
