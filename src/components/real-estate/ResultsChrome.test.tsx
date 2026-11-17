import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ActiveFilterChips } from "@/components/real-estate/ActiveFilterChips";
import { MobileFilterDrawer } from "@/components/real-estate/MobileFilterDrawer";
import { ResultsToolbar } from "@/components/real-estate/ResultsToolbar";
import { createTranslator } from "@/lib/i18n/translator";
import type { GeographyOption } from "@/lib/real-estate/geography";
import type { ListingFacets } from "@/lib/real-estate/loaders";
import { parseListingFilters } from "@/lib/real-estate/search";

/**
 * The marketplace results chrome: the active-filter chips, the results toolbar and
 * the mobile filter drawer.
 *
 * These are the controls that make a filtered result set explainable. The
 * properties pinned here are the ones a regression would silently break: that a
 * chip removes exactly its own filter and nothing else, that the toolbar states
 * the real total, and that the drawer's trigger reports how many filters are live.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/en/real-estate/listings",
}));

const t = createTranslator("en").t;

const EMPTY_FACETS: ListingFacets = {
  categories: new Map(),
  currencies: [],
  amenities: [],
};

const GEOGRAPHY: readonly GeographyOption[] = [
  {
    id: "region-1",
    slug: "south-west",
    name: "South West",
    count: 3,
    divisions: [
      {
        id: "division-1",
        slug: "fako",
        name: "Fako",
        count: 3,
        subdivisions: [
          {
            id: "subdivision-1",
            slug: "limbe-i",
            name: "Limbe I",
            count: 2,
          },
        ],
      },
    ],
  },
];

describe("ActiveFilterChips", () => {
  it("renders nothing when no filter is set", () => {
    const { container } = render(
      <ActiveFilterChips
        locale="en"
        t={t}
        filters={parseListingFilters({})}
        view="list"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("labels a location chip with the published name, not the slug", () => {
    render(
      <ActiveFilterChips
        locale="en"
        t={t}
        filters={parseListingFilters({ region: "south-west" })}
        view="list"
        locationNames={new Map([["south-west", "South West"]])}
      />,
    );
    expect(screen.getByText("Region: South West")).toBeInTheDocument();
  });

  it("builds each chip's link by removing only its own filter", () => {
    render(
      <ActiveFilterChips
        locale="en"
        t={t}
        filters={parseListingFilters({
          region: "south-west",
          type: "sale",
          minBedrooms: "2",
        })}
        view="list"
      />,
    );
    const regionChip = screen.getByRole("link", {
      name: /Region: South West/,
    });
    const href = regionChip.getAttribute("href") ?? "";
    expect(href).not.toContain("region=south-west");
    // The other two filters survive.
    expect(href).toContain("type=sale");
    expect(href).toContain("minBedrooms=2");
  });

  it("keeps the map view when a chip removes a filter", () => {
    render(
      <ActiveFilterChips
        locale="en"
        t={t}
        filters={parseListingFilters({ region: "south-west" })}
        view="map"
      />,
    );
    expect(
      screen
        .getByRole("link", { name: /Region: South West/ })
        .getAttribute("href"),
    ).toContain("view=map");
  });

  it("renders a chip for the verified-only filter", () => {
    render(
      <ActiveFilterChips
        locale="en"
        t={t}
        filters={parseListingFilters({ verified: "true" })}
        view="list"
      />,
    );
    expect(
      screen.getByText(t("realEstate.search.verifiedOnlyChip")),
    ).toBeInTheDocument();
  });

  it("offers a clear-all link that drops every filter", () => {
    render(
      <ActiveFilterChips
        locale="en"
        t={t}
        filters={parseListingFilters({ region: "south-west", type: "sale" })}
        view="list"
      />,
    );
    const clear = screen.getByRole("link", {
      name: t("realEstate.search.clearAll"),
    });
    expect(clear).toHaveAttribute("href", "/en/real-estate/listings");
  });

  it("keeps the map view when clearing all", () => {
    render(
      <ActiveFilterChips
        locale="en"
        t={t}
        filters={parseListingFilters({ type: "sale" })}
        view="map"
      />,
    );
    expect(
      screen
        .getByRole("link", { name: t("realEstate.search.clearAll") })
        .getAttribute("href"),
    ).toBe("/en/real-estate/listings?view=map");
  });
});

describe("ResultsToolbar", () => {
  it("states the real total and the current location and category", () => {
    render(
      <ResultsToolbar
        locale="en"
        filters={parseListingFilters({})}
        view="list"
        total={7}
        locationLabel="South West"
        categoryLabel={t("realEstate.categories.forSale")}
      />,
    );
    expect(
      screen.getByText(t("realEstate.search.toolbarResults", { count: 7 })),
    ).toBeInTheDocument();
    expect(screen.getByText(/South West/)).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(t("realEstate.categories.forSale"))),
    ).toBeInTheDocument();
  });

  it("uses the singular wording for exactly one result", () => {
    render(
      <ResultsToolbar
        locale="en"
        filters={parseListingFilters({})}
        view="list"
        total={1}
      />,
    );
    expect(
      screen.getByText(t("realEstate.search.toolbarResultsOne")),
    ).toBeInTheDocument();
  });

  it("offers the supported sort orders", () => {
    render(
      <ResultsToolbar
        locale="en"
        filters={parseListingFilters({})}
        view="list"
        total={3}
      />,
    );
    const select = screen.getByRole("combobox");
    const values = within(select)
      .getAllByRole("option")
      .map((option) => (option as HTMLOptionElement).value);
    expect(values).toEqual([
      "relevance",
      "newest",
      "price-asc",
      "price-desc",
      "most-viewed",
    ]);
  });
});

describe("MobileFilterDrawer", () => {
  it("shows the active-filter count on the trigger", () => {
    render(
      <MobileFilterDrawer
        locale="en"
        geography={GEOGRAPHY}
        facets={EMPTY_FACETS}
        filters={parseListingFilters({ region: "south-west", type: "sale" })}
        view="list"
      />,
    );
    const trigger = screen.getByRole("button", {
      name: new RegExp(t("realEstate.search.openFilters")),
    });
    expect(trigger).toHaveTextContent("2");
  });

  it("opens the shared filter panel from the trigger", () => {
    render(
      <MobileFilterDrawer
        locale="en"
        geography={GEOGRAPHY}
        facets={EMPTY_FACETS}
        filters={parseListingFilters({})}
        view="list"
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: new RegExp(t("realEstate.search.openFilters")),
      }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
