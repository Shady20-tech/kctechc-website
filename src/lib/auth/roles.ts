/**
 * Role model. These string values are the single source of truth shared by the
 * application and the `public.user_role` Postgres enum created in the identity
 * migration — keep them in sync.
 */

export const APP_ROLES = [
  "visitor",
  "customer",
  "real_estate_agent",
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
};

export function getRoleDepartment(role: AppRole): string | null {
  return ROLE_DEPARTMENTS[role] ?? null;
}

/** True when `role` may act on the given department slug. */
export function canAccessDepartment(role: AppRole, slug: string): boolean {
  if (role === "super_admin" || role === "department_staff") return true;
  return getRoleDepartment(role) === slug;
}
