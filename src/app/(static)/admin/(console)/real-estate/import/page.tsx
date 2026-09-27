import { redirect } from "next/navigation";

import { ListingImportPanel } from "@/components/admin/ListingImportPanel";
import { ButtonLink } from "@/components/ui/Button";
import { PageIntro } from "@/components/ui/PageIntro";
import { getAuthState } from "@/lib/auth/session";
import { isRealEstateAdminRole } from "@/lib/auth/roles";
import { createTranslator } from "@/lib/i18n/translator";

export const dynamic = "force-dynamic";

/**
 * Admin: import listings from CSV.
 *
 * Every row an import writes is a draft, whatever the file says. An import is a
 * bulk data-entry convenience, and letting a spreadsheet publish a portfolio
 * unreviewed is the failure this design avoids — publishing stays a deliberate,
 * individual act.
 */
export default async function AdminImportPage() {
  const t = createTranslator("en").t;
  const state = await getAuthState();

  if (state.status === "unconfigured") {
    redirect("/admin/login?reason=unconfigured");
  }
  if (state.status !== "authenticated") {
    redirect("/admin/login?next=%2Fadmin%2Freal-estate%2Fimport");
  }
  if (!state.profile || !isRealEstateAdminRole(state.profile.role)) {
    redirect("/admin/unauthorized");
  }

  return (
    <>
      <PageIntro
        eyebrow={t("realEstate.eyebrow")}
        heading={t("realEstate.admin.importHeading")}
        intro={t("realEstate.admin.importIntro")}
      />

      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/admin/real-estate" variant="secondary">
          {t("realEstate.admin.heading")}
        </ButtonLink>
      </div>

      <div className="mt-10">
        <ListingImportPanel locale="en" />
      </div>
    </>
  );
}
