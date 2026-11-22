import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CartLines } from "./CartLines";
import type { Cart } from "@/lib/store/cart";
import { updateCartItemAction } from "@/lib/store/cart-actions";

vi.mock("@/lib/store/cart-actions", () => ({
  removeCartItemAction: vi.fn(),
  updateCartItemAction: vi.fn(),
}));

const updateQuantity = vi.mocked(updateCartItemAction);

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

describe("CartLines quantity control after editing the field", () => {
  // The field used to be `defaultValue`. React stops writing to an input once the
  // customer has typed into it, so pressing +/- afterwards sent the correct
  // quantity to the server but left the field showing the previous number: the
  // cart changed and the screen did not. Typing then clicking is the ordinary
  // way to order two of something, so this is the regression that matters.
  beforeEach(() => {
    updateQuantity.mockReset();
  });

  it("shows the incremented value after the field was typed into", async () => {
    render(<CartLines cart={cart} locale="en" />);
    const input = screen.getByLabelText("Quantity") as HTMLInputElement;
    const increase = screen.getByRole("button", {
      name: "Increase quantity for HP EliteBook 840 G9",
    });

    fireEvent.change(input, { target: { value: "3" } });
    expect(input.value).toBe("3");

    // The control is disabled while the Server Action is in flight, so wait for
    // it to settle before pressing it.
    await waitFor(() => expect(increase.hasAttribute("disabled")).toBe(false));
    fireEvent.click(increase);
    expect(input.value).toBe("4");
  });

  it("shows the decremented value after the field was typed into", async () => {
    render(<CartLines cart={cart} locale="en" />);
    const input = screen.getByLabelText("Quantity") as HTMLInputElement;
    const decrease = screen.getByRole("button", {
      name: "Decrease quantity for HP EliteBook 840 G9",
    });

    fireEvent.change(input, { target: { value: "4" } });
    await waitFor(() => expect(decrease.hasAttribute("disabled")).toBe(false));
    fireEvent.click(decrease);
    expect(input.value).toBe("3");
  });

  it("sends the quantity the button press produced, not the typed one", async () => {
    render(<CartLines cart={cart} locale="en" />);
    const input = screen.getByLabelText("Quantity") as HTMLInputElement;
    const increase = screen.getByRole("button", {
      name: "Increase quantity for HP EliteBook 840 G9",
    });

    fireEvent.change(input, { target: { value: "2" } });
    await waitFor(() => expect(increase.hasAttribute("disabled")).toBe(false));
    fireEvent.click(increase);
    // 2 typed -> 3 on screen -> the action is told 3.
    expect(updateQuantity).toHaveBeenLastCalledWith(
      expect.objectContaining({ itemId: "line-1", quantity: 3 }),
    );
  });

  it("restores the cart quantity when the field is left blank", () => {
    render(<CartLines cart={cart} locale="en" />);
    const input = screen.getByLabelText("Quantity") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(input.value).toBe("2");
  });

  it("adopts a quantity that arrives from the server", () => {
    const { rerender } = render(<CartLines cart={cart} locale="en" />);
    const input = screen.getByLabelText("Quantity") as HTMLInputElement;
    expect(input.value).toBe("2");

    const updated: Cart = {
      ...cart,
      lines: [{ ...cart.lines[0]!, quantity: 4 }],
    };
    rerender(<CartLines cart={updated} locale="en" />);
    expect(
      (screen.getByLabelText("Quantity") as HTMLInputElement).value,
    ).toBe("4");
  });
});
