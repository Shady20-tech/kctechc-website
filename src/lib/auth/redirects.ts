import { getSiteUrl } from "@/lib/config/env";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/locales";

/**
 * Where a password-recovery email lands.
 *
 * Supabase appends the PKCE `code` to the redirect URL, so the link cannot point
 * straight at the reset form — the code has to be exchanged for a session first.
 * `/auth/callback` does that exchange and forwards to `next`, the page that sets
 * the new password. Pointing `redirectTo` at a bare page path skips the exchange
 * and leaves the visitor on a form whose Server Action refuses for want of a
 * session.
 *
 * Kept out of `actions.ts` because that module is `"use server"`, where every
 * export must be an async Server Action; this is a pure string builder and is
 * exported so a test can assert the path shape without request context.
 *
 * The target is locale-scoped because the page lives under `/[locale]/admin/…`.
 */
export function recoveryRedirectUrlFor(
  localeCookie: string | undefined,
  origin: URL = getSiteUrl(),
): string {
  const locale =
    localeCookie && isLocale(localeCookie) ? localeCookie : DEFAULT_LOCALE;
  const next = `/${locale}/admin/reset-password`;
  return new URL(
    `/auth/callback?next=${encodeURIComponent(next)}`,
    origin,
  ).toString();
}
