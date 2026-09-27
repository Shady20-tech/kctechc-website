"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Form";
import { resetPasswordAction } from "@/lib/auth/actions";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import {
  RESET_PASSWORD_ERROR_KEYS,
  type ResetPasswordState,
} from "@/lib/validation/auth";

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
 * Reached only by following the recovery link, which `/auth/callback` exchanges
 * for a session. The action refuses without that session, so arriving here by
 * guessing the URL changes nothing — but the page still renders rather than
 * bouncing, so the customer sees why when the link has expired.
 */
export function ResetPasswordForm({ locale }: { locale: Locale }) {
  const t = createTranslator(locale).t;
  const [state, formAction] = useActionState(resetPasswordAction, INITIAL_STATE);

  if (state.status === "updated") {
    return (
      <Alert tone="success" title={t("auth.passwordUpdatedTitle")}>
        <p>{t("auth.passwordUpdatedBody")}</p>
        <p className="mt-2">
          <Link
            href={`/${locale}/admin/login`}
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
          {errors.form === "recoverySessionMissing"
            ? t("auth.recoverySessionMissing")
            : t("auth.errorBody")}
        </Alert>
      ) : null}

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
          href={`/${locale}/admin/login`}
          className="font-medium text-ink-900 underline underline-offset-4"
        >
          {t("auth.backToSignIn")}
        </Link>
      </p>
    </form>
  );
}
