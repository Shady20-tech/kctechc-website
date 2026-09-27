import { redirect } from "next/navigation";

import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeading } from "@/components/ui/Card";
import { PageIntro } from "@/components/ui/PageIntro";
import { Notice } from "@/components/ui/Notice";
import { getAuthState } from "@/lib/auth/session";
import { isRealEstateAdminRole } from "@/lib/auth/roles";
import { createTranslator } from "@/lib/i18n/translator";
import {
  loadAdminListings,
  loadRealEstateOverview,
} from "@/lib/real-estate/loaders";
import type { AdminListingRecord } from "@/lib/real-estate/types";

export const dynamic = "force-dynamic";

/**
 * Admin: real-estate console.
 *
 * The entry point of the department's internal area. The overview counts, the
 * listing table and the routes into submissions and import all sit here so an
 * operator arriving at `/admin/real-estate` has the portfolio in front of them
 * rather than a menu they have to navigate before seeing anything.
 *
 * Authorization mirrors the other admin routes: checked on the server, and again
 * in every action. Hiding a link is not a control.
 */
export default async function AdminRealEstatePage() {
  const t = createTranslator("en").t;
  const state = await getAuthState();

  if (state.status === "unconfigured") {
    redirect("/admin/login?reason=unconfigured");
  }
  if (state.status !== "authenticated") {
    redirect("/admin/login?next=%2Fadmin%2Freal-estate");
  }
  if (!state.profile || !isRealEstateAdminRole(state.profile.role)) {
    redirect("/admin/unauthorized");
  }

  const [overview, listings] = await Promise.all([
    loadRealEstateOverview(),
    loadAdminListings({ limit: 25 }),
  ]);

  return (
    <>
      <PageIntro
        eyebrow={t("realEstate.eyebrow")}
        heading={t("realEstate.admin.heading")}
        intro={t("realEstate.admin.intro")}
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            ["overviewTotal", overview.total],
            ["overviewDrafts", overview.drafts],
            ["overviewPendingReview", overview.pendingReview],
            ["overviewPublished", overview.published],
            ["overviewArchived", overview.archived],
            ["overviewSubmissions", overview.pendingSubmissions],
            ["overviewAgents", overview.activeAgents],
          ] as const
        ).map(([key, value]) => (
          <Card key={key}>
            <p className="text-sm text-muted">
              {t(`realEstate.admin.${key}`)}
            </p>
            <p className="mt-2 font-display text-3xl font-bold text-ink-900">
              {value}
            </p>
          </Card>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink
          href="/admin/real-estate/listings/new"
          variant="primary"
        >
          {t("realEstate.admin.createHeading")}
        </ButtonLink>
        <ButtonLink href="/admin/real-estate/submissions" variant="secondary">
          {t("realEstate.admin.navSubmissions")}
        </ButtonLink>
        <ButtonLink href="/admin/real-estate/import" variant="secondary">
          {t("realEstate.admin.navImport")}
        </ButtonLink>
      </div>

      <section className="mt-12">
        <CardHeading>{t("realEstate.admin.listingsHeading")}</CardHeading>
        <p className="mt-2 max-w-3xl text-sm text-body">
          {t("realEstate.admin.listingsIntro")}
        </p>

        <div className="mt-6">
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
                  render: (row) => (
                    <span className="font-mono">{row.reference}</span>
                  ),
                },
                {
                  key: "title",
                  header: t("realEstate.admin.fieldTitle"),
                  render: (row) => row.title,
                },
                {
                  key: "status",
                  header: t("realEstate.listing.statusLabel"),
                  render: (row) => (
                    <Badge>{t(`realEstate.statuses.${row.status}`)}</Badge>
                  ),
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
      </section>
    </>
  );
}
