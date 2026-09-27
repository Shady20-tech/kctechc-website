"use client";

import Link from "next/link";
import { useActionState } from "react";
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
 * Forgot-password form.
 *
 * Collects an email and asks Supabase to send a recovery link. The confirmation
 * is deliberately identical whether or not the address has an account: a form
 * that said "no account found" would be an account-enumeration oracle. The
 * customer is told to check their inbox, which is true in both cases.
 */
export function ForgotPasswordForm({ locale }: { locale: Locale }) {
  const t = createTranslator(locale).t;
  const [state, formAction] = useActionState(forgotPasswordAction, INITIAL_STATE);

  if (state.status === "sent") {
    return (
      <Alert tone="success" title={t("auth.resetLinkSentTitle")}>
        <p>{t("auth.resetLinkSentBody")}</p>
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

      {state.status === "error" ? (
        <Alert tone="error">{t("auth.invalidEmail")}</Alert>
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
