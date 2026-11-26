"use client";

import { useActionState, useId, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import {
  archiveListingAction,
  deleteListingAction,
} from "@/lib/real-estate/admin-actions";

const EMPTY = { ok: false } as { ok: boolean; error?: string; detail?: string };

/**
 * Archive and permanently delete a listing, each behind an explicit confirmation.
 *
 * The two are separate forms rather than one control with a mode, because they are
 * different operations with different consequences: archiving is reversible and
 * available to any real-estate administrator, while permanent deletion is
 * irreversible, super-admin only, and gated on the listing having no retained
 * history. The delete form is not rendered for a lesser role — a control whose
 * submit is always refused is worse than no control, because it reads as a
 * permission the user has.
 *
 * Confirmation is a two-step reveal rather than `window.confirm`: a native dialog
 * cannot carry the reason field, and the reason is required by the database. The
 * operator types why, then confirms. The reason is what the audit trail records.
 */
export function ListingLifecycleForm({
  listingId,
  currentStatus,
  canDelete,
  locale,
}: {
  listingId: string;
  currentStatus: string;
  /** True only for a super admin. Decides whether the delete form renders. */
  canDelete: boolean;
  locale: Locale;
}) {
  const t = createTranslator(locale).t;
  const reasonId = useId();

  const [archiveState, archiveAction, archivePending] = useActionState(
    async (_previous: typeof EMPTY, formData: FormData) =>
      archiveListingAction(listingId, String(formData.get("reason") ?? "")),
    EMPTY,
  );

  const [deleteState, deleteAction, deletePending] = useActionState(
    async (_previous: typeof EMPTY, formData: FormData) =>
      deleteListingAction(listingId, String(formData.get("reason") ?? "")),
    EMPTY,
  );

  // The confirmation step is client state only. It gates the submit button, not
  // the action: the server still validates the reason and the role, so a bypassed
  // reveal grants nothing.
  const [deleteArmed, setDeleteArmed] = useState(false);

  const alreadyArchived = currentStatus === "archived";

  return (
    <div className="space-y-10">
      <section>
        <h3 className="font-display text-lg font-bold text-ink-900">
          {t("realEstate.admin.archiveHeading")}
        </h3>
        <p className="mt-1 max-w-2xl text-sm text-body">
          {t("realEstate.admin.archiveIntro")}
        </p>

        <form action={archiveAction} className="mt-4 max-w-xl space-y-4">
          {archiveState.ok ? (
            <Notice tone="success" title={t("realEstate.admin.archiveUpdated")} />
          ) : null}
          {!archiveState.ok && archiveState.error ? (
            <Notice tone="warning" title={t("realEstate.admin.metaTitle")}>
              <p>{t(`realEstate.admin.errors.${archiveState.error}`)}</p>
              {archiveState.detail ? (
                <p className="mt-2 break-words font-mono text-xs">
                  {archiveState.detail}
                </p>
              ) : null}
            </Notice>
          ) : null}

          <div>
            <label
              htmlFor={`${reasonId}-archive`}
              className="block text-sm font-medium text-ink-900"
            >
              {t("realEstate.admin.reasonLabel")}
            </label>
            <textarea
              id={`${reasonId}-archive`}
              name="reason"
              rows={2}
              required
              maxLength={500}
              className="mt-1 w-full rounded-field border border-border-strong bg-surface px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-muted">
              {t("realEstate.admin.reasonHint")}
            </p>
          </div>

          <Button
            type="submit"
            variant="secondary"
            disabled={archivePending || alreadyArchived}
          >
            {archivePending
              ? t("realEstate.admin.archiveSubmitting")
              : alreadyArchived
                ? t("realEstate.admin.archiveAlready")
                : t("realEstate.admin.archiveSubmit")}
          </Button>
        </form>
      </section>

      {canDelete ? (
        <section className="border-t border-border pt-8">
          <h3 className="font-display text-lg font-bold text-ink-900">
            {t("realEstate.admin.deleteHeading")}
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-body">
            {t("realEstate.admin.deleteIntro")}
          </p>

          <form action={deleteAction} className="mt-4 max-w-xl space-y-4">
            {deleteState.ok ? (
              <Notice
                tone="success"
                title={t("realEstate.admin.deleteUpdated")}
              />
            ) : null}
            {!deleteState.ok && deleteState.error ? (
              <Notice tone="error" title={t("realEstate.admin.metaTitle")}>
                <p>{t(`realEstate.admin.errors.${deleteState.error}`)}</p>
                {deleteState.detail ? (
                  <p className="mt-2 break-words font-mono text-xs">
                    {deleteState.detail}
                  </p>
                ) : null}
              </Notice>
            ) : null}

            <div>
              <label
                htmlFor={`${reasonId}-delete`}
                className="block text-sm font-medium text-ink-900"
              >
                {t("realEstate.admin.deleteReasonLabel")}
              </label>
              <textarea
                id={`${reasonId}-delete`}
                name="reason"
                rows={2}
                required
                minLength={10}
                maxLength={500}
                className="mt-1 w-full rounded-field border border-border-strong bg-surface px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-muted">
                {t("realEstate.admin.deleteReasonHint")}
              </p>
            </div>

            {deleteArmed ? (
              <Notice tone="error" title={t("realEstate.admin.deleteConfirmTitle")}>
                <p>{t("realEstate.admin.deleteConfirmBody")}</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <Button type="submit" variant="danger" disabled={deletePending}>
                    {deletePending
                      ? t("realEstate.admin.deleteSubmitting")
                      : t("realEstate.admin.deleteConfirm")}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setDeleteArmed(false)}
                    disabled={deletePending}
                  >
                    {t("realEstate.admin.deleteCancel")}
                  </Button>
                </div>
              </Notice>
            ) : (
              <Button
                type="button"
                variant="danger"
                onClick={() => setDeleteArmed(true)}
              >
                {t("realEstate.admin.deleteSubmit")}
              </Button>
            )}
          </form>
        </section>
      ) : null}
    </div>
  );
}
