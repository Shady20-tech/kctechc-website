import "server-only";

import type { Locale } from "@/lib/i18n/locales";
import { accessibleDashboards } from "@/lib/real-estate/dashboard";
import { loadMyMembershipSummary } from "@/lib/real-estate/membership-loaders";

import { isAdminRole } from "./roles";
import { getAuthState } from "./session";

/**
 * The workspace a signed-in account returns to from the public site.
 *
 * `href` is the destination and `labelKey` is a static message key the caller
 * translates, so this module holds no English text of its own.
 */
export type DashboardHome = { href: string; labelKey: string };

/**
 * Resolve the dashboard a signed-in account belongs to, or `null`.
 *
 * A signed-in *dashboard user* — a console role, or a customer holding an approved
 * landlord/agent capability — gets a link back to their workspace from the public
 * header. A plain customer gets `null`, so the header keeps offering the account
 * hub instead. That distinction is the requirement: an ordinary customer has no
 * dashboard to return to.
 *
 * The console wins when a caller is both staff and a capability holder. The
 * role-based console is the workspace their authorization is built around, and a
 * staff member who also lists a property reaches the capability dashboard from
 * their account page.
 *
 * The returned href is only a convenience: the destination re-checks the session,
 * the role and the capability on the server, so a tampered response cannot open a
 * page the caller is not entitled to.
 */
export async function resolveDashboardHome(
  locale: Locale,
): Promise<DashboardHome | null> {
  const auth = await getAuthState();
  if (auth.status !== "authenticated" || !auth.profile) return null;

  if (isAdminRole(auth.profile.role)) {
    return { href: "/admin", labelKey: "account.dashboards.returnToConsole" };
  }

  const memberships = await loadMyMembershipSummary();
  const kind = accessibleDashboards(memberships)[0];
  if (!kind) return null;

  return {
    href: `/${locale}/account/${kind}`,
    labelKey: `account.dashboards.${kind}.title`,
  };
}
