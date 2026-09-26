import { SITE } from "@/lib/config/site";
import { getSiteUrl } from "@/lib/config/env";
import type { FaqItem } from "@/lib/content/types";
import { priceForFeed } from "@/lib/store/types";
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

/**
 * A service offered by the organization.
 *
 * `areaServed` is only emitted when a caller supplies it, and no price, rating,
 * review or availability is ever attached: none of those are supplied business
 * facts, and structured data is a factual claim made to search engines.
 */
export function serviceJsonLd(input: {
  name: string;
  description: string;
  path: string;
  locale: Locale;
  serviceType?: string;
  areaServed?: string;
}): JsonLd {
  const siteUrl = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: input.name,
    description: input.description,
    url: new URL(input.path, siteUrl).toString(),
    inLanguage: LOCALE_SEO_TAGS[input.locale],
    provider: { "@id": new URL("/#organization", siteUrl).toString() },
    ...(input.serviceType ? { serviceType: input.serviceType } : {}),
    ...(input.areaServed ? { areaServed: input.areaServed } : {}),
  };
}

/**
 * An article, for the insights section.
 *
 * `author` is required by the caller rather than defaulted to the organization.
 * The database already refuses to publish an article without an author, so this
 * mirrors a guarantee the data makes.
 */
export function articleJsonLd(input: {
  headline: string;
  description: string;
  path: string;
  locale: Locale;
  datePublished: string;
  dateModified?: string;
  authorName: string;
  imagePath?: string;
}): JsonLd {
  const siteUrl = getSiteUrl();
  const url = new URL(input.path, siteUrl).toString();
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.headline,
    description: input.description,
    url,
    mainEntityOfPage: url,
    inLanguage: LOCALE_SEO_TAGS[input.locale],
    datePublished: input.datePublished,
    ...(input.dateModified ? { dateModified: input.dateModified } : {}),
    author: { "@type": "Person", name: input.authorName },
    publisher: { "@id": new URL("/#organization", siteUrl).toString() },
    ...(input.imagePath
      ? { image: new URL(input.imagePath, siteUrl).toString() }
      : {}),
  };
}

/**
 * An FAQ page, built from question/answer pairs that are rendered on the page.
 *
 * Emitted only for a non-empty list. Marking up questions that are not visible to
 * the reader is a structured-data violation, so the caller passes exactly what
 * the page displays.
 */
export function faqJsonLd(items: readonly FaqItem[]): JsonLd | null {
  if (items.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

/**
 * A product, with its offer.
 *
 * Everything emitted here is a value the page also renders: the name, the
 * description, the SKU, the price, the currency and the availability all come
 * from the same resolved product record. Structured data that disagrees with the
 * visible page is a Merchant Center suspension risk and a false claim to a search
 * engine, so the caller passes the rendered values rather than recomputing them.
 *
 * Deliberately absent:
 *   - `aggregateRating` / `review`: no reviews exist. Inventing them is both a
 *     structured-data violation and a fabricated endorsement.
 *   - `priceValidUntil`: a made-up expiry is worse than none.
 *   - `shippingDetails` / `hasMerchantReturnPolicy`: the brief supplies no
 *     shipping or returns terms, so none are asserted.
 */
export function productJsonLd(input: {
  name: string;
  description: string;
  path: string;
  locale: Locale;
  sku: string;
  brand?: string;
  gtin?: string;
  priceMinor: number;
  currency: string;
  availability: string;
  condition: string;
  imagePath?: string;
}): JsonLd {
  const siteUrl = getSiteUrl();
  const url = new URL(input.path, siteUrl).toString();

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    description: input.description,
    url,
    sku: input.sku,
    inLanguage: LOCALE_SEO_TAGS[input.locale],
    ...(input.imagePath
      ? { image: new URL(input.imagePath, siteUrl).toString() }
      : {}),
    // `brand` is only emitted when one is genuinely known.
    ...(input.brand ? { brand: { "@type": "Brand", name: input.brand } } : {}),
    // Google expects the length-specific property (gtin13, gtin12, …) rather
    // than the generic `gtin`, so the correct one is selected from the length.
    ...(input.gtin ? { [gtinPropertyName(input.gtin)]: input.gtin } : {}),
    offers: {
      "@type": "Offer",
      url,
      price: priceForFeed(input.priceMinor, input.currency),
      priceCurrency: input.currency,
      availability: `https://schema.org/${SCHEMA_AVAILABILITY[input.availability] ?? "OutOfStock"}`,
      itemCondition: `https://schema.org/${SCHEMA_CONDITION[input.condition] ?? "NewCondition"}`,
      // Sold by the organisation itself, not a marketplace seller.
      seller: { "@id": new URL("/#organization", siteUrl).toString() },
    },
  };
}

/** Map the database availability enum to schema.org's vocabulary. */
const SCHEMA_AVAILABILITY: Record<string, string> = {
  in_stock: "InStock",
  out_of_stock: "OutOfStock",
  preorder: "PreOrder",
  backorder: "BackOrder",
  discontinued: "Discontinued",
};

/** Map the database condition enum to schema.org's vocabulary. */
const SCHEMA_CONDITION: Record<string, string> = {
  new: "NewCondition",
  refurbished: "RefurbishedCondition",
  used: "UsedCondition",
};

/**
 * The schema.org property name for a GTIN of a given length.
 *
 * Google's product feed requires the length-specific property; the generic
 * `gtin` is a fallback that some validators ignore. An unrecognised length falls
 * back to `gtin` rather than guessing, and the database already rejects a GTIN
 * that is not 8, 12, 13 or 14 digits.
 */
export function gtinPropertyName(gtin: string): string {
  switch (gtin.length) {
    case 8:
      return "gtin8";
    case 12:
      return "gtin12";
    case 13:
      return "gtin13";
    case 14:
      return "gtin14";
    default:
      return "gtin";
  }
}

/**
 * An item list, for the store and category indexes.
 *
 * A list of products rather than a `CollectionPage`: it describes the products
 * the page shows, which is what a crawler needs to discover the detail pages.
 */
export function itemListJsonLd(input: {
  name: string;
  path: string;
  items: readonly { name: string; path: string }[];
}): JsonLd | null {
  if (input.items.length === 0) return null;
  const siteUrl = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: input.name,
    url: new URL(input.path, siteUrl).toString(),
    numberOfItems: input.items.length,
    itemListElement: input.items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: new URL(item.path, siteUrl).toString(),
    })),
  };
}

/** Serialize for a `<script type="application/ld+json">` tag. */
export function serializeJsonLd(data: JsonLd): string {
  // `<` is escaped so a value can never terminate the script element early.
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
