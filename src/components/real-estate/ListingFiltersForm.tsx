"use client";

import { useRouter } from "next/navigation";

import { Button, ButtonLink } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Form";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { LISTING_PROPERTY_KINDS, LISTING_TYPES } from "@/lib/real-estate/enums";
import {
  BEDROOM_FILTER_OPTIONS,
  buildListingQuery,
  type ListingFilters,
} from "@/lib/real-estate/search";

/** The translate function alone, for the private selects below. */
type Translate = ReturnType<typeof createTranslator>["t"];

/**
 * Property filter controls.
 *
 * A plain GET form: the filters ARE query parameters, so submitting navigates to
 * the filtered URL. That is deliberate and is why there is almost no JavaScript
 * here — the form works without hydration, a filtered view is a shareable and
 * cacheable URL, and the back button behaves as a reader expects because each
 * filter state is a real navigation.
 *
 * The client component exists only for the sort control, which should apply on
 * change rather than requiring a second button press.
 *
 * The form never constructs a URL with values absent from its own fields; a
 * hidden `view` field carries the list/map choice through a filter change so
 * applying a filter does not silently drop the reader back to the list.
 */
export function ListingFiltersForm({
  locale,
  regions,
  filters,
  view,
}: {
  locale: Locale;
  regions: readonly { slug: string; name: string; count: number }[];
  filters: ListingFilters;
  view: "list" | "map";
}) {
  // The translator is pure and isomorphic, so a Client Component derives it from
  // the locale rather than receiving it. A function cannot cross the Server/Client
  // boundary, so the previous `t` prop was rejected at render time.
  const t = createTranslator(locale).t;
  const router = useRouter();
  const basePath = `/${locale}/real-estate/properties`;

  return (
    <form method="get" action={basePath} className="space-y-6">
      {view === "map" ? <input type="hidden" name="view" value="map" /> : null}

      <div className="grid gap-6 lg:grid-cols-3">
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
        >
          <option value="">{t("realEstate.search.regionAll")}</option>
          {regions.map((region) => (
            <option key={region.slug} value={region.slug}>
              {region.name}
            </option>
          ))}
        </SelectField>

        <ListingTypeSelect
          id="type"
          name="type"
          label={t("realEstate.search.typeLabel")}
          defaultValue={filters.listingType ?? ""}
          t={t}
        />

        <ListingKindSelect
          id="kind"
          name="kind"
          label={t("realEstate.search.kindLabel")}
          defaultValue={filters.propertyKind ?? ""}
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
          defaultValue={filters.minPrice !== undefined ? String(filters.minPrice) : ""}
        />

        <TextField
          id="maxPrice"
          name="maxPrice"
          type="number"
          min={0}
          step={1000}
          inputMode="numeric"
          label={t("realEstate.search.maxPriceLabel")}
          defaultValue={filters.maxPrice !== undefined ? String(filters.maxPrice) : ""}
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
          id="sort"
          name="sort"
          label={t("realEstate.search.sortLabel")}
          defaultValue={filters.sort ?? "newest"}
          onChange={(event) => {
            // The sort applies on change. Reading the current form values rather
            // than only the new sort keeps the other filters intact.
            const form = event.currentTarget.form;
            if (!form) return;
            const data = new FormData(form);
            const next: ListingFilters = {
              query: stringValue(data.get("q")) || undefined,
              regionSlug: stringValue(data.get("region")) || undefined,
              listingType: undefined,
              propertyKind: undefined,
              minPrice: numberValue(data.get("minPrice")),
              maxPrice: numberValue(data.get("maxPrice")),
              minBedrooms: numberValue(data.get("minBedrooms")),
              sort: isSortValue(event.currentTarget.value)
                ? event.currentTarget.value
                : undefined,
            };
            const params = new URLSearchParams(
              buildListingQuery(next).replace(/^\?/, ""),
            );
            if (view === "map") params.set("view", "map");
            router.push(`${basePath}${params.toString() ? `?${params}` : ""}`);
          }}
        >
          <option value="newest">{t("realEstate.search.sortNewest")}</option>
          <option value="price-asc">{t("realEstate.search.sortPriceAsc")}</option>
          <option value="price-desc">
            {t("realEstate.search.sortPriceDesc")}
          </option>
        </SelectField>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="primary">
          {t("realEstate.search.searchSubmit")}
        </Button>
        {/* A link, not a reset button: "clear" is the absence of query
            parameters, and a link makes that a real URL with a working back
            button rather than a form-state side effect. */}
        <ButtonLink href={basePath} variant="secondary">
          {t("realEstate.search.clearFilters")}
        </ButtonLink>
      </div>
    </form>
  );
}

function stringValue(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

function numberValue(value: FormDataEntryValue | null): number | undefined {
  const raw = stringValue(value).trim();
  if (raw === "") return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isSortValue(value: string): value is "newest" | "price-asc" | "price-desc" {
  return value === "newest" || value === "price-asc" || value === "price-desc";
}

function ListingTypeSelect({
  t,
  ...props
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
  t: Translate;
}) {
  return (
    <SelectField {...props}>
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
  id: string;
  name: string;
  label: string;
  defaultValue: string;
  t: Translate;
}) {
  return (
    <SelectField {...props}>
      <option value="">{t("realEstate.search.kindAll")}</option>
      {LISTING_PROPERTY_KINDS.map((kind) => (
        <option key={kind} value={kind}>
          {t(`realEstate.kinds.${kind}`)}
        </option>
      ))}
    </SelectField>
  );
}
