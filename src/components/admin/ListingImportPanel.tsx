"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { TextAreaField } from "@/components/ui/Form";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import {
  commitListingImportAction,
  loadImportTemplateAction,
  previewListingImportAction,
  type ImportCommitResult,
  type ImportPreviewResult,
} from "@/lib/real-estate/admin-actions";

/**
 * CSV import: validate, then commit.
 *
 * Two explicit steps rather than one upload that validates and writes. The file
 * is read in the browser and sent as text so the preview and the commit send the
 * same bytes, and the operator sees exactly the rows that will be written before
 * any of them are. The commit re-validates server-side regardless — the preview
 * is a courtesy, not a certificate.
 */
export function ListingImportPanel({ locale }: { locale: Locale }) {
  // Derived from the locale rather than received: a function cannot cross the
  // Server/Client boundary, and the translator is pure and isomorphic.
  const t = createTranslator(locale).t;
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [commit, setCommit] = useState<ImportCommitResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const readFile = async (file: File) => {
    const text = await file.text();
    setCsvText(text);
    setFileName(file.name);
    setPreview(null);
    setCommit(null);
  };

  const runPreview = () => {
    startTransition(async () => {
      setCommit(null);
      setPreview(await previewListingImportAction(csvText));
    });
  };

  const runCommit = () => {
    startTransition(async () => {
      setCommit(await commitListingImportAction(csvText));
    });
  };

  const loadTemplate = () => {
    startTransition(async () => {
      const result = await loadImportTemplateAction();
      if (result.ok) {
        setCsvText(`${result.header}\n${result.example}\n`);
        setFileName(null);
        setPreview(null);
        setCommit(null);
      }
    });
  };

  return (
    <div className="max-w-3xl space-y-6">
      <p className="text-sm text-body">{t("realEstate.admin.importIntro")}</p>

      <div>
        <label
          htmlFor="import-file"
          className="block text-sm font-medium text-ink-900"
        >
          {t("realEstate.admin.importFileLabel")}
        </label>
        <input
          id="import-file"
          type="file"
          accept=".csv,text/csv"
          className="mt-1.5 block w-full text-sm"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void readFile(file);
          }}
        />
        {fileName ? (
          <p className="mt-1 text-xs text-muted">{fileName}</p>
        ) : null}
      </div>

      <TextAreaField
        id="import-paste"
        name="importPaste"
        label={t("realEstate.admin.importPasteLabel")}
        hint={t("realEstate.admin.importPasteHint")}
        rows={10}
        value={csvText}
        onChange={(event) => {
          setCsvText(event.target.value);
          setPreview(null);
          setCommit(null);
        }}
      />

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={loadTemplate}
          disabled={isPending}
        >
          {t("realEstate.admin.importTemplate")}
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={runPreview}
          disabled={isPending || csvText.trim() === ""}
        >
          {isPending
            ? t("realEstate.admin.importPreviewing")
            : t("realEstate.admin.importPreview")}
        </Button>
        <Button
          type="button"
          variant="accent"
          onClick={runCommit}
          disabled={
            isPending ||
            !preview ||
            !preview.ok ||
            preview.report.validRows === 0
          }
        >
          {isPending
            ? t("realEstate.admin.importCommitting")
            : t("realEstate.admin.importCommit")}
        </Button>
      </div>

      {preview ? (
        preview.ok ? (
          <Notice tone="info" title={t("realEstate.admin.importPreview")}>
            <p>
              {t("realEstate.admin.importValidRows", {
                count: preview.report.validRows,
              })}
            </p>
            {preview.report.rejectedRows > 0 ? (
              <p className="mt-1">
                {t("realEstate.admin.importRejectedRows", {
                  count: preview.report.rejectedRows,
                })}
              </p>
            ) : null}
          </Notice>
        ) : (
          <Notice tone="warning" title={t("realEstate.admin.importIssuesHeading")}>
            <p>{t(`realEstate.admin.errors.${preview.error}`)}</p>
          </Notice>
        )
      ) : null}

      {preview?.ok && preview.report.issues.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-ink-900">
            {t("realEstate.admin.importIssuesHeading")}
          </h3>
          <ul className="mt-2 space-y-1 text-sm text-body">
            {preview.report.issues.map((issue, index) => (
              <li key={`${issue.line}-${index}`}>
                <span className="font-mono">
                  {t("realEstate.admin.importLine")} {issue.line}
                  {issue.column ? ` · ${issue.column}` : ""}
                </span>
                {" — "}
                {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {commit ? (
        commit.ok ? (
          <Notice tone="success" title={t("realEstate.admin.importDoneHeading")}>
            <p>
              {t("realEstate.admin.importInserted", { count: commit.inserted })}
            </p>
            {commit.failed > 0 ? (
              <p className="mt-1">
                {t("realEstate.admin.importFailedRows", {
                  count: commit.failed,
                })}
              </p>
            ) : null}
          </Notice>
        ) : (
          <Notice tone="warning" title={t("realEstate.admin.importDoneHeading")}>
            <p>{t(`realEstate.admin.errors.${commit.error}`)}</p>
          </Notice>
        )
      ) : null}
    </div>
  );
}
