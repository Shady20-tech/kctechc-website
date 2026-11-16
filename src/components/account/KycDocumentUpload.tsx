"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { SelectField, TextField } from "@/components/ui/Form";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import {
  removeKycDocumentAction,
  uploadKycDocumentAction,
  type KycDocumentState,
} from "@/lib/real-estate/kyc-actions";
import {
  KYC_DOCUMENT_KINDS,
  kycDocumentGuidanceKey,
  kycDocumentKindLabelKey,
  type KycDocumentRecord,
  type KycMembershipType,
} from "@/lib/real-estate/kyc";
import {
  exceedsSizeLimit,
  MAX_KYC_DOCUMENT_BYTES,
  MAX_KYC_VIDEO_BYTES,
} from "@/lib/uploads/limits";
import {
  ALLOWED_KYC_DOCUMENT_TYPES,
  ALLOWED_KYC_VIDEO_TYPES,
} from "@/lib/uploads/validation";

/**
 * KYC document and face-video uploader.
 *
 * Each upload is its own multipart POST, so a large face video never re-sends the
 * application form. The file is validated in the browser only as a courtesy (an
 * obviously oversized file is refused before the bytes cross the network); the
 * server re-checks the real bytes and is the control.
 *
 * The accepted types and the size limit shown under the input are read from the
 * same constants the server validates against, so the promise the UI makes and
 * the rule the server enforces cannot drift.
 */
export function KycDocumentUpload({
  membershipType,
  documents,
  locale,
  readOnly,
}: {
  membershipType: KycMembershipType;
  documents: KycDocumentRecord[];
  locale: Locale;
  readOnly: boolean;
}) {
  const t = createTranslator(locale).t;

  const [state, formAction] = useActionState(
    uploadKycDocumentAction.bind(null, membershipType, locale),
    null as KycDocumentState | null,
  );
  const [kind, setKind] = useState<string>("id_front");
  const [clientError, setClientError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isVideo = kind === "face_video";
  const limit = isVideo ? MAX_KYC_VIDEO_BYTES : MAX_KYC_DOCUMENT_BYTES;
  const accept = (
    isVideo ? ALLOWED_KYC_VIDEO_TYPES : ALLOWED_KYC_DOCUMENT_TYPES
  ).join(",");

  const uploaded = new Set(documents.map((document) => document.kind));

  function onFileChange(): void {
    const file = fileRef.current?.files?.[0] ?? null;
    setClientError(
      exceedsSizeLimit(file, limit) ? "too_large" : null,
    );
  }

  function remove(documentId: string): void {
    setRemovingId(documentId);
    startTransition(async () => {
      await removeKycDocumentAction(documentId, locale);
      setRemovingId(null);
    });
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink-900">
          {t("account.kyc.uploadHeading")}
        </h2>
        <p className="mt-1 text-sm text-muted">{t("account.kyc.uploadedDocuments")}</p>
      </div>

      {documents.length === 0 ? (
        <p className="text-sm text-muted">{t("account.kyc.noDocuments")}</p>
      ) : (
        <ul className="space-y-2">
          {documents.map((document) => (
            <li
              key={document.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-field border border-border bg-surface-alt px-4 py-3"
            >
              <span className="flex items-center gap-3">
                <Badge tone="info">
                  {t(kycDocumentKindLabelKey(document.kind))}
                </Badge>
                <span className="text-sm text-body">
                  {document.originalFilename}
                </span>
              </span>
              {!readOnly ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={removingId === document.id}
                  onClick={() => remove(document.id)}
                >
                  {removingId === document.id
                    ? t("account.kyc.removing")
                    : t("account.kyc.remove")}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {!readOnly ? (
        <form action={formAction} className="space-y-4">
          {state && !state.ok ? (
            <Notice tone="error">
              {t(`errors.${state.error}`)}
            </Notice>
          ) : null}
          {clientError ? (
            <Notice tone="error">{t("errors.too_large")}</Notice>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              id="kind"
              name="kind"
              label={t("account.kyc.documentLabel")}
              value={kind}
              onChange={(event) => setKind(event.target.value)}
            >
              {KYC_DOCUMENT_KINDS.map((value) => (
                <option key={value} value={value}>
                  {t(kycDocumentKindLabelKey(value))}
                  {uploaded.has(value) ? " ✓" : ""}
                </option>
              ))}
            </SelectField>
            <TextField
              id="issuingCountry"
              name="issuingCountry"
              label={t("account.kyc.issuingCountryLabel")}
            />
          </div>

          <p className="text-xs text-muted">{t(kycDocumentGuidanceKey(kind as never))}</p>

          <TextField
            id="file"
            name="file"
            type="file"
            label={t("account.kyc.fileLabel")}
            accept={accept}
            onChange={onFileChange}
            ref={fileRef}
            required
          />

          <TextField
            id="note"
            name="note"
            label={t("account.kyc.noteLabel")}
          />

          <p className="text-xs text-muted">{t("account.kyc.replaceHint")}</p>

          <UploadButton
            label={t("account.kyc.uploadCta")}
            pendingLabel={t("account.kyc.uploading")}
            disabled={clientError !== null}
          />
        </form>
      ) : null}

      {pending ? <p className="text-xs text-muted">{t("account.kyc.removing")}</p> : null}
    </section>
  );
}

function UploadButton({
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
