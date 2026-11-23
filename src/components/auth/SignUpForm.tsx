"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Form";
import { signUpAction } from "@/lib/auth/actions";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import {
  ACCOUNT_TYPES,
  accountTypeRequiresKyc,
  type AccountType,
} from "@/lib/real-estate/kyc";
import { SIGN_UP_ERROR_KEYS } from "@/lib/validation/auth-error-keys";
import type { SignUpState } from "@/lib/validation/auth";

const INITIAL_STATE: SignUpState = { status: "idle" };

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
 * Sign-up form.
 *
 * The four fields the brief specifies, plus the privacy acknowledgement, which
 * is a required checkbox rather than a note. The password is confirmed by a
 * second field validated on the server, not only in the browser: a mismatch that
 * a direct POST could bypass would leave an account with a typo'd password and no
 * way in.
 *
 * An account is created here and nowhere else. The sign-in form never creates
 * one, so "sign up before you can sign in" is enforced by the absence of the
 * capability rather than by a message.
 */
export function SignUpForm({
  locale,
  disabled,
}: {
  locale: Locale;
  disabled: boolean;
}) {
  const t = createTranslator(locale).t;
  const [state, formAction] = useActionState(signUpAction, INITIAL_STATE);
  const [accountType, setAccountType] = useState<AccountType>("buyer");

  // The privacy notice now has its own route, so the acknowledgement links
  // straight to the policy rather than to a note on the contact page.
  const privacyHref = `/${locale}/privacy`;

  // Only a landlord or an agent is applying to publish property, so only those
  // are held to the adult rule. A buyer account carries no age requirement.
  const requiresAdult = accountTypeRequiresKyc(accountType);

  if (state.status === "check_email") {
    return (
      <Alert tone="success" title={t("auth.checkEmailTitle")}>
        <p>{t("auth.checkEmailBody")}</p>
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
    field: keyof typeof SIGN_UP_ERROR_KEYS,
  ): string | undefined =>
    errors[field] ? t(`auth.${SIGN_UP_ERROR_KEYS[field]}`) : undefined;

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
        <Alert tone="error">{t(`auth.${SIGN_UP_ERROR_KEYS.form}`)}</Alert>
      ) : null}

      <TextField
        id="fullName"
        name="fullName"
        label={t("auth.fullNameLabel")}
        autoComplete="name"
        required
        error={errorFor("fullName")}
      />

      {/* A dropdown, not a radio group: the choice is one declaration, and the
          date-of-birth hint below changes with it. Each option keeps its own
          explanation, so collapsing the list loses no guidance. */}
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

      <div>
        <TextField
          id="dateOfBirth"
          name="dateOfBirth"
          type="date"
          label={t("auth.dateOfBirthLabel")}
          // No `autocomplete="bday"`: the WHATWG token for a complete birth
          // date is `bday`, but Chrome's audit rejects it in favour of the
          // granular `bday-day`/`bday-month`/`bday-year` tokens, which would be
          // wrong on a control that captures a whole date. Chrome reported the
          // mismatch as a DevTools issue, which Lighthouse counts, so the
          // attribute is omitted rather than claiming a token the browser
          // treats as invalid. `type="date"` already gives the native picker.
          required
          aria-describedby="dateOfBirth-hint"
          error={errorFor("dateOfBirth")}
        />
        <p id="dateOfBirth-hint" className="mt-1 text-xs text-muted">
          {requiresAdult
            ? t("auth.dateOfBirthHintAdult")
            : t("auth.dateOfBirthHintBuyer")}
        </p>
      </div>

      <TextField
        id="phone"
        name="phone"
        type="tel"
        label={t("auth.phoneLabel")}
        hint={t("auth.phoneHint")}
        autoComplete="tel"
        required
        error={errorFor("phone")}
      />

      {/* A dropdown for the same reason as the account type: a single required
          choice with two options reads better as a select than as two radios. */}
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
        id="email"
        name="email"
        type="email"
        label={t("auth.emailLabel")}
        autoComplete="email"
        required
        error={errorFor("email")}
      />

      <TextField
        id="password"
        name="password"
        type="password"
        label={t("auth.passwordLabel")}
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

      <div>
        <div className="flex items-start gap-2.5">
          <input
            id="acceptPrivacy"
            name="acceptPrivacy"
            type="checkbox"
            required
            aria-required="true"
            aria-invalid={errors.acceptPrivacy ? true : undefined}
            aria-describedby={
              errors.acceptPrivacy ? "acceptPrivacy-error" : undefined
            }
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-border-strong"
          />
          <label htmlFor="acceptPrivacy" className="text-sm text-body">
            {t("auth.privacyLabel")}{" "}
            <Link
              href={privacyHref}
              className="font-medium text-ink-900 underline underline-offset-4"
            >
              {t("auth.privacyLinkLabel")}
            </Link>
          </label>
        </div>
        {errors.acceptPrivacy ? (
          <p
            id="acceptPrivacy-error"
            className="mt-1 text-xs font-medium text-red-700"
          >
            {errorFor("acceptPrivacy")}
          </p>
        ) : null}
      </div>

      <SubmitButton
        label={t("auth.signUpSubmit")}
        pendingLabel={t("auth.signingUp")}
        disabled={disabled}
      />

      <p className="text-sm text-body">
        {t("auth.haveAccount")}{" "}
        <Link
          href={`/${locale}/admin/login`}
          className="font-medium text-ink-900 underline underline-offset-4"
        >
          {t("auth.signInSubmit")}
        </Link>
      </p>
    </form>
  );
}
