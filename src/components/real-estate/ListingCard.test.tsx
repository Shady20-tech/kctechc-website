import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The save control is a Client Component that reads the router; the card itself
// needs no navigation, so the hook is stubbed to keep the render inert.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/en/real-estate/listings",
}));

import {
  ListingCard,
  ListingGrid,
  listingFactChips,
  listingHref,
  listingStatusTone,
} from "@/components/real-estate/ListingCard";
import { VerifiedBadge } from "@/components/real-estate/VerifiedBadge";
import { createTranslator } from "@/lib/i18n/translator";
import type { PropertyListingRecord } from "@/lib/real-estate/types";

/**
 * The marketplace property card.
 *
 * The card is a Server Component, so the first render *is* the HTML a crawler
 * and a no-JavaScript visitor receive — the properties pinned here are the ones
 * that matter for a listing to be discoverable and honestly described: the price,
 * the title, the location, the category, and the fact that an empty optional
 * field renders nothing rather than a fabricated value.
 */

const t = createTranslator("en").t;

function record(
  overrides: Partial<PropertyListingRecord> = {},
): PropertyListingRecord {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    reference: "KC-RE-000001",
    slug: "villa-limbe",

    listingType: "sale",
    propertyKind: "villa",
    propertyType: "residential",
    status: "published",
    source: "admin",
    title: "Villa with sea view",
    description: "A four-bedroom villa overlooking the bay.",
    highlights: ["Sea view"],
    amenities: ["pool"],
    priceMinor: 45000000,
    currency: "XAF",
    pricePeriod: "total",
    priceOnRequest: false,
    bedrooms: 4,
    bathrooms: 3,
    yearBuilt: 2019,
    isFeatured: true,
    viewCount: 12,
    inquiryCount: 2,
    publishedAt: "2026-01-01T00:00:00Z",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    regionSlug: "south-west",
    regionName: "South West",
    locality: "Limbe",
    images: [],
    translations: {},
    publisherVerified: false,
    ...overrides,
  };
}

describe("ListingCard", () => {
  it("links the whole card to the listing's locale slug", () => {
    render(
      <ul>
        <ListingCard record={record()} locale="en" t={t} />
      </ul>,
    );
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute(
      "href",
      "/en/real-estate/listings/villa-limbe",
    );
  });

  it("shows the price, title, location and category", () => {
    render(
      <ul>
        <ListingCard record={record()} locale="en" t={t} />
      </ul>,
    );
    expect(screen.getByText(/45,000,000/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Villa with sea view" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Limbe, South West")).toBeInTheDocument();
    expect(screen.getByText(t("realEstate.kinds.villa"))).toBeInTheDocument();
  });

  it("renders the facts that exist and nothing for the ones that do not", () => {
    const { rerender } = render(
      <ul>
        <ListingCard
          record={record({
            bedrooms: 2,
            bathrooms: undefined,
            landAreaSqm: undefined,
            buildingAreaSqm: undefined,
          })}
          locale="en"
          t={t}
        />
      </ul>,
    );
    expect(
      screen.getByText(t("realEstate.units.bedrooms", { count: 2 })),
    ).toBeInTheDocument();
    // No bathroom, no area: nothing invented to fill the row.
    expect(
      screen.queryByText(t("realEstate.units.bathrooms", { count: 1 })),
    ).not.toBeInTheDocument();

    rerender(
      <ul>
        <ListingCard record={record()} locale="en" t={t} />
      </ul>,
    );
    expect(
      screen.getByText(t("realEstate.units.bathrooms", { count: 3 })),
    ).toBeInTheDocument();
  });

  it("shows a placeholder rather than a stock photo when there is no image", () => {
    render(
      <ul>
        <ListingCard record={record()} locale="en" t={t} />
      </ul>,
    );
    expect(
      screen.getByText(t("realEstate.listing.galleryHeading")),
    ).toBeInTheDocument();
  });

  it("shows a status badge only for a listing that is not plainly published", () => {
    const { rerender } = render(
      <ul>
        <ListingCard record={record()} locale="en" t={t} />
      </ul>,
    );
    expect(
      screen.queryByText(t("realEstate.statuses.published")),
    ).not.toBeInTheDocument();

    rerender(
      <ul>
        <ListingCard
          record={record({ status: "under_offer" })}
          locale="en"
          t={t}
        />
      </ul>,
    );
    expect(
      screen.getByText(t("realEstate.statuses.under_offer")),
    ).toBeInTheDocument();
  });

  it("shows the verified badge only for a verified publisher", () => {
    const { rerender } = render(
      <ul>
        <ListingCard record={record()} locale="en" t={t} />
      </ul>,
    );
    expect(
      screen.queryByText(t("realEstate.verified.badgeShort")),
    ).not.toBeInTheDocument();

    rerender(
      <ul>
        <ListingCard
          record={record({ publisherVerified: true })}
          locale="en"
          t={t}
        />
      </ul>,
    );
    expect(
      screen.getByText(t("realEstate.verified.badgeShort")),
    ).toBeInTheDocument();
  });

  it("omits the save control unless the caller supplies a favourite state", () => {
    const { rerender } = render(
      <ul>
        <ListingCard record={record()} locale="en" t={t} />
      </ul>,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    rerender(
      <ul>
        <ListingCard record={record()} locale="en" t={t} isFavorite={false} />
      </ul>,
    );
    // The save control is a nested, independently focusable button, so the whole
    // card can be a link without swallowing the action.
    expect(
      screen.getByRole("button", {
        name: t("realEstate.favorites.add", { title: "Villa with sea view" }),
      }),
    ).toBeInTheDocument();
  });
});

describe("ListingGrid", () => {
  it("renders one card per listing", () => {
    render(
      <ListingGrid
        listings={[
          record(),
          record({
            id: "22222222-2222-2222-2222-222222222222",
            slug: "villa-two",
            title: "Second villa",
          }),
        ]}
        locale="en"
        t={t}
      />,
    );
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(2);
  });
});

describe("listingHref", () => {
  it("uses the locale's own slug when one is published", () => {
    expect(
      listingHref(record({ localizedSlugs: { fr: "villa-limbe-fr" } }), "fr"),
    ).toBe("/fr/real-estate/listings/villa-limbe-fr");
  });

  it("falls back to the canonical slug when the locale has none", () => {
    expect(listingHref(record(), "fr")).toBe(
      "/fr/real-estate/listings/villa-limbe",
    );
  });
});

describe("listingStatusTone", () => {
  it("mutes a concluded listing and flags one under offer", () => {
    expect(listingStatusTone("published")).toBe("success");
    expect(listingStatusTone("under_offer")).toBe("warning");
    expect(listingStatusTone("sold")).toBe("neutral");
  });
});

describe("listingFactChips", () => {
  it("counts only the facts that are present", () => {
    expect(
      listingFactChips(
        record({ bedrooms: undefined, bathrooms: undefined }),
        t,
      ),
    ).toEqual([]);
  });
});

describe("VerifiedBadge", () => {
  it("announces that it is an identity review, not a title guarantee", () => {
    render(<VerifiedBadge t={t} />);
    expect(
      screen.getByText(t("realEstate.verified.badgeShort")),
    ).toBeInTheDocument();
    expect(
      screen.getByText(t("realEstate.verified.badgeTitle"), { exact: false }),
    ).toBeInTheDocument();
  });
});
