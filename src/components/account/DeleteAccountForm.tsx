"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { DELETE_ACCOUNT_CONFIRMATION } from "@/lib/auth/account-deletion";
import {
  deleteOwnAccountAction,
  type DeleteOwnAccountState,
} from "@/lib/auth/delete-own-account";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";

const INITIAL: DeleteOwnAccountState | null = null;

/**
 * The customer's own "delete my account" control.
 *
 * A Client Component so it can show the outcome of the action inline. It takes
 * `locale` rather than a translator function, because a closure cannot cross the
 * Server/Client boundary — the rule `client-boundary.test.ts` enforces.
 *
 * The confirmation phrase comes from `DELETE_ACCOUNT_CONFIRMATION`, the same
 * constant the action compares against, so the word the form asks for and the
 * word the server accepts cannot disagree.
 *
 * `variant="danger"` is used for the submit so the irreversible control does not
 * look like the secondary buttons around it — the visual weight is the only
 * warning a hurried reader gets.
 */
export function DeleteAccountForm({ locale }: { locale: Locale }) {
  const t = createTranslator(locale).t;
  const [state, formAction] = useActionState(deleteOwnAccountAction, INITIAL);

  return (
    <form action={formAction} className="mt-6 max-w-xl">
      <input type="hidden" name="locale" value={locale} />

      <label
        htmlFor="delete-confirmation"
        className="block text-sm font-medium text-ink-900"
      >
        {t("account.delete.confirmationLabel", {
          phrase: DELETE_ACCOUNT_CONFIRMATION,
        })}
      </label>
      <input
        id="delete-confirmation"
        name="confirmation"
        type="text"
        autoComplete="off"
        spellCheck={false}
        aria-describedby="delete-confirmation-hint"
        className="mt-1.5 w-full rounded-field border border-border-strong bg-surface px-3 py-2.5 text-sm text-ink-900 transition-soft placeholder:text-muted hover:border-ink-500 focus:outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
      />
      <p id="delete-confirmation-hint" className="mt-1.5 text-xs text-muted">
        {t("account.delete.confirmationHint", {
          phrase: DELETE_ACCOUNT_CONFIRMATION,
        })}
      </p>

      {state && !state.ok ? (
        <div className="mt-4">
          <Notice tone="error" title={t("account.delete.errorHeading")}>
            {t(`account.delete.errors.${state.error}`)}
          </Notice>
        </div>
      ) : null}

      <div className="mt-5">
        <DeleteSubmit
          label={t("account.delete.submit")}
          pendingLabel={t("account.delete.submitting")}
        />
      </div>
    </form>
  );
}

/** The submit control, split out so `useFormStatus` sees the form it belongs to. */
function DeleteSubmit({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}
