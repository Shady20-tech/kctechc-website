"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { TextAreaField } from "@/components/ui/Form";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import {
  addKycNoteAction,
  getKycDocumentUrlAction,
  reviewKycApplicationAction,
  type KycReviewState,
} from "@/lib/real-estate/kyc-review-actions";
import {
  kycDocumentKindLabelKey,
  type KycDocumentRecord,
  type KycStatus,
} from "@/lib/real-estate/kyc";

/**
 * The super-admin review panel.
 *
 * Three independent capabilities, each its own Server Action so a failure in one
 * cannot be mistaken for another:
 *
 *   * **decide** — approve, reject or request changes. The approval is the only
 *     path in the codebase that creates a capability, and it goes through the
 *     `approve_kyc_application` function on the service-role client.
 *   * **note** — an internal note that is never shown to the applicant.
 *   * **view** — mint a short-lived signed URL for one document, and record that
 *     it was viewed.
 *
 * The role gate is repeated in every action, and the database refuses a
 * non-super-admin independently, so this component's `canDecide` prop is a
 * presentation concern rather than the control.
 */
export function KycReviewPanel({
  applicationId,
  status,
  documents,
  locale,
  canDecide,
}: {
  applicationId: string;
  status: KycStatus;
  documents: KycDocumentRecord[];
  locale: Locale;
  canDecide: boolean;
}) {
  const t = createTranslator(locale).t;

  const [state, decisionAction] = useActionState(
    reviewKycApplicationAction.bind(null, applicationId),
    null as KycReviewState | null,
  );
  const [noteState, noteAction] = useActionState(
    addKycNoteAction.bind(null, applicationId),
    null as KycReviewState | null,
  );

  const [decision, setDecision] = useState<"approve" | "reject" | "request_changes">(
    "approve",
  );
  const [urlError, setUrlError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reasonRequired = decision !== "approve";
  const alreadyApproved = status === "approved";

  function openDocument(documentId: string): void {
    setUrlError(null);
    setOpeningId(documentId);
    startTransition(async () => {
      const result = await getKycDocumentUrlAction(documentId);
      setOpeningId(null);
      if (!result.ok) {
        setUrlError(result.error);
        return;
      }
      window.open(result.url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <div className="space-y-8">
      <section aria-labelledby="kyc-documents-heading">
        <h3
          id="kyc-documents-heading"
          className="text-lg font-semibold text-ink-900"
        >
          {t("adminKyc.documentsSection")}
        </h3>
        <p className="mt-1 text-sm text-muted">{t("adminKyc.signedUrlNote")}</p>

        {urlError ? (
          <div className="mt-3">
            <Notice tone="error">
              {t(`errors.${urlError}`)}
            </Notice>
          </div>
        ) : null}

        {documents.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            {t("account.kyc.noDocuments")}
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {documents.map((document) => (
              <li
                key={document.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-field border border-border bg-surface-alt px-4 py-3"
              >
                <span className="flex flex-wrap items-center gap-3">
                  <Badge tone="info">
                    {t(kycDocumentKindLabelKey(document.kind))}
                  </Badge>
                  <span className="text-sm text-body">
                    {document.originalFilename}
                  </span>
                  <span className="font-mono text-xs text-muted">
                    {Math.round(document.byteSize / 1024)} KB
                  </span>
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={openingId === document.id}
                  onClick={() => openDocument(document.id)}
                >
                  {openingId === document.id
                    ? t("adminKyc.viewing")
                    : t("adminKyc.viewDocument")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canDecide ? (
        <section aria-labelledby="kyc-decision-heading">
          <h3
            id="kyc-decision-heading"
            className="text-lg font-semibold text-ink-900"
          >
            {t("adminKyc.decisionSection")}
          </h3>

          {state && !state.ok ? (
            <div className="mt-3">
              <Notice tone="error">
                {t(`errors.${state.error}`)}
                {state.detail ? (
                  <span className="mt-2 block break-words font-mono text-xs">
                    {state.detail}
                  </span>
                ) : null}
              </Notice>
            </div>
          ) : null}
          {state?.ok ? (
            <div className="mt-3">
              <Notice tone="success">{t("adminKyc.decisionSaved")}</Notice>
            </div>
          ) : null}

          <form action={decisionAction} className="mt-4 space-y-4">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-ink-900">
                {t("adminKyc.decisionLabel")}
              </legend>
              {(
                [
                  ["approve", t("adminKyc.decisionApprove")],
                  ["reject", t("adminKyc.decisionReject")],
                  ["request_changes", t("adminKyc.decisionRequestChanges")],
                ] as const
              ).map(([value, label]) => (
                <div key={value} className="flex items-center gap-2.5">
                  <input
                    id={`decision-${value}`}
                    name="decision"
                    type="radio"
                    value={value}
                    checked={decision === value}
                    onChange={() => setDecision(value)}
                    className="h-4 w-4 border-border-strong"
                  />
                  <label
                    htmlFor={`decision-${value}`}
                    className="text-sm text-body"
                  >
                    {label}
                  </label>
                </div>
              ))}
            </fieldset>

            <TextAreaField
              id="reason"
              name="reason"
              label={t("adminKyc.reasonLabel")}
              hint={t("adminKyc.reasonHint")}
              rows={4}
              required={reasonRequired}
            />

            <DecisionButton
              label={t("adminKyc.save")}
              pendingLabel={t("adminKyc.saving")}
              disabled={alreadyApproved}
            />
          </form>
        </section>
      ) : null}

      <section aria-labelledby="kyc-notes-heading">
        <h3 id="kyc-notes-heading" className="text-lg font-semibold text-ink-900">
          {t("adminKyc.internalNotesSection")}
        </h3>

        {noteState && !noteState.ok ? (
          <div className="mt-3">
            <Notice tone="error">
              {t(`errors.${noteState.error}`)}
              {noteState.detail ? (
                <span className="mt-2 block break-words font-mono text-xs">
                  {noteState.detail}
                </span>
              ) : null}
            </Notice>
          </div>
        ) : null}
        {noteState?.ok ? (
          <div className="mt-3">
            <Notice tone="success">{t("adminKyc.noteAdded")}</Notice>
          </div>
        ) : null}

        <form action={noteAction} className="mt-4 space-y-4">
          <TextAreaField
            id="note"
            name="note"
            label={t("adminKyc.noteLabel")}
            hint={t("adminKyc.noteHint")}
            rows={3}
            required
          />
          <NoteButton
            label={t("adminKyc.addNote")}
            pendingLabel={t("adminKyc.addingNote")}
          />
        </form>
      </section>

      {pending ? (
        <p className="text-xs text-muted">{t("adminKyc.viewing")}</p>
      ) : null}
    </div>
  );
}

function DecisionButton({
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
    <Button type="submit" disabled={disabled || pending} aria-busy={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

function NoteButton({
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
      variant="secondary"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? pendingLabel : label}
    </Button>
  );
}
