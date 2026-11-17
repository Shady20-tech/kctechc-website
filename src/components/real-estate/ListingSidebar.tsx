"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { FilterSection } from "@/components/real-estate/FilterSection";
import {
  SearchableSelect,
  type SearchableOption,
} from "@/components/real-estate/SearchableSelect";
import { Button, ButtonLink } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Form";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { LISTING_PROPERTY_KINDS, PROPERTY_TYPES } from "@/lib/real-estate/enums";
import type { GeographyOption } from "@/lib/real-estate/geography";
import type { ListingFacets } from "@/lib/real-estate/loaders";
import {
  BATHROOM_FILTER_OPTIONS,
  BEDROOM_FILTER_OPTIONS,
  DEFAULT_LISTING_SORT,
  PRIMARY_CURRENCY,
  PROPERTY_CATEGORIES,
  activeFilterKeys,
  applyCategory,
  buildListingQuery,
  categoryForFilters,
  type ListingFilters,
} from "@/lib/real-estate/search";

/**
 * The marketplace filter sidebar.
 *
 * Sections A-E of the brief, each a collapsible `<details>` group so a long
 * sidebar stays scannable. The controls are a plain GET form, so the filters ARE
 * the query string: submitting navigates to the filtered URL, a filtered view is
 * shareable and cacheable, the back button behaves, and everything works without
 * JavaScript.
 *
 * Three controls navigate immediately when changed, because they must react
 * before a submit: the geography cascade (choosing a region changes which
 * divisions are offered), the currency (it rebinds what the price bounds mean)
 * and the verified-only switch (a single toggle whose purpose is instant
 * narrowing). Everything else is submitted with the form.
 *
 * Counts come from `listing_facets`, which counts under the same visibility
 * predicate the search uses. A category or currency with no listings shows no
 * count at all rather than a zero, so the sidebar never implies inventory that is
 * not there.
 */
export function ListingSidebar({
  locale,
  geography,
  facets,
  filters,
  view,
  variant = "sidebar",
  onClose,
}: {
  locale: Locale;
  geography: readonly GeographyOption[];
  facets: ListingFacets;
  filters: ListingFilters;
  view: "list" | "map";
  /** `drawer` renders the mobile presentation with sticky apply/close actions. */
  variant?: "sidebar" | "drawer";
  onClose?: () => void;
}) {
  const t = createTranslator(locale).t;
  const router = useRouter();
  const basePath = `/${locale}/real-estate/listings`;

  // A draft of the location cascade so a change is reflected in the child
  // selectors before the form is submitted. Seeded from the URL state.
  const [regionSlug, setRegionSlug] = useState(filters.regionSlug ?? "");
  const [divisionSlug, setDivisionSlug] = useState(filters.divisionSlug ?? "");
  const [subdivisionSlug, setSubdivisionSlug] = useState(
    filters.subdivisionSlug ?? "",
  );

  const selectedRegion = geography.find((region) => region.slug === regionSlug);
  const selectedDivision = selectedRegion?.divisions.find(
    (division) => division.slug === divisionSlug,
  );

  const activeCategory = categoryForFilters(filters);
  const activeCount = activeFilterKeys(filters).length;

  function countLabel(name: string, count: number): string {
    return t("realEstate.search.optionWithCount", { name, count });
  }

  /** Navigate to a URL built from the current filter state plus one change. */
  function navigate(patch: Partial<ListingFilters>) {
    const next = { ...filters, ...patch, page: undefined };
    const params = new URLSearchParams(
      buildListingQuery(next).replace(/^\?/, ""),
    );
    if (view === "map") params.set("view", "map");
    const query = params.toString();
    router.push(`${basePath}${query ? `?${query}` : ""}`);
  }

  const regionOptions: SearchableOption[] = geography.map((region) => ({
    value: region.slug,
    label: region.name,
    count: region.count,
  }));
  const divisionOptions: SearchableOption[] = (
    selectedRegion?.divisions ?? []
  ).map((division) => ({
    value: division.slug,
    label: division.name,
    count: division.count,
  }));
  const subdivisionOptions: SearchableOption[] = (
    selectedDivision?.subdivisions ?? []
  ).map((subdivision) => ({
    value: subdivision.slug,
    label: subdivision.name,
    count: subdivision.count,
  }));

  const currencies = facets.currencies;

  return (
    <form
      method="get"
      action={basePath}
      className="flex h-full flex-col"
      id="listing-filters-form"
    >
      {view === "map" ? <input type="hidden" name="view" value="map" /> : null}
      {/* The cascade selects navigate immediately, but their values must also be
          part of a plain submit so the form works without JavaScript. */}
      <input type="hidden" name="region" value={regionSlug} />
      <input type="hidden" name="division" value={divisionSlug} />
      <input type="hidden" name="subdivision" value={subdivisionSlug} />
      {filters.currency ? (
        <input type="hidden" name="currency" value={filters.currency} />
      ) : null}
      {filters.verifiedOnly ? (
        <input type="hidden" name="verified" value="true" />
      ) : null}

      <div className="flex-1">
        {/* Keyword. Kept in the sidebar as well as on the landing page so a
            visitor who searched once can refine the term without going back. */}
        <FilterSection title={t("realEstate.search.searchLabel")}>
          <TextField
            id="filter-q"
            name="q"
            type="search"
            label={t("realEstate.search.searchLabel")}
            placeholder={t("realEstate.search.searchPlaceholder")}
            defaultValue={filters.query ?? ""}
          />
        </FilterSection>

        {/* A. Property categories - links, so a category is a real URL and works
            without JavaScript. The count comes from the matching facet bucket. */}
        <FilterSection title={t("realEstate.search.categoriesHeading")}>
          <ul className="flex flex-col gap-0.5">
            {PROPERTY_CATEGORIES.map((category) => {
              const count = facets.categories.get(category.bucket);
              const isActive = activeCategory === category.bucket;
              const href = `${basePath}${buildListingQuery(
                applyCategory(filters, category.bucket),
              )}`;
              return (
                <li key={category.bucket}>
                  <a
                    href={href}
                    aria-current={isActive ? "true" : undefined}
                    className={`flex items-center justify-between gap-2 rounded-control px-2.5 py-2 text-sm transition-soft ${
                      isActive
                        ? "bg-surface-alt font-semibold text-dept-accent"
                        : "text-body hover:bg-surface-alt"
                    }`}
                  >
                    <span>{t(category.labelKey)}</span>
                    {count !== undefined && count > 0 ? (
                      <span className="text-xs text-muted">{count}</span>
                    ) : null}
                  </a>
                </li>
              );
            })}
          </ul>
        </FilterSection>

        {/* B. Location - a cascading, searchable hierarchy plus a free-text
            neighbourhood field. */}
        <FilterSection title={t("realEstate.search.locationHeading")}>
          <div className="flex flex-col gap-4">
            <SearchableSelect
              id="filter-region"
              label={t("realEstate.search.regionLabel")}
              options={regionOptions}
              value={regionSlug}
              placeholder={t("realEstate.search.regionAll")}
              emptyLabel={t("realEstate.search.regionAll")}
              countLabel={countLabel}
              onSelect={(value) => {
                // Changing a parent clears the child selections: they belonged to
                // the previous region and cannot be shown under the new one.
                setRegionSlug(value);
                setDivisionSlug("");
                setSubdivisionSlug("");
                navigate({
                  regionSlug: value || undefined,
                  divisionSlug: undefined,
                  subdivisionSlug: undefined,
                });
              }}
            />
            <SearchableSelect
              id="filter-division"
              label={t("realEstate.search.divisionLabel")}
              options={divisionOptions}
              value={divisionSlug}
              placeholder={t("realEstate.search.divisionAll")}
              emptyLabel={t("realEstate.search.divisionAll")}
              countLabel={countLabel}
              disabled={!selectedRegion}
              disabledHint={t("realEstate.search.regionLabel")}
              onSelect={(value) => {
                setDivisionSlug(value);
                setSubdivisionSlug("");
                navigate({
                  divisionSlug: value || undefined,
                  subdivisionSlug: undefined,
                });
              }}
            />
            <SearchableSelect
              id="filter-subdivision"
              label={t("realEstate.search.subdivisionLabel")}
              options={subdivisionOptions}
              value={subdivisionSlug}
              placeholder={t("realEstate.search.subdivisionAll")}
              emptyLabel={t("realEstate.search.subdivisionAll")}
              countLabel={countLabel}
              disabled={!selectedDivision}
              disabledHint={t("realEstate.search.divisionLabel")}
              onSelect={(value) => {
                setSubdivisionSlug(value);
                navigate({ subdivisionSlug: value || undefined });
              }}
            />
            <TextField
              id="locality"
              name="locality"
              type="search"
              label={t("realEstate.search.cityLabel")}
              placeholder={t("realEstate.search.cityPlaceholder")}
              defaultValue={filters.locality ?? ""}
            />
          </div>
        </FilterSection>

        {/* C. Price - two fields side by side, each with the brief's wording, in
            one currency at a time. */}
        <FilterSection title={t("realEstate.search.priceHeading")}>
          <div className="flex flex-col gap-4">
            {currencies.length > 1 ? (
              <label className="block text-sm font-medium text-ink-900">
                {t("realEstate.search.currencyLabel")}
                <select
                  value={filters.currency ?? ""}
                  onChange={(event) =>
                    navigate({
                      currency: event.currentTarget.value || undefined,
                    })
                  }
                  className="mt-1.5 w-full rounded-field border border-border-strong bg-surface px-3 py-2.5 text-sm text-ink-900"
                >
                  <option value="">{t("realEstate.search.currencyAny")}</option>
                  {currencies.map((currency) => (
                    <option key={currency.code} value={currency.code}>
                      {currency.code}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <p className="text-xs text-muted">
              {t("realEstate.search.currencyHint")}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <TextField
                id="minPrice"
                name="minPrice"
                type="number"
                min={0}
                step={1000}
                inputMode="numeric"
                label={t("realEstate.search.minPriceLabel")}
                hint={t("realEstate.search.minPriceHint")}
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
                hint={t("realEstate.search.maxPriceHint")}
                defaultValue={
                  filters.maxPrice !== undefined ? String(filters.maxPrice) : ""
                }
              />
            </div>
            <p className="text-xs font-medium text-body">
              {t("realEstate.search.priceCurrencyNote", {
                currency: filters.currency ?? PRIMARY_CURRENCY,
              })}
            </p>
          </div>
        </FilterSection>

        {/* D. Property characteristics. */}
        <FilterSection title={t("realEstate.search.characteristicsHeading")}>
          <div className="flex flex-col gap-4">
            <label className="block text-sm font-medium text-ink-900">
              {t("realEstate.search.kindLabel")}
              <select
                name="kind"
                defaultValue={filters.propertyKind ?? ""}
                className="mt-1.5 w-full rounded-field border border-border-strong bg-surface px-3 py-2.5 text-sm text-ink-900"
              >
                <option value="">{t("realEstate.search.kindAll")}</option>
                {LISTING_PROPERTY_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {t(`realEstate.kinds.${kind}`)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-ink-900">
              {t("realEstate.search.propertyTypeLabel")}
              <select
                name="propertyType"
                defaultValue={filters.propertyType ?? ""}
                className="mt-1.5 w-full rounded-field border border-border-strong bg-surface px-3 py-2.5 text-sm text-ink-900"
              >
                <option value="">{t("realEstate.search.propertyTypeAll")}</option>
                {PROPERTY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`realEstate.propertyTypes.${type}`)}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium text-ink-900">
                {t("realEstate.search.bedroomsLabel")}
                <select
                  name="minBedrooms"
                  defaultValue={
                    filters.minBedrooms !== undefined
                      ? String(filters.minBedrooms)
                      : ""
                  }
                  className="mt-1.5 w-full rounded-field border border-border-strong bg-surface px-3 py-2.5 text-sm text-ink-900"
                >
                  <option value="">{t("realEstate.search.bedroomsAny")}</option>
                  {BEDROOM_FILTER_OPTIONS.map((count) => (
                    <option key={count} value={count}>
                      {count}+
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-ink-900">
                {t("realEstate.search.bathroomsLabel")}
                <select
                  name="minBathrooms"
                  defaultValue={
                    filters.minBathrooms !== undefined
                      ? String(filters.minBathrooms)
                      : ""
                  }
                  className="mt-1.5 w-full rounded-field border border-border-strong bg-surface px-3 py-2.5 text-sm text-ink-900"
                >
                  <option value="">{t("realEstate.search.bathroomsAny")}</option>
                  {BATHROOM_FILTER_OPTIONS.map((count) => (
                    <option key={count} value={count}>
                      {count}+
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
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
            </div>

            {facets.amenities.length > 0 ? (
              <fieldset>
                <legend className="text-sm font-medium text-ink-900">
                  {t("realEstate.search.amenitiesLabel")}
                </legend>
                <p className="mt-1 text-xs text-muted">
                  {t("realEstate.search.amenitiesHint")}
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  {facets.amenities.slice(0, 12).map((amenity) => (
                    <label
                      key={amenity.slug}
                      className="inline-flex items-center gap-2 text-sm text-body"
                    >
                      <input
                        type="checkbox"
                        name="amenity"
                        value={amenity.slug}
                        defaultChecked={filters.amenities?.includes(
                          amenity.slug,
                        )}
                        className="h-4 w-4 rounded border-border"
                      />
                      <span className="capitalize">
                        {humanize(amenity.slug)}
                      </span>
                      <span className="text-xs text-muted">
                        ({amenity.count})
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}
          </div>
        </FilterSection>

        {/* E. Verified publishers. The badge is only ever shown for a membership
            a super admin granted and that is still approved. */}
        <FilterSection title={t("realEstate.search.publishersHeading")}>
          <label className="inline-flex items-start gap-2 text-sm text-body">
            <input
              type="checkbox"
              checked={filters.verifiedOnly === true}
              onChange={(event) =>
                navigate({
                  verifiedOnly: event.currentTarget.checked || undefined,
                })
              }
              className="mt-0.5 h-4 w-4 rounded border-border"
            />
            <span>
              <span className="font-medium text-ink-900">
                {t("realEstate.search.verifiedOnlyLabel")}
              </span>
              <span className="mt-1 block text-xs text-muted">
                {t("realEstate.search.verifiedOnlyHint")}
              </span>
            </span>
          </label>
        </FilterSection>
      </div>

      <div
        className={`mt-6 flex flex-wrap gap-3 ${
          variant === "drawer"
            ? "sticky bottom-0 -mx-5 border-t border-border bg-surface px-5 py-4"
            : ""
        }`}
      >
        <Button type="submit" variant="primary" className="flex-1">
          {variant === "drawer"
            ? t("realEstate.search.applyFilters")
            : t("realEstate.search.searchSubmit")}
        </Button>
        <ButtonLink href={basePath} variant="secondary">
          {t("realEstate.search.clearAll")}
        </ButtonLink>
        {variant === "drawer" && onClose ? (
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("realEstate.search.closeFilters")}
          </Button>
        ) : null}
        {activeCount > 0 ? (
          <p className="w-full text-xs text-muted">
            {t("realEstate.search.filtersActiveCount", { count: activeCount })}
          </p>
        ) : null}
      </div>

      {/* The sort is carried through a submit so a filter change does not silently
          reset the ordering the visitor chose. */}
      <input
        type="hidden"
        name="sort"
        value={filters.sort ?? DEFAULT_LISTING_SORT}
      />
      {filters.query ? (
        <input type="hidden" name="q" value={filters.query} />
      ) : null}
    </form>
  );
}

/** Turn an amenity slug into a readable label. */
function humanize(slug: string): string {
  return slug.replace(/[-_]+/g, " ");
}
