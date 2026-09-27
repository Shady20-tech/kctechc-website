import { redirect } from "next/navigation";

import { ListingForm } from "@/components/admin/ListingForm";
import { Notice } from "@/components/ui/Notice";
import { PageIntro } from "@/components/ui/PageIntro";
import { getAuthState } from "@/lib/auth/session";
import { isRealEstateAdminRole } from "@/lib/auth/roles";
import { createTranslator } from "@/lib/i18n/translator";
import { loadGeographyOptions } from "@/lib/real-estate/loaders";

export const dynamic = "force-dynamic";

/**
 * Admin: create a listing.
 *
 * The geography options are loaded server-side and passed in whole. Loading them
 * in the browser would mean a second request the form has to wait on, and the
 * region list is small and cacheable — one page render is the simplest correct
 * arrangement.
 */
export default async function AdminNewListingPage() {
  const t = createTranslator("en").t;
  const state = await getAuthState();

  if (state.status === "unconfigured") {
    redirect("/admin/login?reason=unconfigured");
  }
  if (state.status !== "authenticated") {
    redirect("/admin/login?next=%2Fadmin%2Freal-estate%2Flistings%2Fnew");
  }
  if (!state.profile || !isRealEstateAdminRole(state.profile.role)) {
    redirect("/admin/unauthorized");
  }

  const geography = await loadGeographyOptions();

  return (
    <>
      <PageIntro
        eyebrow={t("realEstate.eyebrow")}
        heading={t("realEstate.admin.createHeading")}
        intro={t("realEstate.admin.createIntro")}
      />

      <div className="mt-8">
        {geography.length === 0 ? (
          // Without geography there is nothing a listing can attach to, and the
          // form would render a region select with no options. Saying so is
          // better than presenting a form that cannot be completed.
          <Notice tone="warning" title={t("realEstate.admin.metaTitle")}>
            <p>{t("realEstate.admin.errors.unconfigured")}</p>
          </Notice>
        ) : (
          <ListingForm locale="en" geography={geography} />
        )}
      </div>
    </>
  );
}
