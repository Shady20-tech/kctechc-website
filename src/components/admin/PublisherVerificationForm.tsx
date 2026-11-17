"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import {
  setPublisherVerificationAction,
  type VerificationState,
} from "@/lib/real-estate/verification-actions";

/**
 * Grant or revoke one publisher's verification badge.
 *
 * One control that flips between grant and revoke, driven by the row's current
 * state. The action is a super-admin-only write and the real boundary is the
 * `enforce_membership_verification` trigger in the database; this form only makes
 * the intent legible.
 */
export function PublisherVerificationForm({
  membershipId,
  verified,
  labels,
}: {
  membershipId: string;
  verified: boolean;
  labels: Record<string, string>;
}) {
  const [state, formAction] = useActionState(
    setPublisherVerificationAction,
    null as VerificationState | null,
  );

  return (
    <form action={formAction} className="mt-3 space-y-2">
      <input type="hidden" name="membershipId" value={membershipId} />
      <input type="hidden" name="verified" value={verified ? "false" : "true"} />
      {state && !state.ok ? (
        <Notice tone="error">
          {labels[`errors.${state.error}`] ?? labels["errors.write_failed"]}
        </Notice>
      ) : null}
      {state?.ok ? (
        <Notice tone="success">{labels.saved}</Notice>
      ) : null}
      <SubmitButton
        label={verified ? labels.revoke : labels.grant}
        pendingLabel={labels.saving}
        variant={verified ? "danger" : "primary"}
      />
    </form>
  );
}

function SubmitButton({
  label,
  pendingLabel,
  variant,
}: {
  label: string | undefined;
  pendingLabel: string | undefined;
  variant?: "danger" | "primary";
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="sm"
      variant={variant}
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? (pendingLabel ?? "…") : (label ?? "Save")}
    </Button>
  );
}
