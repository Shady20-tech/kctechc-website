import { describe, expect, it } from "vitest";

import type { CheckoutInput } from "@/lib/validation/checkout";
import { buildPlaceOrderArgs } from "./place-order-args";

/**
 * Every parameter `place_order` accepts. PostgREST resolves an RPC by the exact
 * set of named arguments it receives, so a builder that omits an optional key
 * makes PostgREST look for a different overload and fail with PGRST202 before the
 * database is ever reached. That is how checkout silently failed.
 */
const ALL_PLACE_ORDER_PARAMS = [
  "p_idempotency_key",
  "p_cart_id",
  "p_customer_id",
  "p_email",
  "p_full_name",
  "p_phone",
  "p_locale",
  "p_fulfillment",
  "p_payment_method",
  "p_delivery_address_line1",
  "p_delivery_address_line2",
  "p_delivery_city",
  "p_delivery_region_id",
  "p_delivery_notes",
  "p_delivery_minor",
] as const;

const base = {
  fullName: "Awa Nkeng",
  email: "awa@example.com",
  locale: "en",
  paymentMethod: "bank_transfer",
  idempotencyKey: "key-1",
  consent: true,
} as const;

function input(overrides: Partial<CheckoutInput> = {}): CheckoutInput {
  return {
    ...base,
    fulfillment: "delivery",
    deliveryAddressLine1: "12 Rue Bonanjo",
    deliveryCity: "Douala",
    ...overrides,
  } as CheckoutInput;
}

function build(overrides: Partial<CheckoutInput> = {}, customerId: string | null = null) {
  return buildPlaceOrderArgs({
    input: input(overrides),
    cartId: "cart-1",
    customerId,
    deliveryMinor: 0,
  });
}

describe("buildPlaceOrderArgs", () => {
  it("always sends every place_order parameter", () => {
    const args = build();
    expect(Object.keys(args).sort()).toEqual([...ALL_PLACE_ORDER_PARAMS].sort());
  });

  it("uses null, never undefined, for values the customer did not supply", () => {
    // `undefined` would be dropped by supabase-js, shrinking the argument set and
    // reintroducing the overload-resolution failure.
    const args = build({ phone: undefined, deliveryAddressLine2: undefined, deliveryNotes: undefined });
    for (const [key, value] of Object.entries(args)) {
      expect(value, `${key} must not be undefined`).not.toBeUndefined();
    }
    expect(Object.keys(args).sort()).toEqual([...ALL_PLACE_ORDER_PARAMS].sort());
  });

  it("keeps the argument set identical for a guest and a signed-in customer", () => {
    const guest = build({}, null);
    const signedIn = build({}, "user-1");
    expect(Object.keys(guest)).toEqual(Object.keys(signedIn));
    expect(guest.p_customer_id).toBeNull();
    expect(signedIn.p_customer_id).toBe("user-1");
  });

  it("clears the delivery address for a pickup order", () => {
    const args = build({
      fulfillment: "pickup",
      deliveryAddressLine1: "12 Rue Bonanjo",
      deliveryAddressLine2: "Etage 2",
      deliveryCity: "Douala",
    });
    expect(args.p_delivery_address_line1).toBeNull();
    expect(args.p_delivery_address_line2).toBeNull();
    expect(args.p_delivery_city).toBeNull();
  });

  it("keeps the delivery address for a delivery order", () => {
    const args = build();
    expect(args.p_delivery_address_line1).toBe("12 Rue Bonanjo");
    expect(args.p_delivery_city).toBe("Douala");
  });

  it("passes the cart id, payment method and delivery fee straight through", () => {
    const args = buildPlaceOrderArgs({
      input: input({ paymentMethod: "mobile_money_orange" }),
      cartId: "cart-42",
      customerId: null,
      deliveryMinor: 1500,
    });
    expect(args.p_cart_id).toBe("cart-42");
    expect(args.p_payment_method).toBe("mobile_money_orange");
    expect(args.p_delivery_minor).toBe(1500);
    expect(args.p_idempotency_key).toBe("key-1");
    expect(args.p_email).toBe("awa@example.com");
  });
});
