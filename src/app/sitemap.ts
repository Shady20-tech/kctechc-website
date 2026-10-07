import type { MetadataRoute } from "next";
import {
  INSIGHTS_PATH,
  NAV_PATHS,
  LEGAL_PATHS,
  PROPERTY_SEARCH_PATH,
  SOLAR_PACKAGES_PATH,
  STORE_PATH,
} from "@/lib/config/navigation";
import { getSiteUrl } from "@/lib/config/env";
import { DEPARTMENTS, SITE_REVISION_DATE } from "@/lib/config/site";
import {
  allCategories,
  departmentHasServices,
  serviceRecordsFor,
} from "@/lib/content/defaults";
import { SOLAR_PACKAGES } from "@/lib/content/solar-packages";
import { loadInsights } from "@/lib/content/loaders";
import { LOCALES } from "@/lib/i18n/locales";
import { loadPublishedListings } from "@/lib/real-estate/loaders";
import { listingSlugForLocale } from "@/lib/real-estate/records";
import { alternatesFor, canonicalFor } from "@/lib/seo/canonical";
import { loadCategoryRecords, loadProductRecords } from "@/lib/store/loaders";
import { slugForLocale } from "@/lib/store/slug-resolution";

/**
 * XML sitemap foundation.
 *
 * Only genuinely localized, indexable routes are listed. Private routes and
 * untranslated content are excluded rather than advertised.
 *
 * The path list is derived from the shared nav model plus the department slugs,
 * so a new nav entry cannot be added to the header while being forgotten here —
 * the two would otherwise drift silently and leave a linked page unlisted.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();

  // `lastmod` must mean "when this page actually changed", not "when this request
  // ran". A value that moves on every fetch is one a crawler learns to distrust
  // and then ignores, which defeats the point of listing the URL at all. So the
  // static routes carry an explicit site revision date and the data-driven ones
  // carry their own row timestamp.
  const staticLastModified = new Date(SITE_REVISION_DATE);

  const localizedPaths = [
    "/",
    ...DEPARTMENTS.map((department) => `/${department.slug}`),
    ...NAV_PATHS,
    // Legal pages are footer-linked rather than in the primary bar, so they are
    // listed from their own constant.
    ...LEGAL_PATHS,
    // The solar package detail pages are data-driven from the bundled brochure
    // catalogue, so they are enumerated rather than a static path.
    ...SOLAR_PACKAGES.map(
      (pkg) => `${SOLAR_PACKAGES_PATH}/${pkg.id}`,
    ),
    // Only departments with published content expose these surfaces, so listing
    // them unconditionally would advertise 404s for the departments whose phases
    // have not landed yet.
    ...DEPARTMENTS.filter((department) =>
      departmentHasServices(department.slug),
    ).flatMap((department) => [
      `/${department.slug}/services`,
      `/${department.slug}/portfolio`,
      ...serviceRecordsFor(department.slug).map(
        (service) => `/${department.slug}/services/${service.slug}`,
      ),
    ]),
    ...allCategories().map(
      (category) => `${INSIGHTS_PATH}/category/${category.slug}`,
    ),
  ];

  const entries: MetadataRoute.Sitemap = LOCALES.flatMap((locale) =>
    localizedPaths.map((pathWithoutLocale) => ({
      url: canonicalFor(locale, pathWithoutLocale),
      lastModified: staticLastModified,
      changeFrequency: pathChangeFrequency(pathWithoutLocale),
      priority: pathPriority(pathWithoutLocale),
      alternates: {
        languages: alternatesFor(pathWithoutLocale),
      },
    })),
  );

  // Published articles are data-driven, so they are read at request time rather
  // than enumerated from a constant. `loadInsights` returns an empty list when
  // Supabase is unconfigured or unreachable, so a database outage contributes
  // nothing here instead of failing the whole sitemap.
  //
  // Each article carries its own timestamp. `lastModified` moving on every
  // request would tell a crawler nothing about which article actually changed,
  // which is precisely the signal this feed exists to send.
  const articles = await loadInsights("en");
  for (const locale of LOCALES) {
    for (const article of articles) {
      const path = `${INSIGHTS_PATH}/${article.slug}`;
      entries.push({
        url: canonicalFor(locale, path),
        lastModified: new Date(article.updatedAt ?? article.publishedAt),
        changeFrequency: "monthly",
        priority: 0.6,
        alternates: { languages: alternatesFor(path) },
      });
    }
  }

  // Store categories and products are data-driven. Each product is listed under
  // its own locale's slug, so the French sitemap advertises the French URL and
  // not the English one — listing both would ask a search engine to index two
  // addresses for one product.
  const storeRecords = await loadProductRecords();
  const storeCategories = await loadCategoryRecords();

  for (const locale of LOCALES) {
    for (const category of storeCategories) {
      const categorySlug = slugForLocale(category, locale);
      const path = `${STORE_PATH}/${categorySlug}`;
      entries.push({
        url: canonicalFor(locale, path),
        lastModified: category.updatedAt
          ? new Date(category.updatedAt)
          : staticLastModified,
        changeFrequency: "weekly",
        priority: 0.7,
        alternates: { languages: alternatesFor(path) },
      });

      for (const product of storeRecords) {
        if (product.categorySlug !== category.slug) continue;
        const productPath = `${STORE_PATH}/${categorySlug}/${slugForLocale(product, locale)}`;
        entries.push({
          url: canonicalFor(locale, productPath),
          lastModified: product.updatedAt
            ? new Date(product.updatedAt)
            : staticLastModified,
          changeFrequency: "weekly",
          priority: 0.7,
          alternates: { languages: alternatesFor(productPath) },
        });
      }
    }
  }

  // Property listings are data-driven, for the same reason the store records
  // are: the portfolio changes without a deploy. Each listing is advertised
  // under its own locale's slug so the French sitemap points at the French URL.
  const propertyRecords = await loadPublishedListings({ limit: 500 });
  for (const locale of LOCALES) {
    for (const record of propertyRecords) {
      const path = `${PROPERTY_SEARCH_PATH}/${listingSlugForLocale(record, locale)}`;
      entries.push({
        url: canonicalFor(locale, path),
        lastModified: record.updatedAt
          ? new Date(record.updatedAt)
          : staticLastModified,
        changeFrequency: "weekly",
        priority: 0.7,
        alternates: { languages: alternatesFor(path) },
      });
    }
  }

  // The language-neutral gateway is listed once, without locale alternates,
  // because it is the x-default target rather than a localized page.
  entries.push({
    url: new URL("/", siteUrl).toString(),
    lastModified: staticLastModified,
    changeFrequency: "monthly",
    priority: 1,
  });

  return entries;
}

/**
 * Page-level priority.
 *
 * Kept as a small explicit function so the intent is readable: the gateway is
 * the most important entry, department and service pages carry the commercial
 * weight, and supporting pages rank below them.
 */
function pathPriority(pathWithoutLocale: string): number {
  if (pathWithoutLocale === "/") return 1;
  if (isLegalPath(pathWithoutLocale)) return 0.3;
  if (pathWithoutLocale === "/about" || pathWithoutLocale === "/contact") {
    return 0.6;
  }
  if (pathWithoutLocale.includes("/services/")) return 0.7;
  if (pathWithoutLocale.startsWith(SOLAR_PACKAGES_PATH)) return 0.7;
  if (pathWithoutLocale.includes(INSIGHTS_PATH)) return 0.6;
  if (pathWithoutLocale.endsWith("/portfolio")) return 0.6;
  return 0.8;
}

/**
 * How often a route changes.
 *
 * Legal pages change on revision of the terms rather than on a publishing cycle,
 * so advertising them as weekly would be a claim the page itself does not
 * support. Everything else here is content that genuinely moves.
 */
function pathChangeFrequency(pathWithoutLocale: string): "weekly" | "yearly" {
  return isLegalPath(pathWithoutLocale) ? "yearly" : "weekly";
}

function isLegalPath(pathWithoutLocale: string): boolean {
  return (LEGAL_PATHS as readonly string[]).includes(pathWithoutLocale);
}
