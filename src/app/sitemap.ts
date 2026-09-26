import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/config/env";
import { DEPARTMENTS } from "@/lib/config/site";
import { LOCALES } from "@/lib/i18n/locales";
import { alternatesFor, canonicalFor } from "@/lib/seo/canonical";

/**
 * XML sitemap foundation.
 *
 * Only genuinely localized, indexable routes are listed. Private routes and
 * untranslated content are excluded rather than advertised.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const lastModified = new Date();

  const localizedPaths = [
    "/",
    ...DEPARTMENTS.map((department) => `/${department.slug}`),
    "/about",
    "/contact",
  ];

  const entries: MetadataRoute.Sitemap = LOCALES.flatMap((locale) =>
    localizedPaths.map((pathWithoutLocale) => ({
      url: canonicalFor(locale, pathWithoutLocale),
      lastModified,
      changeFrequency: "weekly" as const,
      priority:
        pathWithoutLocale === "/"
          ? 1
          : pathWithoutLocale === "/about" || pathWithoutLocale === "/contact"
            ? 0.6
            : 0.8,
      alternates: {
        languages: alternatesFor(pathWithoutLocale),
      },
    })),
  );

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
