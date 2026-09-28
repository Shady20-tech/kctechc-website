"use client";

import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import {
  HoneypotField,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/ui/Form";
import { Spinner } from "@/components/ui/Loading";
import { submitQuoteRequest } from "@/lib/inquiries/quote-actions";
import type { Locale } from "@/lib/i18n/locales";
import type { QuoteFormState } from "@/lib/validation/quote";

export type QuoteFormLabels = Record<
  | "formHeading"
  | "formIntro"
  | "nameLabel"
  | "namePlaceholder"
  | "emailLabel"
  | "emailPlaceholder"
  | "phoneLabel"
  | "phoneHint"
  | "phonePlaceholder"
  | "locationLabel"
  | "locationPlaceholder"
  | "locationHint"
  | "regionLabel"
  | "regionHint"
  | "regionPlaceholder"
  | "serviceLabel"
  | "serviceHint"
  | "servicePlaceholder"
  | "serviceGeneral"
  | "propertyTypeLabel"
  | "propertyTypeHint"
  | "propertyTypePlaceholder"
  | "propertyTypeResidential"
  | "propertyTypeCommercial"
  | "propertyTypeIndustrial"
  | "contactMethodLabel"
  | "contactMethodHint"
  | "contactMethodEmail"
  | "contactMethodPhone"
  | "contactMethodWhatsapp"
  | "contactDetailsLabel"
  | "contactDetailsHint"
  | "contactDetailsPlaceholder"
  | "descriptionLabel"
  | "descriptionPlaceholder"
  | "appointmentHeading"
  | "appointmentIntro"
  | "appointmentRequestLabel"
  | "appointmentDateLabel"
  | "appointmentDateHint"
  | "appointmentWindowLabel"
  | "appointmentWindowMorning"
  | "appointmentWindowAfternoon"
  | "appointmentWindowAnytime"
  | "appointmentNotesLabel"
  | "appointmentNotesPlaceholder"
  | "filesLabel"
  | "filesHint"
  | "consentLabel"
  | "submit"
  | "submitting"
  | "successTitle"
  | "successBody"
  | "successAppointmentBody"
  | "errorTitle"
  | "errorBody"
  | "rateLimitedTitle"
  | "rateLimitedBody"
  | "unavailableTitle"
  | "unavailableBody"
  | "errorSummaryHeading"
  | "referenceLabel",
  string
>;

const INITIAL_STATE: QuoteFormState = { status: "idle" };

/**
 * Quote / site-visit request form.
 *
 * Uses `useActionState` so validation errors and the success receipt survive a
 * server round trip, and so the form still works with JavaScript unavailable — it
 * is a real `<form>` posting to a server action.
 *
 * The file input is `multiple` with no `accept` restriction relied upon for
 * safety: `accept` is a browser convenience that filters the picker, and a
 * determined client can post anything regardless. The server inspects the file's
 * actual bytes, which is the control that matters. `accept` is still set because
 * it helps an honest visitor pick the right file.
 *
 * The site-visit fields are revealed by the checkbox rather than always shown.
 * They are inside a `<fieldset>` that is disabled while collapsed, so a screen
 * reader does not encounter fields that are not on screen and their values are
 * not submitted when the visit is not requested.
 */
export function QuoteForm({
  locale,
  labels,
  regionOptions,
  serviceOptions,
  validationMessages,
  defaultService,
  maxFiles,
  maxSize,
}: {
  locale: Locale;
  labels: QuoteFormLabels;
  regionOptions: readonly { slug: string; label: string }[];
  serviceOptions: readonly { slug: string; label: string }[];
  validationMessages: Record<string, string>;
  defaultService?: string;
  maxFiles: number;
  maxSize: string;
}) {
  const [state, formAction, isPending] = useActionState(
    submitQuoteRequest,
    INITIAL_STATE,
  );
  const [visitRequested, setVisitRequested] = useState(false);

  const message = (
    key: string | undefined,
    values?: Record<string, string>,
  ) => {
    if (!key) return undefined;
    const template =
      validationMessages[key] ?? validationMessages.required ?? key;
    return template.replace(/\{(\w+)\}/g, (match, token: string) => {
      const value = values?.[token];
      return value === undefined ? match : value;
    });
  };

  const fieldErrors = state.status === "invalid" ? state.errors : {};

  return (
    <section
      aria-labelledby="quote-form-heading"
      className="rounded-card border border-border bg-surface p-6 shadow-card sm:p-8"
    >
      <h2
        id="quote-form-heading"
        className="text-xl font-semibold text-ink-900"
      >
        {labels.formHeading}
      </h2>
      <p className="mt-2 text-sm text-body">{labels.formIntro}</p>

      {state.status === "success" ? (
        <div className="mt-6">
          <Alert tone="success" title={labels.successTitle}>
            <p>{labels.successBody}</p>
            {state.appointmentRequested ? (
              <p className="mt-2">{labels.successAppointmentBody}</p>
            ) : null}
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
            id="quote-form-errors"
          >
            {Object.keys(fieldErrors).length > 0 ? (
              <ul className="list-inside list-disc">
                {Object.entries(fieldErrors).map(([field, key]) => (
                  <li key={field}>
                    {message(key, { maxFiles: String(maxFiles), maxSize })}
                  </li>
                ))}
              </ul>
            ) : (
              <p>{labels.errorBody}</p>
            )}
          </Alert>
        </div>
      ) : null}

      <form
        action={formAction}
        className="relative mt-6 space-y-5"
        noValidate
        encType="multipart/form-data"
      >
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

        <TextField
          id="location"
          name="location"
          label={labels.locationLabel}
          placeholder={labels.locationPlaceholder}
          hint={labels.locationHint}
          required
          requiredLabel={validationMessages.required}
          error={message(fieldErrors.location)}
        />

        <SelectField
          id="region"
          name="region"
          label={labels.regionLabel}
          hint={labels.regionHint}
          defaultValue=""
          error={message(fieldErrors.region)}
        >
          <option value="">{labels.regionPlaceholder}</option>
          {regionOptions.map((region) => (
            <option key={region.slug} value={region.slug}>
              {region.label}
            </option>
          ))}
        </SelectField>

        <SelectField
          id="service"
          name="service"
          label={labels.serviceLabel}
          hint={labels.serviceHint}
          defaultValue={defaultService ?? ""}
          error={message(fieldErrors.service)}
        >
          <option value="">{labels.serviceGeneral}</option>
          {serviceOptions.map((service) => (
            <option key={service.slug} value={service.slug}>
              {service.label}
            </option>
          ))}
        </SelectField>

        <SelectField
          id="propertyType"
          name="propertyType"
          label={labels.propertyTypeLabel}
          hint={labels.propertyTypeHint}
          defaultValue=""
          required
          requiredLabel={validationMessages.required}
          error={message(fieldErrors.propertyType)}
        >
          <option value="">{labels.propertyTypePlaceholder}</option>
          <option value="residential">{labels.propertyTypeResidential}</option>
          <option value="commercial">{labels.propertyTypeCommercial}</option>
          <option value="industrial">{labels.propertyTypeIndustrial}</option>
        </SelectField>

        <SelectField
          id="contactMethod"
          name="contactMethod"
          label={labels.contactMethodLabel}
          hint={labels.contactMethodHint}
          defaultValue=""
          required
          requiredLabel={validationMessages.required}
          error={message(fieldErrors.contactMethod)}
        >
          <option value="">{labels.propertyTypePlaceholder}</option>
          <option value="email">{labels.contactMethodEmail}</option>
          <option value="phone">{labels.contactMethodPhone}</option>
          <option value="whatsapp">{labels.contactMethodWhatsapp}</option>
        </SelectField>

        <TextField
          id="contactDetails"
          name="contactDetails"
          label={labels.contactDetailsLabel}
          placeholder={labels.contactDetailsPlaceholder}
          hint={labels.contactDetailsHint}
          error={message(fieldErrors.contactDetails)}
        />

        <TextAreaField
          id="description"
          name="description"
          label={labels.descriptionLabel}
          placeholder={labels.descriptionPlaceholder}
          required
          requiredLabel={validationMessages.required}
          error={message(fieldErrors.description)}
        />

        <fieldset className="rounded-card border border-border bg-surface-alt p-5">
          <legend className="px-1 text-base font-semibold text-ink-900">
            {labels.appointmentHeading}
          </legend>
          <p className="mt-1 text-sm text-body">{labels.appointmentIntro}</p>

          <div className="mt-4">
            <label
              htmlFor="appointmentRequested"
              className="flex items-start gap-3 text-sm"
            >
              <input
                id="appointmentRequested"
                name="appointmentRequested"
                type="checkbox"
                checked={visitRequested}
                onChange={(event) => setVisitRequested(event.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 rounded border-border-strong"
              />
              <span className="font-medium text-ink-900">
                {labels.appointmentRequestLabel}
              </span>
            </label>
          </div>

          {visitRequested ? (
            <div className="mt-5 space-y-5">
              <TextField
                id="appointmentDate"
                name="appointmentDate"
                type="date"
                label={labels.appointmentDateLabel}
                hint={labels.appointmentDateHint}
                error={message(fieldErrors.appointmentDate)}
              />

              <SelectField
                id="appointmentWindow"
                name="appointmentWindow"
                label={labels.appointmentWindowLabel}
                defaultValue="anytime"
                error={message(fieldErrors.appointmentWindow)}
              >
                <option value="anytime">
                  {labels.appointmentWindowAnytime}
                </option>
                <option value="morning">
                  {labels.appointmentWindowMorning}
                </option>
                <option value="afternoon">
                  {labels.appointmentWindowAfternoon}
                </option>
              </SelectField>

              <TextAreaField
                id="appointmentNotes"
                name="appointmentNotes"
                label={labels.appointmentNotesLabel}
                placeholder={labels.appointmentNotesPlaceholder}
                rows={3}
                error={message(fieldErrors.appointmentNotes)}
              />
            </div>
          ) : null}
        </fieldset>

        <div>
          <label
            htmlFor="attachments"
            className="block text-sm font-medium text-ink-900"
          >
            {labels.filesLabel}
          </label>
          <p id="attachments-hint" className="mt-1 text-xs text-muted">
            {message(labels.filesHint, {
              maxFiles: String(maxFiles),
              maxSize,
            })}
          </p>
          <input
            id="attachments"
            name="attachments"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
            aria-describedby={
              fieldErrors.attachments
                ? "attachments-hint attachments-error"
                : "attachments-hint"
            }
            aria-invalid={fieldErrors.attachments ? true : undefined}
            className="mt-1.5 w-full rounded-field border border-border-strong bg-surface px-3 py-2.5 text-sm text-ink-900 transition-soft file:mr-3 file:rounded-pill file:border-0 file:bg-surface-sunken file:px-3 file:py-1.5 file:text-xs file:font-semibold focus:outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
          />
          {fieldErrors.attachments ? (
            <p
              id="attachments-error"
              className="mt-1 text-xs font-medium text-red-700"
            >
              {message(fieldErrors.attachments, {
                maxFiles: String(maxFiles),
                maxSize,
              })}
            </p>
          ) : null}
        </div>

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
