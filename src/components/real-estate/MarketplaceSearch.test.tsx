import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarketplaceSearch } from "@/components/real-estate/MarketplaceSearch";
import { createTranslator } from "@/lib/i18n/translator";
import type { GeographyOption } from "@/lib/real-estate/geography";
import { PROPERTY_CATEGORIES } from "@/lib/real-estate/search";

/**
 * The marketplace landing page's search area.
 *
 * It is a plain GET form, so the properties that matter are structural: the
 * search IS a URL (the form navigates to the results path with the filters
 * encoded), the location selector offers the real geography, and each category
 * shortcut links to the same filter combination the sidebar would produce — a
 * shortcut and its result set cannot disagree.
 */

const t = createTranslator("en").t;

const GEOGRAPHY: readonly GeographyOption[] = [
  {
    id: "region-1",
    slug: "south-west",
    name: "South West",
    count: 4,
    divisions: [],
  },
  {
    id: "region-2",
    slug: "littoral",
    name: "Littoral",
    count: 0,
    divisions: [],
  },
];

describe("MarketplaceSearch", () => {
  it("is a GET form that navigates to the results path", () => {
    const { container } = render(
      <MarketplaceSearch
        locale="en"
        geography={GEOGRAPHY}
        categories={new Map()}
      />,
    );
    const form = container.querySelector("form");
    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", "/en/real-estate/listings");
  });

  it("offers a location selector and a keyword input", () => {
    render(
      <MarketplaceSearch
        locale="en"
        geography={GEOGRAPHY}
        categories={new Map()}
      />,
    );
    const location = screen.getByLabelText(
      t("realEstate.marketplace.locationLabel"),
    );
    expect(location).toHaveAttribute("name", "region");
    const keyword = screen.getByLabelText(
      t("realEstate.marketplace.keywordLabel"),
    );
    expect(keyword).toHaveAttribute("name", "q");
    expect(screen.getByRole("button", { name: /Search/ })).toBeInTheDocument();
  });

  it("shows a real count only where inventory exists", () => {
    render(
      <MarketplaceSearch
        locale="en"
        geography={GEOGRAPHY}
        categories={new Map([["for_sale", 3]])}
      />,
    );
    const location = screen.getByLabelText(
      t("realEstate.marketplace.locationLabel"),
    );
    // South West has 4 published listings, Littoral has none — the count is
    // omitted rather than printed as "0".
    const options = within(location).getAllByRole("option");
    expect(options.some((o) => o.textContent?.includes("4"))).toBe(true);
    expect(options.find((o) => o.textContent === "Littoral")).toBeTruthy();
  });

  it("links every category shortcut to its filter combination", () => {
    render(
      <MarketplaceSearch
        locale="en"
        geography={GEOGRAPHY}
        categories={new Map([["for_sale", 3]])}
      />,
    );
    const shortcuts = screen
      .getAllByRole("link")
      .filter((link) =>
        link.getAttribute("href")?.startsWith("/en/real-estate/listings"),
      );
    expect(shortcuts).toHaveLength(PROPERTY_CATEGORIES.length);
    const forSale = shortcuts.find((link) =>
      link.textContent?.includes(t("realEstate.categories.forSale")),
    );
    expect(forSale?.getAttribute("href")).toContain("type=sale");
  });

  it("renders the localized copy in French", () => {
    const fr = createTranslator("fr").t;
    render(
      <MarketplaceSearch
        locale="fr"
        geography={GEOGRAPHY}
        categories={new Map()}
      />,
    );
    expect(
      screen.getByLabelText(fr("realEstate.marketplace.locationLabel")),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: new RegExp(fr("realEstate.marketplace.searchSubmit")),
      }),
    ).toBeInTheDocument();
  });
});
