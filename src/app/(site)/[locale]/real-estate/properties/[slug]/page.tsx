import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SectionBand } from "@/components/layout/PageShell";
import { PropertyMap } from "@/components/maps/PropertyMap";
import {
  FactRow,
  ListingGrid,
  formatArea,
} from "@/components/real-estate/ListingCard";
import { ListingGallery } from "@/components/real-estate/ListingGallery";
import { ListingInquiryForm } from "@/components/real-estate/ListingInquiryForm";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { ButtonLink } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import {
  PROPERTY_SEARCH_PATH,
  REAL_ESTATE_PATH,
} from "@/lib/config/navigation";
import { isLocale, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import {
  activeMapProvider,
  mapStyleFor,
  viewForPoints,
} from "@/lib/maps/adapter";
import {
  loadListingBySlug,
  loadPublishedListings,
} from "@/lib/real-estate/loaders";
import { qualifyListing, qualifyListings } from "@/lib/real-estate/listings";
import {
  formatListingPrice,
  listingPrimaryImage,
} from "@/lib/real-estate/records";
import { propertyMediaPublicUrl } from "@/lib/real-estate/storage";
import { selectRelatedListings } from "@/lib/real-estate/search";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  breadcrumbJsonLd,
  realEstateListingJsonLd,
} from "@/lib/seo/structured-data";
import { departmentScopeProps } from "@/lib/theme/department-scope";

/**
 * A property listing.
 *
 * The page renders only what the database actually holds. A listing with no
 * published position shows the reason rather than an empty map frame, and a
 * listing whose price is on request says so rather than showing a figure nobody
 * quoted.
 *
 * The enquiry form is bound to this listing's id and writes through a Server
 * Action; the exact address and owner contact are never read by this route, so
 * there is nothing on the page to leak them.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};

  const listing = await loadListingBySlug(slug);
  if (!listing) return {};

  const { record } = qualifyListing(listing, locale);
  const primary = listingPrimaryImage(record);
  const imageUrl = primary
    ? propertyMediaPublicUrl(primary.storagePath)
    : null;

  return buildMetadata({
    locale,
    pathWithoutLocale: `${PROPERTY_SEARCH_PATH}/${slug}`,
    title: record.seo?.title ?? record.title,
    description: record.seo?.description ?? record.description.slice(0, 300),
    noindex: record.seo?.noindex,
    ...(imageUrl
      ? { imageUrl, imageAlt: primary?.alt ?? record.title }
      : {}),
  });
}

export default async function PropertyListingPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const resolved: Locale = locale;
  const t = createTranslator(resolved).t;

  const listing = await loadListingBySlug(slug);
  if (!listing) notFound();

  const qualified = qualifyListing(listing, resolved);
  const record = qualified.record;

  const [allListings] = await Promise.all([loadPublishedListings({ limit: 48 })]);
  const related = qualifyListings(
    selectRelatedListings(allListings, record, 3),
    resolved,
  );

  const price = formatListingPrice(record, resolved);
  const location = record.publicLocation;
  const mapStyle = mapStyleFor(activeMapProvider());

  const breadcrumbs: BreadcrumbItem[] = [
    { name: t("nav.home"), href: `/${resolved}` },
    { name: t("realEstate.eyebrow"), href: `/${resolved}${REAL_ESTATE_PATH}` },
    {
      name: t("realEstate.search.heading"),
      href: `/${resolved}${PROPERTY_SEARCH_PATH}`,
    },
    {
      name: record.title,
      href: `/${resolved}${PROPERTY_SEARCH_PATH}/${qualified.slug}`,
    },
  ];

  const listingJsonLd = realEstateListingJsonLd({
    name: record.title,
    description: record.description.slice(0, 300),
    path: `/${resolved}${PROPERTY_SEARCH_PATH}/${qualified.slug}`,
    locale: resolved,
    reference: record.reference,
    propertyKind: record.propertyKind,
    imagePaths: record.images.map((image) => image.storagePath),
    ...(record.priceMinor !== null && !record.priceOnRequest
      ? { priceMinor: record.priceMinor, currency: record.currency }
      : {}),
    ...(record.bedrooms !== undefined ? { bedrooms: record.bedrooms } : {}),
    ...(record.bathrooms !== undefined ? { bathrooms: record.bathrooms } : {}),
    ...(record.buildingAreaSqm !== undefined
      ? { floorSizeSqm: record.buildingAreaSqm }
      : record.landAreaSqm !== undefined
        ? { floorSizeSqm: record.landAreaSqm }
        : {}),
    ...(record.yearBuilt !== undefined ? { yearBuilt: record.yearBuilt } : {}),
    ...(record.locality ? { locality: record.locality } : {}),
    regionName: record.regionName,
    ...(record.publishedAt ? { datePublished: record.publishedAt } : {}),
  });

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
            name: t("realEstate.search.heading"),
            path: `/${resolved}${PROPERTY_SEARCH_PATH}`,
          },
          {
            name: record.title,
            path: `/${resolved}${PROPERTY_SEARCH_PATH}/${qualified.slug}`,
          },
        ])}
      />
      <JsonLdScript data={listingJsonLd} />

      <SectionBand labelledBy="listing-heading">
        <Breadcrumbs
          items={breadcrumbs}
          ariaLabel={t("a11y.breadcrumb")}
          className="mb-8"
        />

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
          <div className="min-w-0">
            <ListingGallery
              images={record.images}
              ariaLabel={t("realEstate.listing.galleryAriaLabel")}
              fallbackAlt={record.title}
              emptyLabel={t("realEstate.listing.galleryHeading")}
            />
          </div>

          <div className="min-w-0">
            <p className="mono-label text-dept-accent">
              {record.regionName}
              {record.locality ? ` · ${record.locality}` : ""}
            </p>
            <h1
              id="listing-heading"
              className="display-tight mt-3 font-display text-3xl font-bold text-ink-900"
            >
              {record.title}
            </h1>
            <p className="mt-4 font-display text-2xl font-semibold text-ink-900">
              {price}
            </p>
            <p className="mt-1 text-sm text-muted">
              {t("realEstate.listing.referenceLabel")}: {record.reference}
            </p>

            {record.hasFallback ? (
              <div className="mt-6">
                <Notice tone="info" title={t("realEstate.eyebrow")}>
                  {t("realEstate.translationNotice")}
                </Notice>
              </div>
            ) : null}

            <dl className="mt-8 divide-y divide-border border-y border-border">
              <FactRow
                label={t("realEstate.listing.typeLabel")}
                value={t(`realEstate.types.${record.listingType}`)}
              />
              <FactRow
                label={t("realEstate.listing.kindLabel")}
                value={t(`realEstate.kinds.${record.propertyKind}`)}
              />
              <FactRow
                label={t("realEstate.listing.statusLabel")}
                value={t(`realEstate.statuses.${record.status}`)}
              />
              {record.bedrooms !== undefined ? (
                <FactRow
                  label={t("realEstate.listing.bedroomsLabel")}
                  value={String(record.bedrooms)}
                />
              ) : null}
              {record.bathrooms !== undefined ? (
                <FactRow
                  label={t("realEstate.listing.bathroomsLabel")}
                  value={String(record.bathrooms)}
                />
              ) : null}
              {record.buildingAreaSqm !== undefined ? (
                <FactRow
                  label={t("realEstate.listing.buildingAreaLabel")}
                  value={formatArea(record.buildingAreaSqm, t) ?? ""}
                />
              ) : null}
              {record.landAreaSqm !== undefined ? (
                <FactRow
                  label={t("realEstate.listing.landAreaLabel")}
                  value={formatArea(record.landAreaSqm, t) ?? ""}
                />
              ) : null}
              {record.yearBuilt !== undefined ? (
                <FactRow
                  label={t("realEstate.listing.yearBuiltLabel")}
                  value={String(record.yearBuilt)}
                />
              ) : null}
            </dl>

            <div className="mt-8">
              <a
                href="#listing-inquiry-heading"
                className="inline-flex items-center rounded-pill bg-dept-accent px-5 py-3 text-sm font-semibold text-white transition-soft hover:opacity-90"
              >
                {t("realEstate.listing.inquiryCta")}
              </a>
            </div>
          </div>
        </div>
      </SectionBand>

      <SectionBand tone="alt" labelledBy="listing-description-heading">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
          <div className="min-w-0">
            <h2
              id="listing-description-heading"
              className="font-display text-2xl font-bold text-ink-900"
            >
              {t("realEstate.listing.overviewHeading")}
            </h2>
            <div className="mt-4 space-y-4 text-base leading-relaxed text-body">
              {record.description
                .split(/\n\s*\n/)
                .filter((paragraph) => paragraph.trim().length > 0)
                .map((paragraph, index) => (
                  <p key={index}>{paragraph.trim()}</p>
                ))}
            </div>

            {record.highlights.length > 0 ? (
              <div className="mt-10">
                <h3 className="font-display text-xl font-semibold text-ink-900">
                  {t("realEstate.listing.highlightsHeading")}
                </h3>
                <ul className="mt-4 list-inside list-disc space-y-2 text-body">
                  {record.highlights.map((highlight) => (
                    <li key={highlight}>{highlight}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {record.amenities.length > 0 ? (
              <div className="mt-10">
                <h3 className="font-display text-xl font-semibold text-ink-900">
                  {t("realEstate.listing.amenitiesHeading")}
                </h3>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {record.amenities.map((amenity) => (
                    <li
                      key={amenity}
                      className="rounded-pill border border-border px-3 py-1 text-sm text-body"
                    >
                      {amenity}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="min-w-0">
            <h2 className="font-display text-2xl font-bold text-ink-900">
              {t("realEstate.listing.locationHeading")}
            </h2>
            {location && !mapStyle.unavailable ? (
              <>
                <div className="mt-4">
                  <PropertyMap
                    points={[
                      {
                        id: record.id,
                        label: record.reference,
                        longitude: location.longitude,
                        latitude: location.latitude,
                        precisionMetres: location.precisionMetres,
                      },
                    ]}
                    styleUrl={mapStyle.styleUrl}
                    view={viewForPoints([
                      {
                        id: record.id,
                        label: record.reference,
                        longitude: location.longitude,
                        latitude: location.latitude,
                      },
                    ])}
                    hrefById={{
                      [record.id]: `/${resolved}${PROPERTY_SEARCH_PATH}/${qualified.slug}`,
                    }}
                    ariaLabel={t("realEstate.listing.mapAriaLabel")}
                    loadingLabel={t("realEstate.search.mapLoading")}
                    unavailableLabel={t("realEstate.search.mapUnavailable")}
                    openLabel={t("actions.learnMore")}
                  />
                </div>
                <p className="mt-3 text-sm text-muted">
                  {t("realEstate.listing.locationApproxNotice")}
                </p>
              </>
            ) : (
              <p className="mt-4 text-sm text-body">
                {t("realEstate.listing.locationUnavailable")}
              </p>
            )}

            <p className="mt-6 text-sm text-muted">
              {t("realEstate.listing.priceNote")}
            </p>
          </div>
        </div>
      </SectionBand>

      <SectionBand labelledBy="listing-inquiry-section-heading">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,32rem)]">
          <div className="min-w-0">
            <h2
              id="listing-inquiry-section-heading"
              className="font-display text-2xl font-bold text-ink-900"
            >
              {t("realEstate.listing.inquiryHeading")}
            </h2>
            <p className="mt-3 text-base text-body">
              {t("realEstate.listing.inquiryIntro")}
            </p>
            <p className="mt-6">
              <ButtonLink
                href={`/${resolved}${PROPERTY_SEARCH_PATH}`}
                variant="secondary"
              >
                {t("realEstate.listing.backToSearch")}
              </ButtonLink>
            </p>
          </div>

          <div className="min-w-0">
            <ListingInquiryForm
              listingId={record.id}
              locale={resolved}
              labels={{
                heading: t("realEstate.inquiry.heading"),
                intro: t("realEstate.listing.inquiryIntro"),
                nameLabel: t("realEstate.inquiry.nameLabel"),
                namePlaceholder: t("realEstate.inquiry.nameLabel"),
                emailLabel: t("realEstate.inquiry.emailLabel"),
                emailPlaceholder: t("realEstate.inquiry.emailLabel"),
                phoneLabel: t("realEstate.inquiry.phoneLabel"),
                phonePlaceholder: t("realEstate.inquiry.phoneLabel"),
                phoneHint: t("realEstate.inquiry.phoneLabel"),
                messageLabel: t("realEstate.inquiry.messageLabel"),
                messagePlaceholder: t("realEstate.inquiry.messageHint"),
                messageHint: t("realEstate.inquiry.messageHint"),
                viewingLabel: t("realEstate.listing.viewingCta"),
                viewingHint: t("realEstate.listing.inquiryIntro"),
                consentLabel: t("contact.consentLabel"),
                submit: t("realEstate.inquiry.submit"),
                submitting: t("realEstate.inquiry.sending"),
                successTitle: t("realEstate.inquiry.sentHeading"),
                successBody: t("realEstate.inquiry.sentBody"),
                referenceLabel: t("realEstate.listing.referenceLabel"),
                errorTitle: t("realEstate.inquiry.errorHeading"),
                errorBody: t("realEstate.inquiry.errors.invalid"),
                errorSummaryHeading: t("a11y.errorSummary"),
                rateLimitedTitle: t("realEstate.inquiry.errorHeading"),
                rateLimitedBody: t("realEstate.inquiry.errors.rate_limited"),
                unavailableTitle: t("realEstate.inquiry.errorHeading"),
                unavailableBody: t("realEstate.inquiry.errors.unconfigured"),
              }}
              validationMessages={{
                required: t("validation.required"),
                tooLong: t("validation.tooLong"),
                tooShort: t("validation.tooShort"),
                invalidPhone: t("validation.invalidPhone"),
                consentRequired: t("validation.consentRequired"),
              }}
            />
          </div>
        </div>
      </SectionBand>

      {related.length > 0 ? (
        <SectionBand tone="alt" labelledBy="listing-related-heading">
          <h2
            id="listing-related-heading"
            className="font-display text-2xl font-bold text-ink-900"
          >
            {t("realEstate.latestHeading")}
          </h2>
          <div className="mt-8">
            <ListingGrid
              listings={related.map((entry) => entry.record)}
              locale={resolved}
              t={t}
            />
          </div>
        </SectionBand>
      ) : null}
    </div>
  );
}
