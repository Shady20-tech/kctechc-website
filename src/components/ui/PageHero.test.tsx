import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageHero } from "@/components/ui/PageHero";

/**
 * Shared corporate page hero.
 *
 * The hero is the page's only `<h1>`, so the properties that matter are that it
 * renders exactly one heading at the top level, that the breadcrumb trail is
 * present and announced, and that the decorative layers (photograph, grid, glow)
 * are hidden from assistive technology rather than being read out as content.
 */
describe("PageHero", () => {
  it("renders one h1 and the eyebrow", () => {
    render(<PageHero eyebrow="About us" heading="One company" />);
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent("One company");
    expect(screen.getByText("About us")).toBeInTheDocument();
  });

  it("renders the breadcrumb trail with its accessible name", () => {
    const { container } = render(
      <PageHero
        eyebrow="Gallery"
        heading="Our work"
        breadcrumbLabel="Breadcrumb"
        breadcrumbs={[
          { name: "Home", href: "/en" },
          { name: "Gallery", href: "/en/gallery" },
        ]}
      />,
    );
    expect(
      screen.getByRole("navigation", { name: "Breadcrumb" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/en",
    );
    // The final crumb is the current page, not a link back to itself. The word
    // "Gallery" also appears as the eyebrow, so the assertion targets the
    // aria-current node rather than the text alone.
    expect(container.querySelector('[aria-current="page"]')).toHaveTextContent(
      "Gallery",
    );
  });

  it("omits the breadcrumb nav when no label is supplied", () => {
    render(
      <PageHero
        eyebrow="Services"
        heading="What we do"
        breadcrumbs={[{ name: "Home", href: "/en" }]}
      />,
    );
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("hides every decorative layer from assistive technology", () => {
    const { container } = render(
      <PageHero
        eyebrow="Contact"
        heading="Talk to us"
        image="/hero/corporate-v3.jpg"
      />,
    );
    // The grid and both glows are aria-hidden; the backdrop photo is rendered by
    // HeroMedia, which is aria-hidden internally.
    const hidden = container.querySelectorAll('[aria-hidden="true"]');
    expect(hidden.length).toBeGreaterThanOrEqual(3);
  });

  it("renders the hero meta as a labelled definition list", () => {
    render(
      <PageHero
        eyebrow="Contact"
        heading="Talk to us"
        meta={[
          { term: "Head office", detail: "Half-Mile, Limbe" },
          { term: "Email", detail: "kctechc@gmail.com" },
        ]}
      />,
    );
    expect(screen.getByText("Head office").tagName).toBe("DT");
    expect(screen.getByText("Half-Mile, Limbe").tagName).toBe("DD");
  });
});
