"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import {
  HoneypotField,
  TextAreaField,
  TextField,
} from "@/components/ui/Form";
import { Spinner } from "@/components/ui/Loading";
import type { Locale } from "@/lib/i18n/locales";
import { submitListingInquiry } from "@/lib/real-estate/inquiry-actions";
import type { ListingInquiryState } from "@/lib/validation/listing-inquiry";

export type ListingInquiryLabels = {
  heading: string;
  intro: string;
  nameLabel: string;
  namePlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  phoneLabel: string;
  phonePlaceholder: string;
  phoneHint: string;
  messageLabel: string;
  messagePlaceholder: string;
  messageHint: string;
  viewingLabel: string;
  viewingHint: string;
  consentLabel: string;
  submit: string;
  submitting: string;
  successTitle: string;
  successBody: string;
  referenceLabel: string;
  errorTitle: string;
  errorBody: string;
  errorSummaryHeading: string;
  rateLimitedTitle: string;
  rateLimitedBody: string;
  unavailableTitle: string;
  unavailableBody: string;
};

const INITIAL_STATE: ListingInquiryState = { status: "idle" };

/**
 * Property enquiry form.
 *
 * The listing id travels in a hidden field, so an enquiry is always bound to the
 * listing it was written from. The server re-checks that the listing is published
 * before writing — the hidden field is a convenience, not a guarantee.
 *
 * `useActionState` keeps the form working without JavaScript: it is a real
 * `<form>` posting to a Server Action, with the success receipt rendered from the
 * returned state rather than from client bookkeeping.
 */
export function ListingInquiryForm({
  listingId,
  locale,
  labels,
  validationMessages,
}: {
  listingId: string;
  locale: Locale;
  labels: ListingInquiryLabels;
  validationMessages: Record<string, string>;
}) {
  const [state, formAction, isPending] = useActionState(
    submitListingInquiry,
    INITIAL_STATE,
  );

  const message = (key: string | undefined) =>
    key
      ? (validationMessages[key] ?? validationMessages.required ?? key)
      : undefined;

  const fieldErrors = state.status === "invalid" ? state.errors : {};

  return (
    <section
      aria-labelledby="listing-inquiry-heading"
      className="rounded-card border border-border bg-surface p-6 shadow-card sm:p-8"
    >
      <h2
        id="listing-inquiry-heading"
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

      {state.status === "error" || state.status === "verification_failed" ? (
        <div className="mt-6">
          <Alert tone="error" title={labels.errorTitle}>
            {labels.errorBody}
          </Alert>
        </div>
      ) : null}

      {state.status === "invalid" ? (
        <div className="mt-6">
          <Alert tone="error" title={labels.errorSummaryHeading} id="form-errors">
            {Object.keys(fieldErrors).length > 0 ? (
              <ul className="list-inside list-disc">
                {Object.entries(fieldErrors).map(([field, key]) => (
                  <li key={field}>{message(key)}</li>
                ))}
              </ul>
            ) : (
              <p>{labels.errorBody}</p>
            )}
          </Alert>
        </div>
      ) : null}

      <form action={formAction} className="relative mt-6 space-y-5" noValidate>
        <input type="hidden" name="listingId" value={listingId} />
        <input type="hidden" name="locale" value={locale} />
        <HoneypotField name="companyWebsite" />

        <TextField
          id="listing-inquiry-name"
          name="fullName"
          label={labels.nameLabel}
          placeholder={labels.namePlaceholder}
          autoComplete="name"
          required
          requiredLabel={validationMessages.required}
          error={message(fieldErrors.fullName)}
        />

        <TextField
          id="listing-inquiry-email"
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
          id="listing-inquiry-phone"
          name="phone"
          type="tel"
          label={labels.phoneLabel}
          placeholder={labels.phonePlaceholder}
          hint={labels.phoneHint}
          autoComplete="tel"
          error={message(fieldErrors.phone)}
        />

        <TextAreaField
          id="listing-inquiry-message"
          name="message"
          label={labels.messageLabel}
          placeholder={labels.messagePlaceholder}
          hint={labels.messageHint}
          required
          requiredLabel={validationMessages.required}
          rows={5}
          error={message(fieldErrors.message)}
        />

        <div>
          <label
            htmlFor="listing-inquiry-viewing"
            className="flex items-start gap-3 text-sm"
          >
            <input
              id="listing-inquiry-viewing"
              name="viewingRequest"
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0 rounded border-border-strong"
            />
            <span className="text-body">
              {labels.viewingLabel}
              <span className="mt-1 block text-xs text-muted">
                {labels.viewingHint}
              </span>
            </span>
          </label>
        </div>

        <div>
          <label
            htmlFor="listing-inquiry-consent"
            className="flex items-start gap-3 text-sm"
          >
            <input
              id="listing-inquiry-consent"
              name="consent"
              type="checkbox"
              aria-invalid={fieldErrors.consent ? true : undefined}
              aria-describedby={
                fieldErrors.consent ? "listing-inquiry-consent-error" : undefined
              }
              className="mt-1 h-4 w-4 shrink-0 rounded border-border-strong"
            />
            <span className="text-body">{labels.consentLabel}</span>
          </label>
          {fieldErrors.consent ? (
            <p
              id="listing-inquiry-consent-error"
              className="mt-1 text-xs font-medium text-red-700"
            >
              {message(fieldErrors.consent)}
            </p>
          ) : null}
        </div>

        <div className="pt-2">
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
        </div>
      </form>
    </section>
  );
}
