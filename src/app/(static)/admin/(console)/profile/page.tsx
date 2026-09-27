import { AvatarForm } from "@/components/admin/AvatarForm";
import { PasswordForm } from "@/components/admin/PasswordForm";
import { ProfileDetailsForm } from "@/components/admin/ProfileDetailsForm";
import { resolveAvatarUrl } from "@/components/admin/Avatar";
import { Card } from "@/components/ui/Card";
import { PageIntro } from "@/components/ui/PageIntro";
import { requireAdmin } from "@/lib/auth/guards";
import { adminTranslator } from "@/lib/admin/labels";

export const dynamic = "force-dynamic";

/** Admin: self-service profile, picture and password. */
export default async function AdminProfilePage() {
  const profile = await requireAdmin("/admin/profile");
  const { t } = adminTranslator("adminProfile");

  const roleLabels: Record<string, string> = {
    "role.super_admin": t("roleName.super_admin"),
    "role.real_estate_admin": t("roleName.real_estate_admin"),
    "role.real_estate_agent": t("roleName.real_estate_agent"),
    "role.digital_marketing_admin": t("roleName.digital_marketing_admin"),
    "role.digital_marketing_staff": t("roleName.digital_marketing_staff"),
    "role.electrical_admin": t("roleName.electrical_admin"),
    "role.electrical_staff": t("roleName.electrical_staff"),
    "role.department_staff": t("roleName.department_staff"),
    "role.customer": t("roleName.customer"),
  };

  const detailsLabels = {
    detailsHeading: t("adminProfile.detailsHeading"),
    detailsIntro: t("adminProfile.detailsIntro"),
    nameLabel: t("adminProfile.nameLabel"),
    nameHint: t("adminProfile.nameHint"),
    emailLabel: t("adminProfile.emailLabel"),
    emailHint: t("adminProfile.emailHint"),
    phoneLabel: t("adminProfile.phoneLabel"),
    phoneHint: t("adminProfile.phoneHint"),
    localeLabel: t("adminProfile.localeLabel"),
    roleLabel: t("adminProfile.roleLabel"),
    save: t("adminProfile.save"),
    saving: t("adminProfile.saving"),
    updated: t("adminProfile.updated"),
    ...roleLabels,
    "errors.update_failed": t("adminProfile.errors.update_failed"),
    "errors.unauthenticated": t("adminProfile.errors.unauthenticated"),
    "errors.unconfigured": t("adminProfile.errors.unconfigured"),
    "errors.invalid_locale": t("adminProfile.errors.invalid_locale"),
    "errors.name_too_long": t("adminProfile.errors.name_too_long"),
    "errors.phone_too_long": t("adminProfile.errors.phone_too_long"),
  };

  const avatarLabels = {
    avatarHeading: t("adminProfile.avatarHeading"),
    avatarIntro: t("adminProfile.avatarIntro"),
    avatarChoose: t("adminProfile.avatarChoose"),
    avatarUpload: t("adminProfile.avatarUpload"),
    avatarUploading: t("adminProfile.avatarUploading"),
    avatarRemove: t("adminProfile.avatarRemove"),
    avatarUpdated: t("adminProfile.avatarUpdated"),
    "errors.no_file": t("adminProfile.errors.no_file"),
    "errors.empty": t("adminProfile.errors.empty"),
    "errors.too_large": t("adminProfile.errors.too_large"),
    "errors.type_not_allowed": t("adminProfile.errors.type_not_allowed"),
    "errors.unknown_type": t("adminProfile.errors.unknown_type"),
    "errors.rate_limited": t("adminProfile.errors.rate_limited"),
    "errors.upload_failed": t("adminProfile.errors.upload_failed"),
    "errors.update_failed": t("adminProfile.errors.update_failed"),
    "errors.unauthenticated": t("adminProfile.errors.unauthenticated"),
    "errors.unconfigured": t("adminProfile.errors.unconfigured"),
  };

  const passwordLabels = {
    passwordHeading: t("adminProfile.passwordHeading"),
    passwordIntro: t("adminProfile.passwordIntro"),
    newPasswordLabel: t("adminProfile.newPasswordLabel"),
    confirmPasswordLabel: t("adminProfile.confirmPasswordLabel"),
    updatePassword: t("adminProfile.updatePassword"),
    updatingPassword: t("adminProfile.updatingPassword"),
    passwordUpdated: t("adminProfile.passwordUpdated"),
    "errors.password_too_short": t("adminProfile.errors.password_too_short"),
    "errors.password_mismatch": t("adminProfile.errors.password_mismatch"),
    "errors.password_failed": t("adminProfile.errors.password_failed"),
    "errors.unauthenticated": t("adminProfile.errors.unauthenticated"),
    "errors.unconfigured": t("adminProfile.errors.unconfigured"),
  };

  return (
    <>
      <PageIntro
        eyebrow={t("adminNav.profile")}
        heading={t("adminProfile.heading")}
        intro={t("adminProfile.intro")}
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <ProfileDetailsForm profile={profile} labels={detailsLabels} />
        </Card>

        <div className="space-y-6">
          <Card>
            <AvatarForm
              currentUrl={resolveAvatarUrl(profile.avatarPath)}
              name={profile.fullName || profile.email || ""}
              labels={avatarLabels}
            />
          </Card>

          <Card>
            <PasswordForm labels={passwordLabels} />
          </Card>
        </div>
      </div>
    </>
  );
}
