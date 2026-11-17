"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { SelectField, TextField } from "@/components/ui/Form";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import {
  saveKycApplicationAction,
  type KycActionState,
} from "@/lib/real-estate/kyc-actions";
import {
  KYC_ID_TYPES,
  KYC_RESIDENCY_STATUSES,
  isKycDecidedStatus,
  kycDocumentKindLabelKey,
  kycIdTypeLabelKey,
  kycResidencyStatusLabelKey,
  kycStatusLabelKey,
  type KycApplicationRecord,
  type KycDocumentKind,
  type KycDocumentRecord,
  type KycMembershipType,
} from "@/lib/real-estate/kyc";
import { KYC_ERROR_KEYS } from "@/lib/validation/kyc";

import { KycDocumentUpload } from "./KycDocumentUpload";

/**
 * The KYC application form.
 *
 * Two submit paths over one field set: "save and continue later" writes a draft,
 * and "submit for review" writes a submitted application once both consents are
 * ticked. Both post to the same Server Action with a different `intent`, so a
 * draft is never a different shape from a submission.
 *
 * The document uploader is a separate island, because it posts multipart bodies
 * of its own; keeping it out of the form means a large upload never re-sends the
 * whole application, and the file inputs are never part of the application POST.
 *
 * `t` is built here from a serializable `locale` rather than passed in: a
 * translator is a closure and cannot cross the Server/Client boundary.
 */
export function KycApplicationForm({
  membershipType,
  application,
  documents,
  locale,
}: {
  membershipType: KycMembershipType;
  application: KycApplicationRecord | null;
  documents: KycDocumentRecord[];
  locale: Locale;
}) {
  const t = createTranslator(locale).t;

  const [state, submitAction] = useActionState(
    saveKycApplicationAction.bind(null, membershipType, "submit", locale),
    null as KycActionState | null,
  );
  const [draftState, draftAction] = useActionState(
    saveKycApplicationAction.bind(null, membershipType, "draft", locale),
    null as KycActionState | null,
  );

  const [consentOpen, setConsentOpen] = useState(false);

  const errorState = state && !state.ok ? state : null;
  // The action returns stable field-message keys, mapped through
  // `KYC_ERROR_KEYS` so a field the schema adds cannot render its raw key.
  const fieldError = (
    field: keyof typeof KYC_ERROR_KEYS,
  ): string | undefined =>
    errorState?.fields?.[field] ? t(`account.kyc.${KYC_ERROR_KEYS[field]}`) : undefined;

  const isApproved = application?.status === "approved";
  const isDecided = application !== null && isKycDecidedStatus(application.status);
  const readOnly = isApproved;

  return (
    <div className="space-y-8">
      {application ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted">{t("account.kyc.statusLabel")}</span>
          <Badge tone={isApproved ? "success" : "neutral"}>
            {t(kycStatusLabelKey(application.status))}
          </Badge>
        </div>
      ) : null}

      {isDecided && application.decisionReason ? (
        <Notice tone={isApproved ? "success" : "info"}>
          <strong>{t("account.kyc.reasonLabel")}:</strong>{" "}
          {application.decisionReason}
        </Notice>
      ) : null}

      {state?.ok ? (
        <Notice tone="success">{t("account.kyc.submitted")}</Notice>
      ) : null}
      {draftState?.ok ? (
        <Notice tone="info">{t("account.kyc.draftSaved")}</Notice>
      ) : null}

      {errorState ? (
        <Notice tone="error">
          {errorState.error === "documents_missing" && errorState.fields?.form
            ? t("account.kyc.missingRequired", {
                items: errorState.fields.form
                  .split(",")
                  .map((kind) =>
                    t(kycDocumentKindLabelKey(kind as KycDocumentKind)),
                  )
                  .join(", "),
              })
            : t(`errors.${errorState.error}`)}
        </Notice>
      ) : null}

      <KycDocumentUpload
        membershipType={membershipType}
        documents={documents}
        locale={locale}
        readOnly={readOnly}
      />

      <form action={submitAction} className="space-y-6" noValidate>
        <Card>
          <h2 className="text-lg font-semibold text-ink-900">
            {t("account.kyc.sectionPersonal")}
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <TextField
              id="fullLegalName"
              name="fullLegalName"
              label={t("account.kyc.fullLegalName")}
              defaultValue={application?.fullLegalName ?? ""}
              required
              error={fieldError("fullLegalName")}
            />
            <TextField
              id="email"
              name="email"
              type="email"
              label={t("account.kyc.email")}
              defaultValue={application?.email ?? ""}
              required
              error={fieldError("email")}
            />
            <TextField
              id="phone"
              name="phone"
              label={t("account.kyc.phone")}
              defaultValue={application?.phone ?? ""}
              required
              error={fieldError("phone")}
            />
            <TextField
              id="dateOfBirth"
              name="dateOfBirth"
              type="date"
              label={t("account.kyc.dateOfBirth")}
              defaultValue={application?.dateOfBirth ?? ""}
              required
              error={fieldError("dateOfBirth")}
            />
            <TextField
              id="countryOfResidence"
              name="countryOfResidence"
              label={t("account.kyc.countryOfResidence")}
              defaultValue={application?.countryOfResidence ?? "Cameroon"}
              required
              error={fieldError("countryOfResidence")}
            />
            <TextField
              id="currentLocation"
              name="currentLocation"
              label={t("account.kyc.currentLocation")}
              defaultValue={application?.currentLocation ?? ""}
              error={fieldError("currentLocation")}
            />
            <SelectField
              id="residencyStatus"
              name="residencyStatus"
              label={t("account.kyc.residencyStatusLabel")}
              defaultValue={application?.residencyStatus ?? "permanent"}
            >
              {KYC_RESIDENCY_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t(kycResidencyStatusLabelKey(status))}
                </option>
              ))}
            </SelectField>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-ink-900">
            {t("account.kyc.sectionIdentity")}
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <SelectField
              id="idType"
              name="idType"
              label={t("account.kyc.idTypeLabel")}
              defaultValue={application?.idType ?? "national_id_card"}
            >
              {KYC_ID_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(kycIdTypeLabelKey(type))}
                </option>
              ))}
            </SelectField>
            <TextField
              id="idIssuingCountry"
              name="idIssuingCountry"
              label={t("account.kyc.idIssuingCountry")}
              defaultValue={application?.idIssuingCountry ?? "Cameroon"}
              required
              error={fieldError("idIssuingCountry")}
            />
            <TextField
              id="idNumberLast4"
              name="idNumberLast4"
              label={t("account.kyc.idNumberLast4")}
              hint={t("account.kyc.idNumberLast4Hint")}
              maxLength={4}
              defaultValue={application?.idNumberLast4 ?? ""}
              error={fieldError("idNumberLast4")}
            />
          </div>
        </Card>

        {!readOnly ? (
          <Card>
            <h2 className="text-lg font-semibold text-ink-900">
              {t("account.kyc.sectionSubmit")}
            </h2>

            {!consentOpen ? (
              <p className="mt-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setConsentOpen(true)}
                >
                  {application?.status === "rejected" ||
                  application?.status === "changes_requested"
                    ? t("account.kyc.resubmit")
                    : t("account.kyc.submit")}
                </Button>
              </p>
            ) : null}

            <div className={consentOpen ? "mt-4 space-y-4" : "hidden"}>
              <ConsentRow
                id="videoConsent"
                label={t("account.kyc.videoConsent")}
                error={
                  errorState?.fields?.videoConsent
                    ? t("errors.consent_required")
                    : undefined
                }
              />
              <ConsentRow
                id="declaration"
                label={t("account.kyc.declaration")}
                error={
                  errorState?.fields?.declaration
                    ? t("errors.consent_required")
                    : undefined
                }
              />
              <p className="text-xs text-muted">{t("account.kyc.privacyNote")}</p>
              <SubmitButton
                label={t("account.kyc.submit")}
                pendingLabel={t("account.kyc.submitting")}
              />
            </div>
          </Card>
        ) : null}

        {!readOnly ? (
          <div className="flex flex-wrap gap-3">
            <DraftButton
              formAction={draftAction}
              label={t("account.kyc.saveDraft")}
              pendingLabel={t("account.kyc.savingDraft")}
            />
          </div>
        ) : null}
      </form>
    </div>
  );
}

function ConsentRow({
  id,
  label,
  error,
}: {
  id: string;
  label: string;
  error?: string;
}) {
  return (
    <div>
      <div className="flex items-start gap-2.5">
        <input
          id={id}
          name={id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-border-strong"
        />
        <label htmlFor={id} className="text-sm text-body">
          {label}
        </label>
      </div>
      {error ? (
        <p className="mt-1 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function SubmitButton({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

function DraftButton({
  formAction,
  label,
  pendingLabel,
}: {
  formAction: (formData: FormData) => void;
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="secondary"
      formAction={formAction}
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? pendingLabel : label}
    </Button>
  );
}
