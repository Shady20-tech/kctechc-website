import Link from "next/link";

import { Avatar, resolveAvatarUrl } from "@/components/admin/Avatar";
import { Card } from "@/components/ui/Card";
import { PageIntro } from "@/components/ui/PageIntro";
import { navItemsForRole, navSectionsForRole } from "@/lib/admin/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { createTranslator } from "@/lib/i18n/translator";

export const dynamic = "force-dynamic";

/**
 * Admin dashboard entry point.
 *
 * The cards are not a hand-written list: they are the same navigation model the
 * sidebar renders, filtered to the viewer's role. A route therefore cannot appear
 * in the sidebar without also appearing here, and a user never sees a card leading
 * somewhere they may not go — the filtering reads the database role through
 * `requireAdmin`, and each destination re-checks on its own request.
 */
export default async function AdminDashboardPage() {
  const profile = await requireAdmin("/admin");
  const t = createTranslator("en").t;
  const items = navItemsForRole(profile.role);
  const sections = navSectionsForRole(profile.role);
  const displayName = profile.fullName || profile.email || "";

  return (
    <>
      <PageIntro
        eyebrow={t("adminNav.consoleName")}
        heading={t("adminDashboard.heading")}
        intro={t("adminDashboard.intro")}
      />

      <div className="mt-8 flex items-center gap-4 rounded-card border border-border bg-surface p-5">
        <Avatar
          src={resolveAvatarUrl(profile.avatarPath)}
          name={displayName}
          size="md"
        />
        <div>
          <p className="text-sm text-muted">
            {t("adminDashboard.welcome", { name: displayName })}
          </p>
          <p className="mt-1 font-medium text-ink-900">
            {t("adminDashboard.roleLabel")}: {t(`roleName.${profile.role}`)}
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="mt-8 text-sm text-muted">{t("adminDashboard.noAccess")}</p>
      ) : (
        <div className="mt-8 space-y-8">
          {sections.map((section) => (
            <section key={section.headingKey}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
                {t(`adminNav.${section.headingKey}`)}
              </h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="group flex items-start gap-4 rounded-card border border-border bg-surface p-5 shadow-card transition-soft hover:border-border-strong hover:shadow-raised"
                    >
                      <span className="rounded-card bg-surface-alt p-2 text-dept-accent">
                        <Icon aria-hidden="true" className="h-5 w-5" />
                      </span>
                      <span>
                        <span className="block font-semibold text-ink-900">
                          {t(`adminNav.${item.labelKey}`)}
                        </span>
                        <span className="mt-1 block text-sm text-muted">
                          {t("adminDashboard.open")} →
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <Card className="mt-8">
        <h2 className="text-lg font-semibold text-ink-900">
          {t("adminDashboard.quickActions")}
        </h2>
        <ul className="mt-3 flex flex-wrap gap-3 text-sm">
          {items.slice(0, 5).map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="rounded-pill border border-border-strong px-3 py-1 text-body hover:border-dept-accent hover:text-dept-accent"
              >
                {t(`adminNav.${item.labelKey}`)}
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
