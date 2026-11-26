import { redirect } from "next/navigation";

import { ListingForm } from "@/components/admin/ListingForm";
import { Notice } from "@/components/ui/Notice";
import { PageIntro } from "@/components/ui/PageIntro";
import { getAuthState } from "@/lib/auth/session";
import { isRealEstateAdminRole } from "@/lib/auth/roles";
import { createTranslator } from "@/lib/i18n/translator";
import { loadGeographyOptionsResult } from "@/lib/real-estate/loaders";

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
    redirect("/login?reason=unconfigured");
  }
  if (state.status !== "authenticated") {
    redirect("/login?next=%2Fadmin%2Freal-estate%2Flistings%2Fnew");
  }
  if (!state.profile || !isRealEstateAdminRole(state.profile.role)) {
    redirect("/admin/unauthorized");
  }

  const geographyResult = await loadGeographyOptionsResult("admin");
  const geography = geographyResult.ok ? geographyResult.data : [];

  let problem: { body: string; detail?: string } | null = null;
  if (!geographyResult.ok) {
    problem = {
      body:
        geographyResult.reason === "unconfigured"
          ? t("realEstate.admin.errors.unconfigured")
          : t("errors.read_failed"),
      detail: geographyResult.detail,
    };
  } else if (geography.length === 0) {
    // An empty reference table is not a configuration failure: the database
    // answered, it simply has no regions. Saying "not configured" sent operators
    // to the environment when the fix is the geography seed.
    problem = { body: t("errors.geography_empty") };
  }

  return (
    <>
      <PageIntro
        eyebrow={t("realEstate.eyebrow")}
        heading={t("realEstate.admin.createHeading")}
        intro={t("realEstate.admin.createIntro")}
        back={{
          href: "/admin/real-estate/listings",
          label: t("common.backTo", { destination: t("adminNav.listings") }),
        }}
      />

      <div className="mt-8">
        {problem ? (
          <Notice tone="warning" title={t("realEstate.admin.metaTitle")}>
            <p>{problem.body}</p>
            {problem.detail ? (
              <p className="mt-2 break-words font-mono text-xs">
                {problem.detail}
              </p>
            ) : null}
          </Notice>
        ) : (
          <ListingForm locale="en" geography={geography} />
        )}
      </div>
    </>
  );
}
