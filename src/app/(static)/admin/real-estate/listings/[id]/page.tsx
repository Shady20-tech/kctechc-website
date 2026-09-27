import { notFound, redirect } from "next/navigation";

import { ListingForm } from "@/components/admin/ListingForm";
import { ListingStatusForm } from "@/components/admin/ListingStatusForm";
import { PageIntro } from "@/components/ui/PageIntro";
import { getAuthState } from "@/lib/auth/session";
import { isRealEstateAdminRole } from "@/lib/auth/roles";
import { createTranslator } from "@/lib/i18n/translator";
import {
  loadAdminListingById,
  loadGeographyOptions,
} from "@/lib/real-estate/loaders";

export const dynamic = "force-dynamic";

/**
 * Admin: edit a listing.
 *
 * Guarded by `isRealEstateAdminRole`, the same check the actions themselves
 * apply. An agent manages only their own listings and reaches them through the
 * department surface, so admitting them here would render a form whose submit is
 * always refused. The RLS policies still decide which rows an administrator can
 * actually read, so a cross-tenant edit attempt fails as a 404 rather than a
 * permission error that would confirm the row exists.
 */
export default async function AdminEditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = createTranslator("en").t;
  const state = await getAuthState();

  if (state.status === "unconfigured") {
    redirect("/admin/login?reason=unconfigured");
  }
  if (state.status !== "authenticated") {
    redirect(`/admin/login?next=${encodeURIComponent(`/admin/real-estate/listings/${id}`)}`);
  }
  if (!state.profile || !isRealEstateAdminRole(state.profile.role)) {
    redirect("/admin/unauthorized");
  }

  const [listing, geography] = await Promise.all([
    loadAdminListingById(id),
    loadGeographyOptions(),
  ]);

  if (!listing) notFound();

  return (
    <>
      <PageIntro
        eyebrow={t("realEstate.eyebrow")}
        heading={t("realEstate.admin.editHeading")}
        intro={t("realEstate.admin.editIntro")}
      />

      <p className="mt-4 font-mono text-sm text-muted">
        {t("realEstate.listing.referenceLabel")}: {listing.reference}
      </p>

      <div className="mt-8 space-y-12">
        <ListingForm locale="en" geography={geography} listing={listing} />

        <section className="border-t border-border pt-10">
          <h2 className="font-display text-xl font-bold text-ink-900">
            {t("realEstate.admin.statusHeading")}
          </h2>
          <div className="mt-4">
            <ListingStatusForm
              listingId={listing.id}
              currentStatus={listing.status}
              locale="en"
            />
          </div>
        </section>
      </div>
    </>
  );
}
