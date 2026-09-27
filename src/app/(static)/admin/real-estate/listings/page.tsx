import { redirect } from "next/navigation";

import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { PageIntro } from "@/components/ui/PageIntro";
import { getAuthState } from "@/lib/auth/session";
import { isRealEstateAdminRole } from "@/lib/auth/roles";
import { createTranslator } from "@/lib/i18n/translator";
import { loadAdminListings } from "@/lib/real-estate/loaders";
import type { AdminListingRecord } from "@/lib/real-estate/types";

export const dynamic = "force-dynamic";

/** Admin: the full listing table. */
export default async function AdminListingsPage() {
  const t = createTranslator("en").t;
  const state = await getAuthState();

  if (state.status === "unconfigured") {
    redirect("/admin/login?reason=unconfigured");
  }
  if (state.status !== "authenticated") {
    redirect("/admin/login?next=%2Fadmin%2Freal-estate%2Flistings");
  }
  if (!state.profile || !isRealEstateAdminRole(state.profile.role)) {
    redirect("/admin/unauthorized");
  }

  const listings = await loadAdminListings({ limit: 200 });

  return (
    <>
      <PageIntro
        eyebrow={t("realEstate.eyebrow")}
        heading={t("realEstate.admin.listingsHeading")}
        intro={t("realEstate.admin.listingsIntro")}
      />

      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/admin/real-estate/listings/new" variant="primary">
          {t("realEstate.admin.createHeading")}
        </ButtonLink>
        <ButtonLink href="/admin/real-estate" variant="secondary">
          {t("realEstate.admin.heading")}
        </ButtonLink>
      </div>

      <div className="mt-8">
        {listings.length === 0 ? (
          <Notice tone="info" title={t("realEstate.admin.listingsHeading")}>
            <p>{t("realEstate.admin.noListings")}</p>
          </Notice>
        ) : (
          <DataTable<AdminListingRecord>
            caption={t("realEstate.admin.listingsHeading")}
            columns={[
              {
                key: "reference",
                header: t("realEstate.listing.referenceLabel"),
                render: (row) => <span className="font-mono">{row.reference}</span>,
              },
              {
                key: "title",
                header: t("realEstate.admin.fieldTitle"),
                render: (row) => row.title,
              },
              {
                key: "status",
                header: t("realEstate.listing.statusLabel"),
                render: (row) => <Badge>{t(`realEstate.statuses.${row.status}`)}</Badge>,
              },
              {
                key: "type",
                header: t("realEstate.listing.typeLabel"),
                render: (row) => t(`realEstate.types.${row.listingType}`),
              },
              {
                key: "region",
                header: t("realEstate.listing.regionLabel"),
                render: (row) => row.regionName,
              },
              {
                key: "actions",
                header: t("realEstate.admin.openListing"),
                render: (row) => (
                  <ButtonLink
                    href={`/admin/real-estate/listings/${row.id}`}
                    variant="secondary"
                    size="sm"
                  >
                    {t("realEstate.admin.openListing")}
                  </ButtonLink>
                ),
              },
            ]}
            rows={listings}
            getRowKey={(row) => row.id}
            emptyMessage={t("realEstate.admin.noListings")}
            rowHeaderKey="title"
            scrollLabel={t("realEstate.admin.listingsHeading")}
          />
        )}
      </div>
    </>
  );
}
