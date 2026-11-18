import { redirect } from "next/navigation";

import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { PageIntro } from "@/components/ui/PageIntro";
import { getAuthState } from "@/lib/auth/session";
import { isRealEstateAdminRole } from "@/lib/auth/roles";
import { createTranslator } from "@/lib/i18n/translator";
import { LISTING_STATUSES } from "@/lib/real-estate/enums";
import { loadAdminListings } from "@/lib/real-estate/loaders";
import type { AdminListingRecord } from "@/lib/real-estate/types";

export const dynamic = "force-dynamic";

/**
 * Admin: the full listing table, searchable and status-filtered.
 *
 * The filter is a plain GET form, so it works without JavaScript and the applied
 * filters live in the URL — an operator can bookmark or share "the drafts" and a
 * back button returns to the previous filter state. The loader applies both
 * filters in the query rather than in memory, so a large portfolio is never
 * downloaded to the console.
 */
export default async function AdminListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
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

  const params = await searchParams;
  const search = params.q?.trim() ?? "";
  // Only a known status is applied; an unknown one is ignored rather than
  // forwarded to the query, where it would match nothing and read as an empty
  // portfolio instead of a bad filter.
  const status = LISTING_STATUSES.includes(
    params.status as (typeof LISTING_STATUSES)[number],
  )
    ? (params.status as (typeof LISTING_STATUSES)[number])
    : undefined;

  const listings = await loadAdminListings({
    status,
    search: search || undefined,
    limit: 200,
  });

  const filtered = Boolean(search || status);

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

      <form
        method="get"
        className="mt-8 flex flex-wrap items-end gap-4 rounded-card border border-border bg-surface p-4"
      >
        <div className="min-w-[16rem] flex-1">
          <label
            htmlFor="admin-listing-search"
            className="block text-sm font-medium text-ink-900"
          >
            {t("realEstate.admin.searchLabel")}
          </label>
          <input
            id="admin-listing-search"
            type="search"
            name="q"
            defaultValue={search}
            placeholder={t("realEstate.admin.searchPlaceholder")}
            className="mt-1 w-full rounded-field border border-border-strong bg-surface px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label
            htmlFor="admin-listing-status"
            className="block text-sm font-medium text-ink-900"
          >
            {t("realEstate.admin.statusFilterLabel")}
          </label>
          <select
            id="admin-listing-status"
            name="status"
            defaultValue={status ?? ""}
            className="mt-1 rounded-field border border-border-strong bg-surface px-3 py-2 text-sm"
          >
            <option value="">{t("realEstate.admin.allStatuses")}</option>
            {LISTING_STATUSES.map((value) => (
              <option key={value} value={value}>
                {t(`realEstate.statuses.${value}`)}
              </option>
            ))}
          </select>
        </div>

        <Button type="submit" variant="secondary">
          {t("realEstate.admin.applyFilters")}
        </Button>
        {filtered ? (
          <ButtonLink href="/admin/real-estate/listings" variant="ghost">
            {t("realEstate.admin.clearFilters")}
          </ButtonLink>
        ) : null}
      </form>

      {filtered ? (
        <p className="mt-4 text-sm text-muted" aria-live="polite">
          {t("realEstate.admin.resultsCount", {
            count: String(listings.length),
          })}
        </p>
      ) : null}

      <div className="mt-8">
        {listings.length === 0 ? (
          <Notice tone="info" title={t("realEstate.admin.listingsHeading")}>
            <p>
              {filtered
                ? t("realEstate.admin.noMatchingListings")
                : t("realEstate.admin.noListings")}
            </p>
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
