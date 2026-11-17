"use client";

import { useRouter } from "next/navigation";

import { MarketplaceCategoryNavigation } from "@/components/marketplace/MarketplaceCategoryNavigation";
import { MarketplaceFilterSection } from "@/components/marketplace/MarketplaceFilterSection";
import { MarketplaceFilterSidebar } from "@/components/marketplace/MarketplaceFilterSidebar";
import type { MarketplaceCategoryItem } from "@/components/marketplace/types";
import { TextField } from "@/components/ui/Form";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import type { StoreFacets } from "@/lib/store/catalogue";
import {
  activeStoreFilterKeys,
  buildStoreQuery,
  STORE_PRIMARY_CURRENCY,
  type StoreFilters,
} from "@/lib/store/search";

/**
 * The store's filter form.
 *
 * The fields are the store's own — keyword, category, brand, price range in one
 * currency, in-stock — and they are rendered inside the shared
 * `MarketplaceFilterSidebar`, so the store gets the same two-column shell, the
 * same collapsible sections and the same mobile drawer Real Estate has, with none
 * of Real Estate's filter model. The seam is the `children` slot: one shell, three
 * different sets of fields.
 *
 * A plain GET form, so the filters ARE the query string: a filtered catalogue is
 * shareable and cacheable, and it works without JavaScript. Every value the form
 * carries is also carried as a hidden input when it is set by an immediate
 * control, so a plain submit does not drop a selection the visitor made without
 * pressing the button.
 */
export function StoreFilterSidebar({
  locale,
  basePath,
  filters,
  facets,
  categories,
  variant = "sidebar",
  onClose,
}: {
  locale: Locale;
  /** The store index path the form submits to. */
  basePath: string;
  filters: StoreFilters;
  facets: StoreFacets;
  categories: readonly MarketplaceCategoryItem[];
  variant?: "sidebar" | "drawer";
  onClose?: () => void;
}) {
  const t = createTranslator(locale).t;
  const router = useRouter();
  const activeCount = activeStoreFilterKeys(filters).length;

  // An immediate change navigates without a submit, so the visitor sees the new
  // result set at once. The full filter state is rebuilt from the parsed model, so
  // a change cannot drop a value the URL already carried.
  function navigate(patch: Partial<StoreFilters>) {
    const next: StoreFilters = { ...filters, ...patch, page: undefined };
    router.push(`${basePath}${buildStoreQuery(next)}`);
  }

  return (
    <MarketplaceFilterSidebar
      action={basePath}
      variant={variant}
      onClose={onClose}
      activeCount={activeCount}
      labels={{
        submit:
          variant === "drawer"
            ? t("store.applyFilters")
            : t("store.searchLabel"),
        clear: t("store.clearFilters"),
        close: t("store.closeFilters"),
        activeCount: t("store.filtersActiveCount", { count: activeCount }),
      }}
    >
      {/* Carried through a plain submit so the form works without JavaScript. */}
      {filters.sort ? (
        <input type="hidden" name="sort" value={filters.sort} />
      ) : null}
      {filters.category ? (
        <input type="hidden" name="category" value={filters.category} />
      ) : null}
      {filters.brand ? (
        <input type="hidden" name="brand" value={filters.brand} />
      ) : null}
      {filters.inStock ? (
        <input type="hidden" name="inStock" value="true" />
      ) : null}
      {filters.currency ? (
        <input type="hidden" name="currency" value={filters.currency} />
      ) : null}

      <MarketplaceFilterSection title={t("store.filterSearchLabel")}>
        <TextField
          id="store-filter-q"
          name="q"
          type="search"
          label={t("store.filterSearchLabel")}
          placeholder={t("store.filterSearchPlaceholder")}
          defaultValue={filters.query ?? ""}
        />
      </MarketplaceFilterSection>

      {categories.length > 0 ? (
        <MarketplaceFilterSection title={t("store.filterCategoryLabel")}>
          <MarketplaceCategoryNavigation
            items={categories}
            ariaLabel={t("store.filterCategoryLabel")}
            variant="list"
          />
        </MarketplaceFilterSection>
      ) : null}

      {/* Price. Two fields side by side where the column allows, each with the
          wording the brief specifies, and the currency stated beside them. The
          bound is applied in the chosen currency — never compared across
          currencies, which is why the currency is part of the filter state. */}
      <MarketplaceFilterSection title={t("store.filterPriceHeading")}>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            id="store-filter-min-price"
            name="minPrice"
            type="number"
            inputMode="numeric"
            min={0}
            label={t("store.filterMinPriceLabel")}
            hint={t("store.filterMinPriceHint")}
            defaultValue={filters.minPrice ?? ""}
          />
          <TextField
            id="store-filter-max-price"
            name="maxPrice"
            type="number"
            inputMode="numeric"
            min={0}
            label={t("store.filterMaxPriceLabel")}
            hint={t("store.filterMaxPriceHint")}
            defaultValue={filters.maxPrice ?? ""}
          />
        </div>
        <p className="mt-2 text-xs text-muted">
          {t("store.filterCurrencyLabel")}:{" "}
          <span className="font-medium text-ink-900">
            {filters.currency ?? STORE_PRIMARY_CURRENCY}
          </span>
        </p>
      </MarketplaceFilterSection>

      {facets.brands.length > 0 ? (
        <MarketplaceFilterSection title={t("store.filterBrandLabel")}>
          <label
            htmlFor="store-filter-brand"
            className="block text-sm font-medium text-ink-900"
          >
            {t("store.filterBrandLabel")}
          </label>
          <select
            id="store-filter-brand"
            value={filters.brand ?? ""}
            onChange={(event) =>
              navigate({ brand: event.currentTarget.value || undefined })
            }
            className="mt-1.5 w-full rounded-field border border-border-strong bg-surface px-3 py-2.5 text-sm text-ink-900"
          >
            <option value="">{t("store.filterBrandPlaceholder")}</option>
            {facets.brands.map((brand) => (
              <option key={brand.value} value={brand.value}>
                {t("store.optionWithCount", {
                  name: brand.value,
                  count: brand.count,
                })}
              </option>
            ))}
          </select>
        </MarketplaceFilterSection>
      ) : null}

      <MarketplaceFilterSection title={t("store.filterAvailabilityHeading")}>
        <label className="inline-flex items-start gap-2 text-sm text-body">
          <input
            type="checkbox"
            checked={filters.inStock === true}
            onChange={(event) =>
              navigate({
                inStock: event.currentTarget.checked || undefined,
              })
            }
            className="mt-0.5 h-4 w-4 rounded border-border"
          />
          <span>
            <span className="font-medium text-ink-900">
              {t("store.filterInStockLabel")}
            </span>
            <span className="mt-1 block text-xs text-muted">
              {t("store.filterInStockHint")}
            </span>
          </span>
        </label>
      </MarketplaceFilterSection>
    </MarketplaceFilterSidebar>
  );
}
