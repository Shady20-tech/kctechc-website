"use client";

import { ArrowDownWideNarrow } from "lucide-react";
import { useRouter } from "next/navigation";

import { ViewToggle } from "@/components/real-estate/ViewToggle";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import {
  LISTING_SORTS,
  buildListingQuery,
  isListingSort,
  listingSortLabelKey,
  type ListingFilters,
} from "@/lib/real-estate/search";

/**
 * The results toolbar.
 *
 * Above the results it states what is being shown — the total, the current
 * location and the active category — and offers the sort control and the
 * list/map toggle. The count is `aria-live="polite"` so a filter change is
 * announced rather than only seen.
 *
 * The sort is a client select that navigates on change, because re-submitting the
 * whole filter form to change an ordering would be a needless round trip through
 * a button. It preserves every other filter by rebuilding the URL from the parsed
 * state, and it resets to page one: page 4 of the old ordering is not a
 * meaningful page of the new one.
 */
export function ResultsToolbar({
  locale,
  filters,
  view,
  total,
  locationLabel,
  categoryLabel,
}: {
  locale: Locale;
  filters: ListingFilters;
  view: "list" | "map";
  total: number;
  locationLabel?: string;
  categoryLabel?: string;
}) {
  const t = createTranslator(locale).t;
  const router = useRouter();
  const basePath = `/${locale}/real-estate/listings`;

  function navigate(patch: Partial<ListingFilters>) {
    const next = { ...filters, ...patch, page: undefined };
    const params = new URLSearchParams(
      buildListingQuery(next).replace(/^\?/, ""),
    );
    if (view === "map") params.set("view", "map");
    const query = params.toString();
    router.push(`${basePath}${query ? `?${query}` : ""}`);
  }

  return (
    <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div aria-live="polite" className="min-w-0">
          <p className="font-display text-lg font-bold text-ink-900">
            {total === 1
              ? t("realEstate.search.toolbarResultsOne")
              : t("realEstate.search.toolbarResults", { count: total })}
          </p>
          {locationLabel || categoryLabel ? (
            <p className="mt-0.5 truncate text-sm text-muted">
              {[categoryLabel, locationLabel].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm">
            <ArrowDownWideNarrow
              aria-hidden="true"
              className="h-4 w-4 text-muted"
            />
            <span className="visually-hidden">
              {t("realEstate.search.sortLabel")}
            </span>
            <select
              value={filters.sort ?? "newest"}
              onChange={(event) =>
                navigate({
                  sort: isListingSort(event.currentTarget.value)
                    ? event.currentTarget.value
                    : undefined,
                })
              }
              className="rounded-field border border-border-strong bg-surface px-3 py-2 text-sm text-ink-900"
            >
              {LISTING_SORTS.map((sort) => (
                <option key={sort} value={sort}>
                  {t(listingSortLabelKey(sort))}
                </option>
              ))}
            </select>
          </label>

          <ViewToggle locale={locale} t={t} filters={filters} view={view} />
        </div>
      </div>
    </div>
  );
}
