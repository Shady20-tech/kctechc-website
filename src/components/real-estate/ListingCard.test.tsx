import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The save control is a Client Component that reads the router; the card itself
// needs no navigation, so the hook is stubbed to keep the render inert.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/en/real-estate/listings",
}));

// `publicEnv` is read once at import time, so a test cannot set
// NEXT_PUBLIC_SUPABASE_URL late. The storage helper is stubbed instead, which
// is the only thing standing between a fixture image and a rendered <img>.
vi.mock("@/lib/real-estate/storage", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/real-estate/storage")
  >("@/lib/real-estate/storage");
  return {
    ...actual,
    propertyMediaPublicUrl: (path: string) =>
      path ? `https://example.supabase.co/property-media/${path}` : null,
  };
});

import {
  ListingCard,
  ListingGrid,
  formatArea,
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

  it("prioritises only the leading cards so the LCP image is not competing", () => {
    // `next/image` drops `loading="lazy"` for a prioritised image, which is what
    // makes the browser fetch it eagerly instead of after layout. The rest of
    // the grid stays lazy so the LCP image is not racing eleven others.
    const photo = [
      {
        id: "img-1",
        storagePath: "listing/demo-0.jpg",
        alt: "Front of the villa",
        isPrimary: true,
        position: 0,
      },
    ];
    const { container } = render(
      <ListingGrid
        listings={[
          record({ images: photo }),
          record({
            id: "22222222-2222-2222-2222-222222222222",
            slug: "two",
            images: photo,
          }),
          record({
            id: "33333333-3333-3333-3333-333333333333",
            slug: "three",
            images: photo,
          }),
        ]}
        locale="en"
        t={t}
        priorityCount={2}
      />,
    );
    const images = Array.from(container.querySelectorAll("img"));
    expect(images).toHaveLength(3);
    expect(images[0]).not.toHaveAttribute("loading", "lazy");
    expect(images[1]).not.toHaveAttribute("loading", "lazy");
    expect(images[2]).toHaveAttribute("loading", "lazy");
  });

  it("marks the prioritised images with an explicit high fetch priority", () => {
    // `priority` only drops `loading="lazy"`; the browser still treats the
    // request as default priority unless `fetchpriority="high"` is stated. The
    // preload link is what Lighthouse's lcp-discovery audit inspects.
    const photo = [
      {
        id: "img-1",
        storagePath: "listing/demo-0.jpg",
        alt: "Front of the villa",
        isPrimary: true,
        position: 0,
      },
    ];
    const { container } = render(
      <ListingGrid
        listings={[
          record({ images: photo }),
          record({
            id: "22222222-2222-2222-2222-222222222222",
            slug: "two",
            images: photo,
          }),
        ]}
        locale="en"
        t={t}
        priorityCount={1}
      />,
    );
    const images = Array.from(container.querySelectorAll("img"));
    expect(images[0]?.getAttribute("fetchpriority")).toBe("high");
    expect(images[1]?.getAttribute("fetchpriority")).not.toBe("high");
  });

  it("leaves every card lazy when no priority count is given", () => {
    const { container } = render(
      <ListingGrid
        listings={[
          record({
            images: [
              {
                id: "img-1",
                storagePath: "listing/demo-0.jpg",
                alt: "Front of the villa",
                isPrimary: true,
                position: 0,
              },
            ],
          }),
        ]}
        locale="en"
        t={t}
      />,
    );
    expect(container.querySelector("img")).toHaveAttribute("loading", "lazy");
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
        "en",
        t,
      ),
    ).toEqual([]);
  });

  it("tags each fact with what it describes, so the icon follows the fact", () => {
    // Bathrooms without a bedroom count is the case that broke the positional
    // icon: the only fact present is a bathroom, and it must not be a bed.
    expect(
      listingFactChips(
        record({
          bedrooms: undefined,
          bathrooms: 2,
          landAreaSqm: undefined,
          buildingAreaSqm: 180,
        }),
        "en",
        t,
      ),
    ).toEqual([
      {
        kind: "bathroom",
        label: t("realEstate.units.bathrooms", { count: 2 }),
      },
      { kind: "area", label: "180 m²" },
    ]);
  });
});

describe("formatArea", () => {
  it("groups digits for the page's locale", () => {
    // fr-CM groups with a narrow no-break space, en-CM with a comma; a French
    // page showing "1,234 m²" is the English convention in French copy.
    expect(formatArea(1234, "en", t)).toBe("1,234 m²");
    expect(formatArea(1234, "fr", t)).toBe("1\u202f234 m²");
    expect(formatArea(undefined, "fr", t)).toBeNull();
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
