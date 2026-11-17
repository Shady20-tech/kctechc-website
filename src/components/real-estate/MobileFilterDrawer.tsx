"use client";

import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";

import { ListingSidebar } from "@/components/real-estate/ListingSidebar";
import { Modal } from "@/components/ui/Modal";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import type { GeographyOption } from "@/lib/real-estate/geography";
import type { ListingFacets } from "@/lib/real-estate/loaders";
import {
  activeFilterKeys,
  type ListingFilters,
} from "@/lib/real-estate/search";

/**
 * The mobile filter entry point.
 *
 * The desktop sidebar is `hidden` below `lg`, so a narrow viewport gets this
 * instead of a horizontally-overflowing panel. The trigger shows the number of
 * active filters, because "Filter" alone gives no indication that a short result
 * list is the visitor's own doing.
 *
 * The controls live inside a `Modal` with `placement="side"`, which already
 * handles focus trapping, Escape, scroll lock and focus return — the same
 * behaviour the site's navigation drawer uses, so the two feel identical. The
 * filter form itself is the *same* `ListingSidebar` component in its `drawer`
 * variant, so the two presentations cannot drift: there is one implementation of
 * the filters, rendered twice.
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
  const [open, setOpen] = useState(false);
  const count = activeFilterKeys(filters).length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-control border border-border-strong bg-surface px-4 py-2.5 text-sm font-semibold text-ink-900 transition-soft hover:border-dept-accent lg:hidden"
      >
        <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
        {t("realEstate.search.openFilters")}
        {count > 0 ? (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-pill bg-dept-accent px-1.5 text-[11px] font-semibold text-white">
            {count}
          </span>
        ) : null}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("realEstate.search.filtersHeading")}
        placement="side"
        closeLabel={t("realEstate.search.closeFilters")}
      >
        <div className="mt-2">
          <ListingSidebar
            locale={locale}
            geography={geography}
            facets={facets}
            filters={filters}
            view={view}
            variant="drawer"
            onClose={() => setOpen(false)}
          />
        </div>
      </Modal>
    </>
  );
}
