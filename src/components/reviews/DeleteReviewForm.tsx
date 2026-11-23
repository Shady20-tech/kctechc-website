"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/Button";
import { deleteOwnReviewAction } from "@/lib/reviews/actions";

/**
 * Delete one of your own reviews.
 *
 * A small Client Component only so the confirmation can be a real browser dialog
 * before the action runs; the action itself is server-side and the
 * `reviews_delete_own` policy is what scopes the delete to the caller's own row.
 */
export function DeleteReviewForm({
  reviewId,
  label,
  confirmMessage,
}: {
  reviewId: string;
  label: string;
  confirmMessage: string;
}) {
  const [state, formAction, pending] = useActionState(
    async (_previous: { status: string } | null, formData: FormData) =>
      deleteOwnReviewAction(formData),
    null,
  );

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="reviewId" value={reviewId} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {label}
      </Button>
      {state?.status === "error" ? (
        <p className="mt-1 text-xs text-red-700">{state.status}</p>
      ) : null}
    </form>
  );
}
