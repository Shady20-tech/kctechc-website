"use client";

import { useRouter } from "next/navigation";

import { MarketplaceResultsToolbar } from "@/components/marketplace/MarketplaceResultsToolbar";
import type { MarketplaceSortChoice } from "@/components/marketplace/types";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import {
  buildStoreQuery,
  isStoreSort,
  sortLabelKey,
  STORE_SORTS,
  type StoreFilters,
} from "@/lib/store/search";

/**
 * The store results toolbar.
 *
 * A binding over the shared `MarketplaceResultsToolbar`: it states the real total
 * `search_products` returned and offers the sort control. Changing the sort
 * rebuilds the URL from the parsed filter state and resets to page one — page 4 of
 * the old ordering is not a meaningful page of the new one.
 */
export function StoreResultsToolbar({
  locale,
  basePath,
  filters,
  total,
}: {
  locale: Locale;
  basePath: string;
  filters: StoreFilters;
  total: number;
}) {
  const t = createTranslator(locale).t;
  const router = useRouter();

  const choices: MarketplaceSortChoice[] = STORE_SORTS.map((sort) => ({
    value: sort,
    label: t(sortLabelKey(sort)),
  }));

  return (
    <MarketplaceResultsToolbar
      labels={{
        total:
          total === 1
            ? t("store.toolbarResultsOne")
            : t("store.toolbarResults", { count: total }),
        sortLabel: t("store.sortLabel"),
      }}
      sortChoices={choices}
      sortValue={filters.sort ?? "relevance"}
      onSortChange={(value) =>
        router.push(
          `${basePath}${buildStoreQuery({
            ...filters,
            sort: isStoreSort(value) ? value : undefined,
            page: undefined,
          })}`,
        )
      }
    />
  );
}
