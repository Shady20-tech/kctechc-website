import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SectionBand } from "@/components/layout/PageShell";
import { PropertyMap } from "@/components/maps/PropertyMap";
import { ListingGrid, listingHref } from "@/components/real-estate/ListingCard";
import { ListingFiltersForm } from "@/components/real-estate/ListingFiltersForm";
import { ViewToggle } from "@/components/real-estate/ViewToggle";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { ButtonLink } from "@/components/ui/Button";
import { PageIntro } from "@/components/ui/PageIntro";
import { PROPERTY_SEARCH_PATH, REAL_ESTATE_PATH } from "@/lib/config/navigation";
import { isLocale, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import {
  activeMapProvider,
  mapStyleFor,
  viewForPoints,
  type MapPoint,
} from "@/lib/maps/adapter";
import {
  loadListingRegionOptions,
  loadPublishedListings,
} from "@/lib/real-estate/loaders";
import {
  filterListings,
  hasActiveFilters,
  isListingSort,
  parseListingType,
  parseNumberParam,
  parsePropertyKind,
  type ListingFilters,
} from "@/lib/real-estate/search";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo/structured-data";
import { departmentScopeProps } from "@/lib/theme/department-scope";

/**
 * Property search.
 *
 * One route serves the list and the map, and the view is a query parameter rather
 * than a second URL. Two URLs for one result set is the duplicate-content problem
 * the locale routing already avoids.
 *
 * Filtering happens here over the already-localized listings, so the searchable
 * text is the translated text — the store's reason, applied to property. The
 * ranked full-text RPC is not used on this page: it matches the canonical English
 * columns, which is right for the admin search and wrong for a French visitor
 * searching "terrain".
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = createTranslator(locale).t;
  return buildMetadata({
    locale,
    pathWithoutLocale: PROPERTY_SEARCH_PATH,
    title: t("realEstate.search.metaTitle"),
    description: t("realEstate.search.metaDescription"),
  });
}

/** The first value of a possibly-repeated query parameter. */
function first(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function PropertySearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const resolved: Locale = locale;
  const t = createTranslator(resolved).t;
  const query = await searchParams;

  const view = first(query.view) === "map" ? "map" : "list";
  const sortParam = first(query.sort);
  const minPrice = parseNumberParam(first(query.minPrice));
  const maxPrice = parseNumberParam(first(query.maxPrice));
  const minBedrooms = parseNumberParam(first(query.minBedrooms));

  const sortCandidate = sortParam ?? undefined;
  const filters: ListingFilters = {
    query: first(query.q)?.trim() || undefined,
    regionSlug: first(query.region)?.trim() || undefined,
    listingType: parseListingType(first(query.type)),
    propertyKind: parsePropertyKind(first(query.kind)),
    minPrice,
    maxPrice,
    minBedrooms:
      minBedrooms !== undefined && minBedrooms > 0 ? minBedrooms : undefined,
    sort: isListingSort(sortCandidate) ? sortCandidate : undefined,
  };

  const [allListings, regions] = await Promise.all([
    loadPublishedListings({ limit: 48 }),
    loadListingRegionOptions(),
  ]);

  const listings = filterListings(allListings, filters);
  const active = hasActiveFilters(filters);

  // Only listings with a published, coarsened position can be drawn. Exact
  // coordinates never reach this component: the loader reads the API view, which
  // exposes the already-snapped point.
  const points: MapPoint[] = listings.flatMap((record) => {
    const location = record.publicLocation;
    if (!location) return [];
    return [
      {
        id: record.id,
        label: record.reference,
        longitude: location.longitude,
        latitude: location.latitude,
        precisionMetres: location.precisionMetres,
      },
    ];
  });

  const hrefById = Object.fromEntries(
    listings.map((record) => [record.id, listingHref(record, resolved)]),
  );

  const breadcrumbs: BreadcrumbItem[] = [
    { name: t("nav.home"), href: `/${resolved}` },
    { name: t("realEstate.eyebrow"), href: `/${resolved}${REAL_ESTATE_PATH}` },
    {
      name: t("realEstate.search.metaTitle"),
      href: `/${resolved}${PROPERTY_SEARCH_PATH}`,
    },
  ];

  const listJsonLd = itemListJsonLd({
    name: t("realEstate.search.heading"),
    path: `/${resolved}${PROPERTY_SEARCH_PATH}`,
    items: listings.map((record) => ({
      name: record.title,
      path: listingHref(record, resolved),
    })),
  });

  const mapStyle = mapStyleFor(activeMapProvider());

  return (
    <>
      <JsonLdScript
        data={breadcrumbJsonLd([
          { name: t("nav.home"), path: `/${resolved}` },
          {
            name: t("realEstate.eyebrow"),
            path: `/${resolved}${REAL_ESTATE_PATH}`,
          },
          {
            name: t("realEstate.search.metaTitle"),
            path: `/${resolved}${PROPERTY_SEARCH_PATH}`,
          },
        ])}
      />
      {listJsonLd ? <JsonLdScript data={listJsonLd} /> : null}

      <SectionBand
        labelledBy="property-search-heading"
        {...departmentScopeProps("real-estate")}
      >
        <Breadcrumbs
          items={breadcrumbs}
          ariaLabel={t("a11y.breadcrumb")}
          className="mb-8"
        />
        <PageIntro
          eyebrow={t("realEstate.eyebrow")}
          heading={t("realEstate.search.heading")}
          intro={t("realEstate.search.intro")}
        />
        <h2 id="property-search-heading" className="visually-hidden">
          {t("realEstate.search.heading")}
        </h2>
      </SectionBand>

      <SectionBand tone="alt" labelledBy="property-filters-heading">
        <h2 id="property-filters-heading" className="visually-hidden">
          {t("realEstate.search.filterLabel")}
        </h2>
        <ListingFiltersForm
          locale={resolved}
          regions={regions}
          filters={filters}
          view={view}
        />
      </SectionBand>

      <SectionBand labelledBy="property-results-heading">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="property-results-heading" className="visually-hidden">
            {t("realEstate.search.heading")}
          </h2>
          {allListings.length > 0 ? (
            <ViewToggle locale={resolved} t={t} filters={filters} view={view} />
          ) : null}
        </div>

        {allListings.length === 0 ? (
          <div className="max-w-2xl">
            <h3 className="text-xl font-semibold text-ink-900">
              {t("realEstate.search.emptyHeading")}
            </h3>
            <p className="mt-3 text-base text-body">
              {t("realEstate.search.emptyBody")}
            </p>
            <p className="mt-6">
              <ButtonLink
                href={`/${resolved}${REAL_ESTATE_PATH}`}
                variant="secondary"
              >
                {t("realEstate.backToDepartment")}
              </ButtonLink>
            </p>
          </div>
        ) : listings.length === 0 ? (
          <div className="max-w-2xl">
            <h3 className="text-xl font-semibold text-ink-900">
              {t("realEstate.search.noResultsHeading")}
            </h3>
            <p className="mt-3 text-base text-body">
              {t("realEstate.search.noResultsBody")}
            </p>
            <p className="mt-6">
              <ButtonLink
                href={`/${resolved}${PROPERTY_SEARCH_PATH}`}
                variant="secondary"
              >
                {t("realEstate.search.clearFilters")}
              </ButtonLink>
            </p>
          </div>
        ) : (
          <>
            <p className="mb-6 text-sm text-muted" aria-live="polite">
              {listings.length === 1
                ? t("realEstate.search.resultsCountOne")
                : t("realEstate.search.resultsCount", {
                    count: listings.length,
                  })}
              {active ? ` · ${t("realEstate.search.filterLabel")}` : ""}
            </p>

            {view === "map" && !mapStyle.unavailable ? (
              <div>
                <PropertyMap
                  points={points}
                  styleUrl={mapStyle.styleUrl}
                  view={viewForPoints(points)}
                  cluster
                  hrefById={hrefById}
                  ariaLabel={t("realEstate.search.mapAriaLabel")}
                  loadingLabel={t("realEstate.search.mapLoading")}
                  unavailableLabel={t("realEstate.search.mapUnavailable")}
                  openLabel={t("actions.learnMore")}
                />
                <p className="mt-3 text-sm text-muted">
                  {t("realEstate.search.mapApproxNotice")}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {t("realEstate.search.countOnMap", { count: points.length })}
                </p>
                {/* The list is always rendered under the map, so every property
                    remains reachable by keyboard and to a reader without WebGL. */}
                <div className="mt-10">
                  <ListingGrid listings={listings} locale={resolved} t={t} />
                </div>
              </div>
            ) : (
              <>
                {view === "map" ? (
                  <p className="mb-6 text-sm text-muted" role="status">
                    {t("realEstate.search.mapUnavailable")}
                  </p>
                ) : null}
                <ListingGrid listings={listings} locale={resolved} t={t} />
              </>
            )}
          </>
        )}
      </SectionBand>
    </>
  );
}
