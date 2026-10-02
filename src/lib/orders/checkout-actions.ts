"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSiteUrl } from "@/lib/config/env";
import { STORE_PATH } from "@/lib/config/navigation";
import { getAuthState } from "@/lib/auth/session";
import { checkRateLimit, clientKeyFrom } from "@/lib/security/rate-limit";
import { recordAudit } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getCartByToken,
  readCartToken,
  clearCartToken,
} from "@/lib/store/cart";
import {
  checkoutSchema,
  toCheckoutFieldErrors,
  type CheckoutState,
} from "@/lib/validation/checkout";
import {
  initiatePayment,
  transactionReferenceFor,
} from "@/lib/payments/service";
import { formatPrice } from "@/lib/store/types";
import { sendOrderConfirmation } from "@/lib/email/send";
import { readOrderTokens, rememberOrderToken } from "./tokens";
import { buildPlaceOrderArgs } from "./place-order-args";

/**
 * Checkout Server Actions.
 *
 * The order of operations matters and is deliberate:
 *
 *   1. **Validate** the form. No money or stock value is in the payload.
 *   2. **Rate limit**, so checkout cannot be used to hammer the provider.
 *   3. **Place the order** through the `place_order` database function, which
 *      re-reads every price from the catalogue, takes stock conditionally (so two
 *      concurrent checkouts cannot oversell), computes the totals, and converts
 *      the cart — all in one transaction.
 *   4. **Initiate payment**, which records an attempt and, for a provider method,
 *      returns a hosted-page link. The order is *not* paid here, and cannot be:
 *      confirmation arrives only from a verified provider callback.
 *
 * A failure at step 4 leaves a valid `pending_payment` order, which is the
 * correct outcome — the customer can retry payment without re-ordering.
 */

const RATE_LIMIT = { limit: 10, windowSeconds: 600 } as const;

/**
 * Delivery fee.
 *
 * The brief supplies no delivery price list, so this is a flat zero rather than
 * invented per-zone pricing. It is server-side logic, not a client value, so a
 * caller cannot choose a cheaper zone. When the business provides a real
 * schedule this constant is the single place to change.
 */
const DELIVERY_FEE_MINOR = 0;

export async function submitCheckout(
  _previous: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const parsed = checkoutSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    locale: formData.get("locale") ?? "en",
    fulfillment: formData.get("fulfillment") ?? "delivery",
    paymentMethod: formData.get("paymentMethod"),
    deliveryAddressLine1: formData.get("deliveryAddressLine1") ?? undefined,
    deliveryAddressLine2: formData.get("deliveryAddressLine2") ?? undefined,
    deliveryCity: formData.get("deliveryCity") ?? undefined,
    deliveryRegion: formData.get("deliveryRegion") ?? undefined,
    deliveryNotes: formData.get("deliveryNotes") ?? undefined,
    idempotencyKey: formData.get("idempotencyKey"),
    consent: formData.get("consent") === "on",
  });

  if (!parsed.success) {
    return {
      status: "invalid",
      errors: toCheckoutFieldErrors(parsed.error.issues),
    };
  }

  const input = parsed.data;
  const requestHeaders = await headers();

  const rate = checkRateLimit(
    clientKeyFrom(requestHeaders, "checkout"),
    RATE_LIMIT,
  );
  if (!rate.allowed) return { status: "rate_limited" };

  const admin = createAdminClient();
  if (!admin) return { status: "unconfigured" };

  // The cart comes from the token cookie, never from the request body. That is
  // what makes the line items and their prices trustworthy.
  const token = await readCartToken();
  if (!token) return { status: "empty_cart" };

  const cart = await getCartByToken(token);
  if (!cart || cart.lines.length === 0) return { status: "empty_cart" };

  const authState = await getAuthState();
  const customerId =
    authState.status === "authenticated" ? authState.userId : null;

  const deliveryMinor = input.fulfillment === "pickup" ? 0 : DELIVERY_FEE_MINOR;

  // Every optional argument is sent as an explicit `null` rather than `undefined`
  // by this builder: supabase-js drops `undefined` keys from the request body,
  // and PostgREST resolves an RPC by the exact set of named arguments it
  // receives, so an omitted key makes it look for a different overload.
  //
  // The cast is needed because the generated types describe a function argument
  // as its base type (`string`), not as nullable. PostgreSQL function arguments
  // accept null regardless, and `place_order` is written to receive it.
  const { data: orderData, error: orderError } = await admin.rpc(
    "place_order",
    buildPlaceOrderArgs({
      input,
      cartId: cart.id,
      customerId,
      deliveryMinor,
    }) as never,
  );

  if (orderError || !orderData) {
    // The database raises specific messages for the two conditions a customer can
    // act on, so they are surfaced rather than collapsed into a generic error.
    const message = orderError?.message ?? "";
    if (message.includes("Insufficient stock")) {
      const slug = message.split("Insufficient stock for ")[1] ?? "";
      return { status: "out_of_stock", item: slug.trim() };
    }
    if (
      message.includes("no longer purchasable") ||
      message.includes("Cart is empty") ||
      message.includes("not available for checkout")
    ) {
      return { status: "empty_cart" };
    }
    return { status: "error" };
  }

  // `place_order` returns the order row as JSON.
  const order = orderData as unknown as {
    id: string;
    reference: string;
    total_minor: number;
    currency: string;
    access_token: string;
  };

  // The cart is spent. Clearing the cookie stops the customer's next visit
  // showing a basket that is already an order.
  await clearCartToken();
  // Remember the order token so a guest can return to their order history
  // without an account.
  await rememberOrderToken(order.reference, order.access_token);

  await recordAudit({
    actorId: customerId,
    action: "payment_state_changed",
    entityType: "order",
    entityId: order.reference,
    metadata: {
      outcome: "order_placed",
      method: input.paymentMethod,
      fulfillment: input.fulfillment,
      locale: input.locale,
    },
  });

  const txRef = transactionReferenceFor(order.reference);
  // Keyed on the checkout key so a resubmitted checkout resumes the same payment
  // attempt instead of creating a second charge.
  const paymentIdempotencyKey = `pay-${input.idempotencyKey}`;

  // Confirm receipt to the customer before handing off to the payment page. The
  // email states the order is awaiting payment, not that it is paid — payment is
  // confirmed only by the verified provider callback. A failed send is logged and
  // does not block checkout: the order is already stored and the customer must
  // still reach the payment page.
  const confirmation = await sendOrderConfirmation({
    reference: order.reference,
    email: input.email,
    fullName: input.fullName,
    totalFormatted: formatPrice(
      order.total_minor,
      order.currency,
      input.locale,
    ),
    locale: input.locale,
  });
  if (!confirmation.ok) {
    console.error(
      `[email] order ${order.reference} confirmation not sent: ${confirmation.error}`,
    );
  }

  const payment = await initiatePayment({
    orderId: order.id,
    amountMinor: order.total_minor,
    currency: order.currency,
    method: input.paymentMethod,
    txRef,
    idempotencyKey: paymentIdempotencyKey,
    customerEmail: input.email,
    customerName: input.fullName,
    customerPhone: input.phone || undefined,
    redirectUrl: new URL(
      `/api/payments/return?tx_ref=${encodeURIComponent(txRef)}`,
      getSiteUrl(),
    ).toString(),
    narration: `KC Technology Corporation order ${order.reference}`,
  });

  revalidatePath(`/${input.locale}${STORE_PATH}/cart`);
  revalidatePath(`/${input.locale}${STORE_PATH}/orders`);

  // Hand the browser to the next page from the server.
  //
  // Placing the order clears the cart cookie, which makes the checkout route
  // re-render into its empty-cart branch before a client-side effect on the form
  // could navigate. The form is unmounted by that re-render, so `redirect` here —
  // which Next.js turns into the action's response — is the reliable hop.
  const orderPath = `/${input.locale}${STORE_PATH}/orders/${encodeURIComponent(order.reference)}`;

  // A hosted payment page is the next step when the provider returned one.
  if (payment.ok && payment.kind === "redirect") {
    redirect(payment.link);
  }

  // A provider failure, a bank transfer or a pending mobile-money charge: the
  // confirmation page explains the actual state and offers a retry.
  redirect(orderPath);
}

/**
 * Retry payment for an existing order.
 *
 * Safe by three properties:
 *
 *   * the amount is re-read from the order, never taken from the client;
 *   * ownership is proved by the order's own `access_token` (held in the guest
 *     cookie) or the signed-in `customer_id`, so a guessed reference cannot be
 *     used to pay — or probe — someone else's order;
 *   * it refuses unless the order is still `pending_payment`, which stops it
 *     being a way to create a second charge for a settled or cancelled order.
 *
 * The token is read from the cookie rather than accepted as an argument, so it
 * does not travel through the client.
 */
export async function retryPaymentAction(input: {
  orderReference: string;
}): Promise<
  | { ok: true; link: string }
  | { ok: true; manual: true }
  | { ok: true; pending: true }
  | { ok: false; error: string }
> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "unconfigured" };

  const authState = await getAuthState();
  const customerId =
    authState.status === "authenticated" ? authState.userId : null;

  const { data: order } = await admin
    .from("orders")
    .select(
      "id, reference, status, total_minor, currency, email, full_name, phone, payment_method, access_token, customer_id",
    )
    .eq("reference", input.orderReference)
    .maybeSingle();

  if (!order) return { ok: false, error: "not_found" };

  // Ownership. A signed-in customer matches on id; a guest must hold the token
  // remembered in their cookie. The reference alone is never sufficient.
  let ownsIt: boolean;
  if (customerId) {
    ownsIt = order.customer_id === customerId;
  } else {
    const tokens = await readOrderTokens();
    const remembered = tokens.find(
      (entry) => entry.reference === order.reference,
    );
    ownsIt = Boolean(remembered && remembered.token === order.access_token);
  }

  if (!ownsIt) return { ok: false, error: "forbidden" };

  // Nothing to pay: a settled, cancelled or refunded order must not be charged.
  if (order.status !== "pending_payment") {
    return { ok: false, error: "not_payable" };
  }

  const method = order.payment_method;
  if (!method) return { ok: false, error: "no_method" };

  const txRef = transactionReferenceFor(order.reference);
  const idempotencyKey = `retry-${order.reference}-${Date.now()}`;

  const payment = await initiatePayment({
    orderId: order.id,
    amountMinor: order.total_minor,
    currency: order.currency,
    method: method as
      | "card"
      | "mobile_money_mtn"
      | "mobile_money_orange"
      | "bank_transfer",
    txRef,
    idempotencyKey,
    customerEmail: order.email,
    customerName: order.full_name,
    customerPhone: order.phone ?? undefined,
    redirectUrl: new URL(
      `/api/payments/return?tx_ref=${encodeURIComponent(txRef)}`,
      getSiteUrl(),
    ).toString(),
    narration: `KC Technology Corporation order ${order.reference}`,
  });

  if (!payment.ok) return { ok: false, error: payment.error };
  if (payment.kind === "manual") return { ok: true, manual: true };
  if (payment.kind === "redirect") return { ok: true, link: payment.link };
  // Mobile money: the customer approves on their handset, so there is no link.
  return { ok: true, pending: true };
}
