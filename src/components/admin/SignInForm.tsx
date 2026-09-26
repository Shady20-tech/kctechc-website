"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Notice } from "@/components/ui/Notice";
import { signInAction, type SignInActionState } from "@/lib/auth/actions";

const INITIAL_STATE: SignInActionState = { status: "idle" };

function SubmitButton({
  label,
  pendingLabel,
  disabled,
}: {
  label: string;
  pendingLabel: string;
  disabled: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
      className="w-full rounded-card bg-navy-900 px-4 py-3 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-60"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

/**
 * Sign-in form. Uses a Server Action so the password is never handled by
 * client-side fetch code, and the action re-validates on the server.
 */
export function SignInForm({
  labels,
  nextPath,
  disabled,
}: {
  labels: {
    email: string;
    password: string;
    submit: string;
    submitting: string;
    invalid: string;
  };
  nextPath?: string;
  disabled: boolean;
}) {
  const [state, formAction] = useActionState(signInAction, INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-4">
      {state.status === "error" ? (
        <Notice tone="error">
          <p>{labels.invalid}</p>
        </Notice>
      ) : null}

      {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}

      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-navy-900"
        >
          {labels.email}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-required="true"
          className="mt-1 w-full rounded-card border border-border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-navy-900"
        >
          {labels.password}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-required="true"
          minLength={8}
          className="mt-1 w-full rounded-card border border-border px-3 py-2 text-sm"
        />
      </div>

      <SubmitButton
        label={labels.submit}
        pendingLabel={labels.submitting}
        disabled={disabled}
      />
    </form>
  );
}
