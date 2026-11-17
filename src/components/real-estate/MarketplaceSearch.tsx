import { MarketplaceSearchHeader } from "@/components/marketplace/MarketplaceSearchHeader";
import type { MarketplaceCategoryItem } from "@/components/marketplace/types";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import type { GeographyOption } from "@/lib/real-estate/geography";
import {
  PROPERTY_CATEGORIES,
  buildListingQuery,
  type ListingFilters,
} from "@/lib/real-estate/search";

/**
 * The Real Estate marketplace landing page's search area.
 *
 * A binding over the shared `MarketplaceSearchHeader`: the shared component owns
 * the layout, the submit button and the category shortcut row, and this supplies
 * the property-specific fields — the seeded region selector and the keyword input
 * — plus the shortcut links built from the same `PROPERTY_CATEGORIES` model the
 * sidebar uses, so a shortcut and its result set cannot disagree.
 *
 * It is a plain GET form, so the search IS a URL: submitting navigates to
 * `/real-estate/listings` with the filters encoded, the result is shareable and
 * cacheable, and it works without JavaScript.
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

  const shortcuts: MarketplaceCategoryItem[] = PROPERTY_CATEGORIES.map(
    (category) => {
      const filters: ListingFilters = { ...category.filters };
      return {
        value: category.bucket,
        label: t(category.labelKey),
        href: `${basePath}${buildListingQuery(filters)}`,
        count: categories.get(category.bucket),
      };
    },
  );

  return (
    <MarketplaceSearchHeader
      action={basePath}
      submitLabel={t("realEstate.marketplace.searchSubmit")}
      categories={shortcuts}
      categoriesLabel={t("realEstate.marketplace.categoriesHeading")}
      fields={
        <>
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
        </>
      }
    />
  );
}
