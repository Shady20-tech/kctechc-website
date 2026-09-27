import { Avatar, resolveAvatarUrl } from "@/components/admin/Avatar";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageIntro } from "@/components/ui/PageIntro";
import { requireAdmin } from "@/lib/auth/guards";
import { createTranslator } from "@/lib/i18n/translator";

export const dynamic = "force-dynamic";

/**
 * Admin: settings.
 *
 * Deliberately short. The console's configurable surface is a person's own
 * account, which lives on the profile page, and the site-wide settings that are
 * read from the environment at boot and are not editable at runtime. Rendering
 * empty toggles here would imply a control that does not exist, so each section
 * states where the thing is actually set.
 */
export default async function AdminSettingsPage() {
  const profile = await requireAdmin("/admin/settings");
  const t = createTranslator("en").t;

  return (
    <>
      <PageIntro
        eyebrow={t("adminNav.settings")}
        heading={t("adminSettings.heading")}
        intro={t("adminSettings.intro")}
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card as="section">
          <h2 className="text-lg font-semibold text-ink-900">
            {t("adminSettings.accountHeading")}
          </h2>
          <p className="mt-1 text-sm text-body">
            {t("adminSettings.accountIntro")}
          </p>
          <div className="mt-4 flex items-center gap-4">
            <Avatar
              src={resolveAvatarUrl(profile.avatarPath)}
              name={profile.fullName || profile.email || ""}
              size="md"
            />
            <div>
              <p className="font-medium text-ink-900">
                {profile.fullName || profile.email}
              </p>
              <p className="text-sm text-muted">{t(`roleName.${profile.role}`)}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <ButtonLink href="/admin/profile" variant="primary" size="sm">
              {t("adminSettings.accountLink")}
            </ButtonLink>
            <ButtonLink href="/admin/profile" variant="ghost" size="sm">
              {t("adminNav.password")}
            </ButtonLink>
          </div>
        </Card>

        <Card as="section">
          <h2 className="text-lg font-semibold text-ink-900">
            {t("adminSettings.appearanceHeading")}
          </h2>
          <p className="mt-1 text-sm text-body">
            {t("adminSettings.appearanceIntro")}
          </p>
          <p className="mt-4 text-sm text-muted">
            {profile.locale === "fr" ? "Français" : "English"}
          </p>
        </Card>

        <Card as="section">
          <h2 className="text-lg font-semibold text-ink-900">
            {t("adminSettings.systemHeading")}
          </h2>
          <p className="mt-1 text-sm text-body">{t("adminSettings.systemIntro")}</p>
        </Card>

        <Card as="section">
          <h2 className="text-lg font-semibold text-ink-900">
            {t("adminSettings.integrationsHeading")}
          </h2>
          <p className="mt-1 text-sm text-body">
            {t("adminSettings.integrationsIntro")}
          </p>
        </Card>
      </div>
    </>
  );
}
