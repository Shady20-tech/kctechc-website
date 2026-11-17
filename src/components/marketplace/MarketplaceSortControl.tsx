"use client";

import { ArrowDownWideNarrow } from "lucide-react";

import type { MarketplaceSortChoice } from "./types";

/**
 * The sort control.
 *
 * A client select that calls back on change, because re-submitting the whole
 * filter form to change an ordering would be a needless round trip through a
 * button. The *department* decides what happens next — the store rebuilds its
 * product URL, Real Estate rebuilds its listing URL and resets to page one — so
 * this component carries no knowledge of any filter model.
 *
 * The visible label is hidden with `visually-hidden` rather than removed: a
 * select with no label is announced as an unlabelled combobox, and the icon alone
 * does not name it.
 */
export function MarketplaceSortControl({
  choices,
  value,
  label,
  onChange,
}: {
  choices: readonly MarketplaceSortChoice[];
  value: string;
  /** The accessible name for the select. */
  label: string;
  onChange: (value: string) => void;
}) {
  if (choices.length === 0) return null;

  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <ArrowDownWideNarrow aria-hidden="true" className="h-4 w-4 text-muted" />
      <span className="visually-hidden">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="rounded-field border border-border-strong bg-surface px-3 py-2 text-sm text-ink-900"
      >
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </select>
    </label>
  );
}
