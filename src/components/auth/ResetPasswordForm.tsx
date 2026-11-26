"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Form";
import { resetPasswordAction } from "@/lib/auth/actions";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { RESET_PASSWORD_ERROR_KEYS } from "@/lib/validation/auth-error-keys";
import type { ResetPasswordState } from "@/lib/validation/auth";

const INITIAL_STATE: ResetPasswordState = { status: "idle" };

function SubmitButton({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="primary"
      disabled={pending}
      aria-busy={pending}
      className="w-full"
    >
      {pending ? pendingLabel : label}
    </Button>
  );
}

/**
 * Reset-password form.
 *
 * The customer arrives from `/forgot-password` with the email in the query
 * string and a 6-digit code in their inbox. The Server Action verifies the code
 * with Supabase (`type: "recovery"`), updates the password in the same request,
 * signs the recovery session out, and the form then sends the customer to the
 * sign-in page. No clickable recovery link or pre-existing session is required,
 * so an unauthenticated visitor can use this page directly.
 */
export function ResetPasswordForm({
  locale,
  initialEmail = "",
}: {
  locale: Locale;
  initialEmail?: string;
}) {
  const t = createTranslator(locale).t;
  const router = useRouter();
  const [state, formAction] = useActionState(
    resetPasswordAction,
    INITIAL_STATE,
  );

  useEffect(() => {
    if (state.status !== "updated") return;
    const timer = window.setTimeout(() => {
      router.push(`/${locale}/login?reason=password_updated`);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [locale, router, state.status]);

  if (state.status === "updated") {
    return (
      <Alert tone="success" title={t("auth.passwordUpdatedTitle")}>
        <p>{t("auth.passwordUpdatedBody")}</p>
        <p className="mt-2 text-sm">{t("auth.redirectingToSignIn")}</p>
        <p className="mt-2">
          <Link
            href={`/${locale}/login?reason=password_updated`}
            className="font-medium underline underline-offset-4"
          >
            {t("auth.backToSignIn")}
          </Link>
        </p>
      </Alert>
    );
  }

  const errors = state.status === "error" ? state.errors : {};
  const errorFor = (
    field: keyof typeof RESET_PASSWORD_ERROR_KEYS,
  ): string | undefined =>
    errors[field] ? t(`auth.${RESET_PASSWORD_ERROR_KEYS[field]}`) : undefined;

  return (
    <form action={formAction} className="space-y-4" noValidate>
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

      {errors.form ? (
        <Alert tone="error">
          {errors.form === "invalidOtp"
            ? t("auth.invalidOtp")
            : t("auth.errorBody")}
        </Alert>
      ) : null}

      <TextField
        id="email"
        name="email"
        type="email"
        label={t("auth.emailLabel")}
        autoComplete="email"
        defaultValue={initialEmail}
        required
        error={errorFor("email")}
      />

      <TextField
        id="token"
        name="token"
        type="text"
        label={t("auth.resetCodeLabel")}
        hint={t("auth.resetCodeHint")}
        autoComplete="one-time-code"
        inputMode="numeric"
        pattern="[0-9]{6}"
        maxLength={6}
        minLength={6}
        required
        error={errorFor("token")}
      />

      <TextField
        id="password"
        name="password"
        type="password"
        label={t("auth.newPasswordLabel")}
        hint={t("auth.passwordHint")}
        autoComplete="new-password"
        minLength={8}
        required
        error={errorFor("password")}
      />

      <TextField
        id="confirmPassword"
        name="confirmPassword"
        type="password"
        label={t("auth.confirmPasswordLabel")}
        autoComplete="new-password"
        minLength={8}
        required
        error={errorFor("confirmPassword")}
      />

      <SubmitButton
        label={t("auth.setNewPassword")}
        pendingLabel={t("auth.settingNewPassword")}
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
