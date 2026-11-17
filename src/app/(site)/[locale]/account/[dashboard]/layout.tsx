import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { resolveAvatarUrl } from "@/components/admin/Avatar";
import { DashboardShell } from "@/components/account/DashboardShell";
import { getAuthState } from "@/lib/auth/session";
import { isLocale, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { isDashboardKind } from "@/lib/real-estate/dashboard";
import { dashboardNavSections } from "@/lib/real-estate/dashboard-nav";

/**
 * The shared shell for the landlord and agent dashboards.
 *
 * It renders the admin-console-style sidebar these dashboards were asked to match,
 * and it is the one place the two dashboards authenticate: an anonymous visitor is
 * sent to sign-in with the dashboard as the return target before any child
 * renders. It does NOT decide capability — whether the viewer actually holds the
 * landlord or agent capability is the page's guard, because a viewer whose
 * application is pending must still reach the dashboard and see the verification
 * panel rather than be bounced to the account page.
 *
 * The dynamic `[dashboard]` segment resolves to a kind or 404s, so a guessed
 * `/account/anything` is a not-found rather than a shell wrapping nothing. Static
 * siblings under `/account` — `kyc` — win over this dynamic segment and are
 * unaffected.
 *
 * `force-dynamic` because the shell reads the session cookie; prerendering it
 * would bake in the signed-out redirect and serve it to everyone.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  // The private dashboards are `noindex` at the page level; this is a belt-and-
  // braces guard for any future child route that forgets to set it.
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string; dashboard: string }>;
}) {
  const { locale, dashboard } = await params;
  if (!isLocale(locale)) notFound();
  if (!isDashboardKind(dashboard)) notFound();

  const resolved: Locale = locale;
  const returnTo = encodeURIComponent(`/${resolved}/account/${dashboard}`);

  const state = await getAuthState();
  if (state.status === "unconfigured") {
    redirect(`/admin/login?reason=unconfigured&next=${returnTo}`);
  }
  if (state.status !== "authenticated") {
    redirect(`/admin/login?next=${returnTo}`);
  }

  const t = createTranslator(resolved).t;
  const sections = dashboardNavSections(dashboard, resolved);

  const labels: Record<string, string> = {
    consoleName: t(`account.dashboards.${dashboard}.title`),
    sidebarLabel: t("account.dashboards.nav.sidebarLabel"),
    openMenu: t("account.dashboards.nav.openMenu"),
    closeMenu: t("account.dashboards.nav.closeMenu"),
    yourAccount: t("account.dashboards.nav.yourAccount"),
    signOut: t("account.dashboards.nav.signOut"),
  };
  for (const role of [
    "super_admin",
    "real_estate_admin",
    "real_estate_agent",
    "digital_marketing_admin",
    "digital_marketing_staff",
    "electrical_admin",
    "electrical_staff",
    "department_staff",
    "customer",
  ]) {
    labels[`role.${role}`] = t(`roleName.${role}`);
  }
  for (const section of sections) {
    labels[section.headingKey] = t(
      `account.dashboards.navSections.${section.headingKey}`,
    );
    for (const item of section.items) {
      labels[item.labelKey] = t(`account.dashboards.nav.${item.labelKey}`);
    }
  }

  const user = {
    name: state.profile?.fullName ?? "",
    email: state.email ?? "",
    role: state.profile?.role ?? "customer",
    avatarUrl: resolveAvatarUrl(state.profile?.avatarPath),
  };

  return (
    <DashboardShell
      sections={sections}
      labels={labels}
      user={user}
      locale={resolved}
      kind={dashboard}
    >
      {children}
    </DashboardShell>
  );
}
