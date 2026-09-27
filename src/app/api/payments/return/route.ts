import { NextResponse } from "next/server";
import { STORE_PATH } from "@/lib/config/navigation";
import { reconcilePayment } from "@/lib/payments/service";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Payment return URL.
 *
 * Where Fapshi sends the customer after the hosted page. This route does **not**
 * mark anything paid on the strength of the query string: the redirect is a hint
 * that a payment attempt finished, and the outcome is decided by asking Fapshi
 * (`reconcilePayment`).
 *
 * That distinction is the whole point. A customer can edit the return URL, and a
 * redirect is never a reliable payment signal. On Fapshi this route carries more
 * of the load than it would with a provider that retries webhooks — Fapshi sends
 * each webhook once with no redelivery, so a delivery that is missed (a deploy, a
 * blip) would otherwise leave the order stuck in `pending_payment` forever. This
 * route is the recovery path for exactly that case.
 *
 * The `tx_ref` parameter is our own order reference, which we placed on the
 * `redirectUrl` when creating the link, so it is present regardless of what the
 * provider chooses to append.
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
  // Any extra parameters the provider appends are ignored; only our own
  // `tx_ref` identifies the payment, and even that is not trusted for state.
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
