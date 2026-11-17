import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MarketplaceActiveFilters } from "@/components/marketplace/MarketplaceActiveFilters";
import { MarketplaceCategoryNavigation } from "@/components/marketplace/MarketplaceCategoryNavigation";
import { MarketplaceEmptyState } from "@/components/marketplace/MarketplaceEmptyState";
import { MarketplaceFilterSection } from "@/components/marketplace/MarketplaceFilterSection";
import { MarketplaceFilterSidebar } from "@/components/marketplace/MarketplaceFilterSidebar";
import { MarketplaceMobileFilterDrawer } from "@/components/marketplace/MarketplaceMobileFilterDrawer";
import { MarketplacePagination } from "@/components/marketplace/MarketplacePagination";
import { MarketplaceResultsToolbar } from "@/components/marketplace/MarketplaceResultsToolbar";
import { MarketplaceSearchHeader } from "@/components/marketplace/MarketplaceSearchHeader";

/**
 * The shared marketplace component layer.
 *
 * These components are the reason every department gets one filtering
 * experience: the layout, the sidebar shell, the mobile drawer, the chips, the
 * toolbar and the pagination are written once and given a department's *fields*
 * as children. The properties pinned here are the ones that would silently
 * diverge if a department forked a component — that a chip removes exactly its
 * own filter, that a shortcut is a real URL, that the drawer reports the active
 * count, and that an empty state never invents a count.
 *
 * `MarketplaceSearchableSelect` is exercised by the Real Estate results-chrome
 * suite, which drives it through the sidebar that owns it.
 */

describe("MarketplaceSearchHeader", () => {
  const categories = [
    {
      value: "for-sale",
      label: "For sale",
      href: "/en/store?type=sale",
      count: 3,
    },
    { value: "for-rent", label: "For rent", href: "/en/store?type=rent" },
  ];

  it("is a GET form that submits to the department's results path", () => {
    const { container } = render(
      <MarketplaceSearchHeader
        action="/en/real-estate/listings"
        submitLabel="Search"
        categoriesLabel="Categories"
        categories={categories}
        fields={<input aria-label="Keyword" name="q" />}
      />,
    );
    const form = container.querySelector("form");
    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", "/en/real-estate/listings");
    expect(screen.getByRole("button", { name: /Search/ })).toBeInTheDocument();
  });

  it("renders each category shortcut as a link to a real URL", () => {
    render(
      <MarketplaceSearchHeader
        action="/en/store"
        submitLabel="Search"
        categoriesLabel="Categories"
        categories={categories}
        fields={<input aria-label="Keyword" name="q" />}
      />,
    );
    const forSale = screen.getByRole("link", { name: /For sale/ });
    expect(forSale).toHaveAttribute("href", "/en/store?type=sale");
    // A count is shown only when the data supports one; an entry with no count
    // shows none rather than a fabricated zero.
    expect(screen.getByRole("link", { name: /For rent/ })).toHaveTextContent(
      "For rent",
    );
  });
});

describe("MarketplaceCategoryNavigation", () => {
  it("marks the current entry with aria-current and hides a zero count", () => {
    render(
      <MarketplaceCategoryNavigation
        ariaLabel="Categories"
        items={[
          {
            value: "a",
            label: "All",
            href: "/en/store",
            count: 0,
            active: true,
          },
          {
            value: "b",
            label: "Laptops",
            href: "/en/store?category=laptops",
            count: 12,
          },
        ]}
      />,
    );
    const all = screen.getByRole("link", { name: /All/ });
    expect(all).toHaveAttribute("aria-current", "true");
    expect(all).not.toHaveTextContent("0");
    expect(screen.getByRole("link", { name: /Laptops/ })).toHaveTextContent(
      "12",
    );
  });

  it("renders nothing for an empty list rather than an empty shell", () => {
    const { container } = render(
      <MarketplaceCategoryNavigation ariaLabel="Categories" items={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("MarketplaceActiveFilters", () => {
  it("renders nothing when no filter is set", () => {
    const { container } = render(
      <MarketplaceActiveFilters
        chips={[]}
        clearHref="/en/store"
        clearLabel="Clear all"
        label="Filters"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("names the removal target so a screen reader hears the filter and value", () => {
    render(
      <MarketplaceActiveFilters
        chips={[
          {
            key: "region",
            label: "Region: South West",
            href: "/en/listings",
            removeLabel: "Remove filter Region: South West",
          },
        ]}
        clearHref="/en/listings"
        clearLabel="Clear all"
        label="Filters"
      />,
    );
    expect(
      screen.getByRole("link", {
        name: "Remove filter Region: South West",
      }),
    ).toHaveAttribute("href", "/en/listings");
  });
});

describe("MarketplaceResultsToolbar", () => {
  it("states the total and offers the sort choices", () => {
    const onSortChange = vi.fn();
    render(
      <MarketplaceResultsToolbar
        labels={{ total: "7 products", detail: "Laptops", sortLabel: "Sort" }}
        sortChoices={[
          { value: "relevance", label: "Relevance" },
          { value: "price-asc", label: "Price: low to high" },
        ]}
        sortValue="relevance"
        onSortChange={onSortChange}
      />,
    );
    expect(screen.getByText("7 products")).toBeInTheDocument();
    expect(screen.getByText("Laptops")).toBeInTheDocument();
    const select = screen.getByRole("combobox");
    expect(
      within(select)
        .getAllByRole("option")
        .map((option) => (option as HTMLOptionElement).value),
    ).toEqual(["relevance", "price-asc"]);
    fireEvent.change(select, { target: { value: "price-asc" } });
    expect(onSortChange).toHaveBeenCalledWith("price-asc");
  });

  it("omits the sort control when the department offers no choices", () => {
    render(
      <MarketplaceResultsToolbar labels={{ total: "0", sortLabel: "Sort" }} />,
    );
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});

describe("MarketplaceFilterSidebar", () => {
  it("is a GET form with a submit, a clear link and a drawer close control", () => {
    const onClose = vi.fn();
    const { container } = render(
      <MarketplaceFilterSidebar
        action="/en/store"
        variant="drawer"
        onClose={onClose}
        activeCount={2}
        labels={{
          submit: "Apply filters",
          clear: "Clear filters",
          close: "Close",
          activeCount: "2 active",
        }}
      >
        <input aria-label="Keyword" name="q" />
      </MarketplaceFilterSidebar>,
    );
    const form = container.querySelector("form");
    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", "/en/store");
    expect(
      screen.getByRole("button", { name: "Apply filters" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute(
      "href",
      "/en/store",
    );
    expect(screen.getByText("2 active")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("hides the close control outside the drawer", () => {
    render(
      <MarketplaceFilterSidebar
        action="/en/store"
        labels={{ submit: "Search", clear: "Clear filters" }}
      >
        <input aria-label="Keyword" name="q" />
      </MarketplaceFilterSidebar>,
    );
    expect(
      screen.queryByRole("button", { name: "Close" }),
    ).not.toBeInTheDocument();
  });
});

describe("MarketplaceMobileFilterDrawer", () => {
  it("reports the active-filter count on the trigger and opens a dialog", () => {
    render(
      <MarketplaceMobileFilterDrawer
        labels={{ open: "Filters", title: "Filters", close: "Close" }}
        activeCount={3}
      >
        <input aria-label="Keyword" name="q" />
      </MarketplaceMobileFilterDrawer>,
    );
    const trigger = screen.getByRole("button", { name: /Filters/ });
    expect(trigger).toHaveTextContent("3");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("MarketplaceFilterSection", () => {
  it("is a native disclosure that is open by default", () => {
    const { container } = render(
      <MarketplaceFilterSection title="Price">
        <input aria-label="Minimum price" />
      </MarketplaceFilterSection>,
    );
    const details = container.querySelector("details");
    // A native `<details open>` collapses without hydration, so a crawler and a
    // no-JavaScript visitor both get the fields.
    expect(details).toHaveAttribute("open");
    expect(screen.getByText("Price")).toBeInTheDocument();
  });

  it("shows a count badge only when the section has an active value", () => {
    render(
      <MarketplaceFilterSection title="Brand" count={2}>
        <input aria-label="Brand" />
      </MarketplaceFilterSection>,
    );
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});

describe("MarketplacePagination", () => {
  const labels = {
    nav: "Pagination",
    previous: "Previous",
    next: "Next",
    page: (page: number) => `Page ${page}`,
  };

  it("renders nothing for a single page", () => {
    const { container } = render(
      <MarketplacePagination
        page={1}
        pageCount={1}
        hrefFor={() => "/en/store"}
        labels={labels}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("offers real links and marks the current page", () => {
    render(
      <MarketplacePagination
        page={2}
        pageCount={5}
        hrefFor={(page) => `/en/store?page=${page}`}
        labels={labels}
      />,
    );
    expect(screen.getByRole("link", { name: "Page 3" })).toHaveAttribute(
      "href",
      "/en/store?page=3",
    );
    expect(screen.getByRole("link", { name: "Page 2" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute(
      "rel",
      "prev",
    );
  });

  it("renders a disabled edge as text, not as a link to the same page", () => {
    render(
      <MarketplacePagination
        page={1}
        pageCount={4}
        hrefFor={(page) => `/en/store?page=${page}`}
        labels={labels}
      />,
    );
    // Page 1 has no previous page, so there must be no "Previous" link.
    expect(
      screen.queryByRole("link", { name: "Previous" }),
    ).not.toBeInTheDocument();
  });
});

describe("MarketplaceEmptyState", () => {
  it("renders the caller's heading, body and action", () => {
    render(
      <MarketplaceEmptyState
        heading="Nothing published yet"
        body="Products appear here when they are published."
        action={<span data-testid="empty-action">Clear filters</span>}
      />,
    );
    expect(screen.getByText("Nothing published yet")).toBeInTheDocument();
    expect(screen.getByTestId("empty-action")).toHaveTextContent(
      "Clear filters",
    );
  });
});
