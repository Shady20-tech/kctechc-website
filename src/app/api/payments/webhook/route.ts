import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  deriveEventId,
  verifyWebhookSignature,
} from "@/lib/payments/flutterwave";
import { reconcilePayment } from "@/lib/payments/service";

/**
 * Flutterwave webhook receiver.
 *
 * The security-critical endpoint of this phase. Three properties, in order:
 *
 *   1. **The signature is verified before the body is trusted.** Flutterwave
 *      sends the webhook secret in the `verif-hash` header. An unverified request
 *      is recorded as invalid and returns 401 without touching any order — a
 *      forged "payment successful" must not be able to mark anything paid.
 *   2. **Replay is a no-op.** Every delivery is recorded against a derived event
 *      id under a unique index. A second delivery of the same event inserts
 *      nothing, so the handler detects it and stops. This matters because
 *      providers deliver at-least-once by design and will retry the same event.
 *   3. **The order is reconciled against the provider, not the payload.** The
 *      body is treated as a *notification that something happened*, not as
 *      evidence. `reconcilePayment` asks the provider for the transaction and
 *      compares the verified amount and currency against the order.
 *
 * `runtime = "nodejs"` is required: the signature comparison uses `node:crypto`
 * for a constant-time digest comparison, which the edge runtime does not provide.
 */

export const runtime = "nodejs";
// Never cache a webhook: each delivery must be processed exactly once.
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  const signatureValid = verifyWebhookSignature({
    headerHash: request.headers.get("verif-hash"),
  });

  // Read the raw text before parsing, so the body that was verified is the body
  // that is stored. Re-serializing a parsed object could differ from what the
  // provider signed.
  const rawBody = await request.text();

  let body: unknown = null;
  try {
    body = JSON.parse(rawBody);
  } catch {
    body = null;
  }

  const admin = createAdminClient();

  // A malformed body cannot be processed and cannot be recorded meaningfully.
  if (body === null || typeof body !== "object") {
    return NextResponse.json({ status: "ignored" }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const data =
    typeof record.data === "object" && record.data !== null
      ? (record.data as Record<string, unknown>)
      : record;

  const providerEventId = deriveEventId(body);
  const txRef = typeof data.tx_ref === "string" ? data.tx_ref : null;
  const eventType =
    typeof record.event === "string"
      ? record.event
      : typeof record["event.type"] === "string"
        ? (record["event.type"] as string)
        : null;

  if (!admin) {
    // Cannot record or reconcile. Returning 5xx is correct: it tells the
    // provider to retry rather than silently dropping a real payment event.
    return NextResponse.json({ status: "unconfigured" }, { status: 503 });
  }

  // An unverified request is recorded so an operator can see attempted forgeries,
  // but it is never acted on. The response is 401 rather than 200: this delivery
  // should not be treated as handled.
  if (!signatureValid) {
    if (providerEventId) {
      await admin
        .from("payment_webhook_events")
        .insert({
          provider: "flutterwave",
          provider_event_id: providerEventId,
          event_type: eventType,
          provider_tx_ref: txRef,
          signature_valid: false,
          processed: false,
          process_note: "signature rejected",
          payload: {},
        })
        // A repeat forgery collides on the unique index and is ignored; that is
        // the desired behaviour, not an error to surface.
        .select("id")
        .maybeSingle();
    }

    await recordAudit({
      actorId: null,
      action: "payment_state_changed",
      entityType: "payment_webhook",
      entityId: providerEventId,
      metadata: { outcome: "signature_rejected", event_type: eventType },
    });

    return NextResponse.json({ status: "invalid_signature" }, { status: 401 });
  }

  // Replay guard. `upsert` with `ignoreDuplicates` relies on the unique index on
  // (provider, provider_event_id); if a row already exists, the returned data is
  // empty and we know this event has been seen.
  const { data: inserted } = await admin
    .from("payment_webhook_events")
    .upsert(
      {
        provider: "flutterwave",
        provider_event_id: providerEventId ?? "",
        event_type: eventType,
        provider_tx_ref: txRef,
        signature_valid: true,
        processed: false,
        payload: record as never,
      },
      { onConflict: "provider,provider_event_id", ignoreDuplicates: true },
    )
    .select("id");

  const insertedRow = inserted?.[0];
  if (!insertedRow) {
    // Seen before. Acknowledge with 200 so the provider stops retrying, and say
    // plainly that nothing was done.
    return NextResponse.json({ status: "duplicate" }, { status: 200 });
  }

  const eventRowId = insertedRow.id;

  // Nothing to reconcile without a reference to the payment.
  if (!txRef) {
    await admin
      .from("payment_webhook_events")
      .update({ processed: true, process_note: "no tx_ref in payload" })
      .eq("id", eventRowId);
    return NextResponse.json({ status: "ignored" }, { status: 200 });
  }

  // Find the payment and the order it belongs to, so the amount to verify against
  // is the order's own total — never a number from the webhook body.
  const { data: payment } = await admin
    .from("payments")
    .select("id, order_id, amount_minor, currency")
    .eq("provider_tx_ref", txRef)
    .maybeSingle();

  if (!payment) {
    await admin
      .from("payment_webhook_events")
      .update({ processed: true, process_note: "unknown tx_ref" })
      .eq("id", eventRowId);
    return NextResponse.json({ status: "unknown_reference" }, { status: 200 });
  }

  // Verify against the *order*, which is the authoritative amount. Using the
  // payment's own amount would let a tampered payment row self-validate.
  const { data: order } = await admin
    .from("orders")
    .select("total_minor, currency")
    .eq("id", payment.order_id)
    .maybeSingle();

  const expectedAmountMinor = order?.total_minor ?? payment.amount_minor;
  const expectedCurrency = order?.currency ?? payment.currency;

  const result = await reconcilePayment({
    txRef,
    expectedAmountMinor,
    expectedCurrency,
  });

  await admin
    .from("payment_webhook_events")
    .update({
      processed: true,
      process_note: result.ok ? `reconciled:${result.outcome}` : `error:${result.error}`,
    })
    .eq("id", eventRowId);

  if (!result.ok) {
    // A verification failure is a retryable condition (a provider timeout, a
    // transient 5xx). Returning 5xx asks for a redelivery rather than losing it.
    return NextResponse.json({ status: "reconcile_failed" }, { status: 502 });
  }

  return NextResponse.json({ status: "ok", outcome: result.outcome }, { status: 200 });
}

/**
 * A GET is not part of the protocol. Answering explicitly avoids a browser or a
 * probe receiving a confusing 405 and is a clearer signal than silence.
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ status: "method_not_allowed" }, { status: 405 });
}
