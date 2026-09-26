import type { Metadata } from "next";
import { SITE } from "@/lib/config/site";
import { getSiteUrl } from "@/lib/config/env";
import { LOCALE_SEO_TAGS, type Locale } from "@/lib/i18n/locales";
import { alternatesFor, canonicalFor } from "./canonical";

export const DEFAULT_TITLE_TEMPLATE = `%s | ${SITE.legalName}`;
export const DEFAULT_DESCRIPTION =
  "KC Technology Corporation delivers digital marketing, electrical services and real estate across Cameroon.";

type BuildMetadataInput = {
  locale: Locale;
  /** Locale-relative path, e.g. "/" or "/digital-marketing". */
  pathWithoutLocale: string;
  title: string;
  description?: string;
  /** Set for pages that must stay out of the index (auth, admin, private). */
  noindex?: boolean;
  type?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
};

/**
 * Build page metadata from the shared SEO framework so titles, descriptions,
 * canonicals and `hreflang` alternates stay consistent across every route.
 */
export function buildMetadata({
  locale,
  pathWithoutLocale,
  title,
  description = DEFAULT_DESCRIPTION,
  noindex = false,
  type = "website",
  publishedTime,
  modifiedTime,
}: BuildMetadataInput): Metadata {
  const canonical = canonicalFor(locale, pathWithoutLocale);

  return {
    metadataBase: getSiteUrl(),
    title,
    description,
    alternates: {
      canonical,
      languages: noindex ? undefined : alternatesFor(pathWithoutLocale),
    },
    openGraph: {
      type,
      title,
      description,
      url: canonical,
      siteName: SITE.legalName,
      locale: LOCALE_SEO_TAGS[locale],
      ...(publishedTime ? { publishedTime } : {}),
      ...(modifiedTime ? { modifiedTime } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: noindex
      ? { index: false, follow: false, nocache: true }
      : { index: true, follow: true },
  };
}

/**
 * Metadata for internal areas. Always `noindex`, and deliberately without
 * locale alternates so private URLs are never advertised to crawlers.
 */
export function buildPrivateMetadata(title: string): Metadata {
  return {
    metadataBase: getSiteUrl(),
    title,
    robots: { index: false, follow: false, nocache: true },
  };
}
