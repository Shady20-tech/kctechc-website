import { MarketplaceActiveFilters } from "@/components/marketplace/MarketplaceActiveFilters";
import type { MarketplaceActiveFilterChip } from "@/components/marketplace/types";
import type { Locale } from "@/lib/i18n/locales";
import type { Translator } from "@/lib/i18n/translator";
import { formatListingPrice } from "@/lib/real-estate/records";
import {
  activeFilterKeys,
  buildListingQuery,
  listingStatusLabelKey,
  removeListingFilter,
  type FilterKey,
  type ListingFilters,
} from "@/lib/real-estate/search";

/**
 * The active listing filters, as removable chips.
 *
 * A binding over the shared `MarketplaceActiveFilters`: this component knows what
 * a listing filter *is* — it reads the typed `ListingFilters` model, names each
 * value from the published geography and the enum dictionaries, and builds the
 * removal URL from the full filter state — and the shared component renders the
 * chips. That split is what keeps the chip presentation identical across the
 * departments without any department's filter model reaching another's.
 *
 * Each chip is a link to the same view with that one filter removed, built from
 * the full filter state rather than from a query-string splice. Splicing would
 * leave a stale `page` behind, and removing a region would leave an orphaned
 * division in the URL that the panel cannot display.
 */
export function ActiveFilterChips({
  locale,
  t,
  filters,
  view,
  locationNames,
}: {
  locale: Locale;
  t: Translator["t"];
  filters: ListingFilters;
  view: "list" | "map";
  /**
   * The published names for the geography slugs in the URL, keyed by slug.
   *
   * The page already loads the geography tree, so the real name is available and
   * a chip should read "Southwest Region", not "Southwest-region" derived from the
   * slug. A slug with no entry falls back to the humanized slug, which keeps the
   * chip honest for a hand-typed URL the selector never offered.
   */
  locationNames?: ReadonlyMap<string, string>;
}) {
  const keys = activeFilterKeys(filters);
  if (keys.length === 0) return null;

  const basePath = `/${locale}/real-estate/listings`;

  function hrefFor(key: FilterKey): string {
    const next = removeListingFilter(filters, key);
    const params = new URLSearchParams(
      buildListingQuery(next).replace(/^\?/, ""),
    );
    if (view === "map") params.set("view", "map");
    const query = params.toString();
    return `${basePath}${query ? `?${query}` : ""}`;
  }

  const chips: MarketplaceActiveFilterChip[] = keys.map((key) => {
    const label = filterLabel(filters, key, locale, t, locationNames);
    return {
      key,
      label,
      href: hrefFor(key),
      removeLabel: t("realEstate.search.removeFilter", { filter: label }),
    };
  });

  // Clear all is a link to the bare results path, so it drops every filter at
  // once — including any the chip list cannot render, such as an orphaned
  // division. It keeps the map view, which is a presentation choice rather than a
  // filter.
  return (
    <MarketplaceActiveFilters
      chips={chips}
      clearHref={view === "map" ? `${basePath}?view=map` : basePath}
      clearLabel={t("realEstate.search.clearAll")}
      label={t("realEstate.search.activeFilters")}
    />
  );
}

/**
 * A human label for one active filter, including its value.
 *
 * The value is included because a chip reading "Region" tells the visitor nothing
 * they cannot already see; "Region: South West" is what lets them decide whether
 * to remove it. A price range is rendered as one chip per bound so each can be
 * removed independently.
 */
function filterLabel(
  filters: ListingFilters,
  key: FilterKey,
  locale: Locale,
  t: Translator["t"],
  locationNames?: ReadonlyMap<string, string>,
): string {
  const nameFor = (slug: string | undefined) =>
    (slug ? locationNames?.get(slug) : undefined) ?? humanize(slug);
  switch (key) {
    case "q":
      return `${t("realEstate.search.chipQuery")}: ${filters.query}`;
    case "region":
      return `${t("realEstate.search.regionLabel")}: ${nameFor(filters.regionSlug)}`;
    case "division":
      return `${t("realEstate.search.divisionLabel")}: ${nameFor(filters.divisionSlug)}`;
    case "subdivision":
      return `${t("realEstate.search.subdivisionLabel")}: ${nameFor(filters.subdivisionSlug)}`;
    case "locality":
      return `${t("realEstate.search.cityLabel")}: ${filters.locality}`;
    case "type":
      return `${t("realEstate.search.typeLabel")}: ${t(`realEstate.types.${filters.listingType}`)}`;
    case "kind":
      return `${t("realEstate.search.kindLabel")}: ${t(`realEstate.kinds.${filters.propertyKind}`)}`;
    case "propertyType":
      return `${t("realEstate.search.propertyTypeLabel")}: ${t(`realEstate.propertyTypes.${filters.propertyType}`)}`;
    case "status":
      return `${t("realEstate.search.statusLabel")}: ${(filters.statuses ?? [])
        .map((status) => t(listingStatusLabelKey(status)))
        .join(", ")}`;
    case "currency":
      return `${t("realEstate.search.currencyLabel")}: ${filters.currency ?? ""}`;
    case "verified":
      return t("realEstate.search.verifiedOnlyChip");
    case "amenity":
      return `${t("realEstate.search.amenitiesLabel")}: ${(filters.amenities ?? []).join(", ")}`;
    case "minPrice":
      return `${t("realEstate.search.minPriceShort")}: ${formatMinor(filters.minPrice, locale, filters.currency)}`;
    case "maxPrice":
      return `${t("realEstate.search.maxPriceShort")}: ${formatMinor(filters.maxPrice, locale, filters.currency)}`;
    case "minBedrooms":
      return t("realEstate.search.bedroomsChip", {
        count: filters.minBedrooms ?? 0,
      });
    case "minBathrooms":
      return t("realEstate.search.bathroomsChip", {
        count: filters.minBathrooms ?? 0,
      });
    case "minSize":
      return `${t("realEstate.search.minSizeShort")}: ${filters.minSize} ${t("realEstate.units.sqm")}`;
    case "maxSize":
      return `${t("realEstate.search.maxSizeShort")}: ${filters.maxSize} ${t("realEstate.units.sqm")}`;
  }
}

/**
 * Turn a slug into a readable label.
 *
 * The slug is what the URL carries, and a chip has to show something; fetching
 * the geography name would mean a database read for a presentational string, and
 * passing the whole geography tree into a chip list to look up one name would be
 * worse. The slug is title-cased instead, which is honest — it is derived from the
 * URL, not claimed to be the official name.
 */
function humanize(slug: string | undefined): string {
  if (!slug) return "";
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Format a whole-franc amount for a chip, without a period suffix. */
function formatMinor(
  value: number | undefined,
  locale: Locale,
  currency: string | undefined,
): string {
  if (value === undefined) return "";
  return formatListingPrice(
    {
      priceMinor: value,
      currency: currency ?? "XAF",
      pricePeriod: "total",
      priceOnRequest: false,
    },
    locale,
  );
}
