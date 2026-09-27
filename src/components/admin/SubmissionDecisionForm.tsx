"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { SelectField, TextAreaField } from "@/components/ui/Form";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { reviewListingSubmissionAction } from "@/lib/real-estate/admin-actions";

const EMPTY = { ok: false } as { ok: boolean; error?: string };

/**
 * Record a decision on one owner submission.
 *
 * The decision and its notes travel together in a single submit, because the
 * database writes the decision and the optional publish in one transaction. A
 * two-step interface would create the state the whole design avoids: an approval
 * that has not yet published.
 *
 * Notes are required for a refusal or a change request. That rule is enforced in
 * the action and in the table; the form marks the field required so the browser
 * refuses an empty refusal before it is sent, without pretending to be the
 * authority on it.
 */
export function SubmissionDecisionForm({
  submissionId,
  locale,
}: {
  submissionId: string;
  locale: Locale;
}) {
  // Derived from the locale rather than received: a function cannot cross the
  // Server/Client boundary, and the translator is pure and isomorphic.
  const t = createTranslator(locale).t;
  const [state, formAction, pending] = useActionState(
    async (_previous: typeof EMPTY, formData: FormData) =>
      reviewListingSubmissionAction(
        submissionId,
        String(formData.get("decision") ?? "") as
          | "approved"
          | "rejected"
          | "changes_requested",
        String(formData.get("reviewNotes") ?? ""),
        formData.get("publish") === "on",
      ),
    EMPTY,
  );

  return (
    <form action={formAction} className="mt-4 space-y-4">
      {state.ok ? (
        <Notice tone="success" title={t("realEstate.admin.submissionRecorded")} />
      ) : null}

      {!state.ok && state.error ? (
        <Notice tone="warning" title={t("realEstate.admin.metaTitle")}>
          <p>{t(`realEstate.admin.errors.${state.error}`)}</p>
        </Notice>
      ) : null}

      <SelectField
        id={`decision-${submissionId}`}
        name="decision"
        label={t("realEstate.admin.decisionLabel")}
        defaultValue="approved"
      >
        <option value="approved">{t("realEstate.admin.decisionApproved")}</option>
        <option value="rejected">{t("realEstate.admin.decisionRejected")}</option>
        <option value="changes_requested">
          {t("realEstate.admin.decisionChanges")}
        </option>
      </SelectField>

      <TextAreaField
        id={`review-notes-${submissionId}`}
        name="reviewNotes"
        label={t("realEstate.admin.reviewNotesLabel")}
        hint={t("realEstate.admin.reviewNotesHint")}
        rows={3}
      />

      <div>
        <label
          htmlFor={`publish-${submissionId}`}
          className="flex items-start gap-3 text-sm"
        >
          <input
            id={`publish-${submissionId}`}
            name="publish"
            type="checkbox"
            defaultChecked
            className="mt-1 h-4 w-4 shrink-0 rounded border-border-strong"
          />
          <span className="text-body">
            {t("realEstate.admin.publishOnApprove")}
            <span className="mt-1 block text-xs text-muted">
              {t("realEstate.admin.publishOnApproveHint")}
            </span>
          </span>
        </label>
      </div>

      <Button type="submit" variant="primary" disabled={pending}>
        {pending
          ? t("realEstate.admin.recording")
          : t("realEstate.admin.submitDecision")}
      </Button>
    </form>
  );
}
