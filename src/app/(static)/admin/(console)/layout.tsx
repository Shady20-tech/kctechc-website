import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminUserMenu } from "@/components/admin/AdminUserMenu";
import { resolveAvatarUrl } from "@/components/admin/Avatar";
import { navSectionsForRole } from "@/lib/admin/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { createTranslator } from "@/lib/i18n/translator";

export const dynamic = "force-dynamic";

/**
 * The console shell.
 *
 * Every route in this group is internal, so this layout is the one place the
 * console authenticates: `requireAdmin` redirects an anonymous visitor to sign-in
 * and a signed-in non-admin to the access-denied page before any child renders.
 * Pages underneath still apply their own finer role checks — a real-estate page
 * narrows to the real-estate roles — but none of them has to establish that the
 * viewer is an admin at all.
 *
 * The shell owns the sidebar, the account menu and the page frame, so the console
 * pages render only their own content. The account menu carries the profile,
 * password and settings links plus sign-out; the sidebar carries the navigation
 * a role is entitled to. Both are built from `src/lib/admin/navigation.ts`.
 */
export default async function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireAdmin("/admin");
  const t = createTranslator("en").t;
  const sections = navSectionsForRole(profile.role);

  const labels: Record<string, string> = {
    consoleName: t("adminNav.consoleName"),
    sidebarLabel: t("adminNav.sidebarLabel"),
    openMenu: t("adminNav.openMenu"),
    closeMenu: t("adminNav.closeMenu"),
    accountMenu: t("adminNav.accountMenu"),
    profile: t("adminNav.profile"),
    settings: t("adminNav.settings"),
    password: t("adminNav.password"),
    signOut: t("adminNav.signOut"),
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
    labels[section.headingKey] = t(`adminNav.${section.headingKey}`);
    for (const item of section.items) {
      labels[item.labelKey] = t(`adminNav.${item.labelKey}`);
    }
  }

  const user = {
    name: profile.fullName ?? "",
    email: profile.email ?? "",
    role: profile.role,
    avatarUrl: resolveAvatarUrl(profile.avatarPath),
  };

  return (
    <div className="min-h-screen bg-surface-alt lg:flex">
      <AdminSidebar sections={sections} labels={labels} user={user} />

      <div className="min-w-0 flex-1">
        <header className="hidden items-center justify-end border-b border-border bg-surface px-8 py-3 lg:flex">
          <AdminUserMenu
            name={user.name}
            email={user.email}
            avatarUrl={user.avatarUrl}
            labels={{
              openMenu: t("adminNav.accountMenu"),
              profile: t("adminNav.profile"),
              settings: t("adminNav.settings"),
              password: t("adminNav.password"),
              signOut: t("adminNav.signOut"),
              menuLabel: t(`roleName.${profile.role}`),
            }}
          />
        </header>

        <main id="main" className="px-4 py-8 sm:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
