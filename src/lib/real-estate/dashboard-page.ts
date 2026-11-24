import "server-only";

import { redirect } from "next/navigation";

import { getAuthState } from "@/lib/auth/session";
import type { Locale } from "@/lib/i18n/locales";

import type { DashboardKind } from "./dashboard";
import {
  loadDashboardContext,
  type DashboardContext,
} from "./dashboard-loaders";

/**
 * The page guard every dashboard route shares.
 *
 * A signed-out visitor is sent to sign-in with the dashboard as the return
 * target; an authenticated user who holds no capability row is sent back to the
 * account page, where the capability cards live and where the apply affordance is.
 * A user whose application is still pending is *not* redirected — the dashboard
 * renders the verification panel instead, because sending them to the account page
 * would lose the context they clicked through for.
 *
 * This guard is the experience, not the control: the listings a dashboard reads are
 * scoped by RLS, so a user who reached the page without the capability would still
 * see nothing. That split is deliberate and documented at the loaders.
 */
export async function requireDashboardContext(
  kind: DashboardKind,
  locale: Locale,
): Promise<DashboardContext> {
  const auth = await getAuthState();
  const returnTo = encodeURIComponent(`/${locale}/account/${kind}`);

  if (auth.status === "unconfigured") {
    redirect(`/login?reason=unconfigured&next=${returnTo}`);
  }
  if (auth.status !== "authenticated") {
    redirect(`/login?next=${returnTo}`);
  }

  const context = await loadDashboardContext(kind);
  if (!context) redirect(`/${locale}/account`);

  return context;
}

/**
 * Whether a dashboard route should be reachable for the caller.
 *
 * Used by the create and detail routes, which need the capability before they load
 * anything else. Returns the context so the caller does not load it twice.
 */
export async function requireAuthorisedDashboard(
  kind: DashboardKind,
  locale: Locale,
): Promise<DashboardContext> {
  const context = await requireDashboardContext(kind, locale);
  if (!context.authorised) {
    redirect(`/${locale}/account/${kind}`);
  }
  return context;
}
