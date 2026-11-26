import { postSignInPathFor } from "@/lib/auth/redirects";
import { DEFAULT_ROLE, isAppRole } from "@/lib/auth/roles";
import type { Locale } from "@/lib/i18n/locales";

/**
 * The two profile facts that decide where a freshly authenticated account goes.
 *
 * Kept as a plain shape rather than the full `Profile` so the callback route
 * (which reads the columns directly) and the ID-token completion action (which
 * uses `getAuthState`) can share one rule without importing each other's types.
 */
export type PostAuthProfile = {
  role: string | null;
  declaredAccountType: string | null;
} | null;

/**
 * Where an authenticated account lands when it did not ask for a specific page.
 *
 * A social sign-in creates the profile without asking for a role or residency —
 * `handle_new_user` leaves `declared_account_type` null — so that account still
 * owes the onboarding step. An account that has already declared goes to the
 * usual role-based landing: the console for staff, the account hub for customers.
 *
 * Pure so `/auth/callback` (email links and Facebook) and
 * `completeOAuthSignInAction` (Google Identity Services) cannot drift.
 */
export function resolvePostAuthPath(
  locale: Locale,
  profile: PostAuthProfile,
): string {
  if (!profile || profile.declaredAccountType === null) {
    return `/${locale}/account/onboarding`;
  }

  const role =
    profile.role && isAppRole(profile.role) ? profile.role : DEFAULT_ROLE;
  return postSignInPathFor(role, locale);
}
