import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import {
  capabilityIsWithReviewer,
  capabilityNeedsApplicantAction,
  type DashboardKind,
  moderationState,
} from "@/lib/real-estate/dashboard";
import type { DashboardListing } from "@/lib/real-estate/dashboard-loaders";
import {
  membershipStatusLabelKey,
  type MembershipSummary,
} from "@/lib/real-estate/memberships";
import { formatPrice } from "@/lib/store/types";

/**
 * Shared presentational pieces for the landlord and agent dashboards.
 *
 * These are Server Components, so they call the translator directly rather than
 * receiving a label map — the restriction on passing a translator applies to the
 * Client boundary, not here, and a server component that translated via a map
 * would be a hand-maintained copy of the message file.
 *
 * The two dashboards differ in what a listing *means* to the viewer (owned vs
 * managed) and in whether there is a public profile to maintain, not in how a
 * listing row or a review state is rendered. Sharing these keeps the two surfaces
 * from drifting into two slightly different ways of showing "awaiting review".
 */

/**
 * The panel shown when the capability is not yet approved.
 *
 * Three states, because the user's next action differs: never applied (offer the
 * application), awaiting us (explain the wait), and sent back (point at the
 * reason). A single "not approved" panel would leave the user unable to tell
 * whether to act or to wait.
 */
export function CapabilityGatePanel({
  summary,
  locale,
}: {
  summary: MembershipSummary;
  locale: Locale;
}) {
  const t = createTranslator(locale).t;
  const base = `account.dashboards.${summary.type}`;

  const statusLabel = summary.status
    ? t(membershipStatusLabelKey(summary.status))
    : null;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink-900">
          {t(`${base}.verificationHeading`)}
        </h2>
        {statusLabel ? <Badge tone="neutral">{statusLabel}</Badge> : null}
      </div>

      <p className="mt-3 max-w-2xl text-sm text-body">
        {t(`${base}.verificationIntro`)}
      </p>

      {summary.reviewNotes &&
      (summary.status === "rejected" ||
        summary.status === "changes_requested") ? (
        <div className="mt-4">
          <Notice tone="info">
            {t(`${base}.reviewerNoteLabel`)}: {summary.reviewNotes}
          </Notice>
        </div>
      ) : null}

      <p className="mt-6 flex flex-wrap gap-3">
        {summary.canApply ||
        summary.canReapply ||
        capabilityNeedsApplicantAction(summary.status) ? (
          <ButtonLink href={`/${locale}/account`} variant="primary">
            {t(`${base}.verificationApplyCta`)}
          </ButtonLink>
        ) : null}
        {capabilityIsWithReviewer(summary.status) ? (
          <ButtonLink
            href={`/${locale}/account/kyc?for=${summary.type}`}
            variant="secondary"
          >
            {t(`${base}.verificationKycCta`)}
          </ButtonLink>
        ) : null}
      </p>
    </Card>
  );
}

/** The tone a moderation badge should carry. */
function moderationTone(
  listing: DashboardListing,
): "neutral" | "success" | "warning" {
  const state = moderationState(listing.status, listing.submission);
  if (state.kind === "approved") return "success";
  if (state.kind === "rejected" || state.kind === "changes_requested") {
    return "warning";
  }
  return "neutral";
}

/** The message-key suffix for a moderation state, matching the message file. */
function moderationSuffix(kind: string): string {
  switch (kind) {
    case "pending":
      return "Pending";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "changes_requested":
      return "ChangesRequested";
    default:
      return "None";
  }
}

/**
 * One listing row.
 *
 * A card rather than a table row, because the dashboard is read on a phone as
 * often as on a desktop and each row carries a title, a price, a status and an
 * action — which is more than a table column set can hold at 375px without
 * horizontal scrolling. The title links to the listing, and the edit action sits
 * outside that link so a tap on it does not also follow the title.
 */
export function DashboardListingCard({
  listing,
  locale,
  kind,
}: {
  listing: DashboardListing;
  locale: Locale;
  kind: DashboardKind;
}) {
  const t = createTranslator(locale).t;
  const base = `account.dashboards.${kind}`;
  const href = `/${locale}/account/${kind}/${listing.id}`;
  const state = moderationState(listing.status, listing.submission);

  return (
    <Card as="li" className="flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-ink-900">
            <Link
              href={href}
              className="transition-colors hover:text-dept-accent"
            >
              {listing.title}
            </Link>
          </h3>
          <p className="mt-1 font-mono text-xs text-muted">
            {listing.reference}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="neutral">
            {t(`realEstate.statuses.${listing.status}`)}
          </Badge>
          <Badge tone={moderationTone(listing)}>
            {t(`${base}.moderation${moderationSuffix(state.kind)}`)}
          </Badge>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted">{t(`${base}.priceLabel`)}</dt>
          <dd className="text-ink-900">
            {listing.priceOnRequest || listing.priceMinor === null
              ? t(`${base}.priceOnRequestLabel`)
              : formatPrice(listing.priceMinor, listing.currency, locale)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{t(`${base}.regionLabel`)}</dt>
          <dd className="text-ink-900">
            {listing.locality ?? listing.regionName ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{t(`${base}.viewsLabel`)}</dt>
          <dd className="text-ink-900">{listing.viewCount}</dd>
        </div>
      </dl>

      {(state.kind === "rejected" || state.kind === "changes_requested") &&
      state.notes ? (
        <div className="mt-4">
          <Notice tone="warning">
            {t(`${base}.reviewerNoteLabel`)}: {state.notes}
          </Notice>
        </div>
      ) : null}

      <p className="mt-5">
        <ButtonLink href={href} variant="secondary" size="sm">
          {t(`${base}.editCta`)}
        </ButtonLink>
      </p>
    </Card>
  );
}
