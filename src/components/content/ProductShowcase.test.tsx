import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductShowcase } from "@/components/content/ProductShowcase";
import { ELECTRICAL_PRODUCTS } from "@/lib/content/electrical-products";
import { createTranslator } from "@/lib/i18n/translator";

/**
 * Product showcase.
 *
 * Two properties matter and both are invisible in a browser screenshot:
 *
 *   1. The products are in the server-rendered HTML. The component is a Server
 *      Component with no client state of its own, so the first render *is* the
 *      markup a crawler and a no-JavaScript visitor receive. This asserts the
 *      names, ratings and image descriptions are present, and that the image
 *      carries a real `alt`.
 *   2. The marquee's duplicate set is decorative. The drift needs the set twice;
 *      the second copy must be `aria-hidden` with empty `alt`s, or assistive
 *      technology and crawlers would see every product twice.
 */

// The grid variant renders `ScrollReveal`, whose breakpoint effect reads
// `matchMedia`. jsdom has no implementation, so it is stubbed to a wide viewport.
beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    })),
  );
});

function setup(variant: "marquee" | "grid", locale: "en" | "fr" = "en") {
  const t = createTranslator(locale).t;
  return render(
    <ProductShowcase
      t={t}
      variant={variant}
      eyebrow={t("electricalProducts.eyebrow")}
      heading={t("electricalProducts.heading")}
      intro={t("electricalProducts.intro")}
      note={t("electricalProducts.note")}
      headingId="equipment-heading"
    />,
  );
}

describe("ProductShowcase", () => {
  for (const variant of ["marquee", "grid"] as const) {
    it(`renders every product name and rating in the initial HTML (${variant})`, () => {
      const t = createTranslator("en").t;
      const { container } = setup(variant);
      for (const product of ELECTRICAL_PRODUCTS) {
        expect(screen.getAllByText(t(product.nameKey)).length).toBeGreaterThan(
          0,
        );
        expect(screen.getAllByText(t(product.specKey)).length).toBeGreaterThan(
          0,
        );
      }
      // The visible set carries a real image description, not an empty alt.
      const described = container.querySelectorAll("img[alt]:not([alt=''])");
      expect(described.length).toBe(ELECTRICAL_PRODUCTS.length);
    });

    it(`labels the section with its heading (${variant})`, () => {
      setup(variant);
      const heading = screen.getByRole("heading", {
        name: createTranslator("en").t("electricalProducts.heading"),
      });
      expect(heading).toHaveAttribute("id", "equipment-heading");
    });
  }

  it("marks the marquee's duplicate set decorative", () => {
    const { container } = setup("marquee");
    const sets = container.querySelectorAll(".product-set");
    expect(sets).toHaveLength(2);
    expect(sets[0]).not.toHaveAttribute("aria-hidden");
    expect(sets[1]).toHaveAttribute("aria-hidden", "true");

    // The duplicate's images must be decorative too: `aria-hidden` on the list
    // hides them from the accessibility tree, but an `alt` that names the
    // product would still be read by a crawler indexing image content.
    const duplicateImages = sets[1]!.querySelectorAll("img");
    expect(duplicateImages.length).toBe(ELECTRICAL_PRODUCTS.length);
    for (const image of duplicateImages) {
      expect(image).toHaveAttribute("alt", "");
    }
  });

  it("does not duplicate the set in the grid variant", () => {
    const { container } = setup("grid");
    expect(container.querySelectorAll(".product-set")).toHaveLength(0);
    expect(container.querySelectorAll(".product-tile")).toHaveLength(
      ELECTRICAL_PRODUCTS.length,
    );
  });

  it("uses the electrical accent scope class on the grid", () => {
    const { container } = setup("grid");
    expect(container.querySelector(".product-grid")).not.toBeNull();
  });

  it("renders localized copy for French", () => {
    const t = createTranslator("fr").t;
    setup("grid", "fr");
    expect(
      screen.getByRole("heading", { name: t("electricalProducts.heading") }),
    ).toBeInTheDocument();
    const first = ELECTRICAL_PRODUCTS[0]!;
    expect(screen.getAllByText(t(first.nameKey)).length).toBeGreaterThan(0);
  });
});

/**
 * The grid reveal is driven by `ScrollReveal`, which needs a browser observer.
 * The property asserted here is the crawlability contract: with no observer —
 * the crawler and no-JavaScript case — no `data-reveal` attribute is written, so
 * the CSS resting state (fully visible) applies.
 */
describe("ProductShowcase grid reveal", () => {
  it("adds no reveal attribute when IntersectionObserver is absent", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { container } = setup("grid");
    expect(container.querySelectorAll("[data-reveal]")).toHaveLength(0);
    vi.unstubAllGlobals();
  });
});
