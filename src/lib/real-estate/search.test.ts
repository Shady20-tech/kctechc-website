import { describe, expect, it } from "vitest";

import type { PropertyListingRecord } from "./types";
import { selectRelatedListings } from "./search";

/**
 * Tests for related-listing selection.
 *
 * The behaviour worth pinning is the scoring and the exclusion rules: a listing
 * that shares nothing must not be shown, and the strip's order must be stable so
 * the server render and any re-render agree.
 */

function listing(
  overrides: Partial<PropertyListingRecord> & { id: string },
): PropertyListingRecord {
  return {
    reference: `KC-RE-${overrides.id.padStart(6, "0")}`,
    slug: `listing-${overrides.id}`,
    listingType: "sale",
    propertyKind: "villa",
    propertyType: "residential",
    status: "published",
    source: "admin",
    regionSlug: "littoral",
    regionName: "Littoral",
    title: `Listing ${overrides.id}`,
    description: "A property.",
    highlights: [],
    amenities: [],
    priceMinor: null,
    currency: "XAF",
    pricePeriod: "total",
    priceOnRequest: false,
    images: [],
    isFeatured: false,
    viewCount: 0,
    inquiryCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("selectRelatedListings", () => {
  const subject = listing({ id: "1" });

  it("never includes the subject listing itself", () => {
    const result = selectRelatedListings([subject], subject);
    expect(result).toEqual([]);
  });

  it("excludes listings that share nothing with the subject", () => {
    const unrelated = listing({
      id: "2",
      regionSlug: "centre",
      propertyKind: "land",
      listingType: "rent",
    });
    expect(selectRelatedListings([subject, unrelated], subject)).toEqual([]);
  });

  it("ranks a same-region and same-kind match above a same-kind-only match", () => {
    const sameRegionAndKind = listing({ id: "2" });
    const sameKindOnly = listing({ id: "3", regionSlug: "centre" });

    const result = selectRelatedListings(
      [subject, sameKindOnly, sameRegionAndKind],
      subject,
    );

    expect(result.map((entry) => entry.id)).toEqual(["2", "3"]);
  });

  it("honours the limit", () => {
    const candidates = ["2", "3", "4", "5"].map((id) => listing({ id }));
    expect(selectRelatedListings([subject, ...candidates], subject, 2)).toHaveLength(
      2,
    );
  });

  it("is stable between renders when scores tie", () => {
    const a = listing({ id: "2" });
    const b = listing({ id: "3" });

    const first = selectRelatedListings([subject, a, b], subject);
    const second = selectRelatedListings([subject, b, a], subject);

    // Ties break on the reference, so the input order cannot leak into the render.
    expect(first.map((entry) => entry.id)).toEqual(second.map((entry) => entry.id));
  });

  it("prefers the more recently published listing on a score tie", () => {
    const older = listing({ id: "2", publishedAt: "2025-01-01T00:00:00.000Z" });
    const newer = listing({ id: "3", publishedAt: "2026-06-01T00:00:00.000Z" });

    const result = selectRelatedListings([subject, older, newer], subject);
    expect(result.map((entry) => entry.id)).toEqual(["3", "2"]);
  });
});
