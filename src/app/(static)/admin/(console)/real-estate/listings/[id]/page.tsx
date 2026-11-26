import { notFound, redirect } from "next/navigation";

import { ListingForm } from "@/components/admin/ListingForm";
import { ListingLifecycleForm } from "@/components/admin/ListingLifecycleForm";
import { ListingMediaForm } from "@/components/admin/ListingMediaForm";
import { ListingStatusForm } from "@/components/admin/ListingStatusForm";
import { Notice } from "@/components/ui/Notice";
import { PageIntro } from "@/components/ui/PageIntro";
import { getAuthState } from "@/lib/auth/session";
import { isRealEstateAdminRole, isSuperAdminRole } from "@/lib/auth/roles";
import { createTranslator } from "@/lib/i18n/translator";
import {
  loadAdminListingByIdResult,
  loadGeographyOptionsResult,
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
    redirect("/login?reason=unconfigured");
  }
  if (state.status !== "authenticated") {
    redirect(
      `/login?next=${encodeURIComponent(`/admin/real-estate/listings/${id}`)}`,
    );
  }
  if (!state.profile || !isRealEstateAdminRole(state.profile.role)) {
    redirect("/admin/unauthorized");
  }

  const [listingResult, geographyResult] = await Promise.all([
    loadAdminListingByIdResult(id, "admin"),
    loadGeographyOptionsResult("admin"),
  ]);

  const listing = listingResult.ok ? listingResult.data : null;
  const geography = geographyResult.ok ? geographyResult.data : [];
  const geographyProblem = !geographyResult.ok
    ? {
        body:
          geographyResult.reason === "unconfigured"
            ? t("realEstate.admin.errors.unconfigured")
            : t("errors.read_failed"),
        detail: geographyResult.detail,
      }
    : geography.length === 0
      ? { body: t("errors.geography_empty") }
      : null;

  if (!listingResult.ok) {
    return (
      <>
        <PageIntro
          eyebrow={t("realEstate.eyebrow")}
          heading={t("realEstate.admin.editHeading")}
          intro={t("realEstate.admin.editIntro")}
          back={{
            href: "/admin/real-estate/listings",
            label: t("common.backTo", { destination: t("adminNav.listings") }),
          }}
        />
        <div className="mt-8">
          <Notice tone="warning" title={t("realEstate.admin.metaTitle")}>
            <p>
              {listingResult.reason === "unconfigured"
                ? t("realEstate.admin.errors.unconfigured")
                : t("errors.read_failed")}
            </p>
            <p className="mt-2 break-words font-mono text-xs">
              {listingResult.detail}
            </p>
          </Notice>
        </div>
      </>
    );
  }

  if (!listing) notFound();

  const labels: Record<string, string> = {
    imagesHeading: t("realEstate.admin.imagesHeading"),
    imagesIntro: t("realEstate.admin.imagesIntro"),
    imageUpload: t("realEstate.admin.imageUpload"),
    imageUploading: t("realEstate.admin.imageUploading"),
    imageAdded: t("realEstate.admin.imageAdded"),
    imageAddedPartial: t("realEstate.admin.imageAddedPartial"),
    imageUploadMultipleHint: t("realEstate.admin.imageUploadMultipleHint"),
    imageRemove: t("realEstate.admin.imageRemove"),
    noImagesYet: t("realEstate.admin.noImagesYet"),
    primaryBadge: t("realEstate.admin.primaryBadge"),
    positionLabel: t("realEstate.admin.positionLabel"),
    altLabel: t("realEstate.admin.altLabel"),
    altPlaceholder: t("realEstate.admin.altPlaceholder"),
    altHint: t("realEstate.admin.altHint"),
    imagesLimitHint: t("realEstate.admin.imagesLimitHint"),
    saving: t("adminContent.saving"),
  };
  for (const key of [
    "unauthenticated",
    "forbidden",
    "unconfigured",
    "not_found",
    "no_file",
    "alt_required",
    "upload_failed",
    "write_failed",
    "too_large",
    "type_not_allowed",
    "unknown_type",
  ]) {
    labels[`errors.${key}`] = t(`realEstate.admin.errors.${key}`);
  }

  return (
    <>
      <PageIntro
        eyebrow={t("realEstate.eyebrow")}
        heading={t("realEstate.admin.editHeading")}
        intro={t("realEstate.admin.editIntro")}
        back={{
          href: "/admin/real-estate/listings",
          label: t("common.backTo", { destination: t("adminNav.listings") }),
        }}
      />

      <p className="mt-4 font-mono text-sm text-muted">
        {t("realEstate.listing.referenceLabel")}: {listing.reference}
      </p>

      <div className="mt-8 space-y-12">
        {geographyProblem ? (
          <Notice tone="warning" title={t("realEstate.admin.metaTitle")}>
            <p>{geographyProblem.body}</p>
            {geographyProblem.detail ? (
              <p className="mt-2 break-words font-mono text-xs">
                {geographyProblem.detail}
              </p>
            ) : null}
          </Notice>
        ) : (
          <ListingForm locale="en" geography={geography} listing={listing} />
        )}

        <section className="border-t border-border pt-10">
          <ListingMediaForm
            listingId={listing.id}
            images={listing.images}
            labels={labels}
          />
        </section>

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

        <section className="border-t border-border pt-10">
          <ListingLifecycleForm
            listingId={listing.id}
            currentStatus={listing.status}
            canDelete={isSuperAdminRole(state.profile.role)}
            locale="en"
          />
        </section>
      </div>
    </>
  );
}
