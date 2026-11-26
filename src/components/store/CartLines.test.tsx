import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CartLines } from "./CartLines";
import type { Cart } from "@/lib/store/cart";

vi.mock("@/lib/store/cart-actions", () => ({
  removeCartItemAction: vi.fn(),
  updateCartItemAction: vi.fn(),
}));

const cart: Cart = {
  id: "cart-1",
  token: "token-1",
  currency: "XAF",
  itemCount: 2,
  subtotalMinor: 1_370_000,
  lines: [
    {
      id: "line-1",
      productId: "p-1",
      sku: "KC-HP-840G9",
      slug: "hp-elitebook-840-g9",
      departmentSlug: "digital-marketing",
      categorySlug: "computers-and-accessories",
      title: "HP EliteBook 840 G9",
      quantity: 2,
      unitPriceMinor: 685_000,
      currency: "XAF",
      currentPriceMinor: 685_000,
      stock: 5,
      imagePath: null,
    },
  ],
};

describe("CartLines", () => {
  it("renders one line per cart entry with its title", () => {
    render(<CartLines cart={cart} locale="en" />);
    expect(
      screen.getByRole("link", { name: "HP EliteBook 840 G9" }),
    ).toBeTruthy();
  });

  it("gives every quantity control a name that includes the product", () => {
    render(<CartLines cart={cart} locale="en" />);
    expect(
      screen.getByRole("button", {
        name: "Decrease quantity for HP EliteBook 840 G9",
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: "Increase quantity for HP EliteBook 840 G9",
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: "Remove HP EliteBook 840 G9 from your cart",
      }),
    ).toBeTruthy();
  });

  it("uses 44px touch targets for the quantity and remove controls", () => {
    // A 28px control is below the touch-target guideline and is easy to miss on
    // a phone. The size lives in classes, so assert the classes rather than a
    // computed box that jsdom does not lay out.
    render(<CartLines cart={cart} locale="en" />);
    const controls = [
      screen.getByRole("button", {
        name: "Decrease quantity for HP EliteBook 840 G9",
      }),
      screen.getByRole("button", {
        name: "Increase quantity for HP EliteBook 840 G9",
      }),
      screen.getByRole("button", {
        name: "Remove HP EliteBook 840 G9 from your cart",
      }),
    ];
    for (const control of controls) {
      expect(control.className).toMatch(/\bh-11\b/);
      expect(control.className).toMatch(/\bw-11\b/);
    }
  });

  it("clamps the quantity input to the available stock", () => {
    render(<CartLines cart={cart} locale="en" />);
    const input = screen.getByLabelText("Quantity") as HTMLInputElement;
    expect(input.max).toBe("5");
    expect(input.min).toBe("1");
  });

  it("renders French labels when the locale is fr", () => {
    render(<CartLines cart={cart} locale="fr" />);
    expect(
      screen.getByRole("button", {
        name: "Retirer HP EliteBook 840 G9 de votre panier",
      }),
    ).toBeTruthy();
  });
});
