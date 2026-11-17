import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SectionBand } from "@/components/layout/PageShell";
import { PropertyMap } from "@/components/maps/PropertyMap";
import { ListingGrid, listingHref } from "@/components/real-estate/ListingCard";
import { MarketplaceSearch } from "@/components/real-estate/MarketplaceSearch";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { ButtonLink } from "@/components/ui/Button";
import { ContactPrompt, CtaBand } from "@/components/ui/Cta";
import { HeroMedia } from "@/components/ui/HeroMedia";
import { PROPERTY_SEARCH_PATH, REAL_ESTATE_PATH } from "@/lib/config/navigation";
import { DEPARTMENT_EMAILS } from "@/lib/config/site";
import { isLocale, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import {
  activeMapProvider,
  mapStyleFor,
  viewForPoints,
  type MapPoint,
} from "@/lib/maps/adapter";
import {
  loadListingFacets,
  loadListingGeographyTree,
  loadListingRegionOptions,
  loadPublishedListings,
  loadTrendingListings,
} from "@/lib/real-estate/loaders";
import { qualifyListings } from "@/lib/real-estate/listings";
import { PROPERTY_CATEGORIES } from "@/lib/real-estate/search";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo/structured-data";
import { themeColorFor } from "@/lib/theme/department-theme";
import { departmentScopeProps } from "@/lib/theme/department-scope";

/**
 * Real Estate department landing page — the marketplace front door.
 *
 * A prominent search area (location + keyword + search, with category
 * shortcuts), then real inventory: categories with real counts, a trending strip
 * derived from the recorded view counts, featured and recent listings, and the
 * nationwide region index. Every number and every card comes from a published
 * database row. Nothing is invented to fill the page — an empty portfolio says so.
 *
 * A real folder, not the shared `[department]` route. Real Estate is a platform
 * rather than a service catalogue, and rendering it through the shared department
 * template would mean inventing process steps and an FAQ to fill a shape that does
 * not fit it.
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
    pathWithoutLocale: REAL_ESTATE_PATH,
    title: t("realEstate.marketplace.metaTitle"),
    description: t("realEstate.marketplace.metaDescription"),
  });
}

/** Real Estate's mobile browser chrome, taken from its theme's dark band. */
export function generateViewport(): Viewport {
  return { themeColor: themeColorFor("real-estate") };
}

export default async function RealEstatePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const resolved: Locale = locale;
  const t = createTranslator(resolved).t;

  const [listings, trending, regions, geography, facets] = await Promise.all([
    loadPublishedListings({ limit: 48 }),
    loadTrendingListings({ limit: 4 }),
    loadListingRegionOptions(resolved),
    loadListingGeographyTree(resolved),
    loadListingFacets(),
  ]);

  const qualified = qualifyListings(listings, resolved);
  const trendingQualified = qualifyListings(trending, resolved);
  const featured = qualified.filter((entry) => entry.isFeatured).slice(0, 3);
  const latest = qualified.slice(0, 6);
  const shown = featured.length > 0 ? featured : latest;

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

  const mapStyle = mapStyleFor(activeMapProvider());

  const breadcrumbs: BreadcrumbItem[] = [
    { name: t("nav.home"), href: `/${resolved}` },
    { name: t("realEstate.eyebrow"), href: `/${resolved}${REAL_ESTATE_PATH}` },
  ];

  const listJsonLd = itemListJsonLd({
    name: t("realEstate.marketplace.heading"),
    path: `/${resolved}${REAL_ESTATE_PATH}`,
    items: shown.map((entry) => ({
      name: entry.record.title,
      path: listingHref(entry.record, resolved),
    })),
  });

  // The sections are numbered from 01 in order; a section that renders nothing is
  // not counted, so the eyebrow sequence never skips or repeats a number.
  let sectionNumber = 0;
  const nextNumber = () => String(++sectionNumber).padStart(2, "0");

  return (
    <div {...departmentScopeProps("real-estate")}>
      <JsonLdScript
        data={breadcrumbJsonLd([
          { name: t("nav.home"), path: `/${resolved}` },
          {
            name: t("realEstate.eyebrow"),
            path: `/${resolved}${REAL_ESTATE_PATH}`,
          },
        ])}
      />
      {listJsonLd ? <JsonLdScript data={listJsonLd} /> : null}

      <section className="on-ink relative overflow-hidden bg-ink-950">
        <HeroMedia src="/hero/real-estate-v2.jpg" />
        <div aria-hidden="true" className="absolute inset-0 bg-grid" />
        <div aria-hidden="true" className="absolute inset-0 bg-glow" />
        <div aria-hidden="true" className="absolute inset-0 dept-glow" />
        <div className="relative container-page py-14 sm:py-16">
          <Breadcrumbs
            items={breadcrumbs}
            ariaLabel={t("a11y.breadcrumb")}
            tone="light"
            className="mb-6"
          />
          <div className="max-w-3xl">
            <p className="mono-label text-dept-accent">
              {t("realEstate.eyebrow")}
            </p>
            <h1 className="display-tight mt-4 font-display text-3xl font-bold text-electric-300 sm:text-5xl">
              {t("realEstate.marketplace.heading")}
            </h1>
            <span aria-hidden="true" className="heading-rule" />
            <p className="mt-5 text-base leading-relaxed text-ink-200 sm:text-lg">
              {t("realEstate.marketplace.intro")}
            </p>
          </div>

          <div className="mt-8 max-w-4xl">
            <MarketplaceSearch
              locale={resolved}
              geography={geography}
              categories={facets.categories}
            />
          </div>
        </div>
      </section>

      {listings.length === 0 ? (
        <SectionBand labelledBy="real-estate-empty-heading">
          <div className="max-w-2xl">
            <h2
              id="real-estate-empty-heading"
              className="text-xl font-semibold text-ink-900"
            >
              {t("realEstate.marketplace.emptyHeading")}
            </h2>
            <span aria-hidden="true" className="heading-rule" />
            <p className="mt-3 text-base text-body">
              {t("realEstate.marketplace.emptyBody")}
            </p>
            <div className="mt-8">
              <ContactPrompt
                locale={resolved}
                t={t}
                heading={t("contact.heading")}
                body={t("contact.intro")}
                departmentEmail={DEPARTMENT_EMAILS["real-estate"]}
              />
            </div>
          </div>
        </SectionBand>
      ) : (
        <>
          {/* Categories with real counts. The counts come from `listing_facets`,
              the same predicate the search uses, so a shortcut and its result set
              cannot disagree. */}
          <SectionBand labelledBy="real-estate-categories-heading">
            <p className="mono-label text-dept-accent">
              {nextNumber()} — {t("realEstate.marketplace.categoriesHeading")}
            </p>
            <h2
              id="real-estate-categories-heading"
              className="display-tight mt-3 font-display text-3xl font-bold text-ink-900"
            >
              {t("realEstate.marketplace.categoriesHeading")}
            </h2>
            <span aria-hidden="true" className="heading-rule" />
            <p className="mt-4 max-w-2xl text-base text-body">
              {t("realEstate.marketplace.categoriesIntro")}
            </p>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {PROPERTY_CATEGORIES.map((category) => {
                const count = facets.categories.get(category.bucket);
                const params = new URLSearchParams();
                if (category.filters.listingType) {
                  params.set("type", category.filters.listingType);
                }
                if (category.filters.propertyKind) {
                  params.set("kind", category.filters.propertyKind);
                }
                if (category.filters.propertyType) {
                  params.set("propertyType", category.filters.propertyType);
                }
                const query = params.toString();
                return (
                  <li key={category.bucket}>
                    <Link
                      href={`/${resolved}${PROPERTY_SEARCH_PATH}${query ? `?${query}` : ""}`}
                      className="flex items-center justify-between gap-4 rounded-card border border-border bg-surface px-5 py-4 transition-soft hover:border-dept-accent"
                    >
                      <span className="text-sm font-semibold text-ink-900">
                        {t(category.labelKey)}
                      </span>
                      <span className="text-xs text-muted">
                        {count !== undefined && count > 0
                          ? count
                          : t("realEstate.marketplace.noCount")}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </SectionBand>

          {/* Trending: derived from the recorded view counts, never invented. Only
              rendered when the data supports it. */}
          {trendingQualified.length > 0 ? (
            <SectionBand tone="alt" labelledBy="real-estate-trending-heading">
              <p className="mono-label text-dept-accent">
                {nextNumber()} — {t("realEstate.marketplace.trendingHeading")}
              </p>
              <h2
                id="real-estate-trending-heading"
                className="display-tight mt-3 font-display text-3xl font-bold text-ink-900"
              >
                {t("realEstate.marketplace.trendingHeading")}
              </h2>
              <span aria-hidden="true" className="heading-rule" />
              <p className="mt-4 max-w-2xl text-base text-body">
                {t("realEstate.marketplace.trendingIntro")}
              </p>
              <div className="mt-8">
                <ListingGrid
                  listings={trendingQualified.map((entry) => entry.record)}
                  locale={resolved}
                  t={t}
                  className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
                />
              </div>
            </SectionBand>
          ) : null}

          {regions.length > 0 ? (
            <SectionBand labelledBy="real-estate-regions-heading">
              <p className="mono-label text-dept-accent">
                {nextNumber()} — {t("realEstate.regionsHeading")}
              </p>
              <h2
                id="real-estate-regions-heading"
                className="display-tight mt-3 font-display text-3xl font-bold text-ink-900"
              >
                {t("realEstate.regionsHeading")}
              </h2>
              <span aria-hidden="true" className="heading-rule" />
              <p className="mt-4 max-w-2xl text-base text-body">
                {t("realEstate.regionsIntro")}
              </p>
              <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {regions.map((region) => (
                  <li key={region.slug}>
                    <Link
                      href={`/${resolved}${PROPERTY_SEARCH_PATH}?region=${encodeURIComponent(region.slug)}`}
                      className="flex items-center justify-between gap-4 rounded-card border border-border bg-surface px-5 py-4 transition-soft hover:border-dept-accent"
                    >
                      <span className="text-sm font-semibold text-ink-900">
                        {region.name}
                      </span>
                      <span className="text-xs text-muted">
                        {t("realEstate.regionCount", { count: region.count })}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </SectionBand>
          ) : null}

          <SectionBand
            tone={regions.length > 0 ? "alt" : undefined}
            labelledBy="real-estate-showcase-heading"
          >
            <p className="mono-label text-dept-accent">
              {nextNumber()} —{" "}
              {featured.length > 0
                ? t("realEstate.marketplace.featuredHeading")
                : t("realEstate.marketplace.recentHeading")}
            </p>
            <h2
              id="real-estate-showcase-heading"
              className="display-tight mt-3 font-display text-3xl font-bold text-ink-900"
            >
              {featured.length > 0
                ? t("realEstate.marketplace.featuredHeading")
                : t("realEstate.marketplace.recentHeading")}
            </h2>
            <span aria-hidden="true" className="heading-rule" />
            <div className="mt-8">
              <ListingGrid
                listings={shown.map((entry) => entry.record)}
                locale={resolved}
                t={t}
              />
            </div>
            <p className="mt-8">
              <ButtonLink
                href={`/${resolved}${PROPERTY_SEARCH_PATH}`}
                variant="secondary"
              >
                {t("realEstate.marketplace.viewAll")}
              </ButtonLink>
            </p>
          </SectionBand>

          {points.length > 0 && !mapStyle.unavailable ? (
            <SectionBand labelledBy="real-estate-map-heading">
              <p className="mono-label text-dept-accent">
                {nextNumber()} — {t("realEstate.search.viewMap")}
              </p>
              <h2
                id="real-estate-map-heading"
                className="display-tight mt-3 font-display text-3xl font-bold text-ink-900"
              >
                {t("realEstate.search.mapHeading")}
              </h2>
              <span aria-hidden="true" className="heading-rule" />
              <div className="mt-8">
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
              </div>
            </SectionBand>
          ) : null}

          <div className="container-page section">
            <CtaBand
              locale={resolved}
              t={t}
              heading={t("realEstate.marketplace.postCta")}
              body={t("realEstate.marketplace.postCtaIntro")}
              accent
            />
          </div>
        </>
      )}
    </div>
  );
}
