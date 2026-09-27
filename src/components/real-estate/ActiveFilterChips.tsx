import { X } from "lucide-react";
import Link from "next/link";

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
 * The active filters, as removable chips.
 *
 * The point of this component is that a filtered result set has to say *why* it
 * is what it is. Without it, a visitor who lands on a shared link with four
 * filters applied sees a short list and no explanation, and the only way to
 * discover the cause is to open the filter panel and read every control.
 *
 * Each chip is a link to the same view with that one filter removed, built from
 * the full filter state rather than from a query-string splice. Splicing would
 * leave a stale `page` behind, and removing a region would leave an orphaned
 * division in the URL that the panel cannot display.
 *
 * A chip is a link, not a button: the target is a real URL, so it is shareable,
 * crawlable as `noindex, follow`, and works without JavaScript.
 */
export function ActiveFilterChips({
  locale,
  t,
  filters,
  view,
}: {
  locale: Locale;
  t: Translator["t"];
  filters: ListingFilters;
  view: "list" | "map";
}) {
  const keys = activeFilterKeys(filters);
  if (keys.length === 0) return null;

  const basePath = `/${locale}/real-estate/listings`;

  function hrefFor(key: FilterKey): string {
    const next = removeListingFilter(filters, key);
    const params = new URLSearchParams(buildListingQuery(next).replace(/^\?/, ""));
    if (view === "map") params.set("view", "map");
    const query = params.toString();
    return `${basePath}${query ? `?${query}` : ""}`;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mono-label text-muted">
        {t("realEstate.search.activeFilters")}
      </span>
      <ul className="flex flex-wrap gap-2">
        {keys.map((key) => (
          <li key={key}>
            <Link
              href={hrefFor(key)}
              className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1.5 text-sm text-body transition-soft hover:border-dept-accent"
              // The label names the filter and its value, so a screen-reader user
              // hears "Remove filter Region: South West" rather than "Region".
              aria-label={t("realEstate.search.removeFilter", {
                filter: filterLabel(filters, key, locale, t),
              })}
            >
              <span>{filterLabel(filters, key, locale, t)}</span>
              <X aria-hidden="true" className="h-3.5 w-3.5" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
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
): string {
  switch (key) {
    case "q":
      return `${t("realEstate.search.chipQuery")}: ${filters.query}`;
    case "region":
      return `${t("realEstate.search.regionLabel")}: ${humanize(filters.regionSlug)}`;
    case "division":
      return `${t("realEstate.search.divisionLabel")}: ${humanize(filters.divisionSlug)}`;
    case "subdivision":
      return `${t("realEstate.search.subdivisionLabel")}: ${humanize(filters.subdivisionSlug)}`;
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
    case "minPrice":
      return `${t("realEstate.search.minPriceShort")}: ${formatMinor(filters.minPrice, locale)}`;
    case "maxPrice":
      return `${t("realEstate.search.maxPriceShort")}: ${formatMinor(filters.maxPrice, locale)}`;
    case "minBedrooms":
      return t("realEstate.search.bedroomsChip", { count: filters.minBedrooms ?? 0 });
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
function formatMinor(value: number | undefined, locale: Locale): string {
  if (value === undefined) return "";
  return formatListingPrice(
    {
      priceMinor: value,
      currency: "XAF",
      pricePeriod: "total",
      priceOnRequest: false,
    },
    locale,
  );
}
