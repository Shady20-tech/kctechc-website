import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { recordAudit } from "@/lib/security/audit";
import {
  createCharge,
  isProviderConfigured,
  newTransactionReference,
  verifyTransaction,
  type ProviderChargeResult,
} from "./fapshi";

/** The provider recorded on every payment row and webhook event. */
export const PAYMENT_PROVIDER = "fapshi";

/**
 * Payment orchestration.
 *
 * Sits between the checkout action and the provider adapter, so the rules that
 * govern when an order may be paid live in one place:
 *
 *   * A payment row is created before the provider is called, so an attempt that
 *     fails mid-flight is still recorded rather than vanishing.
 *   * **The order is never marked paid here.** This module records the attempt
 *     and writes what the *provider* said. Promotion to `paid` happens only
 *     inside `apply_payment_result`, which requires a verified succeeded status
 *     and an order still in `pending_payment`. Keeping that out of this module is
 *     what stops a client-triggered code path from paying an order.
 *   * Every attempt is idempotent on its key, so a retried checkout or a
 *     duplicated webhook cannot create a second charge.
 */

export type InitiatePaymentResult =
  | { ok: true; kind: "redirect"; link: string; paymentId: string }
  | { ok: true; kind: "manual"; paymentId: string }
  | { ok: false; error: string; retryable: boolean };

/**
 * Begin payment for an order.
 *
 * `manual` is a first-class outcome, not an error: a bank-transfer order is
 * created in `manual_pending` and the business is told to expect a payment. It is
 * never auto-reconciled, and the confirmation page says so plainly rather than
 * implying the money arrived.
 */
export async function initiatePayment(input: {
  orderId: string;
  amountMinor: number;
  currency: string;
  method: "card" | "mobile_money_mtn" | "mobile_money_orange" | "bank_transfer";
  txRef: string;
  idempotencyKey: string;
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  redirectUrl: string;
  narration: string;
}): Promise<InitiatePaymentResult> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "unconfigured", retryable: false };

  // Reuse an existing attempt with this key rather than creating a second
  // charge. This is the application half of the idempotency guarantee, and on
  // Fapshi it is the *only* half of it that protects against a duplicate link:
  // the API has no idempotency header, so a retried `initiate-pay` would create a
  // second link if we ever called it twice for one attempt key. The unique index
  // on `provider_tx_ref` is the database half, catching a duplicate record.
  const { data: existing } = await admin
    .from("payments")
    .select("id, status, provider_metadata")
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle();

  if (existing) {
    const link = (existing.provider_metadata as { link?: string } | null)?.link;
    if (existing.status === "manual_pending") {
      return { ok: true, kind: "manual", paymentId: existing.id };
    }
    if (link) {
      return { ok: true, kind: "redirect", link, paymentId: existing.id };
    }
    // No link and not manual: the attempt already reached the provider and failed
    // or was abandoned. Reporting it as a redirect would send the customer to a
    // page that does not exist; the caller treats this as a retryable error.
    return { ok: false, error: "attempt_exists", retryable: true };
  }

  const { data: payment, error: insertError } = await admin
    .from("payments")
    .insert({
      order_id: input.orderId,
      status: "pending",
      method: input.method,
      provider: PAYMENT_PROVIDER,
      amount_minor: input.amountMinor,
      currency: input.currency,
      provider_tx_ref: input.txRef,
      idempotency_key: input.idempotencyKey,
    })
    .select("id")
    .single();

  if (insertError || !payment) {
    return { ok: false, error: "write_failed", retryable: true };
  }

  // Bank transfer: recorded as awaiting human reconciliation. Nothing here
  // contacts a provider, and nothing will ever move this to paid on its own.
  if (input.method === "bank_transfer") {
    await admin
      .from("payments")
      .update({ status: "manual_pending" })
      .eq("id", payment.id);
    return { ok: true, kind: "manual", paymentId: payment.id };
  }

  if (!isProviderConfigured()) {
    // No credentials: the attempt is recorded as failed rather than left
    // pending, so the order does not appear to be awaiting a payment that can
    // never arrive. No success is ever simulated.
    await admin
      .from("payments")
      .update({ status: "failed", failure_reason: "provider_unconfigured" })
      .eq("id", payment.id);
    return { ok: false, error: "unconfigured", retryable: false };
  }

  const charge: ProviderChargeResult = await createCharge({
    txRef: input.txRef,
    amountMinor: input.amountMinor,
    currency: input.currency,
    customerEmail: input.customerEmail,
    redirectUrl: input.redirectUrl,
    narration: input.narration,
  });

  if (!charge.ok) {
    await admin
      .from("payments")
      .update({
        status: "failed",
        failure_reason: charge.error.slice(0, 500),
      })
      .eq("id", payment.id);

    await recordAudit({
      actorId: null,
      action: "payment_state_changed",
      entityType: "payment",
      entityId: payment.id,
      metadata: {
        outcome: "charge_failed",
        method: input.method,
        error: charge.error,
        retryable: charge.retryable,
      },
    });

    return { ok: false, error: charge.error, retryable: charge.retryable };
  }

  if (charge.kind === "redirect") {
    await admin
      .from("payments")
      .update({
        provider_reference: charge.providerReference,
        status: "pending",
        provider_metadata: { link: charge.link },
        authorized_at: new Date().toISOString(),
      })
      .eq("id", payment.id);

    return { ok: true, kind: "redirect", link: charge.link, paymentId: payment.id };
  }

  // Unreachable while Fapshi returns a link for every charge: the union has one
  // success variant. Kept as an explicit failure rather than a silent fallthrough
  // so that a provider which changes shape cannot leave a payment pending with no
  // way for the customer to act.
  await admin
    .from("payments")
    .update({ status: "failed", failure_reason: "provider_returned_no_link" })
    .eq("id", payment.id);

  return { ok: false, error: "provider_returned_no_link", retryable: true };
}

/**
 * Reconcile an order's payment against the provider.
 *
 * Called from the return URL after the customer comes back from the hosted page,
 * and from the webhook handler. Both paths converge here so the verification
 * rule has one implementation: ask the provider, compare the amount and currency
 * against the order, and only then apply the result.
 *
 * A mismatch is treated as a failure rather than a success, because a provider
 * confirming a different amount is either a bug or an attack and neither is
 * grounds for releasing goods.
 */
export async function reconcilePayment(input: {
  txRef: string;
  expectedAmountMinor: number;
  expectedCurrency: string;
}): Promise<
  | { ok: true; outcome: "paid" | "failed" | "pending"; paymentId: string }
  | { ok: false; error: string }
> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "unconfigured" };

  const { data: payment } = await admin
    .from("payments")
    .select("id, order_id, status, provider_reference, provider_tx_ref")
    .eq("provider_tx_ref", input.txRef)
    .maybeSingle();

  if (!payment) return { ok: false, error: "payment_not_found" };

  // Fapshi's status endpoint is keyed on `transId`, not on our `externalId`, so
  // the id captured when the link was created is what verification needs. Without
  // it there is nothing to verify against, and reporting that is better than
  // guessing at a reference.
  if (!payment.provider_reference) {
    return { ok: false, error: "no_provider_reference" };
  }

  const verification = await verifyTransaction({
    transId: payment.provider_reference,
  });
  if (!verification.ok) {
    return { ok: false, error: verification.error };
  }

  // The amount and currency the provider confirms must match the order. A
  // "successful" result for the wrong amount is not a payment for this order.
  const amountMatches = verification.amountMinor === input.expectedAmountMinor;
  const currencyMatches =
    verification.currency.toUpperCase() === input.expectedCurrency.toUpperCase();

  const finalStatus =
    verification.status === "succeeded" && (!amountMatches || !currencyMatches)
      ? "failed"
      : verification.status === "succeeded"
        ? "succeeded"
        : verification.status === "pending"
          ? "pending"
          : "failed";

  const { error } = await admin.rpc("apply_payment_result", {
    p_payment_id: payment.id,
    p_status: finalStatus,
    // `undefined` rather than `null`: the generated RPC types mark these as
    // optional strings, and a null would be a different (and rejected) shape.
    p_provider_reference: verification.providerReference ?? undefined,
    p_failure_reason:
      finalStatus === "failed" && verification.status === "succeeded"
        ? "amount_or_currency_mismatch"
        : finalStatus === "failed"
          ? `provider_status:${verification.providerStatus}`
          : undefined,
    p_provider_metadata: {
      provider_status: verification.providerStatus,
      provider_medium: verification.providerMedium,
      verified_amount_minor: verification.amountMinor,
      verified_currency: verification.currency,
    },
  });

  if (error) return { ok: false, error: "apply_failed" };

  const outcome =
    finalStatus === "succeeded"
      ? "paid"
      : finalStatus === "pending"
        ? "pending"
        : "failed";

  // Audited with identifiers only; no PII crosses into the log.
  await recordAudit({
    actorId: null,
    action: "payment_state_changed",
    entityType: "payment",
    entityId: payment.id,
    metadata: {
      outcome,
      provider_status: verification.providerStatus,
      amount_matched: amountMatches,
      currency_matched: currencyMatches,
    },
  });

  return { ok: true, outcome, paymentId: payment.id };
}

/** A per-attempt transaction reference, derived from the order for traceability. */
export function transactionReferenceFor(orderReference: string): string {
  return newTransactionReference(orderReference.replace(/[^A-Za-z0-9]/g, ""));
}
