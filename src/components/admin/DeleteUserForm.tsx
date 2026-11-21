"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import {
  deleteUserAccountAction,
  type DeleteUserState,
} from "@/lib/admin/delete-user-actions";

const INITIAL: DeleteUserState | null = null;

/**
 * Super-admin control for deleting one account.
 *
 * Collapsed behind a `<details>` disclosure rather than rendered as a bare
 * button in the row: a destructive, irreversible control sitting open beside a
 * role picker invites exactly the mis-click it is meant to prevent, and a table
 * of 200 accounts would otherwise be 200 live delete buttons.
 *
 * A reason is required and recorded in the audit trail. The action refuses
 * self-deletion — the console must not be able to remove the person holding the
 * console — and points the reader at the account page for that case.
 */
export function DeleteUserForm({
  profileId,
  displayName,
  isSelf,
  locale,
}: {
  profileId: string;
  displayName: string;
  isSelf: boolean;
  locale: Locale;
}) {
  const t = createTranslator(locale).t;
  const [state, formAction] = useActionState(deleteUserAccountAction, INITIAL);

  if (isSelf) {
    return (
      <p className="text-xs text-muted">{t("adminUsers.delete.selfNote")}</p>
    );
  }

  return (
    <details className="group">
      <summary className="cursor-pointer list-none rounded-control border border-border-strong px-3 py-1.5 text-xs font-medium text-ink-900 transition-soft hover:bg-surface-alt focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus">
        {t("adminUsers.delete.open")}
      </summary>

      <form action={formAction} className="mt-3 max-w-md">
        <input type="hidden" name="profileId" value={profileId} />

        <p className="text-xs text-body">
          {t("adminUsers.delete.confirmBody", { name: displayName })}
        </p>

        <label
          htmlFor={`delete-reason-${profileId}`}
          className="mt-3 block text-xs font-medium text-ink-900"
        >
          {t("adminUsers.delete.reasonLabel")}
        </label>
        <textarea
          id={`delete-reason-${profileId}`}
          name="reason"
          rows={2}
          minLength={10}
          maxLength={500}
          required
          className="mt-1 w-full rounded-field border border-border-strong bg-surface px-3 py-2 text-xs text-ink-900 transition-soft placeholder:text-muted hover:border-ink-500 focus:outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
          placeholder={t("adminUsers.delete.reasonPlaceholder")}
        />

        {state && !state.ok ? (
          <div className="mt-3">
            <Notice tone="error" title={t("adminUsers.delete.errorHeading")}>
              {t(`adminUsers.delete.errors.${state.error}`)}
            </Notice>
          </div>
        ) : null}

        {state && state.ok ? (
          <div className="mt-3">
            <Notice tone="success">{t("adminUsers.delete.success")}</Notice>
          </div>
        ) : null}

        <div className="mt-3">
          <DeleteSubmit
            label={t("adminUsers.delete.submit")}
            pendingLabel={t("adminUsers.delete.submitting")}
          />
        </div>
      </form>
    </details>
  );
}

function DeleteSubmit({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" size="sm" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}
