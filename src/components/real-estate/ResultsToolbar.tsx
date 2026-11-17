"use client";

import { useRouter } from "next/navigation";

import { MarketplaceResultsToolbar } from "@/components/marketplace/MarketplaceResultsToolbar";
import type { MarketplaceSortChoice } from "@/components/marketplace/types";
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
 * The listing results toolbar.
 *
 * A binding over the shared `MarketplaceResultsToolbar`: it states what is being
 * shown — the real total from the search function, the current location and the
 * active category — and offers the sort control and the list/map toggle. The
 * count is `aria-live="polite"` so a filter change is announced rather than only
 * seen.
 *
 * The sort is a client select that navigates on change, because re-submitting the
 * whole filter form to change an ordering would be a needless round trip through
 * a button. It preserves every other filter by rebuilding the URL from the parsed
 * state, and it resets to page one: page 4 of the old ordering is not a meaningful
 * page of the new one.
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

  const sortChoices: MarketplaceSortChoice[] = LISTING_SORTS.map((sort) => ({
    value: sort,
    label: t(listingSortLabelKey(sort)),
  }));

  const detail = [categoryLabel, locationLabel].filter(Boolean).join(" · ");

  return (
    <MarketplaceResultsToolbar
      labels={{
        total:
          total === 1
            ? t("realEstate.search.toolbarResultsOne")
            : t("realEstate.search.toolbarResults", { count: total }),
        detail: detail.length > 0 ? detail : undefined,
        sortLabel: t("realEstate.search.sortLabel"),
      }}
      sortChoices={sortChoices}
      sortValue={filters.sort ?? "newest"}
      onSortChange={(value) =>
        navigate({
          sort: isListingSort(value) ? value : undefined,
        })
      }
      trailing={
        <ViewToggle locale={locale} t={t} filters={filters} view={view} />
      }
    />
  );
}
