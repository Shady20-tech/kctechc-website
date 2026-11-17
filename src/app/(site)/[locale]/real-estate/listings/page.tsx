import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SectionBand } from "@/components/layout/PageShell";
import { PropertyMap } from "@/components/maps/PropertyMap";
import { ActiveFilterChips } from "@/components/real-estate/ActiveFilterChips";
import { ListingGrid, listingHref } from "@/components/real-estate/ListingCard";
import { ListingPagination } from "@/components/real-estate/ListingPagination";
import { ListingSidebar } from "@/components/real-estate/ListingSidebar";
import { MarketplaceSearchLayout } from "@/components/marketplace/MarketplaceSearchLayout";
import { ResultsToolbar } from "@/components/real-estate/ResultsToolbar";
import { SaveSearchControl } from "@/components/real-estate/SaveSearchControl";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { ButtonLink } from "@/components/ui/Button";
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
  loadListingFacets,
  loadListingGeographyTree,
  queryListings,
} from "@/lib/real-estate/loaders";
import { qualifyListings } from "@/lib/real-estate/listings";
import {
  PROPERTY_CATEGORIES,
  activeFilterKeys,
  buildListingQuery,
  categoryForFilters,
  firstParam,
  hasActiveFilters,
  parseListingFilters,
} from "@/lib/real-estate/search";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo/structured-data";
import { departmentScopeProps } from "@/lib/theme/department-scope";

/**
 * Property listings browser — the marketplace results surface.
 *
 * A two-column layout on desktop: a compact filter sidebar (sections A–E of the
 * brief) and the results. Below `lg` the sidebar is replaced by a drawer so
 * nothing overflows horizontally.
 *
 * Filtering, counting and pagination happen in the database, in
 * `search_property_listings`. The page never loads the catalogue into React and
 * filters it — the RPC returns the page and its total from one query, so the
 * number shown and the rows returned cannot disagree, and the facet counts come
 * from `listing_facets` under the same visibility predicate.
 *
 * The search is localized inside the RPC: it matches the canonical English
 * columns and the French translations, so a French visitor searching "terrain"
 * finds a listing whose English title says "land".
 *
 * ## Indexability
 *
 * A filtered view is `noindex, follow`. An arbitrary combination of region, price
 * and bedrooms is a view of the catalogue, not a page with content of its own;
 * indexing every combination would flood the index with near-duplicates. The
 * unfiltered browser is indexable, and so is a geographic landing page once an
 * editor has published content for it.
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

  const [page, geography, facets, favoriteIds] = await Promise.all([
    queryListings({
      query: filters.query,
      regionSlug: filters.regionSlug,
      divisionSlug: filters.divisionSlug,
      subdivisionSlug: filters.subdivisionSlug,
      locality: filters.locality,
      listingType: filters.listingType,
      propertyKind: filters.propertyKind,
      propertyType: filters.propertyType,
      statuses: filters.statuses,
      currency: filters.currency,
      verifiedOnly: filters.verifiedOnly,
      amenities: filters.amenities,
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
    loadListingGeographyTree(resolved),
    loadListingFacets(),
    loadFavoriteListingIds(),
  ]);

  const qualified = qualifyListings(page.items, resolved);
  const active = hasActiveFilters(filters);
  // A total of zero with no filters means the portfolio is genuinely empty, which
  // is a different message from "your filters matched nothing".
  const hasPortfolio = page.total > 0 || active;

  // The current location and category, named for the toolbar. The names are read
  // from the geography tree the sidebar already loaded, so the toolbar and the
  // selector cannot disagree.
  const selectedRegion = geography.find(
    (region) => region.slug === filters.regionSlug,
  );
  const selectedDivision = selectedRegion?.divisions.find(
    (division) => division.slug === filters.divisionSlug,
  );
  const selectedSubdivision = selectedDivision?.subdivisions.find(
    (subdivision) => subdivision.slug === filters.subdivisionSlug,
  );
  const locationLabel =
    selectedSubdivision?.name ??
    selectedDivision?.name ??
    selectedRegion?.name ??
    filters.locality;
  const categoryBucket = categoryForFilters(filters);
  const category = PROPERTY_CATEGORIES.find(
    (entry) => entry.bucket === categoryBucket,
  );
  const categoryLabel =
    category && category.bucket !== "all" ? t(category.labelKey) : undefined;

  // The published names for the geography slugs in the URL, so a chip reads
  // "Southwest" rather than "Southwest-region" derived from the slug.
  const locationNames = new Map<string, string>();
  for (const region of geography) {
    locationNames.set(region.slug, region.name);
    for (const division of region.divisions) {
      locationNames.set(division.slug, division.name);
      for (const subdivision of division.subdivisions) {
        locationNames.set(subdivision.slug, subdivision.name);
      }
    }
  }

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
    qualified.map((entry) => [
      entry.record.id,
      listingHref(entry.record, resolved),
    ]),
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
    <div {...departmentScopeProps("real-estate")}>
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

      <MarketplaceSearchLayout
        sidebarAriaLabel={t("realEstate.search.filtersHeading")}
        drawerLabels={{
          open: t("realEstate.search.openFilters"),
          title: t("realEstate.search.filtersHeading"),
          close: t("realEstate.search.closeFilters"),
        }}
        activeCount={activeFilterKeys(filters).length}
        filters={(variant) => (
          <ListingSidebar
            locale={resolved}
            geography={geography}
            facets={facets}
            filters={filters}
            view={view}
            variant={variant}
          />
        )}
        header={
          <SectionBand labelledBy="property-search-heading">
            <Breadcrumbs
              items={breadcrumbs}
              ariaLabel={t("a11y.breadcrumb")}
              className="mb-6"
            />
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1
                  id="property-search-heading"
                  className="display-tight font-display text-3xl font-bold text-ink-900 sm:text-4xl"
                >
                  {t("realEstate.search.heading")}
                </h1>
                <p className="mt-2 max-w-2xl text-base text-body">
                  {t("realEstate.search.intro")}
                </p>
              </div>
              <ButtonLink
                href={`/${resolved}${REAL_ESTATE_PATH}`}
                variant="ghost"
                size="sm"
              >
                {t("realEstate.backToDepartment")}
              </ButtonLink>
            </div>
          </SectionBand>
        }
        toolbar={
          hasPortfolio ? (
            <ResultsToolbar
              locale={resolved}
              filters={filters}
              view={view}
              total={page.total}
              locationLabel={locationLabel}
              categoryLabel={categoryLabel}
            />
          ) : null
        }
        meta={
          <>
            {active ? (
              <div className="mt-4">
                <ActiveFilterChips
                  locale={resolved}
                  t={t}
                  filters={filters}
                  view={view}
                  locationNames={locationNames}
                />
              </div>
            ) : null}

            {page.total > 0 ? (
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <SaveSearchControl
                  locale={resolved}
                  queryString={currentQuery}
                  filters={filters}
                />
              </div>
            ) : null}
          </>
        }
        results={
          <>
            {!hasPortfolio ? (
              <div className="mt-10 max-w-2xl rounded-card border border-border bg-surface p-8">
                <h2 className="text-xl font-semibold text-ink-900">
                  {t("realEstate.search.emptyHeading")}
                </h2>
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
              <div className="mt-10 max-w-2xl rounded-card border border-border bg-surface p-8">
                <h2 className="text-xl font-semibold text-ink-900">
                  {t("realEstate.search.noResultsHeading")}
                </h2>
                <p className="mt-3 text-base text-body">
                  {filters.query
                    ? t("realEstate.search.noResultsForQuery", {
                        query: filters.query,
                      })
                    : t("realEstate.search.noResultsBody")}
                </p>
                <p className="mt-6">
                  <ButtonLink
                    href={`/${resolved}${PROPERTY_SEARCH_PATH}`}
                    variant="secondary"
                  >
                    {t("realEstate.search.clearAll")}
                  </ButtonLink>
                </p>
              </div>
            ) : (
              <>
                {view === "map" && !mapStyle.unavailable ? (
                  <div className="mt-6">
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
                      {t("realEstate.search.countOnMap", {
                        count: points.length,
                      })}
                    </p>
                  </div>
                ) : null}

                {view === "map" && mapStyle.unavailable ? (
                  <p className="mt-6 text-sm text-muted" role="status">
                    {t("realEstate.search.mapUnavailable")}
                  </p>
                ) : null}

                {/* The list is always rendered, under the map as well, so every
                    property remains reachable by keyboard and to a reader without
                    WebGL. Both are two views of the SAME page of results. */}
                <div className="mt-6">
                  {/* The results region needs its own heading so the card `h3`s
                      descend from something: without it the document jumps
                      h1 -> h3 and Lighthouse's heading-order check fails. */}
                  <h2 className="visually-hidden">
                    {t("realEstate.search.resultsHeading")}
                  </h2>
                  <ListingGrid
                    listings={qualified.map((entry) => entry.record)}
                    locale={resolved}
                    t={t}
                    favoriteIds={favoriteIds}
                    className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
                  />
                </div>

                <ListingPagination
                  locale={resolved}
                  t={t}
                  filters={filters}
                  page={page.page}
                  pageCount={page.pageCount}
                  view={view}
                />

                <p className="mt-6 text-sm text-muted">
                  {t("realEstate.search.showingRange", {
                    from: (page.page - 1) * page.pageSize + 1,
                    to: (page.page - 1) * page.pageSize + page.items.length,
                    total: page.total,
                  })}
                </p>
              </>
            )}

            <p className="mt-8 text-xs text-muted">
              {t("realEstate.search.trustBadgeNote")}
            </p>
          </>
        }
        footer={
          <SectionBand tone="alt" labelledBy="property-search-links-heading">
            <h2 id="property-search-links-heading" className="visually-hidden">
              {t("realEstate.regionsHeading")}
            </h2>
            <p className="text-sm text-body">
              <Link
                href={`/${resolved}${REAL_ESTATE_PATH}`}
                className="font-semibold text-dept-accent underline-offset-4 hover:underline"
              >
                {t("realEstate.backToDepartment")}
              </Link>
            </p>
          </SectionBand>
        }
      />
    </div>
  );
}
