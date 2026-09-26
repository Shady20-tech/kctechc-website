import "server-only";

import { redirect } from "next/navigation";
import { getAuthState, type Profile } from "./session";
import { isAdminRole, type AppRole } from "./roles";

/**
 * Server-side authorization guards.
 *
 * Every protected route calls one of these. UI-level hiding is not a control:
 * RLS policies in Postgres are the real boundary, and these guards ensure a
 * request never reaches a query it is not entitled to run.
 */

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** Redirect anonymous visitors to sign-in, preserving where they were headed. */
export async function requireUser(returnTo: string): Promise<Profile> {
  const state = await getAuthState();

  if (state.status === "unconfigured") {
    redirect("/admin/login?reason=unconfigured");
  }
  if (state.status !== "authenticated" || !state.profile) {
    redirect(`/admin/login?next=${encodeURIComponent(returnTo)}`);
  }
  if (!state.profile.isActive) {
    redirect("/admin/unauthorized?reason=inactive");
  }
  return state.profile;
}

/** Require any admin-capable role. */
export async function requireAdmin(returnTo: string): Promise<Profile> {
  const profile = await requireUser(returnTo);
  if (!isAdminRole(profile.role)) {
    redirect("/admin/unauthorized?reason=role");
  }
  return profile;
}

/** Require one of an explicit set of roles. */
export async function requireRole(
  allowed: readonly AppRole[],
  returnTo: string,
): Promise<Profile> {
  const profile = await requireUser(returnTo);
  if (!allowed.includes(profile.role)) {
    redirect("/admin/unauthorized?reason=role");
  }
  return profile;
}

/**
 * Non-redirecting check for API routes and Server Actions, where a redirect
 * would be the wrong response shape.
 */
export async function assertRole(
  allowed: readonly AppRole[],
): Promise<Profile> {
  const state = await getAuthState();
  if (state.status !== "authenticated" || !state.profile) {
    throw new AuthorizationError("Authentication required");
  }
  if (!allowed.includes(state.profile.role)) {
    throw new AuthorizationError("Insufficient role");
  }
  return state.profile;
}
