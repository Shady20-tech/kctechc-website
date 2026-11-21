import { describe, expect, it } from "vitest";
import { cartErrorMessage } from "./cart-error-messages";
import { createTranslator } from "@/lib/i18n/translator";

const t = createTranslator("en").t;

describe("cartErrorMessage", () => {
  it("maps out_of_stock to the stock message, not a retry prompt", () => {
    expect(cartErrorMessage("out_of_stock", t)).toBe("Out of stock");
  });

  it("maps unconfigured to an unavailable-ordering message", () => {
    const message = cartErrorMessage("unconfigured", t);
    expect(message).toMatch(/not available/i);
    // The defect this mapper exists to prevent: telling a visitor to retry a
    // fault that retrying cannot fix.
    expect(message).not.toMatch(/try again/i);
  });

  it("maps no_cart to an expired-cart message", () => {
    expect(cartErrorMessage("no_cart", t)).toMatch(/expired/i);
  });

  it("maps unavailable to a no-longer-available message", () => {
    expect(cartErrorMessage("unavailable", t)).toMatch(/no longer available/i);
  });

  it("falls back to a generic retry message for an unknown code", () => {
    expect(cartErrorMessage("something_new", t)).toMatch(/try again/i);
  });

  it("never returns a raw key", () => {
    for (const code of [
      "out_of_stock",
      "unavailable",
      "unconfigured",
      "no_cart",
      "unknown",
    ]) {
      const message = cartErrorMessage(code, t);
      expect(message).not.toContain("store.cart.");
      expect(message).not.toContain("errors.");
      expect(message.length).toBeGreaterThan(0);
    }
  });

  it("resolves every mapped key in French too", () => {
    const fr = createTranslator("fr").t;
    for (const code of ["unavailable", "unconfigured", "no_cart", "unknown"]) {
      const message = cartErrorMessage(code, fr);
      expect(message).not.toContain("store.cart.");
      expect(message.length).toBeGreaterThan(0);
    }
  });
});
