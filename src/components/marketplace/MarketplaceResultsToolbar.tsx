"use client";

import { MarketplaceSortControl } from "./MarketplaceSortControl";
import type { MarketplaceSortChoice, MarketplaceToolbarLabels } from "./types";
import type { ReactNode } from "react";

/**
 * The results toolbar.
 *
 * Above the results it states what is being shown — the total, and the current
 * location and/or category — and offers the sort control and any extra controls
 * the department passes in (`trailing`). The count is `aria-live="polite"` so a
 * filter change is announced rather than only seen.
 *
 * The total and the detail line arrive already translated and already pluralized
 * by the calling page, because pluralization rules and the wording of "12
 * properties" versus "12 products" belong to the department, not to a shared
 * toolbar. `trailing` is where a department puts a view toggle or a save-search
 * control without this component having to know either exists.
 */
export function MarketplaceResultsToolbar({
  labels,
  sortChoices,
  sortValue,
  onSortChange,
  trailing,
}: {
  labels: MarketplaceToolbarLabels;
  sortChoices?: readonly MarketplaceSortChoice[];
  sortValue?: string;
  onSortChange?: (value: string) => void;
  trailing?: ReactNode;
}) {
  const showSort =
    sortChoices && sortChoices.length > 0 && sortValue !== undefined;

  return (
    <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div aria-live="polite" className="min-w-0">
          <p className="font-display text-lg font-bold text-ink-900">
            {labels.total}
          </p>
          {labels.detail ? (
            <p className="mt-0.5 truncate text-sm text-muted">
              {labels.detail}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {showSort && onSortChange ? (
            <MarketplaceSortControl
              choices={sortChoices}
              value={sortValue}
              label={labels.sortLabel}
              onChange={onSortChange}
            />
          ) : null}
          {trailing}
        </div>
      </div>
    </div>
  );
}
