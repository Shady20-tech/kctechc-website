"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, type FormEvent } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Form";
import { forgotPasswordAction } from "@/lib/auth/actions";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import type { ForgotPasswordState } from "@/lib/validation/auth";

const INITIAL_STATE: ForgotPasswordState = { status: "idle" };

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
  const loading = pending || disabled;
  return (
    <Button
      type="submit"
      variant="primary"
      disabled={loading}
      aria-busy={loading}
      className="w-full"
    >
      {loading ? pendingLabel : label}
    </Button>
  );
}

/**
 * Forgot-password form.
 *
 * Collects an email and asks Supabase to send a 6-digit recovery code. The
 * Server Action redirects to `/{locale}/reset-password?email=...`; the code is
 * entered there. The response is deliberately identical whether or not the
 * address has an account: a form that said "no account found" would be an
 * account-enumeration oracle.
 */
export function ForgotPasswordForm({ locale }: { locale: Locale }) {
  const t = createTranslator(locale).t;
  const [state, formAction, isPending] = useActionState(
    forgotPasswordAction,
    INITIAL_STATE,
  );
  const submitGuard = useRef(false);

  // A second click before React reports pending must not send a second email:
  // Supabase invalidates the previous recovery token on every send. This effect
  // only releases the guard; it never calls the action.
  useEffect(() => {
    if (!isPending) submitGuard.current = false;
  }, [isPending]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (submitGuard.current) {
      event.preventDefault();
      return;
    }
    submitGuard.current = true;
  };

  return (
    <form
      action={formAction}
      onSubmit={onSubmit}
      className="space-y-4"
      noValidate
    >
      {state.status === "rate_limited" ? (
        <Alert tone="error" title={t("auth.rateLimitedTitle")}>
          {t("auth.rateLimitedBody")}
        </Alert>
      ) : null}

      {state.status === "unconfigured" ? (
        <Alert tone="warning" title={t("auth.notConfigured")}>
          {t("auth.notConfiguredBody")}
        </Alert>
      ) : null}

      {state.status === "error" ? (
        <Alert tone="error">{t(state.messageKey)}</Alert>
      ) : null}

      <TextField
        id="email"
        name="email"
        type="email"
        label={t("auth.emailLabel")}
        autoComplete="email"
        required
      />

      <SubmitButton
        label={t("auth.sendResetLink")}
        pendingLabel={t("auth.sendingResetLink")}
        disabled={isPending}
      />

      <p className="text-sm text-body">
        <Link
          href={`/${locale}/login`}
          className="font-medium text-ink-900 underline underline-offset-4"
        >
          {t("auth.backToSignIn")}
        </Link>
      </p>
    </form>
  );
}
