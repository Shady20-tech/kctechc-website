"use client";

import { useActionState, useId, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";

const EMPTY = { ok: false } as { ok: boolean; error?: string };

/**
 * A super-admin-only permanent-delete control for one content record.
 *
 * It is shared by the product, project and article consoles so the confirmation
 * flow, the reason requirement and the messages are identical in all three —
 * a per-surface copy would be three places for the same rule to drift. The
 * database rule is `delete_content_permanently`'s `is_super_admin()` guard; the
 * form is not rendered for a lesser role, because a control whose submit is always
 * refused reads as a permission the user has.
 *
 * Confirmation is a two-step reveal rather than `window.confirm`: a native dialog
 * cannot carry the reason field, and the reason is what the audit trail records.
 * The reveal is client state only — it gates the submit button, not the action, so
 * a bypassed reveal grants nothing.
 */
export function DeleteContentForm({
  entityLabel,
  action,
  locale,
}: {
  /** The human noun for the record, e.g. "product". Used in the copy. */
  entityLabel: string;
  action: (reason: string) => Promise<{ ok: boolean; error?: string }>;
  locale: Locale;
}) {
  const t = createTranslator(locale).t;
  const reasonId = useId();
  const [state, formAction, pending] = useActionState(
    async (_previous: typeof EMPTY, formData: FormData) =>
      action(String(formData.get("reason") ?? "")),
    EMPTY,
  );
  const [armed, setArmed] = useState(false);

  return (
    <section className="border-t border-border pt-8">
      <h3 className="font-display text-lg font-bold text-ink-900">
        {t("admin.deleteForm.heading", { entity: entityLabel })}
      </h3>
      <p className="mt-1 max-w-2xl text-sm text-body">
        {t("admin.deleteForm.intro")}
      </p>

      <form action={formAction} className="mt-4 max-w-xl space-y-4">
        {state.ok ? (
          <Notice
            tone="success"
            title={t("admin.deleteForm.done", { entity: entityLabel })}
          />
        ) : null}
        {!state.ok && state.error ? (
          <Notice tone="error" title={t("admin.deleteForm.errorHeading")}>
            <p>{t(`admin.deleteForm.errors.${state.error}`)}</p>
          </Notice>
        ) : null}

        <div>
          <label
            htmlFor={`${reasonId}-delete`}
            className="block text-sm font-medium text-ink-900"
          >
            {t("admin.deleteForm.reasonLabel")}
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
            {t("admin.deleteForm.reasonHint")}
          </p>
        </div>

        {armed ? (
          <Notice tone="error" title={t("admin.deleteForm.confirmTitle")}>
            <p>{t("admin.deleteForm.confirmBody", { entity: entityLabel })}</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Button type="submit" variant="danger" disabled={pending}>
                {pending
                  ? t("admin.deleteForm.submitting")
                  : t("admin.deleteForm.confirm")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setArmed(false)}
                disabled={pending}
              >
                {t("admin.deleteForm.cancel")}
              </Button>
            </div>
          </Notice>
        ) : (
          <Button type="button" variant="danger" onClick={() => setArmed(true)}>
            {t("admin.deleteForm.submit")}
          </Button>
        )}
      </form>
    </section>
  );
}
