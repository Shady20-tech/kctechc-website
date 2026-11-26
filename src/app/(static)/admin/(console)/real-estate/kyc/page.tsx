import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { PageIntro } from "@/components/ui/PageIntro";
import { isKycReviewerRole } from "@/lib/auth/roles";
import { getAuthState } from "@/lib/auth/session";
import { createTranslator } from "@/lib/i18n/translator";
import {
  KYC_STATUSES,
  kycStatusLabelKey,
  type KycStatus,
} from "@/lib/real-estate/kyc";
import { loadKycQueueResult } from "@/lib/real-estate/kyc-loaders";

export const dynamic = "force-dynamic";

/**
 * Admin: the KYC review queue.
 *
 * **Super-admin only.** The brief requires that a normal real-estate
 * administrator must not hold KYC approval permission, so this page is not merely
 * hidden from them — the guard redirects them, and `loadKycQueueResult` reads through
 * the session client where `kyc_applications_select_super_admin` is the control.
 * A plain `real_estate_admin` reaching this URL sees the unauthorized page, and
 * would see no rows even if the guard were removed.
 *
 * `?status=` filters the queue; `?q=` searches name and email. Both are parsed
 * defensively so a hand-edited query string cannot reach the database as an
 * unvalidated filter.
 */
export default async function AdminKycQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const t = createTranslator("en").t;
  const state = await getAuthState();

  if (state.status === "unconfigured") {
    redirect("/login?reason=unconfigured");
  }
  if (state.status !== "authenticated") {
    redirect("/login?next=%2Fadmin%2Freal-estate%2Fkyc");
  }
  if (!state.profile || !isKycReviewerRole(state.profile.role)) {
    redirect("/admin/unauthorized");
  }

  const { status: rawStatus, q: rawSearch } = await searchParams;
  const status: KycStatus | "all" =
    rawStatus && (KYC_STATUSES as readonly string[]).includes(rawStatus)
      ? (rawStatus as KycStatus)
      : "all";
  const search = (rawSearch ?? "").slice(0, 120);

  const queueResult = await loadKycQueueResult({ status, search });
  const queue = queueResult.ok ? queueResult.data : [];

  const filters = ["all", ...KYC_STATUSES] as const;

  return (
    <>
      <PageIntro
        eyebrow={t("realEstate.eyebrow")}
        heading={t("adminKyc.heading")}
        intro={t("adminKyc.intro")}
        back={{
          href: "/admin/real-estate",
          label: t("common.backTo", { destination: t("adminNav.realEstate") }),
        }}
      />

      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/admin/real-estate" variant="secondary">
          {t("realEstate.admin.heading")}
        </ButtonLink>
      </div>

      <form className="mt-8 flex flex-wrap items-end gap-4" method="get">
        <div>
          <label htmlFor="q" className="block text-sm font-medium text-ink-900">
            {t("adminKyc.searchLabel")}
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={search}
            placeholder={t("adminKyc.searchPlaceholder")}
            className="mt-1 rounded-field border border-border-strong bg-surface px-3 py-2 text-sm text-body"
          />
        </div>
        <div>
          <label
            htmlFor="status"
            className="block text-sm font-medium text-ink-900"
          >
            {t("adminKyc.filterLabel")}
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status}
            className="mt-1 rounded-field border border-border-strong bg-surface px-3 py-2 text-sm text-body"
          >
            {filters.map((value) => (
              <option key={value} value={value}>
                {value === "all"
                  ? t("adminKyc.filterAll")
                  : t(kycStatusLabelKey(value))}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-control border border-border-strong bg-surface-alt px-4 py-2 text-sm font-medium text-body"
        >
          {t("adminKyc.apply")}
        </button>
      </form>

      <div className="mt-10">
        {!queueResult.ok ? (
          <Notice tone="warning" title={t("adminKyc.heading")}>
            <p>
              {queueResult.reason === "unconfigured"
                ? t("errors.unconfigured")
                : t("errors.read_failed")}
            </p>
            <p className="mt-2 break-words font-mono text-xs">
              {queueResult.detail}
            </p>
          </Notice>
        ) : queue.length === 0 ? (
          <Notice tone="info" title={t("adminKyc.heading")}>
            {t("adminKyc.empty")}
          </Notice>
        ) : (
          <ul className="flex flex-col gap-6">
            {queue.map((entry) => (
              <li key={entry.id}>
                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-ink-900">
                        {entry.fullLegalName}
                      </h2>
                      <p className="font-mono text-sm text-muted">
                        {entry.email}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="accent">
                        {t(
                          `account.membership.typeLabel.${entry.membershipType}`,
                        )}
                      </Badge>
                      <Badge tone="neutral">
                        {t(kycStatusLabelKey(entry.status))}
                      </Badge>
                    </div>
                  </div>

                  <p className="mt-3 font-mono text-xs text-muted">
                    {t("adminKyc.documents")}: {entry.documentCount}
                    {entry.submittedAt
                      ? ` · ${t("adminKyc.submittedAt")}: ${entry.submittedAt.slice(0, 10)}`
                      : ""}
                  </p>

                  <p className="mt-4">
                    <ButtonLink
                      href={`/admin/real-estate/kyc/${entry.id}`}
                      variant="secondary"
                      size="sm"
                    >
                      {t("adminKyc.openApplication")}
                    </ButtonLink>
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
