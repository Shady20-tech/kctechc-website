import { describe, expect, it } from "vitest";

import {
  asListingKind,
  asListingSource,
  asListingStatus,
  asListingType,
  asPricePeriod,
  asPropertyType,
  formatListingPrice,
  groupListingTranslations,
  listingPrimaryImage,
  listingSlugForLocale,
  localizeListing,
  resolveListingBySlug,
  sortGallery,
  toListingImage,
  toListingRecord,
  type TranslationRow,
} from "./records";
import type { ListingImage, PropertyListingRecord } from "./types";

/**
 * Tests for the pure mapping and localization layer.
 *
 * These are the behaviours a database-backed loader cannot demonstrate: what
 * happens when a column is null, when an enum value comes from a newer migration
 * than this build, when a translation is pending rather than finished, and when a
 * French URL carries an unknown slug. Each is a case that would otherwise only be
 * discovered in production, because none of them can be provoked by reading a
 * well-formed row.
 */

/** A minimal well-formed row, overridden per test. */
function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    reference: "KC-RE-000001",
    slug: "villa-limbe",
    listing_type: "sale",
    property_kind: "villa",
    property_type: "residential",
    status: "published",
    source: "admin",
    title: "Villa with sea view",
    description: "A four-bedroom villa overlooking the bay.",
    highlights: ["Sea view", "Borehole"],
    amenities: ["pool", "solar"],
    price_minor: 45000000,
    currency: "XAF",
    price_period: "total",
    price_on_request: false,
    bedrooms: 4,
    bathrooms: 3,
    year_built: 2019,
    is_featured: true,
    view_count: 12,
    inquiry_count: 2,
    published_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    regions: { slug: "south-west", name: "South West" },
    agent_profiles: { display_name: "A. Agent" },
    ...overrides,
  };
}

describe("enum narrowing", () => {
  it("keeps a value that is a member of the enum", () => {
    expect(asListingType("rent")).toBe("rent");
    expect(asListingKind("land")).toBe("land");
    expect(asPropertyType("commercial")).toBe("commercial");
    expect(asListingStatus("under_offer")).toBe("under_offer");
    expect(asListingSource("import")).toBe("import");
    expect(asPricePeriod("monthly")).toBe("monthly");
  });

  it("falls back rather than trusting an unknown value", () => {
    // A value from a migration newer than this build must not reach the UI as an
    // unhandled union member; it degrades to a safe default.
    expect(asListingType("barter")).toBe("sale");
    expect(asListingKind("castle")).toBe("other");
    expect(asPropertyType("agrarian")).toBe("residential");
    expect(asListingStatus("on_hold")).toBe("draft");
    expect(asListingSource("scraper")).toBe("admin");
    expect(asPricePeriod("hourly")).toBe("total");
  });

  it("falls back for null and non-string values", () => {
    expect(asListingType(null)).toBe("sale");
    expect(asListingType(undefined)).toBe("sale");
    expect(asListingType(7)).toBe("sale");
  });
});

describe("toListingRecord", () => {
  it("maps a full row", () => {
    const record = toListingRecord(row());

    expect(record.id).toBe("11111111-1111-1111-1111-111111111111");
    expect(record.reference).toBe("KC-RE-000001");
    expect(record.slug).toBe("villa-limbe");
    expect(record.listingType).toBe("sale");
    expect(record.propertyKind).toBe("villa");
    expect(record.status).toBe("published");
    expect(record.regionSlug).toBe("south-west");
    expect(record.regionName).toBe("South West");
    expect(record.agentName).toBe("A. Agent");
    expect(record.priceMinor).toBe(45000000);
    expect(record.highlights).toEqual(["Sea view", "Borehole"]);
    expect(record.isFeatured).toBe(true);
    expect(record.viewCount).toBe(12);
  });

  it("defaults a null region join to empty strings rather than undefined", () => {
    const record = toListingRecord(row({ regions: null, agent_profiles: null }));
    expect(record.regionSlug).toBe("");
    expect(record.regionName).toBe("");
    expect(record.agentName).toBeUndefined();
  });

  it("treats an unknown currency as XAF and a missing price as null", () => {
    const record = toListingRecord(row({ currency: null, price_minor: null }));
    expect(record.currency).toBe("XAF");
    expect(record.priceMinor).toBeNull();
  });

  it("treats a non-array highlights column as empty", () => {
    // jsonb can hold a string where an array was expected; rendering it would
    // iterate the characters of the string.
    const record = toListingRecord(row({ highlights: "Sea view" }));
    expect(record.highlights).toEqual([]);
  });

  it("filters non-string entries out of an array column", () => {
    const record = toListingRecord(row({ amenities: ["pool", 7, null, "solar"] }));
    expect(record.amenities).toEqual(["pool", "solar"]);
  });

  it("only reports priceOnRequest when the column is exactly true", () => {
    expect(toListingRecord(row({ price_on_request: true })).priceOnRequest).toBe(true);
    expect(toListingRecord(row({ price_on_request: "true" })).priceOnRequest).toBe(false);
    expect(toListingRecord(row({ price_on_request: null })).priceOnRequest).toBe(false);
  });

  it("coerces a missing id to a string rather than leaving it undefined", () => {
    expect(toListingRecord(row({ id: null })).id).toBe("null");
  });
});

describe("toListingImage", () => {
  it("maps a media row", () => {
    const image = toListingImage({
      id: "img-1",
      storage_path: "listings/villa/front.jpg",
      alt_text: "The front of the villa",
      caption: "Seaward elevation",
      position: 2,
      is_primary: true,
      width: 1600,
      height: 900,
    });

    expect(image.storagePath).toBe("listings/villa/front.jpg");
    expect(image.alt).toBe("The front of the villa");
    expect(image.isPrimary).toBe(true);
    expect(image.position).toBe(2);
  });

  it("defaults a missing position to zero", () => {
    expect(toListingImage({ id: "img-2", position: null }).position).toBe(0);
  });
});

describe("sortGallery", () => {
  const image = (id: string, position: number, isPrimary = false): ListingImage => ({
    id,
    storagePath: `${id}.jpg`,
    alt: id,
    isPrimary,
    position,
  });

  it("promotes the primary image ahead of a lower position", () => {
    const sorted = sortGallery([image("a", 0), image("b", 5, true)]);
    expect(sorted.map((i) => i.id)).toEqual(["b", "a"]);
  });

  it("keeps position order among the rest", () => {
    const sorted = sortGallery([image("c", 3), image("a", 1), image("b", 2)]);
    expect(sorted.map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  it("does not mutate the input", () => {
    const input = [image("a", 2), image("b", 1)];
    const sorted = sortGallery(input);
    expect(input.map((i) => i.id)).toEqual(["a", "b"]);
    expect(sorted.map((i) => i.id)).toEqual(["b", "a"]);
  });

  it("handles an empty gallery", () => {
    expect(sortGallery([])).toEqual([]);
  });
});

describe("groupListingTranslations", () => {
  const translation = (
    overrides: Partial<TranslationRow> = {},
  ): TranslationRow => ({
    entity_id: "listing-1",
    field_name: "title",
    locale: "fr",
    value: "Villa avec vue sur la mer",
    state: "translated",
    ...overrides,
  });

  it("collects a translated title", () => {
    const grouped = groupListingTranslations([translation()]);
    expect(grouped.get("listing-1")?.fr?.title).toBe(
      "Villa avec vue sur la mer",
    );
  });

  it("accepts a reviewed translation", () => {
    const grouped = groupListingTranslations([
      translation({ state: "reviewed" }),
    ]);
    expect(grouped.get("listing-1")?.fr?.title).toBe(
      "Villa avec vue sur la mer",
    );
  });

  it("ignores a pending translation, which holds an empty string", () => {
    // Rendering a pending row would show a French reader a blank title.
    const grouped = groupListingTranslations([
      translation({ state: "pending", value: "" }),
    ]);
    expect(grouped.get("listing-1")).toBeUndefined();
  });

  it("ignores an outdated translation", () => {
    const grouped = groupListingTranslations([
      translation({ state: "outdated" }),
    ]);
    expect(grouped.get("listing-1")).toBeUndefined();
  });

  it("ignores an English row, which is the source locale", () => {
    const grouped = groupListingTranslations([translation({ locale: "en" })]);
    expect(grouped.get("listing-1")).toBeUndefined();
  });

  it("ignores an unknown locale", () => {
    const grouped = groupListingTranslations([translation({ locale: "de" })]);
    expect(grouped.get("listing-1")).toBeUndefined();
  });

  it("combines several fields for one listing", () => {
    const grouped = groupListingTranslations([
      translation({ field_name: "title", value: "Titre" }),
      translation({ field_name: "description", value: "Description" }),
      translation({
        field_name: "highlights",
        value: JSON.stringify(["Vue sur la mer"]),
      }),
    ]);

    const overlay = grouped.get("listing-1")?.fr;
    expect(overlay?.title).toBe("Titre");
    expect(overlay?.description).toBe("Description");
    expect(overlay?.highlights).toEqual(["Vue sur la mer"]);
  });

  it("survives highlights that are not valid JSON", () => {
    const grouped = groupListingTranslations([
      translation({ field_name: "highlights", value: "not json" }),
    ]);
    expect(grouped.get("listing-1")?.fr?.highlights).toBeUndefined();
  });

  it("keeps listings apart", () => {
    const grouped = groupListingTranslations([
      translation({ entity_id: "a", value: "Un" }),
      translation({ entity_id: "b", value: "Deux" }),
    ]);
    expect(grouped.get("a")?.fr?.title).toBe("Un");
    expect(grouped.get("b")?.fr?.title).toBe("Deux");
  });
});

/** A record with a French overlay, for localization tests. */
function record(overrides: Partial<PropertyListingRecord> = {}): PropertyListingRecord {
  return {
    ...toListingRecord(row()),
    ...overrides,
  };
}

describe("localizeListing", () => {
  it("returns the record unchanged for the source locale", () => {
    const localized = localizeListing(record(), "en");
    expect(localized.title).toBe("Villa with sea view");
    expect(localized.hasFallback).toBe(false);
  });

  it("applies a French overlay and reports no fallback", () => {
    const localized = localizeListing(
      record({
        translations: {
          fr: {
            title: "Villa avec vue sur la mer",
            description: "Une villa de quatre chambres.",
            highlights: ["Vue sur la mer", "Forage"],
          },
        },
      }),
      "fr",
    );

    expect(localized.title).toBe("Villa avec vue sur la mer");
    expect(localized.description).toBe("Une villa de quatre chambres.");
    expect(localized.hasFallback).toBe(false);
  });

  it("reports a fallback when no translation exists at all", () => {
    const localized = localizeListing(record(), "fr");
    expect(localized.title).toBe("Villa with sea view");
    expect(localized.hasFallback).toBe(true);
  });

  it("reports a fallback when only some fields are translated", () => {
    // A half-translated listing must not present itself as fully translated.
    const localized = localizeListing(
      record({ translations: { fr: { title: "Titre" } } }),
      "fr",
    );
    expect(localized.title).toBe("Titre");
    expect(localized.description).toBe("A four-bedroom villa overlooking the bay.");
    expect(localized.hasFallback).toBe(true);
  });

  it("treats a whitespace-only translation as absent", () => {
    const localized = localizeListing(
      record({ translations: { fr: { title: "   " } } }),
      "fr",
    );
    expect(localized.title).toBe("Villa with sea view");
    expect(localized.hasFallback).toBe(true);
  });

  it("reports no fallback for an empty record with no translation", () => {
    // Nothing was in English to fall back to, so there is nothing to warn about.
    const localized = localizeListing(
      record({ title: "", description: "", highlights: [] }),
      "fr",
    );
    expect(localized.hasFallback).toBe(false);
  });

  it("falls back for untranslated highlights and says so", () => {
    const localized = localizeListing(
      record({
        translations: {
          fr: { title: "Titre", description: "Description" },
        },
      }),
      "fr",
    );
    expect(localized.highlights).toEqual(["Sea view", "Borehole"]);
    expect(localized.hasFallback).toBe(true);
  });

  it("uses a translated highlights list when present", () => {
    const localized = localizeListing(
      record({
        translations: {
          fr: {
            title: "Titre",
            description: "Description",
            highlights: ["Vue sur la mer"],
          },
        },
      }),
      "fr",
    );
    expect(localized.highlights).toEqual(["Vue sur la mer"]);
    expect(localized.hasFallback).toBe(false);
  });
});

describe("resolveListingBySlug", () => {
  const listings = [
    record({ slug: "villa-limbe", localizedSlugs: { fr: "villa-limbe-fr" } }),
    record({ id: "b", slug: "land-buea", localizedSlugs: { fr: "terrain-buea" } }),
  ];

  it("resolves the canonical slug in either locale", () => {
    expect(resolveListingBySlug(listings, "villa-limbe", "en")?.id).toBe(
      listings[0]?.id,
    );
    expect(resolveListingBySlug(listings, "villa-limbe", "fr")?.id).toBe(
      listings[0]?.id,
    );
  });

  it("resolves the French slug for a French URL", () => {
    expect(resolveListingBySlug(listings, "terrain-buea", "fr")?.id).toBe("b");
  });

  it("does not resolve a French slug for an English URL", () => {
    // The slug is a French URL segment; an English request must not answer it.
    expect(resolveListingBySlug(listings, "terrain-buea", "en")).toBeUndefined();
  });

  it("prefers the canonical owner when a slug collides", () => {
    const colliding = [
      record({ id: "canonical", slug: "shared", localizedSlugs: {} }),
      record({ id: "other", slug: "other", localizedSlugs: { fr: "shared" } }),
    ];
    expect(resolveListingBySlug(colliding, "shared", "fr")?.id).toBe("canonical");
  });

  it("returns undefined for an unknown slug", () => {
    expect(resolveListingBySlug(listings, "nope", "fr")).toBeUndefined();
  });
});

describe("listingSlugForLocale", () => {
  it("uses the localized slug when present", () => {
    expect(
      listingSlugForLocale(record({ localizedSlugs: { fr: "villa-fr" } }), "fr"),
    ).toBe("villa-fr");
  });

  it("falls back to the canonical slug", () => {
    // A missing French slug means the French URL is the canonical one, not that
    // there is no URL.
    expect(listingSlugForLocale(record(), "fr")).toBe("villa-limbe");
  });
});

describe("formatListingPrice", () => {
  it("says the price is on request", () => {
    expect(
      formatListingPrice(
        { priceMinor: null, currency: "XAF", pricePeriod: "total", priceOnRequest: true },
        "en",
      ),
    ).toBe("Price on request");
    expect(
      formatListingPrice(
        { priceMinor: null, currency: "XAF", pricePeriod: "total", priceOnRequest: true },
        "fr",
      ),
    ).toBe("Prix sur demande");
  });

  it("distinguishes a null price from an on-request one", () => {
    // "No price stated yet" and "price on application" are different facts.
    expect(
      formatListingPrice(
        { priceMinor: null, currency: "XAF", pricePeriod: "total", priceOnRequest: false },
        "en",
      ),
    ).toBe("Price not stated");
  });

  it("appends the period for a rental, in the right language", () => {
    const amount = formatListingPrice(
      { priceMinor: 250000, currency: "XAF", pricePeriod: "monthly", priceOnRequest: false },
      "en",
    );
    expect(amount).toContain("/ month");

    const french = formatListingPrice(
      { priceMinor: 250000, currency: "XAF", pricePeriod: "monthly", priceOnRequest: false },
      "fr",
    );
    expect(french).toContain("/ mois");
  });

  it("appends nothing for a total price", () => {
    const amount = formatListingPrice(
      { priceMinor: 45000000, currency: "XAF", pricePeriod: "total", priceOnRequest: false },
      "en",
    );
    expect(amount).not.toContain("/");
  });
});

describe("listingPrimaryImage", () => {
  const image = (id: string, isPrimary: boolean, position: number): ListingImage => ({
    id,
    storagePath: `${id}.jpg`,
    alt: id,
    isPrimary,
    position,
  });

  it("returns the primary image", () => {
    expect(
      listingPrimaryImage(
        record({ images: [image("a", false, 0), image("b", true, 4)] }),
      )?.id,
    ).toBe("b");
  });

  it("falls back to the first image", () => {
    expect(
      listingPrimaryImage(record({ images: [image("a", false, 0)] }))?.id,
    ).toBe("a");
  });

  it("returns undefined for a listing with no image", () => {
    expect(listingPrimaryImage(record({ images: [] }))).toBeUndefined();
  });
});
