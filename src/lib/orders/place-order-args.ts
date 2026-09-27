import type { CheckoutInput } from "@/lib/validation/checkout";

/**
 * The database argument set for `place_order`.
 *
 * Kept apart from the Server Action so it can be unit-tested: a `"use server"`
 * module may only export async functions, so a plain builder cannot live there.
 *
 * Every optional parameter is passed as an explicit `null` rather than
 * `undefined`. supabase-js drops `undefined` keys when it serialises the request
 * body, and PostgREST resolves an RPC by the *exact set* of named arguments it
 * receives -- an omitted key makes it look for a different overload. Passing
 * `null` keeps the argument set identical no matter which optional fields the
 * customer filled in.
 */
export type PlaceOrderArgs = {
  p_idempotency_key: string;
  p_cart_id: string;
  p_customer_id: string | null;
  p_email: string;
  p_full_name: string;
  p_phone: string | null;
  p_locale: CheckoutInput["locale"];
  p_fulfillment: CheckoutInput["fulfillment"];
  p_payment_method: CheckoutInput["paymentMethod"];
  p_delivery_address_line1: string | null;
  p_delivery_address_line2: string | null;
  p_delivery_city: string | null;
  p_delivery_region_id: string | null;
  p_delivery_notes: string | null;
  p_delivery_minor: number;
};

export function buildPlaceOrderArgs({
  input,
  cartId,
  customerId,
  deliveryMinor,
}: {
  input: CheckoutInput;
  cartId: string;
  customerId: string | null;
  deliveryMinor: number;
}): PlaceOrderArgs {
  // A pickup order carries no delivery address: the address fields are cleared
  // rather than kept, so a collected order cannot claim a delivery destination.
  const delivered = input.fulfillment === "delivery";

  return {
    p_idempotency_key: input.idempotencyKey,
    p_cart_id: cartId,
    p_customer_id: customerId,
    p_email: input.email,
    p_full_name: input.fullName,
    p_phone: input.phone ?? null,
    p_locale: input.locale,
    p_fulfillment: input.fulfillment,
    p_payment_method: input.paymentMethod,
    p_delivery_address_line1: delivered ? (input.deliveryAddressLine1 ?? null) : null,
    p_delivery_address_line2: delivered ? (input.deliveryAddressLine2 ?? null) : null,
    p_delivery_city: delivered ? (input.deliveryCity ?? null) : null,
    p_delivery_region_id: null,
    p_delivery_notes: input.deliveryNotes ?? null,
    p_delivery_minor: deliveryMinor,
  };
}
