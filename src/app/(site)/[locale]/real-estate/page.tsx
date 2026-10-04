import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SectionBand } from "@/components/layout/PageShell";
import { PropertyMap } from "@/components/maps/PropertyMap";
import { ListingGrid, listingHref } from "@/components/real-estate/ListingCard";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { ButtonLink } from "@/components/ui/Button";
import { ContactPrompt, CtaBand } from "@/components/ui/Cta";
import { HeroMedia } from "@/components/ui/HeroMedia";
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
import { qualifyListings } from "@/lib/real-estate/listings";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo/structured-data";
import { themeColorFor } from "@/lib/theme/department-theme";
import { departmentScopeProps } from "@/lib/theme/department-scope";

/**
 * Real Estate department landing page.
 *
 * A real folder, not the shared `[department]` route. Real Estate is a platform
 * rather than a service catalogue: it has listings with prices and photographs, a
 * nationwide region index, and a map. Rendering it through the shared department
 * template would have meant inventing process steps and an FAQ to fill a shape
 * that does not fit it, and the brief is explicit that an unsupplied business
 * fact must not be fabricated.
 *
 * Next.js resolves a static segment ahead of a dynamic sibling, so this file
 * takes `/real-estate` and `[department]` continues to serve the other two.
 *
 * The listings shown are the featured and most recent published ones. Nothing is
 * shown until a real listing is published: an empty portfolio says so, rather than
 * displaying seed properties as though they were for sale.
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
    title: t("realEstate.metaTitle"),
    description: t("realEstate.metaDescription"),
  });
}

/**
 * Real Estate's mobile browser chrome, taken from its theme's dark band so the
 * chrome matches the page rather than the corporate ink.
 */
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

  const [listings, regions] = await Promise.all([
    loadPublishedListings({ limit: 48 }),
    loadListingRegionOptions(),
  ]);

  const qualified = qualifyListings(listings, resolved);
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
    name: t("realEstate.heading"),
    path: `/${resolved}${REAL_ESTATE_PATH}`,
    items: shown.map((entry) => ({
      name: entry.record.title,
      path: listingHref(entry.record, resolved),
    })),
  });

  return (
    <div {...departmentScopeProps("real-estate")}>
      <JsonLdScript
        data={breadcrumbJsonLd([
          { name: t("nav.home"), path: `/${resolved}` },
          { name: t("realEstate.eyebrow"), path: `/${resolved}${REAL_ESTATE_PATH}` },
        ])}
      />
      {listJsonLd ? <JsonLdScript data={listJsonLd} /> : null}

      <section className="on-ink relative overflow-hidden bg-ink-950">
        <HeroMedia src="/hero/real-estate-v2.jpg" />
        <div aria-hidden="true" className="absolute inset-0 bg-grid" />
        <div aria-hidden="true" className="absolute inset-0 bg-glow" />
        <div aria-hidden="true" className="absolute inset-0 dept-glow" />
        <div className="relative container-page py-16 sm:py-20">
          <Breadcrumbs
            items={breadcrumbs}
            ariaLabel={t("a11y.breadcrumb")}
            tone="light"
            className="mb-8"
          />
          <div className="max-w-3xl">
            <p className="mono-label text-dept-accent">
              {t("realEstate.eyebrow")}
            </p>
            <h1 className="display-tight mt-4 font-display text-4xl font-bold text-electric-300 sm:text-5xl">
              {t("realEstate.heading")}
            </h1>
            <span aria-hidden="true" className="heading-rule" />
            <p className="mt-5 text-base leading-relaxed text-ink-200 sm:text-lg">
              {t("realEstate.intro")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink
                href={`/${resolved}${PROPERTY_SEARCH_PATH}`}
                variant="accentOnInk"
                size="lg"
              >
                {t("realEstate.heroPrimaryCta")}
              </ButtonLink>
              <Link
                href={`/${resolved}/contact?department=real-estate`}
                className="inline-flex items-center rounded-pill border border-white/20 px-5 py-3 text-sm font-semibold text-white transition-soft hover:border-white/40"
              >
                {t("realEstate.heroSecondaryCta")}
              </Link>
            </div>
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
              {t("realEstate.search.emptyHeading")}
            </h2>
            <span aria-hidden="true" className="heading-rule" />
            <p className="mt-3 text-base text-body">
              {t("realEstate.search.emptyBody")}
            </p>
            <div className="mt-8">
              <ContactPrompt
                locale={resolved}
                t={t}
                heading={t("contact.heading")}
                body={t("contact.intro")}
              />
            </div>
          </div>
        </SectionBand>
      ) : (
        <>
          {regions.length > 0 ? (
            <SectionBand tone="alt" labelledBy="real-estate-regions-heading">
              <p className="mono-label text-dept-accent">
                01 — {t("realEstate.regionsHeading")}
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
            labelledBy="real-estate-showcase-heading"
            tone={regions.length > 0 ? undefined : "alt"}
          >
            <p className="mono-label text-dept-accent">
              {regions.length > 0 ? "02 — " : "01 — "}
              {featured.length > 0
                ? t("realEstate.featuredHeading")
                : t("realEstate.latestHeading")}
            </p>
            <h2
              id="real-estate-showcase-heading"
              className="display-tight mt-3 font-display text-3xl font-bold text-ink-900"
            >
              {featured.length > 0
                ? t("realEstate.featuredHeading")
                : t("realEstate.latestHeading")}
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
                {t("realEstate.browseHeading")}
              </ButtonLink>
            </p>
          </SectionBand>

          {points.length > 0 && !mapStyle.unavailable ? (
            <SectionBand labelledBy="real-estate-map-heading">
              <p className="mono-label text-dept-accent">
                {regions.length > 0 ? "03" : "02"} —{" "}
                {t("realEstate.search.viewMap")}
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
              heading={t("realEstate.heroSecondaryCta")}
              body={t("realEstate.search.intro")}
              accent
            />
          </div>
        </>
      )}
    </div>
  );
}
