import type { Locale } from "@/lib/i18n/locales";

/**
 * Order and payment contracts.
 *
 * These mirror the Postgres enums exactly; `orders.test.ts` asserts the two
 * agree, because a drift would typecheck and then fail at runtime on a value the
 * database rejects.
 */

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "processing"
  | "fulfilled"
  | "cancelled"
  | "refunded";

export type PaymentStatus =
  | "pending"
  | "requires_action"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "refunded"
  | "manual_pending";

export type PaymentMethod =
  | "card"
  | "mobile_money_mtn"
  | "mobile_money_orange"
  | "bank_transfer"
  | "cash_on_confirmation";

export type FulfillmentMethod = "delivery" | "pickup";

export const ORDER_STATUSES: readonly OrderStatus[] = [
  "pending_payment",
  "paid",
  "processing",
  "fulfilled",
  "cancelled",
  "refunded",
];

export const PAYMENT_STATUSES: readonly PaymentStatus[] = [
  "pending",
  "requires_action",
  "succeeded",
  "failed",
  "cancelled",
  "refunded",
  "manual_pending",
];

/**
 * Payment intents a customer may choose today.
 *
 * The site takes no payment itself: an order records the customer's intended
 * method and the business contacts them to finalise it. All four are therefore
 * *intent*, confirmed by a human afterwards.
 *
 * `card` is deliberately not offered — the business settles by mobile money,
 * bank transfer or an agreed arrangement. It stays in `PaymentMethod` because the
 * database enum still contains it and a legacy order must remain readable;
 * removing a value from a live enum would be a destructive migration for no
 * gain. The checkout schema accepts only the four below.
 */
export const PAYMENT_METHODS = [
  "cash_on_confirmation",
  "mobile_money_mtn",
  "mobile_money_orange",
  "bank_transfer",
] as const satisfies readonly PaymentMethod[];

/** The methods a customer may choose today, as a narrow union. */
export type OfferedPaymentMethod = (typeof PAYMENT_METHODS)[number];

export const FULFILLMENT_METHODS: readonly FulfillmentMethod[] = [
  "delivery",
  "pickup",
];

/**
 * The legal transitions, mirrored from `order_transition_allowed` in SQL.
 *
 * Duplicated deliberately: the SQL function is the enforcement, and this copy
 * lets the admin UI offer only the moves that will succeed. `orders.test.ts`
 * asserts the two agree, so the UI cannot offer a transition the database
 * rejects.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_payment: ["paid", "cancelled"],
  paid: ["processing", "fulfilled", "refunded", "cancelled"],
  processing: ["fulfilled", "refunded", "cancelled"],
  fulfilled: ["refunded"],
  cancelled: [],
  refunded: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Narrow an arbitrary string to an order status, for query params. */
export function isOrderStatus(value: string): value is OrderStatus {
  return ORDER_STATUSES.includes(value as OrderStatus);
}

/** A status is terminal when nothing can follow it. */
export function isTerminalStatus(status: OrderStatus): boolean {
  return ORDER_TRANSITIONS[status]?.length === 0;
}

/**
 * The transitions a staff member may apply, for rendering the admin select.
 *
 * `paid` is excluded: it is reached only through `recordManualPayment`, which
 * also writes the payment row. This lives here rather than in the `"use server"`
 * action module because a plain function cannot be exported from a Server Action
 * file — Next.js would try to turn it into an endpoint and the build would fail.
 */
export function staffTransitions(current: OrderStatus): readonly OrderStatus[] {
  return ORDER_TRANSITIONS[current].filter((status) => status !== "paid");
}

/** True when money has been received, whatever else happened. */
export function isPaidStatus(status: OrderStatus): boolean {
  return status === "paid" || status === "processing" || status === "fulfilled";
}

/**
 * Whether a GA4 `purchase` event should fire for this order.
 *
 * Only from a paid state. Firing at order creation would report revenue that was
 * never collected — a `pending_payment` order may be abandoned or fail — making
 * the conversion figure a lie. Every paid state qualifies, and the caller keys
 * the event on the order reference so it fires once per order however many times
 * the confirmation page is viewed.
 */
export function shouldTrackPurchase(status: OrderStatus): boolean {
  return isPaidStatus(status);
}

export type OrderLine = {
  id: string;
  productId: string | null;
  title: string;
  sku: string;
  slug: string;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
  currency: string;
};

export type OrderPayment = {
  id: string;
  status: PaymentStatus;
  method: PaymentMethod;
  amountMinor: number;
  currency: string;
  providerReference: string | null;
  failureReason: string | null;
  createdAt: string;
};

export type Order = {
  id: string;
  reference: string;
  status: OrderStatus;
  email: string;
  fullName: string;
  phone: string | null;
  locale: Locale;
  currency: string;
  fulfillment: FulfillmentMethod;
  deliveryAddressLine1: string | null;
  deliveryAddressLine2: string | null;
  deliveryCity: string | null;
  deliveryNotes: string | null;
  subtotalMinor: number;
  deliveryMinor: number;
  totalMinor: number;
  paidMinor: number;
  paymentMethod: PaymentMethod | null;
  manualPaymentReference: string | null;
  placedAt: string;
  paidAt: string | null;
  lines: OrderLine[];
  payments: OrderPayment[];
};

/** A compact order for lists (history, admin table), without lines. */
export type OrderSummary = Omit<Order, "lines" | "payments"> & {
  itemCount: number;
};
