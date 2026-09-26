"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import {
  HoneypotField,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/ui/Form";
import { Spinner } from "@/components/ui/Loading";
import { DEPARTMENTS, type DepartmentSlug } from "@/lib/config/site";
import type { Locale } from "@/lib/i18n/locales";
import { submitInquiry } from "@/lib/inquiries/actions";
import type { InquiryState } from "@/lib/validation/inquiry";

export type ContactFormLabels = {
  heading: string;
  intro: string;
  nameLabel: string;
  namePlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  phoneLabel: string;
  phoneHint: string;
  phonePlaceholder: string;
  departmentLabel: string;
  departmentHint: string;
  departmentGeneral: string;
  subjectLabel: string;
  subjectPlaceholder: string;
  messageLabel: string;
  messagePlaceholder: string;
  consentLabel: string;
  submit: string;
  submitting: string;
  successTitle: string;
  successBody: string;
  errorTitle: string;
  errorBody: string;
  rateLimitedTitle: string;
  rateLimitedBody: string;
  unavailableTitle: string;
  unavailableBody: string;
  errorSummaryHeading: string;
  referenceLabel: string;
};

const INITIAL_STATE: InquiryState = { status: "idle" };

/**
 * Contact / inquiry form.
 *
 * Uses `useActionState` so validation errors and the success receipt survive a
 * server round trip without client state management, and so the form still works
 * with JavaScript unavailable — it is a real `<form>` posting to a server action.
 *
 * Field errors come back as message keys and are resolved through the
 * `validationMessages` map, which keeps the server free of presentation strings.
 */
export function ContactForm({
  locale,
  labels,
  departmentLabels,
  validationMessages,
  defaultDepartment,
}: {
  locale: Locale;
  labels: ContactFormLabels;
  departmentLabels: Record<DepartmentSlug, string>;
  validationMessages: Record<string, string>;
  defaultDepartment?: DepartmentSlug;
}) {
  const [state, formAction, isPending] = useActionState(
    submitInquiry,
    INITIAL_STATE,
  );

  const message = (key: string | undefined) =>
    key
      ? (validationMessages[key] ?? validationMessages.required ?? key)
      : undefined;

  const fieldErrors = state.status === "invalid" ? state.errors : {};

  return (
    <section
      aria-labelledby="inquiry-form-heading"
      className="rounded-card border border-border bg-surface p-6 shadow-card sm:p-8"
    >
      <h2
        id="inquiry-form-heading"
        className="text-xl font-semibold text-ink-900"
      >
        {labels.heading}
      </h2>
      <p className="mt-2 text-sm text-body">{labels.intro}</p>

      {state.status === "success" ? (
        <div className="mt-6">
          <Alert tone="success" title={labels.successTitle}>
            <p>{labels.successBody}</p>
            <p className="mt-2">
              <span className="font-semibold">{labels.referenceLabel}:</span>{" "}
              <span className="font-mono">{state.reference}</span>
            </p>
          </Alert>
        </div>
      ) : null}

      {state.status === "rate_limited" ? (
        <div className="mt-6">
          <Alert tone="warning" title={labels.rateLimitedTitle}>
            {labels.rateLimitedBody}
          </Alert>
        </div>
      ) : null}

      {state.status === "unconfigured" ? (
        <div className="mt-6">
          <Alert tone="info" title={labels.unavailableTitle}>
            {labels.unavailableBody}
          </Alert>
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="mt-6">
          <Alert tone="error" title={labels.errorTitle}>
            {labels.errorBody}
          </Alert>
        </div>
      ) : null}

      {state.status === "invalid" ? (
        <div className="mt-6">
          <Alert
            tone="error"
            title={labels.errorSummaryHeading}
            id="form-errors"
          >
            {Object.keys(fieldErrors).length > 0 ? (
              <ul className="list-inside list-disc">
                {Object.entries(fieldErrors).map(([field, key]) => (
                  <li key={field}>{message(key)}</li>
                ))}
              </ul>
            ) : (
              // Reached when the only failure is the honeypot, whose field is not
              // rendered back to the visitor. An empty list would be a dead end.
              <p>{labels.errorBody}</p>
            )}
          </Alert>
        </div>
      ) : null}

      <form action={formAction} className="relative mt-6 space-y-5" noValidate>
        <input type="hidden" name="locale" value={locale} />
        <HoneypotField name="companyWebsite" />

        <TextField
          id="fullName"
          name="fullName"
          label={labels.nameLabel}
          placeholder={labels.namePlaceholder}
          autoComplete="name"
          required
          requiredLabel={validationMessages.required}
          error={message(fieldErrors.fullName)}
        />

        <TextField
          id="email"
          name="email"
          type="email"
          label={labels.emailLabel}
          placeholder={labels.emailPlaceholder}
          autoComplete="email"
          required
          requiredLabel={validationMessages.required}
          error={message(fieldErrors.email)}
        />

        <TextField
          id="phone"
          name="phone"
          type="tel"
          label={labels.phoneLabel}
          placeholder={labels.phonePlaceholder}
          hint={labels.phoneHint}
          autoComplete="tel"
          error={message(fieldErrors.phone)}
        />

        <SelectField
          id="department"
          name="department"
          label={labels.departmentLabel}
          hint={labels.departmentHint}
          defaultValue={defaultDepartment ?? ""}
          error={message(fieldErrors.department)}
        >
          <option value="">{labels.departmentGeneral}</option>
          {DEPARTMENTS.map((department) => (
            <option key={department.slug} value={department.slug}>
              {departmentLabels[department.slug]}
            </option>
          ))}
        </SelectField>

        <TextField
          id="subject"
          name="subject"
          label={labels.subjectLabel}
          placeholder={labels.subjectPlaceholder}
          required
          requiredLabel={validationMessages.required}
          error={message(fieldErrors.subject)}
        />

        <TextAreaField
          id="message"
          name="message"
          label={labels.messageLabel}
          placeholder={labels.messagePlaceholder}
          required
          requiredLabel={validationMessages.required}
          error={message(fieldErrors.message)}
        />

        <div>
          <label htmlFor="consent" className="flex items-start gap-3 text-sm">
            <input
              id="consent"
              name="consent"
              type="checkbox"
              aria-invalid={fieldErrors.consent ? true : undefined}
              aria-describedby={
                fieldErrors.consent ? "consent-error" : undefined
              }
              className="mt-1 h-4 w-4 shrink-0 rounded border-border-strong"
            />
            <span className="text-body">{labels.consentLabel}</span>
          </label>
          {fieldErrors.consent ? (
            <p
              id="consent-error"
              className="mt-1 text-xs font-medium text-red-700"
            >
              {message(fieldErrors.consent)}
            </p>
          ) : null}
        </div>

        <Button type="submit" variant="accent" size="lg" disabled={isPending}>
          {isPending ? (
            <>
              <Spinner label={labels.submitting} />
              {labels.submitting}
            </>
          ) : (
            labels.submit
          )}
        </Button>
      </form>
    </section>
  );
}
