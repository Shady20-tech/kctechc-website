import { getSiteUrl } from "@/lib/config/env";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/locales";
import { isAdminRole, type AppRole } from "@/lib/auth/roles";

/**
 * Where an email confirmation link lands.
 *
 * No `next` is passed: `/auth/callback` decides by the account's role and
 * declarations. A self-registration is always a `customer`, so it lands on the
 * account hub; a staff account lands on the console. Passing `next=/admin` here
 * sent every newly confirmed customer into a console that refuses them.
 */
export function confirmationRedirectUrl(origin: URL = getSiteUrl()): string {
  return new URL("/auth/callback", origin).toString();
}

/**
 * Where a signed-in account lands when it did not ask for a specific page.
 *
 * The two destinations do not share a URL shape: the console is the
 * non-localized `/admin` (its own `(static)` route group with an internal
 * language toggle), while the customer account hub is the localized
 * `/[locale]/account`. `/admin` is guarded by `requireAdmin`, which redirects
 * every non-admin role to "Access denied" — so a customer signing in from the
 * public header used to be told they had no permission for signing in correctly.
 * Staff still go to the console; everyone else goes to the account hub.
 */
export function postSignInPathFor(role: AppRole, locale: string): string {
  if (isAdminRole(role)) return "/admin";
  const resolved = isLocale(locale) ? locale : DEFAULT_LOCALE;
  return `/${resolved}/account`;
}
