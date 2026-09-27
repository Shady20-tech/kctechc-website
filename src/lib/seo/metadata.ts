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
  /**
   * An absolute URL to a representative image, used for the social preview.
   *
   * Absolute rather than a storage path on purpose: this module is part of the
   * SEO framework and has no business knowing which bucket an image came from.
   * The caller that already built the public URL passes it in. Omitting it is
   * valid — a page with no photograph simply has no preview image, which is
   * better than pointing the crawler at a URL that does not resolve.
   */
  imageUrl?: string;
  imageAlt?: string;
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
  imageUrl,
  imageAlt,
}: BuildMetadataInput): Metadata {
  const canonical = canonicalFor(locale, pathWithoutLocale);

  // The root layout applies a `%s | <legal name>` template. Pages whose title is
  // already the brand name (the gateway and both localized home pages) would
  // otherwise render it twice, e.g. "KC Technology Corporation | KC Technology
  // Corporation". Using `absolute` for those bypasses the template.
  const titleValue = title.includes(SITE.legalName) ? { absolute: title } : title;

  const images = imageUrl ? [{ url: imageUrl, alt: imageAlt ?? title }] : undefined;

  return {
    metadataBase: getSiteUrl(),
    title: titleValue,
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
      ...(images ? { images } : {}),
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title,
      description,
      ...(images ? { images: images.map((image) => image.url) } : {}),
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
