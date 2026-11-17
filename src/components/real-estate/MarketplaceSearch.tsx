import { Search } from "lucide-react";

import { Button } from "@/components/ui/Button";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import type { GeographyOption } from "@/lib/real-estate/geography";
import {
  PROPERTY_CATEGORIES,
  buildListingQuery,
  type ListingFilters,
} from "@/lib/real-estate/search";

/**
 * The marketplace landing page's search area.
 *
 * A plain GET form, so the search IS a URL: submitting navigates to
 * `/real-estate/listings` with the filters encoded, the result is shareable and
 * cacheable, and it works without JavaScript. The location selector offers the
 * seeded regions, and the quick category shortcuts are links built from the same
 * `PROPERTY_CATEGORIES` model the sidebar uses, so a shortcut and its result set
 * cannot disagree.
 *
 * This is a Server Component: nothing here is interactive beyond the native
 * controls, so it costs no client JavaScript on the page that is the department's
 * front door — the page most likely to be a visitor's first paint.
 */
export function MarketplaceSearch({
  locale,
  geography,
  categories,
}: {
  locale: Locale;
  geography: readonly GeographyOption[];
  /** Real result counts per category bucket, from `listing_facets`. */
  categories: ReadonlyMap<string, number>;
}) {
  const t = createTranslator(locale).t;
  const basePath = `/${locale}/real-estate/listings`;

  return (
    <div className="rounded-panel border border-border bg-surface p-4 shadow-card sm:p-6">
      <form
        method="get"
        action={basePath}
        className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto]"
      >
        <div>
          <label
            htmlFor="marketplace-location"
            className="block text-sm font-medium text-ink-900"
          >
            {t("realEstate.marketplace.locationLabel")}
          </label>
          <select
            id="marketplace-location"
            name="region"
            defaultValue=""
            className="mt-1.5 w-full rounded-field border border-border-strong bg-surface px-3 py-3 text-sm text-ink-900"
          >
            <option value="">
              {t("realEstate.marketplace.locationAll")}
            </option>
            {geography.map((region) => (
              <option key={region.slug} value={region.slug}>
                {region.count > 0
                  ? t("realEstate.search.optionWithCount", {
                      name: region.name,
                      count: region.count,
                    })
                  : region.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="marketplace-keyword"
            className="block text-sm font-medium text-ink-900"
          >
            {t("realEstate.marketplace.keywordLabel")}
          </label>
          <input
            id="marketplace-keyword"
            name="q"
            type="search"
            placeholder={t("realEstate.marketplace.keywordPlaceholder")}
            className="mt-1.5 w-full rounded-field border border-border-strong bg-surface px-3 py-3 text-sm text-ink-900"
          />
        </div>

        <div className="flex items-end">
          {/* The search area sits inside the ink hero, so the accent resolves to
              its bright variant here and white text on it is ~1.9:1. The
              `accentOnInk` pairing puts ink text on the bright fill instead. */}
          <Button
            type="submit"
            variant="accentOnInk"
            className="w-full sm:w-auto"
          >
            <Search aria-hidden="true" className="h-4 w-4" />
            {t("realEstate.marketplace.searchSubmit")}
          </Button>
        </div>
      </form>

      <ul className="mt-4 flex flex-wrap gap-2">
        {PROPERTY_CATEGORIES.map((category) => {
          const filters: ListingFilters = {
            ...category.filters,
          };
          const href = `${basePath}${buildListingQuery(filters)}`;
          const count = categories.get(category.bucket);
          return (
            <li key={category.bucket}>
              <a
                href={href}
                className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface-alt px-3 py-1.5 text-sm text-body transition-soft hover:border-dept-accent"
              >
                {t(category.labelKey)}
                {count !== undefined && count > 0 ? (
                  <span className="text-xs text-muted">{count}</span>
                ) : null}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
