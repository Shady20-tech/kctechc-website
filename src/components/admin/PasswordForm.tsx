"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { TextField } from "@/components/ui/Form";
import { changePasswordAction, type ProfileUpdateState } from "@/lib/admin/profile-actions";

/**
 * Change-password form.
 *
 * The two fields are cleared on success by keying the form to the action state,
 * because leaving a password in the DOM after it has been accepted is a habit
 * worth not forming. Confirmation is checked on the server as well as by the
 * browser's `type="password"` autocomplete hints, since client validation is a
 * convenience and not a control.
 */
export function PasswordForm({ labels }: { labels: Record<string, string> }) {
  const [state, formAction] = useActionState(
    changePasswordAction,
    null as ProfileUpdateState | null,
  );

  return (
    <section aria-labelledby="password-heading" className="space-y-4">
      <div>
        <h2 id="password-heading" className="text-lg font-semibold text-ink-900">
          {labels.passwordHeading}
        </h2>
        <p className="mt-1 text-sm text-body">{labels.passwordIntro}</p>
      </div>

      <form
        action={formAction}
        className="max-w-xl space-y-5"
        key={state?.ok ? "reset" : "form"}
      >
        {state && !state.ok ? (
          <Notice tone="error">
            {labels[`errors.${state.error}`] ?? labels["errors.password_failed"]}
          </Notice>
        ) : null}
        {state?.ok ? <Notice tone="success">{labels.passwordUpdated}</Notice> : null}

        <TextField
          id="password"
          name="password"
          type="password"
          label={labels.newPasswordLabel ?? ""}
          autoComplete="new-password"
          required
          minLength={12}
        />
        <TextField
          id="confirm"
          name="confirm"
          type="password"
          label={labels.confirmPasswordLabel ?? ""}
          autoComplete="new-password"
          required
          minLength={12}
        />

        <PasswordButton
          label={labels.updatePassword ?? ""}
          pendingLabel={labels.updatingPassword}
        />
      </form>
    </section>
  );
}

function PasswordButton({
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
