import { redirect } from "next/navigation";
import { Notice } from "@/components/ui/Notice";
import { PageIntro } from "@/components/ui/PageIntro";
import { getAuthState } from "@/lib/auth/session";
import { createTranslator } from "@/lib/i18n/translator";

/**
 * Admin dashboard entry point.
 *
 * Authorization is enforced here on the server via `getAuthState`, which reads
 * the role from the database. Hiding links in the UI is not a control.
 */
export default async function AdminDashboardPage() {
  const t = createTranslator("en").t;
  const state = await getAuthState();

  if (state.status === "unconfigured") {
    redirect("/admin/login?reason=unconfigured");
  }
  if (state.status !== "authenticated") {
    redirect("/admin/login?next=%2Fadmin");
  }

  const { profile } = state;

  return (
    <>
      <PageIntro
        heading={t("admin.dashboardHeading")}
        intro={t("admin.dashboardIntro")}
      />

      <div className="mt-8 max-w-2xl space-y-4">
        <Notice tone="info" title={t("admin.signedInHeading")}>
          <p>{t("auth.signedInAs", { email: state.email ?? "" })}</p>
          <p className="mt-1">
            {t("admin.roleLabel")}:{" "}
            <strong>{profile?.role ?? "customer"}</strong>
          </p>
        </Notice>

        <Notice tone="warning" title={t("admin.metaTitle")}>
          <p>{t("admin.phaseNotice")}</p>
        </Notice>
      </div>
    </>
  );
}
