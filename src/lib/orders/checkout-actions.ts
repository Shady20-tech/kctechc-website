"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
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
import { formatPrice } from "@/lib/store/types";
import {
  sendOrderConfirmation,
  sendOrderNotificationToAdmin,
} from "@/lib/email/send";
import { createTranslator } from "@/lib/i18n/translator";
import type { Locale } from "@/lib/i18n/locales";
import { rememberOrderToken } from "./tokens";
import { buildPlaceOrderArgs } from "./place-order-args";

/**
 * Checkout Server Action.
 *
 * The site takes no payment. An order is placed, stored, and then emailed to the
 * business, who contact the customer to confirm it and finalise payment. The
 * order of operations is deliberate:
 *
 *   1. **Validate** the form. No money or stock value is in the payload.
 *   2. **Rate limit**, so checkout cannot be used to hammer the database or the
 *      mail provider.
 *   3. **Place the order** through the `place_order` database function, which
 *      re-reads every price from the catalogue, takes stock conditionally (so two
 *      concurrent checkouts cannot oversell), computes the totals, and converts
 *      the cart — all in one transaction. The chosen method is recorded as the
 *      customer's *intent*, not as a charge.
 *   4. **Notify**: confirm receipt to the customer, and send the order to the
 *      business so a human can act on it.
 *
 * A mail failure does not undo the order: the order is stored, and the customer's
 * confirmation page still shows it. The failure is logged so an operator knows to
 * watch the inbox.
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

  const totalFormatted = formatPrice(order.total_minor, order.currency, input.locale);
  const t = createTranslator(input.locale).t;

  // Confirm receipt to the customer. The email says the order is awaiting
  // confirmation, not that it is paid — nothing is charged on this site.
  const confirmation = await sendOrderConfirmation({
    reference: order.reference,
    email: input.email,
    fullName: input.fullName,
    totalFormatted,
    locale: input.locale,
  });
  if (!confirmation.ok) {
    console.error(
      `[email] order ${order.reference} confirmation not sent: ${confirmation.error}`,
    );
  }

  // The signal that an order needs a human. The customer's delivery details come
  // from the validated input; the line items and total come from the cart and the
  // order the database just computed — never from the request.
  const addressLines =
    input.fulfillment === "delivery"
      ? [
          input.deliveryAddressLine1,
          input.deliveryAddressLine2,
          input.deliveryCity,
          input.deliveryRegion,
        ].filter((line): line is string => Boolean(line && line.trim()))
      : [];

  const adminNotice = await sendOrderNotificationToAdmin({
    reference: order.reference,
    fullName: input.fullName,
    email: input.email,
    phone: input.phone ?? null,
    paymentMethodLabel: t(`paymentMethod.${input.paymentMethod}`),
    fulfillmentLabel: t(
      input.fulfillment === "pickup"
        ? "checkout.fulfillmentPickup"
        : "checkout.fulfillmentDelivery",
    ),
    addressLines,
    deliveryNote: input.deliveryNotes ?? null,
    items: cart.lines.map((line) => ({
      title: line.title,
      quantity: line.quantity,
      lineTotalFormatted: formatPrice(
        line.unitPriceMinor * line.quantity,
        order.currency,
        input.locale,
      ),
    })),
    totalFormatted,
    currency: order.currency,
    locale: input.locale as Locale,
    siteLocale: input.locale as Locale,
    placedAtFormatted: new Intl.DateTimeFormat(
      input.locale === "fr" ? "fr-CM" : "en-GB",
      { dateStyle: "long", timeStyle: "short" },
    ).format(new Date()),
  });
  if (!adminNotice.ok) {
    console.error(
      `[email] order ${order.reference} admin notification not sent: ${adminNotice.error}`,
    );
  }

  revalidatePath(`/${input.locale}${STORE_PATH}/cart`);
  revalidatePath(`/${input.locale}${STORE_PATH}/orders`);

  // Hand the browser to the confirmation page from the server.
  //
  // Placing the order clears the cart cookie, which makes the checkout route
  // re-render into its empty-cart branch before a client-side effect on the form
  // could navigate. The form is unmounted by that re-render, so `redirect` here —
  // which Next.js turns into the action's response — is the reliable hop.
  const orderPath = `/${input.locale}${STORE_PATH}/orders/${encodeURIComponent(order.reference)}`;
  redirect(orderPath);
}
