"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { SelectField } from "@/components/ui/Form";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { setListingStatusAction } from "@/lib/real-estate/admin-actions";
import { LISTING_STATUSES } from "@/lib/real-estate/enums";

const EMPTY = { ok: false } as { ok: boolean; error?: string };

/**
 * Change a listing's status.
 *
 * The options offered are every status the type allows, not only the ones legal
 * from the current state. Narrowing them here would mean the form encodes the
 * lifecycle rules, and the lifecycle is enforced by the database trigger — a
 * second copy in the browser is the copy that goes stale. An illegal choice is
 * attempted and refused with the database's own reason, which is honest about
 * who decided.
 */
export function ListingStatusForm({
  listingId,
  currentStatus,
  locale,
}: {
  listingId: string;
  currentStatus: string;
  locale: Locale;
}) {
  // Derived from the locale rather than received: a function cannot cross the
  // Server/Client boundary, and the translator is pure and isomorphic.
  const t = createTranslator(locale).t;
  const [state, formAction, pending] = useActionState(
    async (_previous: typeof EMPTY, formData: FormData) =>
      setListingStatusAction(
        listingId,
        String(formData.get("status") ?? ""),
      ),
    EMPTY,
  );

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <p className="text-sm text-body">{t("realEstate.admin.statusIntro")}</p>

      {state.ok ? (
        <Notice tone="success" title={t("realEstate.admin.statusUpdated")} />
      ) : null}

      {!state.ok && state.error ? (
        <Notice tone="warning" title={t("realEstate.admin.metaTitle")}>
          <p>{t(`realEstate.admin.errors.${state.error}`)}</p>
        </Notice>
      ) : null}

      <SelectField
        id="status"
        name="status"
        label={t("realEstate.admin.statusHeading")}
        defaultValue={currentStatus}
      >
        {LISTING_STATUSES.map((status) => (
          <option key={status} value={status}>
            {t(`realEstate.statuses.${status}`)}
          </option>
        ))}
      </SelectField>

      <Button type="submit" variant="secondary" disabled={pending}>
        {pending
          ? t("realEstate.admin.statusUpdating")
          : t("realEstate.admin.statusSubmit")}
      </Button>
    </form>
  );
}
