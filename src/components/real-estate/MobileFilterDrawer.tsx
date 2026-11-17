"use client";

import { MarketplaceMobileFilterDrawer } from "@/components/marketplace/MarketplaceMobileFilterDrawer";
import { ListingSidebar } from "@/components/real-estate/ListingSidebar";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import type { GeographyOption } from "@/lib/real-estate/geography";
import type { ListingFacets } from "@/lib/real-estate/loaders";
import {
  activeFilterKeys,
  type ListingFilters,
} from "@/lib/real-estate/search";

/**
 * Real Estate's mobile filter entry point.
 *
 * A thin binding over the shared `MarketplaceMobileFilterDrawer`: it supplies the
 * listing-specific panel — the same `ListingSidebar` the desktop column renders,
 * in its `drawer` variant — so the two presentations cannot drift, and the shared
 * component owns the trigger, the active-filter badge and the accessible drawer.
 *
 * Selections inside the drawer are committed by the form's Apply button (a real
 * GET submit) or by the immediate-navigate controls, so closing the drawer without
 * applying leaves the URL — and therefore the results — untouched.
 */
export function MobileFilterDrawer({
  locale,
  geography,
  facets,
  filters,
  view,
}: {
  locale: Locale;
  geography: readonly GeographyOption[];
  facets: ListingFacets;
  filters: ListingFilters;
  view: "list" | "map";
}) {
  const t = createTranslator(locale).t;
  const count = activeFilterKeys(filters).length;

  return (
    <MarketplaceMobileFilterDrawer
      activeCount={count}
      labels={{
        open: t("realEstate.search.openFilters"),
        title: t("realEstate.search.filtersHeading"),
        close: t("realEstate.search.closeFilters"),
      }}
    >
      <ListingSidebar
        locale={locale}
        geography={geography}
        facets={facets}
        filters={filters}
        view={view}
        variant="drawer"
      />
    </MarketplaceMobileFilterDrawer>
  );
}
