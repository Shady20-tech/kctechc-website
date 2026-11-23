"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/Button";
import { TextAreaField } from "@/components/ui/Form";
import { decideReviewAction, type ReviewDecisionResult } from "@/lib/reviews/actions";
import type { ModeratorDecision } from "@/lib/reviews/types";

/**
 * The moderation control for one review.
 *
 * A Client Component only because the three outcomes share one reason field whose
 * requirement depends on the choice. The decision itself is a Server Action, and
 * the `reviews_update_moderator` policy is what decides whether it lands.
 *
 * The reason is shown for every outcome but only required for the two refusals;
 * an approval may be silent. The server enforces the same rule, so the disabled
 * state here is a courtesy rather than the control.
 */
export function ReviewDecisionForm({
  reviewId,
  labels,
  decisions,
}: {
  reviewId: string;
  labels: {
    approve: string;
    reject: string;
    requestChanges: string;
    noteLabel: string;
    noteHint: string;
    forbidden: string;
    generic: string;
    noteError: string;
  };
  decisions: ModeratorDecision[];
}) {
  const [result, formAction, pending] = useActionState(
    async (_previous: ReviewDecisionResult | null, formData: FormData) =>
      decideReviewAction(formData),
    null,
  );
  const [decision, setDecision] = useState<ModeratorDecision>("approved");

  const decisionLabels: Record<ModeratorDecision, string> = {
    approved: labels.approve,
    rejected: labels.reject,
    changes_requested: labels.requestChanges,
  };

  const requiresNote = decision !== "approved";

  if (result?.status === "ok") {
    return (
      <p className="text-sm font-medium text-teal-700">
        {decisionLabels[result.decision as ModeratorDecision] ?? ""}
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="reviewId" value={reviewId} />

      {result?.status === "forbidden" ? (
        <p className="text-sm text-red-700">{labels.forbidden}</p>
      ) : null}
      {result?.status === "error" ? (
        <p className="text-sm text-red-700">{labels.generic}</p>
      ) : null}

      <fieldset>
        <legend className="text-sm font-medium text-ink-900">Decision</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {decisions.map((value) => (
            <label
              key={value}
              className="inline-flex cursor-pointer items-center gap-2 rounded-control border border-border px-3 py-2 text-sm has-[:checked]:border-teal-700 has-[:checked]:bg-surface-alt"
            >
              <input
                type="radio"
                name="decision"
                value={value}
                checked={decision === value}
                onChange={() => setDecision(value)}
                className="h-4 w-4 text-teal-700 focus:ring-teal-700"
              />
              <span>{decisionLabels[value]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <TextAreaField
        id={`note-${reviewId}`}
        name="note"
        label={labels.noteLabel}
        hint={labels.noteHint}
        rows={3}
        required={requiresNote}
        requiredLabel="*"
        error={
          result?.status === "invalid" && result.fields.note
            ? labels.noteError
            : undefined
        }
      />

      <Button type="submit" variant="accent" disabled={pending}>
        {decisionLabels[decision]}
      </Button>
    </form>
  );
}
