import { MarketplaceActiveFilters } from "@/components/marketplace/MarketplaceActiveFilters";
import type { MarketplaceActiveFilterChip } from "@/components/marketplace/types";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import type { LocalizedCategory } from "@/lib/store/types";
import {
  activeStoreFilterKeys,
  buildStoreQuery,
  removeStoreFilter,
  STORE_PRIMARY_CURRENCY,
  type StoreFilterKey,
  type StoreFilters,
} from "@/lib/store/search";

/**
 * The active store filters, as removable chips.
 *
 * A binding over the shared `MarketplaceActiveFilters`: this component knows what
 * a store filter *is* — it reads the typed `StoreFilters` model, names each value
 * from the category list and the price/currency it was parsed with, and builds the
 * removal URL from the full filter state — and the shared component renders the
 * chips. Each chip is a link to the same view with that one filter removed.
 */
export function StoreActiveFilters({
  locale,
  basePath,
  filters,
  categories,
}: {
  locale: Locale;
  basePath: string;
  filters: StoreFilters;
  categories: readonly LocalizedCategory[];
}) {
  const t = createTranslator(locale).t;
  const keys = activeStoreFilterKeys(filters);
  if (keys.length === 0) return null;

  const categoryName = (slug: string | undefined) =>
    categories.find((category) => category.slug === slug)?.name ?? slug ?? "";

  const currency = filters.currency ?? STORE_PRIMARY_CURRENCY;

  const chips: MarketplaceActiveFilterChip[] = keys.map((key) => {
    const label = filterLabel(key, filters, t, categoryName, currency, locale);
    return {
      key,
      label,
      href: `${basePath}${buildStoreQuery(removeStoreFilter(filters, key))}`,
      removeLabel: t("store.removeFilter", { filter: label }),
    };
  });

  return (
    <MarketplaceActiveFilters
      chips={chips}
      clearHref={basePath}
      clearLabel={t("store.clearFilters")}
      label={t("store.activeFilters")}
    />
  );
}

/** A human label for one active store filter, including its value. */
function filterLabel(
  key: StoreFilterKey,
  filters: StoreFilters,
  t: (key: string, params?: Record<string, string | number>) => string,
  categoryName: (slug: string | undefined) => string,
  currency: string,
  locale: Locale,
): string {
  switch (key) {
    case "q":
      return `${t("store.chipQuery")}: ${filters.query}`;
    case "category":
      return `${t("store.chipCategory")}: ${categoryName(filters.category)}`;
    case "brand":
      return `${t("store.chipBrand")}: ${filters.brand}`;
    case "inStock":
      return t("store.chipInStock");
    case "minPrice":
      return `${t("store.chipMinPrice")}: ${formatAmount(
        filters.minPrice ?? 0,
        currency,
        locale,
      )}`;
    case "maxPrice":
      return `${t("store.chipMaxPrice")}: ${formatAmount(
        filters.maxPrice ?? 0,
        currency,
        locale,
      )}`;
    default:
      return "";
  }
}

/**
 * Format a whole-unit amount with its currency code.
 *
 * A price *filter* is expressed in the currency's own unit — a visitor types
 * `500000`, not `5000.00` — so this must not apply a minor-unit divisor the way
 * the product price formatter does. The currency code is always shown, because a
 * bound with no unit is a number the visitor cannot act on.
 */
function formatAmount(value: number, currency: string, locale: Locale): string {
  const amount = new Intl.NumberFormat(locale === "fr" ? "fr-CM" : "en-CM", {
    maximumFractionDigits: 0,
  }).format(value);
  return `${amount} ${currency}`;
}
