import type { MetadataRoute } from "next";
import { INSIGHTS_PATH, NAV_PATHS, STORE_PATH } from "@/lib/config/navigation";
import { getSiteUrl } from "@/lib/config/env";
import { DEPARTMENTS } from "@/lib/config/site";
import {
  allCategories,
  departmentHasServices,
  serviceRecordsFor,
} from "@/lib/content/defaults";
import { loadInsights } from "@/lib/content/loaders";
import { LOCALES } from "@/lib/i18n/locales";
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
  const lastModified = new Date();

  const localizedPaths = [
    "/",
    ...DEPARTMENTS.map((department) => `/${department.slug}`),
    ...NAV_PATHS,
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
      lastModified,
      changeFrequency: "weekly" as const,
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
  const articleSlugs = (await loadInsights("en")).map(
    (article) => `${INSIGHTS_PATH}/${article.slug}`,
  );
  for (const locale of LOCALES) {
    for (const path of articleSlugs) {
      entries.push({
        url: canonicalFor(locale, path),
        lastModified,
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
        lastModified,
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
            : lastModified,
          changeFrequency: "weekly",
          priority: 0.7,
          alternates: { languages: alternatesFor(productPath) },
        });
      }
    }
  }

  // The language-neutral gateway is listed once, without locale alternates,
  // because it is the x-default target rather than a localized page.
  entries.push({
    url: new URL("/", siteUrl).toString(),
    lastModified,
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
  if (pathWithoutLocale === "/about" || pathWithoutLocale === "/contact") {
    return 0.6;
  }
  if (pathWithoutLocale.includes("/services/")) return 0.7;
  if (pathWithoutLocale.includes(INSIGHTS_PATH)) return 0.6;
  if (pathWithoutLocale.endsWith("/portfolio")) return 0.6;
  return 0.8;
}
