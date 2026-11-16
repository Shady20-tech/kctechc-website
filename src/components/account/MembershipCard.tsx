"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { TextAreaField, TextField } from "@/components/ui/Form";
import {
  applyForMembershipAction,
  type MembershipActionState,
} from "@/lib/real-estate/membership-actions";
import {
  membershipStatusLabelKey,
  membershipTypeBodyKey,
  membershipTypeLabelKey,
  type MembershipSummary,
} from "@/lib/real-estate/memberships";

/**
 * One capability, and what the customer can do about it.
 *
 * Renders one of three states: no application yet (offer to apply), an application
 * in progress (show the state and the reviewer's note), or a live capability (show
 * it as held). A suspended capability shows the reason, because a member whose
 * access stopped needs to know why.
 *
 * The apply form is a Server Action, so the write goes through the cookie-bound
 * client and RLS — the capability is applied for, never granted, from here.
 */
export function MembershipCard({
  summary,
  labels,
}: {
  summary: MembershipSummary;
  labels: Record<string, string>;
}) {
  const typeLabel =
    labels[membershipTypeLabelKey(summary.type)] ?? summary.type;
  const statusLabel = summary.status
    ? (labels[membershipStatusLabelKey(summary.status)] ?? summary.status)
    : null;

  return (
    <Card className="flex flex-col">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-ink-900">{typeLabel}</h3>
        {summary.isActive ? (
          <Badge tone="success">{labels.activeBadge}</Badge>
        ) : statusLabel ? (
          <Badge tone="neutral">{statusLabel}</Badge>
        ) : null}
      </div>

      <p className="mt-2 text-sm text-body">
        {labels[membershipTypeBodyKey(summary.type)] ?? ""}
      </p>

      {summary.status === "suspended" && summary.suspensionReason ? (
        <div className="mt-3">
          <Notice tone="error">
            {labels.suspendedReason}: {summary.suspensionReason}
          </Notice>
        </div>
      ) : null}

      {summary.reviewNotes &&
      (summary.status === "rejected" ||
        summary.status === "changes_requested") ? (
        <div className="mt-3">
          <Notice tone="info">
            {labels.reviewerNote}: {summary.reviewNotes}
          </Notice>
        </div>
      ) : null}

      {summary.canApply || summary.canReapply ? (
        <ApplyForm type={summary.type} labels={labels} />
      ) : summary.isActive ? (
        <p className="mt-4 text-sm text-muted">{labels.activeHint}</p>
      ) : summary.status === "suspended" ? (
        <p className="mt-4 text-sm text-muted">{labels.suspendedHint}</p>
      ) : (
        <p className="mt-4 text-sm text-muted">{labels.pendingHint}</p>
      )}
    </Card>
  );
}

function ApplyForm({
  type,
  labels,
}: {
  type: MembershipSummary["type"];
  labels: Record<string, string>;
}) {
  const [state, formAction] = useActionState(
    applyForMembershipAction.bind(null, type),
    null as MembershipActionState | null,
  );

  return (
    <form action={formAction} className="mt-4 flex-1 space-y-4">
      {state && !state.ok ? (
        <Notice tone="error">
          {labels[`errors.${state.error}`] ?? labels["errors.write_failed"]}
        </Notice>
      ) : null}
      {state?.ok ? (
        <Notice tone="success">{labels.applicationReceived}</Notice>
      ) : null}

      <TextField
        id={`kycReference-${type}`}
        name="kycReference"
        label={labels.kycLabel ?? ""}
        hint={labels.kycHint ?? ""}
      />

      <TextAreaField
        id={`notes-${type}`}
        name="notes"
        label={labels.notesLabel ?? ""}
        rows={3}
      />

      <ApplyButton label={labels.apply} pendingLabel={labels.applying} />
    </form>
  );
}

function ApplyButton({
  label,
  pendingLabel,
}: {
  label: string | undefined;
  pendingLabel: string | undefined;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}
