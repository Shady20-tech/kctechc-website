import { SITE } from "@/lib/config/site";
import { getSiteUrl } from "@/lib/config/env";
import { LOCALE_SEO_TAGS, type Locale } from "@/lib/i18n/locales";

/**
 * JSON-LD builders. Structured data is generated on the server from the same
 * values the page renders, so markup and content can never disagree.
 *
 * Only supplied business facts are emitted. No ratings, awards, price ranges or
 * certifications are invented.
 */

export type JsonLd = Record<string, unknown>;

export function organizationJsonLd(locale: Locale): JsonLd {
  const siteUrl = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": new URL("/#organization", siteUrl).toString(),
    name: SITE.legalName,
    slogan: SITE.motto,
    url: siteUrl.toString(),
    email: SITE.email,
    telephone: SITE.phones[0],
    address: {
      "@type": "PostalAddress",
      streetAddress: SITE.address.street,
      addressLocality: SITE.address.city,
      addressRegion: SITE.address.region,
      addressCountry: SITE.address.countryCode,
    },
    inLanguage: LOCALE_SEO_TAGS[locale],
  };
}

export function websiteJsonLd(locale: Locale): JsonLd {
  const siteUrl = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": new URL("/#website", siteUrl).toString(),
    name: SITE.legalName,
    url: siteUrl.toString(),
    inLanguage: LOCALE_SEO_TAGS[locale],
    publisher: { "@id": new URL("/#organization", siteUrl).toString() },
  };
}

export function breadcrumbJsonLd(
  items: readonly { name: string; path: string }[],
): JsonLd {
  const siteUrl = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: new URL(item.path, siteUrl).toString(),
    })),
  };
}

/** Serialize for a `<script type="application/ld+json">` tag. */
export function serializeJsonLd(data: JsonLd): string {
  // `<` is escaped so a value can never terminate the script element early.
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
