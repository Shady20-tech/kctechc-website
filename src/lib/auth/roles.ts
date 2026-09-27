/**
 * Role model. These string values are the single source of truth shared by the
 * application and the `public.user_role` Postgres enum created in the identity
 * migration — keep them in sync.
 */

export const APP_ROLES = [
  "visitor",
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

export type AppRole = (typeof APP_ROLES)[number];

/** Roles that may reach the internal admin surface at all. */
export const ADMIN_ROLES: readonly AppRole[] = [
  "real_estate_agent",
  "real_estate_admin",
  "digital_marketing_staff",
  "digital_marketing_admin",
  "electrical_staff",
  "electrical_admin",
  "department_staff",
  "super_admin",
];

/** Roles permitted to perform destructive or cross-department operations. */
export const ELEVATED_ROLES: readonly AppRole[] = [
  "digital_marketing_admin",
  "electrical_admin",
  "super_admin",
];

/**
 * Roles that may act across all real estate listings.
 *
 * Deliberately separate from `ELEVATED_ROLES`, and deliberately excluding
 * `real_estate_agent`. The two questions are different: `isElevatedRole` asks
 * whether a role may perform a destructive or cross-department operation, while
 * this asks whether it may manage the whole real estate portfolio. An agent
 * reaches the admin surface but manages only their own listings, and a role that
 * is elevated for the store is not thereby entitled to the property portfolio.
 *
 * Mirrors `is_real_estate_admin()` in
 * `20260101000017_agents.sql`; `roles.test.ts` asserts the two agree.
 */
export const REAL_ESTATE_ADMIN_ROLES: readonly AppRole[] = [
  "real_estate_admin",
  "department_staff",
  "super_admin",
];

/** Role granted to a self-registered public user. */
export const DEFAULT_ROLE: AppRole = "customer";

export function isAppRole(value: string): value is AppRole {
  return (APP_ROLES as readonly string[]).includes(value);
}

export function isAdminRole(role: AppRole): boolean {
  return ADMIN_ROLES.includes(role);
}

export function isElevatedRole(role: AppRole): boolean {
  return ELEVATED_ROLES.includes(role);
}

/** True when `role` may manage every real estate listing, not only their own. */
export function isRealEstateAdminRole(role: AppRole): boolean {
  return REAL_ESTATE_ADMIN_ROLES.includes(role);
}

/**
 * Department ownership. A department admin may only manage their own
 * department; `super_admin` and `department_staff` are cross-department.
 */
export const ROLE_DEPARTMENTS: Partial<Record<AppRole, string>> = {
  digital_marketing_staff: "digital-marketing",
  digital_marketing_admin: "digital-marketing",
  electrical_staff: "electrical-services",
  electrical_admin: "electrical-services",
  real_estate_agent: "real-estate",
  real_estate_admin: "real-estate",
};

export function getRoleDepartment(role: AppRole): string | null {
  return ROLE_DEPARTMENTS[role] ?? null;
}

/** True when `role` may act on the given department slug. */
export function canAccessDepartment(role: AppRole, slug: string): boolean {
  if (role === "super_admin" || role === "department_staff") return true;
  return getRoleDepartment(role) === slug;
}

/**
 * Roles that administer the store.
 *
 * The store is the one surface shared between two departments: the corporate
 * gateway presents Digital Marketing and Electrical Services as equal storefront
 * owners, and the catalogue is electrical. That is why this is an explicit role
 * list rather than a department comparison — a comparison would have given the
 * store to exactly one of its two owners.
 *
 * Real Estate is deliberately absent. `real_estate_admin` is elevated for the
 * property portfolio, which does not make it a shop administrator; the two
 * questions are separate, the same way `isRealEstateAdminRole` is separate from
 * `isElevatedRole`. `department_staff` is cross-department, so it is included.
 *
 * Mirrors `is_store_manager()` in
 * `20260101000038_department_administration.sql`; `roles.test.ts` asserts the two
 * agree.
 */
export const STORE_MANAGER_ROLES: readonly AppRole[] = [
  "digital_marketing_admin",
  "electrical_admin",
  "department_staff",
  "super_admin",
];

/**
 * Roles that may author content.
 *
 * Same departmental boundary as the store: Marketing and Electrical, not Real
 * Estate. Which department's posts a manager may edit is a per-row decision made
 * by `can_access_department`, not by this predicate.
 *
 * Mirrors `is_content_manager()` in
 * `20260101000038_department_administration.sql`.
 */
export const CONTENT_MANAGER_ROLES: readonly AppRole[] = [
  "digital_marketing_admin",
  "electrical_admin",
  "department_staff",
  "super_admin",
];

/** True when `role` may administer the shared store. */
export function isStoreManagerRole(role: AppRole): boolean {
  return STORE_MANAGER_ROLES.includes(role);
}

/** True when `role` may author content, within its own department. */
export function isContentManagerRole(role: AppRole): boolean {
  return CONTENT_MANAGER_ROLES.includes(role);
}
