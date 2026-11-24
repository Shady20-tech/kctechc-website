"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Form";
import { completeOAuthOnboardingAction } from "@/lib/auth/actions";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import {
  ACCOUNT_TYPES,
  accountTypeRequiresKyc,
  type AccountType,
} from "@/lib/real-estate/kyc";
import { OAUTH_ONBOARDING_ERROR_KEYS } from "@/lib/validation/auth-error-keys";
import type { OAuthOnboardingState } from "@/lib/validation/auth";

const INITIAL_STATE: OAuthOnboardingState = { status: "idle" };

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
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
 * The declarations a social sign-in did not collect.
 *
 * Supabase's `signInWithOAuth` accepts no metadata payload, so the account is
 * created before we can ask anything: `handle_new_user` provisions it as
 * `customer` with `declared_account_type` null. This form asks the same two
 * questions the password form asks, so both routes end in the same state.
 *
 * Nothing chosen here grants a capability. A landlord or agent declaration is
 * stored on the profile and the account page then offers the KYC application;
 * only an approved application allows publishing. The wording says so, because a
 * "signing up as a landlord" label would otherwise imply the account can already
 * list property.
 */
export function OAuthOnboardingForm({ locale }: { locale: Locale }) {
  const t = createTranslator(locale).t;
  const [state, formAction] = useActionState(
    completeOAuthOnboardingAction,
    INITIAL_STATE,
  );
  const [accountType, setAccountType] = useState<AccountType>("buyer");

  const errors = state.status === "error" ? state.errors : {};
  const errorFor = (field: keyof typeof OAUTH_ONBOARDING_ERROR_KEYS) =>
    errors[field] ? t(`auth.${OAUTH_ONBOARDING_ERROR_KEYS[field]}`) : undefined;

  const requiresAdult = accountTypeRequiresKyc(accountType);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.status === "rate_limited" ? (
        <Alert tone="error" title={t("auth.rateLimitedTitle")}>
          {t("auth.rateLimitedBody")}
        </Alert>
      ) : null}

      {state.status === "unauthenticated" ? (
        <Alert tone="warning">{t("auth.onboardingSessionMissing")}</Alert>
      ) : null}

      {state.status === "unconfigured" ? (
        <Alert tone="warning" title={t("auth.notConfigured")}>
          {t("auth.notConfiguredBody")}
        </Alert>
      ) : null}

      {errors.form ? <Alert tone="error">{t("auth.errorBody")}</Alert> : null}

      <SelectField
        id="accountType"
        name="accountType"
        label={t("auth.accountTypeLegend")}
        hint={t("auth.accountTypeHint")}
        required
        requiredLabel={t("common.required")}
        value={accountType}
        onChange={(event) => setAccountType(event.target.value as AccountType)}
        error={errorFor("accountType")}
      >
        {ACCOUNT_TYPES.map((type) => (
          <option key={type} value={type}>
            {t(`auth.accountType.${type}.label`)} —{" "}
            {t(`auth.accountType.${type}.body`)}
          </option>
        ))}
      </SelectField>

      {requiresAdult ? (
        <p className="text-xs text-muted">{t("auth.onboardingKycNote")}</p>
      ) : null}

      <SelectField
        id="permanentResidency"
        name="permanentResidency"
        label={t("auth.permanentResidencyLegend")}
        hint={t("auth.permanentResidencyHint")}
        required
        requiredLabel={t("common.required")}
        defaultValue=""
        error={errorFor("permanentResidency")}
      >
        <option value="" disabled>
          {t("auth.permanentResidencyPlaceholder")}
        </option>
        <option value="true">{t("auth.permanentResidencyYes")}</option>
        <option value="false">{t("auth.permanentResidencyNo")}</option>
      </SelectField>

      <TextField
        id="phone"
        name="phone"
        type="tel"
        label={t("auth.phoneLabel")}
        hint={t("auth.phoneOptionalHint")}
        autoComplete="tel"
        error={errorFor("phone")}
      />

      <SubmitButton
        label={t("auth.onboardingSubmit")}
        pendingLabel={t("auth.onboardingSaving")}
      />
    </form>
  );
}
