"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import {
  deleteSavedSearchAction,
  setSearchAlertPreferenceAction,
} from "@/lib/real-estate/customer-actions";
import { PROPERTY_SEARCH_PATH } from "@/lib/config/navigation";
import type { AlertFrequency, SavedSearchRecord } from "@/lib/real-estate/loaders";

/**
 * One saved search, with its alert preference and its delete control.
 *
 * The three controls are together because they act on one row and a customer
 * changing an alert is usually looking at the search it belongs to. Splitting them
 * across a list and a detail page would mean a second navigation to do the thing
 * the list is for.
 *
 * Each control writes on its own and reports its own outcome, rather than the page
 * holding one form for all of them. A saved search list is a set of independent
 * rows; a single submit would make one failed write look like the whole page
 * failed, and would lose the other changes the customer had made.
 */
export function SavedSearchCard({
  locale,
  search,
}: {
  locale: Locale;
  search: SavedSearchRecord;
}) {
  const t = createTranslator(locale).t;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(search.alertEnabled);
  const [frequency, setFrequency] = useState<AlertFrequency>(
    search.alertFrequency ?? "daily",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);

  function updateAlert(nextEnabled: boolean, nextFrequency: AlertFrequency) {
    setEnabled(nextEnabled);
    setFrequency(nextFrequency);
    setMessage(null);
    startTransition(async () => {
      const result = await setSearchAlertPreferenceAction(
        search.id,
        nextEnabled,
        nextFrequency,
      );
      if (result.status === "ok") {
        setMessage(t("realEstate.savedSearches.alertSaved"));
        router.refresh();
        return;
      }
      // The toggle is reverted on failure, so what is shown always reflects what
      // is stored. Leaving it on would tell the customer they will be emailed when
      // the preference row was never written.
      setEnabled(search.alertEnabled);
      setFrequency(search.alertFrequency ?? "daily");
      setMessage(
        result.status === "unconfigured"
          ? t("realEstate.savedSearches.alertUnavailable")
          : t("realEstate.savedSearches.alertFailed"),
      );
    });
  }

  function remove() {
    setMessage(null);
    startTransition(async () => {
      const result = await deleteSavedSearchAction(search.id);
      if (result.status === "ok") {
        setRemoved(true);
        router.refresh();
        return;
      }
      setMessage(t("realEstate.savedSearches.deleteFailed"));
    });
  }

  if (removed) return null;

  return (
    <li className="rounded-card border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-ink-900">
            {search.label}
          </h3>
          {search.queryString ? (
            <p className="mt-1 font-mono text-xs text-muted">
              {search.queryString}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/${locale}${PROPERTY_SEARCH_PATH}${search.queryString}`}
            className="text-sm font-medium text-dept-accent underline"
          >
            {t("realEstate.savedSearches.open")}
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={remove}
          >
            <Trash2 aria-hidden="true" className="h-4 w-4" />
            {t("realEstate.savedSearches.delete")}
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border pt-4">
        <label className="flex items-center gap-2 text-sm text-body">
          <input
            type="checkbox"
            checked={enabled}
            disabled={pending}
            onChange={(event) => updateAlert(event.currentTarget.checked, frequency)}
            className="h-4 w-4"
          />
          {t("realEstate.savedSearches.alertLabel")}
        </label>

        <label className="flex items-center gap-2 text-sm text-body">
          <span>{t("realEstate.savedSearches.alertFrequencyLabel")}</span>
          <select
            value={frequency}
            disabled={pending || !enabled}
            onChange={(event) =>
              updateAlert(enabled, event.currentTarget.value as AlertFrequency)
            }
            className="rounded-card border border-border bg-surface px-2 py-1 text-sm text-ink-900"
          >
            <option value="instant">
              {t("realEstate.savedSearches.frequencies.instant")}
            </option>
            <option value="daily">
              {t("realEstate.savedSearches.frequencies.daily")}
            </option>
            <option value="weekly">
              {t("realEstate.savedSearches.frequencies.weekly")}
            </option>
          </select>
        </label>
      </div>

      {message ? (
        <p role="status" className="mt-3 text-sm text-muted">
          {message}
        </p>
      ) : null}
    </li>
  );
}
