import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SectionBand } from "@/components/layout/PageShell";
import { PropertyMap } from "@/components/maps/PropertyMap";
import { ActiveFilterChips } from "@/components/real-estate/ActiveFilterChips";
import { ListingGrid, listingHref } from "@/components/real-estate/ListingCard";
import { ListingFilterPanel } from "@/components/real-estate/ListingFilterPanel";
import { ListingPagination } from "@/components/real-estate/ListingPagination";
import { SaveSearchControl } from "@/components/real-estate/SaveSearchControl";
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
  loadFavoriteListingIds,
  loadListingGeographyTree,
  queryListings,
} from "@/lib/real-estate/loaders";
import { qualifyListings } from "@/lib/real-estate/listings";
import {
  buildListingQuery,
  firstParam,
  hasActiveFilters,
  parseListingFilters,
} from "@/lib/real-estate/search";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo/structured-data";
import { departmentScopeProps } from "@/lib/theme/department-scope";

/**
 * Property listings browser.
 *
 * One route serves the list and the map, and the view is a query parameter rather
 * than a second URL. Two URLs for one result set is the duplicate-content problem
 * the locale routing already avoids.
 *
 * Filtering, counting and pagination happen in the database, in
 * `search_property_listings`. The page used to filter a fetched list in
 * TypeScript, which meant the result count described the fetched page rather than
 * the market, and pagination would have required loading the whole catalogue into
 * the browser. The RPC returns the page and its total from one query, so the
 * number shown and the rows returned cannot disagree.
 *
 * The search is localized inside the RPC: it matches the canonical English
 * columns and the French translations, so a French visitor searching "terrain"
 * finds a listing whose English title says "land". Doing that here would mean the
 * browser holding both languages for every listing.
 *
 * ## Indexability
 *
 * A filtered view is `noindex, follow`. An arbitrary combination of region, price
 * and bedrooms is a view of the catalogue, not a page with content of its own;
 * indexing every combination would flood the index with near-duplicates and dilute
 * the pages that do have content. The unfiltered browser is indexable, and so is a
 * geographic landing page once an editor has published content for it — that is
 * what `geo_landing_content` is for.
 */

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = createTranslator(locale).t;
  const query = await searchParams;
  const filters = parseListingFilters(query);

  return buildMetadata({
    locale,
    pathWithoutLocale: PROPERTY_SEARCH_PATH,
    title: t("realEstate.search.metaTitle"),
    description: t("realEstate.search.metaDescription"),
    // See the indexability note above: a filtered view is a view, not a page.
    noindex: hasActiveFilters(filters),
  });
}

export default async function PropertyListingsPage({
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

  const view = firstParam(query.view) === "map" ? "map" : "list";
  const filters = parseListingFilters(query);

  const [page, geography, favoriteIds] = await Promise.all([
    queryListings({
      query: filters.query,
      regionSlug: filters.regionSlug,
      divisionSlug: filters.divisionSlug,
      subdivisionSlug: filters.subdivisionSlug,
      listingType: filters.listingType,
      propertyKind: filters.propertyKind,
      propertyType: filters.propertyType,
      statuses: filters.statuses,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      minBedrooms: filters.minBedrooms,
      minBathrooms: filters.minBathrooms,
      minSize: filters.minSize,
      maxSize: filters.maxSize,
      sort: filters.sort,
      page: filters.page,
      locale: resolved,
    }),
    loadListingGeographyTree(),
    loadFavoriteListingIds(),
  ]);

  const qualified = qualifyListings(page.items, resolved);
  const active = hasActiveFilters(filters);
  // A total of zero with no filters means the portfolio is genuinely empty, which
  // is a different message from "your filters matched nothing".
  const hasPortfolio = page.total > 0 || active;

  // Only listings with a published, coarsened position can be drawn. Exact
  // coordinates never reach this component: the loader reads the API view, which
  // exposes the already-snapped point.
  const points: MapPoint[] = qualified.flatMap((entry) => {
    const location = entry.record.publicLocation;
    if (!location) return [];
    return [
      {
        id: entry.record.id,
        label: entry.record.reference,
        longitude: location.longitude,
        latitude: location.latitude,
        precisionMetres: location.precisionMetres,
      },
    ];
  });

  const hrefById = Object.fromEntries(
    qualified.map((entry) => [entry.record.id, listingHref(entry.record, resolved)]),
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
    items: qualified.map((entry) => ({
      name: entry.record.title,
      path: entry.href,
    })),
  });

  const mapStyle = mapStyleFor(activeMapProvider());
  const currentQuery = buildListingQuery(filters);

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
        <ListingFilterPanel
          locale={resolved}
          geography={geography}
          filters={filters}
          view={view}
        />
      </SectionBand>

      <SectionBand labelledBy="property-results-heading">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="property-results-heading" className="visually-hidden">
            {t("realEstate.search.heading")}
          </h2>
          {page.total > 0 ? (
            <div className="flex flex-wrap items-center gap-4">
              <ViewToggle locale={resolved} t={t} filters={filters} view={view} />
              <SaveSearchControl
                locale={resolved}
                queryString={currentQuery}
                filters={filters}
              />
            </div>
          ) : null}
        </div>

        {active ? (
          <div className="mt-6">
            <ActiveFilterChips
              locale={resolved}
              t={t}
              filters={filters}
              view={view}
            />
          </div>
        ) : null}

        {!hasPortfolio ? (
          <div className="mt-10 max-w-2xl">
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
        ) : page.items.length === 0 ? (
          <div className="mt-10 max-w-2xl">
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
            <p className="mt-6 mb-6 text-sm text-muted" aria-live="polite">
              {page.total === 1
                ? t("realEstate.search.resultsCountOne")
                : t("realEstate.search.resultsCount", { count: page.total })}
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
                    remains reachable by keyboard and to a reader without WebGL.
                    The map and the list are two views of the SAME page of results,
                    so the counts cannot diverge. */}
                <div className="mt-10">
                  <ListingGrid
                    listings={qualified.map((entry) => entry.record)}
                    locale={resolved}
                    t={t}
                    favoriteIds={favoriteIds}
                  />
                </div>
              </div>
            ) : (
              <>
                {view === "map" ? (
                  <p className="mb-6 text-sm text-muted" role="status">
                    {t("realEstate.search.mapUnavailable")}
                  </p>
                ) : null}
                <ListingGrid
                  listings={qualified.map((entry) => entry.record)}
                  locale={resolved}
                  t={t}
                  favoriteIds={favoriteIds}
                />
              </>
            )}

            <ListingPagination
              locale={resolved}
              t={t}
              filters={filters}
              page={page.page}
              pageCount={page.pageCount}
              view={view}
            />
          </>
        )}
      </SectionBand>
    </>
  );
}
