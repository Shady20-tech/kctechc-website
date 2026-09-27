"use client";

import { useRouter } from "next/navigation";

import { Button, ButtonLink } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Form";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import type { GeographyOption } from "@/lib/real-estate/loaders";
import {
  LISTING_PROPERTY_KINDS,
  LISTING_TYPES,
  PROPERTY_TYPES,
} from "@/lib/real-estate/enums";
import {
  BATHROOM_FILTER_OPTIONS,
  BEDROOM_FILTER_OPTIONS,
  LISTING_SORT_TO_SQL,
  LISTING_STATUS_FILTERS,
  buildListingQuery,
  listingStatusLabelKey,
  type ListingFilters,
  type ListingSort,
} from "@/lib/real-estate/search";

/** The translate function alone, for the private selects below. */
type Translate = ReturnType<typeof createTranslator>["t"];

/**
 * The property filter controls.
 *
 * A plain GET form, so the filters ARE the query string: submitting navigates to
 * the filtered URL, a filtered view is shareable and cacheable, and the back
 * button behaves as a reader expects because each filter state is a real
 * navigation. It works without hydration, which is why only two controls are
 * interactive.
 *
 * The two that are interactive are the ones that must react before submission:
 * the geography hierarchy, where choosing a region changes which divisions are
 * offered, and the sort, where re-submitting the whole form to change the order
 * would be a needless round trip through a button. Both push a URL built from the
 * *current* form values rather than from the props, so a value the reader has
 * typed but not yet submitted is not silently discarded by a geography change.
 *
 * The geography selectors are cascading but not dependent in the database: the
 * search function filters each level independently, so a division can be chosen
 * without a region. The cascade exists because the reader's mental model is a
 * hierarchy — the divisions offered are the ones under the chosen region — and
 * offering all divisions of the country would be a list they have to search
 * themselves.
 */
export function ListingFilterPanel({
  locale,
  geography,
  filters,
  view,
}: {
  locale: Locale;
  geography: readonly GeographyOption[];
  filters: ListingFilters;
  view: "list" | "map";
}) {
  const t = createTranslator(locale).t;
  const router = useRouter();
  const basePath = `/${locale}/real-estate/listings`;

  const selectedRegion = geography.find(
    (region) => region.slug === filters.regionSlug,
  );
  const selectedDivision = selectedRegion?.divisions.find(
    (division) => division.slug === filters.divisionSlug,
  );

  /** Navigate to a URL built from the current form plus one change. */
  function navigate(patch: Partial<ListingFilters>) {
    const next = { ...filters, ...patch, page: undefined };
    const params = new URLSearchParams(buildListingQuery(next).replace(/^\?/, ""));
    if (view === "map") params.set("view", "map");
    const query = params.toString();
    router.push(`${basePath}${query ? `?${query}` : ""}`);
  }

  return (
    <form method="get" action={basePath} className="space-y-6">
      {view === "map" ? <input type="hidden" name="view" value="map" /> : null}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <TextField
          id="q"
          name="q"
          type="search"
          label={t("realEstate.search.searchLabel")}
          placeholder={t("realEstate.search.searchPlaceholder")}
          defaultValue={filters.query ?? ""}
        />

        <SelectField
          id="region"
          name="region"
          label={t("realEstate.search.regionLabel")}
          defaultValue={filters.regionSlug ?? ""}
          onChange={(event) =>
            // Choosing a region clears any division and subdivision: they belonged
            // to the previous region and the selector cannot display them under
            // the new one.
            navigate({
              regionSlug: event.currentTarget.value || undefined,
              divisionSlug: undefined,
              subdivisionSlug: undefined,
            })
          }
        >
          <option value="">{t("realEstate.search.regionAll")}</option>
          {geography.map((region) => (
            <option key={region.slug} value={region.slug}>
              {t("realEstate.search.optionWithCount", {
                name: region.name,
                count: region.count,
              })}
            </option>
          ))}
        </SelectField>

        <SelectField
          id="division"
          name="division"
          label={t("realEstate.search.divisionLabel")}
          defaultValue={filters.divisionSlug ?? ""}
          disabled={!selectedRegion || selectedRegion.divisions.length === 0}
          onChange={(event) =>
            navigate({
              divisionSlug: event.currentTarget.value || undefined,
              subdivisionSlug: undefined,
            })
          }
        >
          <option value="">{t("realEstate.search.divisionAll")}</option>
          {(selectedRegion?.divisions ?? []).map((division) => (
            <option key={division.slug} value={division.slug}>
              {t("realEstate.search.optionWithCount", {
                name: division.name,
                count: division.count,
              })}
            </option>
          ))}
        </SelectField>

        <SelectField
          id="subdivision"
          name="subdivision"
          label={t("realEstate.search.subdivisionLabel")}
          defaultValue={filters.subdivisionSlug ?? ""}
          disabled={!selectedDivision || selectedDivision.subdivisions.length === 0}
          onChange={(event) =>
            navigate({ subdivisionSlug: event.currentTarget.value || undefined })
          }
        >
          <option value="">{t("realEstate.search.subdivisionAll")}</option>
          {(selectedDivision?.subdivisions ?? []).map((subdivision) => (
            <option key={subdivision.slug} value={subdivision.slug}>
              {t("realEstate.search.optionWithCount", {
                name: subdivision.name,
                count: subdivision.count,
              })}
            </option>
          ))}
        </SelectField>

        <ListingTypeSelect
          defaultValue={filters.listingType ?? ""}
          t={t}
        />

        <ListingKindSelect
          defaultValue={filters.propertyKind ?? ""}
          t={t}
        />

        <PropertyTypeSelect
          defaultValue={filters.propertyType ?? ""}
          t={t}
        />

        <TextField
          id="minPrice"
          name="minPrice"
          type="number"
          min={0}
          step={1000}
          inputMode="numeric"
          label={t("realEstate.search.minPriceLabel")}
          defaultValue={
            filters.minPrice !== undefined ? String(filters.minPrice) : ""
          }
        />

        <TextField
          id="maxPrice"
          name="maxPrice"
          type="number"
          min={0}
          step={1000}
          inputMode="numeric"
          label={t("realEstate.search.maxPriceLabel")}
          defaultValue={
            filters.maxPrice !== undefined ? String(filters.maxPrice) : ""
          }
        />

        <SelectField
          id="minBedrooms"
          name="minBedrooms"
          label={t("realEstate.search.bedroomsLabel")}
          defaultValue={
            filters.minBedrooms !== undefined ? String(filters.minBedrooms) : ""
          }
        >
          <option value="">{t("realEstate.search.bedroomsAny")}</option>
          {BEDROOM_FILTER_OPTIONS.map((count) => (
            <option key={count} value={count}>
              {count}+
            </option>
          ))}
        </SelectField>

        <SelectField
          id="minBathrooms"
          name="minBathrooms"
          label={t("realEstate.search.bathroomsLabel")}
          defaultValue={
            filters.minBathrooms !== undefined ? String(filters.minBathrooms) : ""
          }
        >
          <option value="">{t("realEstate.search.bathroomsAny")}</option>
          {BATHROOM_FILTER_OPTIONS.map((count) => (
            <option key={count} value={count}>
              {count}+
            </option>
          ))}
        </SelectField>

        <TextField
          id="minSize"
          name="minSize"
          type="number"
          min={0}
          step={50}
          inputMode="numeric"
          label={t("realEstate.search.minSizeLabel")}
          defaultValue={
            filters.minSize !== undefined ? String(filters.minSize) : ""
          }
        />

        <TextField
          id="maxSize"
          name="maxSize"
          type="number"
          min={0}
          step={50}
          inputMode="numeric"
          label={t("realEstate.search.maxSizeLabel")}
          defaultValue={
            filters.maxSize !== undefined ? String(filters.maxSize) : ""
          }
        />

        <SelectField
          id="sort"
          name="sort"
          label={t("realEstate.search.sortLabel")}
          defaultValue={filters.sort ?? "newest"}
          onChange={(event) =>
            navigate({
              sort: isSort(event.currentTarget.value)
                ? event.currentTarget.value
                : undefined,
            })
          }
        >
          {Object.keys(LISTING_SORT_TO_SQL).map((sort) => (
            <option key={sort} value={sort}>
              {t(sortLabelKey(sort as ListingSort))}
            </option>
          ))}
        </SelectField>
      </div>

      {/* Status is a set of checkboxes rather than a multi-select: a multi-select
          needs a modifier key to choose a second option, which is a hidden
          requirement on touch and on a keyboard. Checkboxes are explicit. */}
      <fieldset className="rounded-card border border-border bg-surface p-5">
        <legend className="px-2 text-sm font-semibold text-ink-900">
          {t("realEstate.search.statusLabel")}
        </legend>
        <p className="mt-1 text-sm text-muted">
          {t("realEstate.search.statusHint")}
        </p>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
          {LISTING_STATUS_FILTERS.map((status) => (
            <label
              key={status}
              className="inline-flex items-center gap-2 text-sm text-body"
            >
              <input
                type="checkbox"
                name="status"
                value={status}
                defaultChecked={filters.statuses?.includes(status) ?? false}
                className="h-4 w-4 rounded border-border"
              />
              {t(listingStatusLabelKey(status))}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="primary">
          {t("realEstate.search.searchSubmit")}
        </Button>
        {/* A link, not a reset button: "clear" is the absence of query parameters,
            and a link makes that a real URL with a working back button rather
            than a form-state side effect. */}
        <ButtonLink href={basePath} variant="secondary">
          {t("realEstate.search.clearFilters")}
        </ButtonLink>
      </div>
    </form>
  );
}

/** The translation key for a sort's label. Kept local so the client bundle does
 * not pull in the whole search module's server-side reasoning. */
function sortLabelKey(sort: ListingSort): string {
  switch (sort) {
    case "price-asc":
      return "realEstate.search.sortPriceAsc";
    case "price-desc":
      return "realEstate.search.sortPriceDesc";
    case "most-viewed":
      return "realEstate.search.sortMostViewed";
    default:
      return "realEstate.search.sortNewest";
  }
}

function isSort(value: string): value is ListingSort {
  return (
    value === "newest" ||
    value === "price-asc" ||
    value === "price-desc" ||
    value === "most-viewed"
  );
}

function ListingTypeSelect({
  t,
  ...props
}: {
  defaultValue: string;
  t: Translate;
}) {
  return (
    <SelectField
      id="type"
      name="type"
      label={t("realEstate.search.typeLabel")}
      {...props}
    >
      <option value="">{t("realEstate.search.typeAll")}</option>
      {LISTING_TYPES.map((type) => (
        <option key={type} value={type}>
          {t(`realEstate.types.${type}`)}
        </option>
      ))}
    </SelectField>
  );
}

function ListingKindSelect({
  t,
  ...props
}: {
  defaultValue: string;
  t: Translate;
}) {
  return (
    <SelectField
      id="kind"
      name="kind"
      label={t("realEstate.search.kindLabel")}
      {...props}
    >
      <option value="">{t("realEstate.search.kindAll")}</option>
      {LISTING_PROPERTY_KINDS.map((kind) => (
        <option key={kind} value={kind}>
          {t(`realEstate.kinds.${kind}`)}
        </option>
      ))}
    </SelectField>
  );
}

function PropertyTypeSelect({
  t,
  ...props
}: {
  defaultValue: string;
  t: Translate;
}) {
  return (
    <SelectField
      id="propertyType"
      name="propertyType"
      label={t("realEstate.search.propertyTypeLabel")}
      {...props}
    >
      <option value="">{t("realEstate.search.propertyTypeAll")}</option>
      {PROPERTY_TYPES.map((type) => (
        <option key={type} value={type}>
          {t(`realEstate.propertyTypes.${type}`)}
        </option>
      ))}
    </SelectField>
  );
}
