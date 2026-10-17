import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Header cart action.
 *
 * The header is statically rendered and cannot read the cart cookie, so this
 * island fills the badge from `/api/cart/summary`. These assertions pin the two
 * behaviours that make that safe:
 *
 *   - the link is real markup in the first render (a crawler and a no-JavaScript
 *     visitor get a working cart link, just without the count), and
 *   - the count and the department-specific href arrive once the fetch resolves.
 *
 * The summary store is module-level, so each test re-imports the modules after
 * `resetModules` to start from a clean store.
 */

const pathname = vi.fn(() => "/en");
vi.mock("next/navigation", () => ({
  usePathname: () => pathname(),
}));

const mockFetch = vi.fn();

beforeEach(() => {
  vi.resetModules();
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
  pathname.mockReturnValue("/en");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function renderCart() {
  const { CartAction } = await import("@/components/layout/CartAction");
  return render(<CartAction locale="en" />);
}

describe("CartAction", () => {
  it("renders a working cart link before the summary resolves", async () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    await renderCart();

    const link = screen.getByRole("link", { name: "View cart" });
    // No department is known yet, so the link falls back to the default store.
    expect(link).toHaveAttribute("href", "/en/digital-marketing/store/cart");
  });

  it("shows the item count and the cart's own department once fetched", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        itemCount: 3,
        href: "/en/electrical-services/store/cart",
      }),
    });
    await renderCart();

    const link = await screen.findByRole("link", { name: /View cart/ });
    await waitFor(() =>
      expect(link).toHaveAttribute(
        "href",
        "/en/electrical-services/store/cart",
      ),
    );
    expect(link).toHaveAccessibleName("View cart — 3 items");
    // The visible badge is the same number, and it is decorative.
    const badge = screen.getByText("3");
    expect(badge).toHaveAttribute("aria-hidden", "true");
  });

  it("reflects a count published by an add-to-cart without a navigation", async () => {
    // A pending fetch means nothing overwrites the published value.
    mockFetch.mockReturnValue(new Promise(() => {}));
    const { setCartSummary } = await import("@/lib/hooks/use-cart-summary");
    setCartSummary({ itemCount: 5 });

    await renderCart();

    expect(
      screen.getByRole("link", { name: "View cart — 5 items" }),
    ).toBeInTheDocument();
  });

  it("hides the badge when the cart is empty", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ itemCount: 0, href: null }),
    });
    await renderCart();

    expect(screen.getByRole("link", { name: "View cart" })).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
