"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Form";
import { signInAction, type SignInActionState } from "@/lib/auth/actions";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { resendConfirmationAction } from "@/lib/auth/actions";
import type { ForgotPasswordState } from "@/lib/validation/auth";

const INITIAL_STATE: SignInActionState = { status: "idle" };
const INITIAL_RESEND: ForgotPasswordState = { status: "idle" };

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
    <Button
      type="submit"
      variant="primary"
      disabled={disabled || pending}
      aria-busy={pending}
      className="w-full"
    >
      {pending ? pendingLabel : label}
    </Button>
  );
}

/**
 * Resend control for an unconfirmed account.
 *
 * A separate `<form>` carrying only the email, so the customer does not have to
 * retype a password to get the confirmation mail again. Kept as its own component
 * so its action state cannot collide with the sign-in action's.
 */
function ResendConfirmation({
  locale,
  email,
}: {
  locale: Locale;
  email: string;
}) {
  const t = createTranslator(locale).t;
  const [state, formAction] = useActionState(
    resendConfirmationAction,
    INITIAL_RESEND,
  );

  if (state.status === "sent") {
    return <p className="text-sm">{t("auth.confirmationResent")}</p>;
  }

  return (
    <form action={formAction} className="mt-2">
      <input type="hidden" name="email" value={email} />
      <Button type="submit" variant="secondary" size="sm">
        {t("auth.resendConfirmation")}
      </Button>
    </form>
  );
}

/**
 * Sign-in form.
 *
 * Email and password, a link to the forgot-password page, and — only when the
 * account exists but is unconfirmed — a resend control. Uses a Server Action so
 * the password is never handled by client-side fetch code and the action
 * re-validates on the server.
 *
 * There is no "create account" behaviour here. A visitor without an account is
 * pointed at the sign-up page; this form will not make one for them.
 */
export function SignInForm({
  locale,
  nextPath,
  disabled,
  initialReason,
}: {
  locale: Locale;
  nextPath?: string;
  disabled: boolean;
  /** `?reason=` from the callback or a guard redirect, surfaced as a notice. */
  initialReason?: string;
}) {
  const t = createTranslator(locale).t;
  const [state, formAction] = useActionState(signInAction, INITIAL_STATE);

  const reasonNotice =
    initialReason === "link_expired"
      ? t("auth.linkExpired")
      : initialReason === "unconfigured"
        ? t("auth.notConfiguredBody")
        : null;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.status === "error" ? (
        <Alert tone="error">
          <p>{t("auth.invalidCredentials")}</p>
        </Alert>
      ) : null}

      {state.status === "rate_limited" ? (
        <Alert tone="error" title={t("auth.rateLimitedTitle")}>
          {t("auth.rateLimitedBody")}
        </Alert>
      ) : null}

      {state.status === "email_unconfirmed" ? (
        <Alert tone="warning" title={t("auth.unconfirmedTitle")}>
          <p>{t("auth.unconfirmedBody")}</p>
          <ResendConfirmation locale={locale} email={state.email} />
        </Alert>
      ) : null}

      {reasonNotice ? <Alert tone="info">{reasonNotice}</Alert> : null}

      {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}

      <TextField
        id="email"
        name="email"
        type="email"
        label={t("auth.emailLabel")}
        autoComplete="email"
        required
        disabled={disabled}
      />

      <TextField
        id="password"
        name="password"
        type="password"
        label={t("auth.passwordLabel")}
        autoComplete="current-password"
        minLength={8}
        required
        disabled={disabled}
      />

      <div className="flex justify-end">
        <Link
          href={`/${locale}/admin/forgot-password`}
          className="text-sm font-medium text-ink-900 underline underline-offset-4"
        >
          {t("auth.forgotPasswordLink")}
        </Link>
      </div>

      <SubmitButton
        label={t("auth.signInSubmit")}
        pendingLabel={t("auth.signingIn")}
        disabled={disabled}
      />

      <p className="text-sm text-body">
        {t("auth.noAccount")}{" "}
        <Link
          href={`/${locale}/admin/sign-up`}
          className="font-medium text-ink-900 underline underline-offset-4"
        >
          {t("auth.signUpSubmit")}
        </Link>
      </p>
    </form>
  );
}
