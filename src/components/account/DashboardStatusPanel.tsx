"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { TextAreaField } from "@/components/ui/Form";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import type { DashboardKind } from "@/lib/real-estate/dashboard";
import {
  setListingStatusAction,
  submitListingForReviewAction,
  type DashboardSimpleResult,
} from "@/lib/real-estate/dashboard-actions";
import type { DashboardListing } from "@/lib/real-estate/dashboard-loaders";
import { moderationState } from "@/lib/real-estate/dashboard";

const EMPTY: DashboardSimpleResult | null = null;

/**
 * The listing's publication controls.
 *
 * Two operations, both gated by the review workflow: a draft can be submitted for
 * review, and a live listing can be withdrawn. There is deliberately no "publish"
 * button — publication is the reviewer's decision, and the lifecycle trigger
 * refuses it without an approved submission, so a publish control would be one the
 * database always rejects.
 *
 * The current state is read from the server-rendered props rather than held in
 * local state, so after an action the page re-renders from the database and the
 * controls reflect what actually happened rather than what was requested.
 */
export function DashboardStatusPanel({
  kind,
  locale,
  listing,
}: {
  kind: DashboardKind;
  locale: Locale;
  listing: DashboardListing;
}) {
  const t = createTranslator(locale).t;
  const base = `account.dashboards.${kind}`;
  const state = moderationState(listing.status, listing.submission);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink-900">
          {t(`${base}.statusHeading`)}
        </h2>
        <Badge tone="neutral">{t(`realEstate.statuses.${listing.status}`)}</Badge>
      </div>

      <p className="mt-3 max-w-2xl text-sm text-body">
        {t(`${base}.moderationHeading`)}:{" "}
        {t(`${base}.moderation${suffix(state.kind)}`)}
      </p>

      {(state.kind === "rejected" || state.kind === "changes_requested") &&
      state.notes ? (
        <div className="mt-3">
          <Notice tone="warning">
            {t(`${base}.reviewerNoteLabel`)}: {state.notes}
          </Notice>
        </div>
      ) : null}

      {listing.status === "draft" || listing.status === "rejected" ? (
        <SubmitForm kind={kind} locale={locale} listingId={listing.id} />
      ) : null}

      {listing.status === "published" || listing.status === "under_offer" ? (
        <WithdrawForm kind={kind} locale={locale} listingId={listing.id} />
      ) : null}

      {listing.status === "archived" ? (
        <RestoreForm kind={kind} locale={locale} listingId={listing.id} />
      ) : null}
    </Card>
  );
}

function SubmitForm({
  kind,
  locale,
  listingId,
}: {
  kind: DashboardKind;
  locale: Locale;
  listingId: string;
}) {
  const t = createTranslator(locale).t;
  const base = `account.dashboards.${kind}`;

  const [state, formAction] = useActionState(
    async (_previous: DashboardSimpleResult | null, formData: FormData) =>
      submitListingForReviewAction(
        kind,
        listingId,
        String(formData.get("notes") ?? ""),
      ),
    EMPTY,
  );

  return (
    <form action={formAction} className="mt-6 space-y-4">
      {state && !state.ok ? (
        <Notice tone="warning">
          {t(`errors.${state.error}`)}
        </Notice>
      ) : null}
      {state?.ok ? (
        <Notice tone="success">{t(`${base}.submitted`)}</Notice>
      ) : null}

      <TextAreaField
        id="notes"
        name="notes"
        label={t(`${base}.reviewNotesLabel`)}
        rows={3}
      />

      <SubmitButton
        label={t(`${base}.submitForReview`)}
        pendingLabel={t(`${base}.submitting`)}
      />
    </form>
  );
}

function WithdrawForm({
  kind,
  locale,
  listingId,
}: {
  kind: DashboardKind;
  locale: Locale;
  listingId: string;
}) {
  const t = createTranslator(locale).t;
  const base = `account.dashboards.${kind}`;

  const [state, formAction] = useActionState(
    async () => setListingStatusAction(kind, listingId, "archived"),
    EMPTY,
  );

  return (
    <form action={formAction} className="mt-6 space-y-4">
      {state && !state.ok ? (
        <Notice tone="warning">{t(`errors.${state.error}`)}</Notice>
      ) : null}
      {state?.ok ? (
        <Notice tone="success">{t(`${base}.statusChanged`)}</Notice>
      ) : null}
      <StatusButton
        label={t(`${base}.withdrawCta`)}
        pendingLabel={t(`${base}.saving`)}
        variant="secondary"
      />
    </form>
  );
}

function RestoreForm({
  kind,
  locale,
  listingId,
}: {
  kind: DashboardKind;
  locale: Locale;
  listingId: string;
}) {
  const t = createTranslator(locale).t;
  const base = `account.dashboards.${kind}`;

  const [state, formAction] = useActionState(
    async () => setListingStatusAction(kind, listingId, "draft"),
    EMPTY,
  );

  return (
    <form action={formAction} className="mt-6 space-y-4">
      {state && !state.ok ? (
        <Notice tone="warning">{t(`errors.${state.error}`)}</Notice>
      ) : null}
      {state?.ok ? (
        <Notice tone="success">{t(`${base}.statusChanged`)}</Notice>
      ) : null}
      <StatusButton
        label={t(`${base}.restoreCta`)}
        pendingLabel={t(`${base}.saving`)}
        variant="secondary"
      />
    </form>
  );
}

function SubmitButton({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

function StatusButton({
  label,
  pendingLabel,
  variant,
}: {
  label: string;
  pendingLabel: string;
  variant: "primary" | "secondary";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending} aria-busy={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

function suffix(kind: string): string {
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
