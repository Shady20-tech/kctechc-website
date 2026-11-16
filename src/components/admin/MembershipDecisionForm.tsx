"use client";

import { useState, useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { SelectField, TextAreaField } from "@/components/ui/Form";
import {
  reviewMembershipAction,
  type MembershipDecision,
  type MembershipReviewState,
} from "@/lib/real-estate/membership-review-actions";

/**
 * The reviewer's decision on one application.
 *
 * A single form with a decision selector and a reason field, rather than four
 * buttons, because the reason is mandatory for a refusal, a request for changes
 * and a suspension but optional for an approval. One form keeps the reason beside
 * the decision that needs it, and the Server Action enforces which combinations
 * are acceptable so the client cannot submit an unexplained refusal.
 */
export function MembershipDecisionForm({
  membershipId,
  labels,
}: {
  membershipId: string;
  labels: Record<string, string>;
}) {
  const [state, formAction] = useActionState(
    reviewMembershipAction.bind(null, membershipId),
    null as MembershipReviewState | null,
  );
  const [decision, setDecision] = useState<MembershipDecision>("approve");

  const notesRequired =
    decision === "reject" ||
    decision === "request_changes" ||
    decision === "suspend";

  return (
    <form action={formAction} className="mt-4 space-y-4">
      {state && !state.ok ? (
        <Notice tone="error">
          {labels[`errors.${state.error}`] ?? labels["errors.write_failed"]}
        </Notice>
      ) : null}
      {state?.ok ? (
        <Notice tone="success">{labels.decisionSaved}</Notice>
      ) : null}

      <SelectField
        id={`decision-${membershipId}`}
        name="decision"
        label={labels.decisionLabel ?? ""}
        value={decision}
        onChange={(event) =>
          setDecision(event.target.value as MembershipDecision)
        }
      >
        <option value="approve">{labels.decisionApprove}</option>
        <option value="reject">{labels.decisionReject}</option>
        <option value="request_changes">{labels.decisionRequestChanges}</option>
        <option value="suspend">{labels.decisionSuspend}</option>
        <option value="reinstate">{labels.decisionReinstate}</option>
      </SelectField>

      <TextAreaField
        id={`notes-${membershipId}`}
        name="notes"
        label={labels.notesLabel ?? ""}
        hint={notesRequired ? labels.notesRequiredHint : labels.notesHint}
        rows={3}
        required={notesRequired}
      />

      <DecisionButton label={labels.save} pendingLabel={labels.saving} />
    </form>
  );
}

function DecisionButton({
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
