"use client";

import { useActionState, useId, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import {
  clearAuditLogsAction,
  type ClearAuditLogsState,
} from "@/lib/admin/log-actions";

/**
 * Super-admin clear for the system log.
 *
 * The confirmation is a two-step reveal rather than `window.confirm` because the
 * reason field is part of the confirmation and is written to the replacement
 * audit row. The reveal gates only the submit button; the Server Action and the
 * DELETE policy are what actually authorize the operation.
 */
export function ClearLogsForm({ locale }: { locale: Locale }) {
  const t = createTranslator(locale).t;
  const reasonId = useId();
  const [state, formAction, pending] = useActionState(
    clearAuditLogsAction,
    null as ClearAuditLogsState | null,
  );
  const [armed, setArmed] = useState(false);

  return (
    <section className="mt-8 border-t border-border pt-8">
      <h2 className="font-display text-xl font-bold text-ink-900">
        {t("adminLogs.clearHeading")}
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-body">
        {t("adminLogs.clearIntro")}
      </p>

      <form action={formAction} className="mt-4 max-w-xl space-y-4">
        {state?.ok ? (
          <Notice
            tone="success"
            title={t("adminLogs.clearDone", { count: state.deleted })}
          >
            {!state.audited ? <p>{t("adminLogs.clearAuditFailed")}</p> : null}
          </Notice>
        ) : null}

        {state && !state.ok ? (
          <Notice tone="error" title={t("adminLogs.clearHeading")}>
            <p>{t(`adminLogs.clearErrors.${state.error}`)}</p>
            {state.detail ? (
              <p className="mt-2 break-words font-mono text-xs">
                {state.detail}
              </p>
            ) : null}
          </Notice>
        ) : null}

        <div>
          <label
            htmlFor={`${reasonId}-reason`}
            className="block text-sm font-medium text-ink-900"
          >
            {t("adminLogs.clearReasonLabel")}
          </label>
          <textarea
            id={`${reasonId}-reason`}
            name="reason"
            rows={3}
            required
            minLength={10}
            maxLength={500}
            className="mt-1 w-full rounded-field border border-border-strong bg-surface px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-muted">
            {t("adminLogs.clearReasonHint")}
          </p>
        </div>

        {armed ? (
          <Notice tone="error" title={t("adminLogs.clearConfirmTitle")}>
            <p>{t("adminLogs.clearConfirmBody")}</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Button type="submit" variant="danger" disabled={pending}>
                {pending
                  ? t("adminLogs.clearSubmitting")
                  : t("adminLogs.clearConfirm")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setArmed(false)}
                disabled={pending}
              >
                {t("adminLogs.clearCancel")}
              </Button>
            </div>
          </Notice>
        ) : (
          <Button type="button" variant="danger" onClick={() => setArmed(true)}>
            {t("adminLogs.clearSubmit")}
          </Button>
        )}
      </form>
    </section>
  );
}
