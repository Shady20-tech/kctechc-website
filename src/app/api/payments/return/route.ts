import { NextResponse } from "next/server";
import { STORE_PATH } from "@/lib/config/navigation";
import { reconcilePayment } from "@/lib/payments/service";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Payment return URL.
 *
 * Where Flutterwave sends the customer after the hosted page. This route does
 * **not** mark anything paid on the strength of the query string: the redirect is
 * a hint that a payment attempt finished, and the outcome is decided by asking
 * the provider (`reconcilePayment`).
 *
 * That distinction is the whole point. A customer can edit the return URL, and
 * Flutterwave's own documentation notes the redirect is not a reliable signal.
 * The webhook is the primary path; this is the secondary one so a customer whose
 * webhook is delayed by a few seconds still sees the correct state rather than a
 * "pending" page they would then refresh.
 *
 * The route always redirects to the order page, carrying the outcome as a query
 * flag for messaging only — never as the source of truth. The order page re-reads
 * the order from the database, so a hand-crafted `?status=paid` has no effect.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const txRef = url.searchParams.get("tx_ref");
  // Flutterwave may append its own status and transaction id; neither is trusted.
  const locale = url.searchParams.get("locale") === "fr" ? "fr" : "en";

  const admin = createAdminClient();
  if (!admin || !txRef) {
    return NextResponse.redirect(
      new URL(`/${locale}${STORE_PATH}/cart`, url.origin),
      { status: 303 },
    );
  }

  // Resolve the order from the reference so the customer lands on their order
  // page whatever the outcome.
  const { data: payment } = await admin
    .from("payments")
    .select("order_id, amount_minor, currency, orders (reference, total_minor, currency)")
    .eq("provider_tx_ref", txRef)
    .maybeSingle();

  const order = (payment?.orders ?? null) as
    | { reference: string; total_minor: number; currency: string }
    | null;

  if (!payment || !order) {
    // An unknown reference is either a stale link or a probe. Send the visitor to
    // the store rather than to an error page that reveals anything.
    return NextResponse.redirect(
      new URL(`/${locale}${STORE_PATH}`, url.origin),
      { status: 303 },
    );
  }

  // Verify against the order's total, not the payment's, so a tampered payment
  // row cannot self-validate.
  const result = await reconcilePayment({
    txRef,
    expectedAmountMinor: order.total_minor,
    expectedCurrency: order.currency,
  });

  const outcome = result.ok ? result.outcome : "unknown";
  const destination = new URL(
    `/${locale}${STORE_PATH}/orders/${encodeURIComponent(order.reference)}`,
    url.origin,
  );
  // Messaging only. The order page ignores this for state.
  destination.searchParams.set("payment", outcome);

  return NextResponse.redirect(destination, { status: 303 });
}
