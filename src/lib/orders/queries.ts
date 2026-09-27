import "server-only";

import type { Locale } from "@/lib/i18n/locales";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLocale } from "@/lib/i18n/locales";
import type {
  FulfillmentMethod,
  Order,
  OrderLine,
  OrderPayment,
  OrderStatus,
  OrderSummary,
  PaymentMethod,
  PaymentStatus,
} from "./types";

/**
 * Order reads.
 *
 * All access goes through the service-role client, and every function that
 * returns an order for a *customer* takes the customer's id or email and filters
 * on it. That is deliberate belt-and-braces: the RLS policies on `orders` also
 * restrict a customer to their own rows, but these loaders are also called from
 * the admin surface (where the filter is the role check instead), so the filter
 * is applied explicitly rather than relied upon implicitly.
 *
 * There is no function here that writes. Orders are created by the `place_order`
 * database function and mutated by the state-machine functions, so no read-side
 * helper can accidentally become a second write path.
 */

const ORDER_SELECT = `
  id, reference, status, email, full_name, phone, locale, currency,
  fulfillment, delivery_address_line1, delivery_address_line2, delivery_city,
  delivery_notes, subtotal_minor, delivery_minor, total_minor, paid_minor,
  payment_method, manual_payment_reference, placed_at, paid_at, access_token
` as const;

type OrderQueryRow = {
  id: string;
  reference: string;
  status: string;
  email: string;
  full_name: string;
  phone: string | null;
  locale: string;
  currency: string;
  fulfillment: string;
  delivery_address_line1: string | null;
  delivery_address_line2: string | null;
  delivery_city: string | null;
  delivery_notes: string | null;
  subtotal_minor: number;
  delivery_minor: number;
  total_minor: number;
  paid_minor: number;
  payment_method: string | null;
  manual_payment_reference: string | null;
  placed_at: string;
  paid_at: string | null;
  access_token: string;
};

function toOrderBase(row: OrderQueryRow): Omit<Order, "lines" | "payments"> {
  return {
    id: row.id,
    reference: row.reference,
    status: row.status as OrderStatus,
    email: row.email,
    fullName: row.full_name,
    phone: row.phone,
    locale: (isLocale(row.locale) ? row.locale : "en") as Locale,
    currency: row.currency,
    fulfillment: row.fulfillment as FulfillmentMethod,
    deliveryAddressLine1: row.delivery_address_line1,
    deliveryAddressLine2: row.delivery_address_line2,
    deliveryCity: row.delivery_city,
    deliveryNotes: row.delivery_notes,
    subtotalMinor: row.subtotal_minor,
    deliveryMinor: row.delivery_minor,
    totalMinor: row.total_minor,
    paidMinor: row.paid_minor,
    paymentMethod: (row.payment_method as PaymentMethod | null) ?? null,
    manualPaymentReference: row.manual_payment_reference,
    placedAt: row.placed_at,
    paidAt: row.paid_at,
  };
}

async function loadLines(orderId: string): Promise<OrderLine[]> {
  const admin = createAdminClient();
  if (!admin) return [];

  const { data } = await admin
    .from("order_items")
    .select(
      "id, product_id, title, sku, slug, quantity, unit_price_minor, line_total_minor, currency",
    )
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  return (data ?? []).map((row) => ({
    id: row.id,
    productId: row.product_id,
    title: row.title,
    sku: row.sku,
    slug: row.slug,
    quantity: row.quantity,
    unitPriceMinor: row.unit_price_minor,
    // `line_total_minor` is a generated column, so the type system sees it as
    // nullable; the arithmetic mirrors the generated expression for the fallback.
    lineTotalMinor: row.line_total_minor ?? row.unit_price_minor * row.quantity,
    currency: row.currency,
  }));
}

async function loadPayments(orderId: string): Promise<OrderPayment[]> {
  const admin = createAdminClient();
  if (!admin) return [];

  const { data } = await admin
    .from("payments")
    .select(
      "id, status, method, amount_minor, currency, provider_reference, failure_reason, created_at",
    )
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id,
    status: row.status as PaymentStatus,
    method: row.method as PaymentMethod,
    amountMinor: row.amount_minor,
    currency: row.currency,
    providerReference: row.provider_reference,
    failureReason: row.failure_reason,
    createdAt: row.created_at,
  }));
}

async function hydrate(row: OrderQueryRow): Promise<Order> {
  const [lines, payments] = await Promise.all([
    loadLines(row.id),
    loadPayments(row.id),
  ]);
  return { ...toOrderBase(row), lines, payments };
}

/**
 * An order by reference, for the customer who owns it.
 *
 * Two ways to prove ownership, and both are required to be non-empty:
 *
 *   * a signed-in customer, matched on `customer_id`; or
 *   * a guest holding the order's `access_token`, a 64-character random value
 *     minted when the order was placed.
 *
 * The human-readable reference is NOT sufficient on its own. It is six
 * characters from a 32-symbol alphabet — around a billion values for a known
 * date — so it is enumerable, and it is also printed on receipts and read out
 * over the phone. Treating it as a bearer credential would let anyone who saw a
 * receipt read that customer's name, address and phone number. The token is the
 * credential; the reference is only a label.
 */
export async function getOrderForOwner(input: {
  reference: string;
  customerId: string | null;
  accessToken: string | null;
}): Promise<Order | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  let query = admin
    .from("orders")
    .select(ORDER_SELECT)
    .eq("reference", input.reference);

  if (input.customerId) {
    query = query.eq("customer_id", input.customerId);
  } else if (input.accessToken) {
    query = query.eq("access_token", input.accessToken);
  } else {
    // No way to prove ownership: return nothing rather than the order.
    return null;
  }

  const { data } = await query.maybeSingle();
  if (!data) return null;
  return hydrate(data as OrderQueryRow);
}

/** Any order by reference. For the admin surface and the webhook handler only. */
export async function getOrderByReference(
  reference: string,
): Promise<Order | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  const { data } = await admin
    .from("orders")
    .select(ORDER_SELECT)
    .eq("reference", reference)
    .maybeSingle();

  if (!data) return null;
  return hydrate(data as OrderQueryRow);
}

/** Any order by id. Used by the payment flow, which holds the id from checkout. */
export async function getOrderById(orderId: string): Promise<Order | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  const { data } = await admin
    .from("orders")
    .select(ORDER_SELECT)
    .eq("id", orderId)
    .maybeSingle();

  if (!data) return null;
  return hydrate(data as OrderQueryRow);
}

/**
 * Every order belonging to a signed-in customer, newest first.
 *
 * Guest orders are absent by design: there is no account to hang them on, and
 * matching by email alone would let two people who share a mailbox read each
 * other's orders.
 */
export async function listOrdersForCustomer(
  customerId: string,
): Promise<OrderSummary[]> {
  const admin = createAdminClient();
  if (!admin) return [];

  const { data } = await admin
    .from("orders")
    .select(`${ORDER_SELECT}, order_items (quantity)`)
    .eq("customer_id", customerId)
    .order("placed_at", { ascending: false })
    .limit(100);

  return (data ?? []).map((row) => {
    const record = row as OrderQueryRow & {
      order_items?: { quantity: number }[];
    };
    const itemCount = (record.order_items ?? []).reduce(
      (total, item) => total + item.quantity,
      0,
    );
    return { ...toOrderBase(record), itemCount };
  });
}

/** Recent orders for the admin surface, optionally filtered by status. */
export async function listOrdersForAdmin(options: {
  status?: OrderStatus;
  limit?: number;
}): Promise<OrderSummary[]> {
  const admin = createAdminClient();
  if (!admin) return [];

  let query = admin
    .from("orders")
    .select(`${ORDER_SELECT}, order_items (quantity)`)
    .order("placed_at", { ascending: false })
    .limit(options.limit ?? 100);

  if (options.status) query = query.eq("status", options.status);

  const { data } = await query;

  return (data ?? []).map((row) => {
    const record = row as OrderQueryRow & {
      order_items?: { quantity: number }[];
    };
    const itemCount = (record.order_items ?? []).reduce(
      (total, item) => total + item.quantity,
      0,
    );
    return { ...toOrderBase(record), itemCount };
  });
}

/** Counts by status, for the admin dashboard summary. No PII involved. */
export async function getOrderStatusCounts(): Promise<
  { status: OrderStatus; count: number }[]
> {
  const admin = createAdminClient();
  if (!admin) return [];

  const { data } = await admin.from("report_order_pipeline").select("status, order_count");
  return (data ?? []).map((row) => ({
    status: row.status as OrderStatus,
    count: row.order_count ?? 0,
  }));
}
