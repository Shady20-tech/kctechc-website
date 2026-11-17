import "server-only";

import type { Locale } from "@/lib/i18n/locales";
import { avatarPublicUrl } from "@/lib/uploads/media";

import { resolveDashboardHome } from "./dashboard-home";
import { getAuthState } from "./session";

/**
 * Everything the public header needs to render its account control, in one
 * serializable value.
 *
 * The header is statically rendered and cannot read the session, so a client
 * island fetches this from `/api/account/summary`. It is deliberately one
 * endpoint rather than one per control: the header shows both the account icon
 * and (for a dashboard user) the return-to-workspace link, and two islands each
 * asking the server about the same session would double the requests for one
 * answer.
 *
 * It carries only what the controls display — whether the visitor is signed in,
 * where their account lives, a display name, an avatar URL and the optional
 * dashboard destination — never the role or the memberships. Every field is a
 * plain string, boolean or null so it survives JSON without a translator or a
 * function crossing the boundary.
 */
export type AccountSummary = {
  signedIn: boolean;
  /** The customer account hub, localized. */
  accountHref: string;
  /** Display name for the avatar fallback; empty when signed out. */
  name: string;
  avatarUrl: string | null;
  /** The dashboard this account returns to, or null. */
  dashboard: { href: string; labelKey: string } | null;
};

export async function resolveAccountSummary(
  locale: Locale,
): Promise<AccountSummary> {
  const accountHref = `/${locale}/account`;
  const auth = await getAuthState();

  if (auth.status !== "authenticated") {
    return {
      signedIn: false,
      accountHref,
      name: "",
      avatarUrl: null,
      dashboard: null,
    };
  }

  const profile = auth.profile;

  return {
    signedIn: true,
    accountHref,
    name: profile?.fullName || auth.email || "",
    avatarUrl: avatarPublicUrl(profile?.avatarPath ?? null),
    dashboard: await resolveDashboardHome(locale),
  };
}
