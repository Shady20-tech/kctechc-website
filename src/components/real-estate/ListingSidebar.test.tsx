import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ListingSidebar } from "@/components/real-estate/ListingSidebar";
import type { GeographyOption } from "@/lib/real-estate/geography";
import type { ListingFacets } from "@/lib/real-estate/loaders";
import type { ListingFilters } from "@/lib/real-estate/search";

/**
 * The filter sidebar's plain-GET contract.
 *
 * The sidebar is a GET form, so the only filters that survive a submit are the
 * ones the form actually carries. A filter chosen outside the form — the listing
 * type comes from the category shortcuts, not from a control in here — needs a
 * hidden input or a submit silently widens the result set. That is what these
 * assertions pin: every active filter is present in the submitted form data.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/en/real-estate/listings",
}));

const EMPTY_FACETS: ListingFacets = {
  categories: new Map(),
  currencies: [],
  amenities: [],
};

const GEOGRAPHY: readonly GeographyOption[] = [
  {
    id: "region-1",
    slug: "southwest",
    name: "Southwest",
    count: 2,
    divisions: [
      {
        id: "division-1",
        slug: "fako",
        name: "Fako",
        count: 2,
        subdivisions: [
          {
            id: "subdivision-1",
            slug: "limbe-1st",
            name: "Limbe 1st",
            count: 2,
          },
        ],
      },
    ],
  },
];

function renderSidebar(filters: ListingFilters) {
  const { container } = render(
    <ListingSidebar
      locale="en"
      geography={GEOGRAPHY}
      facets={EMPTY_FACETS}
      filters={filters}
      view="list"
      variant="drawer"
    />,
  );
  const form = container.querySelector("form");
  if (!form) throw new Error("the sidebar must render a form");
  return new FormData(form);
}

describe("ListingSidebar submitted filters", () => {
  it("carries the listing type so a rent search is not widened to every listing", () => {
    const data = renderSidebar({ listingType: "rent" });

    expect(data.get("type")).toBe("rent");
  });

  it("carries short-term accommodation as its own listing type", () => {
    const data = renderSidebar({ listingType: "short_term" });

    expect(data.get("type")).toBe("short_term");
  });

  it("omits the listing type when no category is active", () => {
    const data = renderSidebar({});

    expect(data.has("type")).toBe(false);
  });

  it("carries the verified-only switch, the currency and the location cascade", () => {
    const data = renderSidebar({
      verifiedOnly: true,
      currency: "XAF",
      regionSlug: "southwest",
      divisionSlug: "fako",
      subdivisionSlug: "limbe-1st",
      listingType: "rent",
    });

    expect(data.get("verified")).toBe("true");
    expect(data.get("currency")).toBe("XAF");
    expect(data.get("region")).toBe("southwest");
    expect(data.get("division")).toBe("fako");
    expect(data.get("subdivision")).toBe("limbe-1st");
    expect(data.get("type")).toBe("rent");
  });

  it("never submits a page number, so a filter change starts at page one", () => {
    const data = renderSidebar({ listingType: "rent", page: 3 });

    expect(data.has("page")).toBe(false);
  });

  it("carries the map view so applying a filter keeps the visitor on the map", () => {
    const { container } = render(
      <ListingSidebar
        locale="en"
        geography={GEOGRAPHY}
        facets={EMPTY_FACETS}
        filters={{ listingType: "sale" }}
        view="map"
        variant="drawer"
      />,
    );
    const form = container.querySelector("form");
    if (!form) throw new Error("the sidebar must render a form");
    const data = new FormData(form);

    expect(data.get("view")).toBe("map");
    expect(data.get("type")).toBe("sale");
  });
});
