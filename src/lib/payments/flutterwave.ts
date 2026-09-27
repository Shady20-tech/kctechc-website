import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/config/server-env";

/**
 * Flutterwave provider adapter.
 *
 * Everything that touches a secret lives here, and the module carries
 * `import "server-only"` so an accidental import from a Client Component is a
 * build error rather than a leaked key in a browser bundle. The public key is
 * the only value that may reach the client, and it is read from `serverEnv`
 * here and passed explicitly to the payment form rather than through
 * `publicEnv`, so there is one source of truth.
 *
 * API shape (current Flutterwave v3 REST):
 *   * `POST /v3/payments` — create a charge, returns a `data.link` to redirect
 *     to for card, or a pending status for mobile money.
 *   * `GET /v3/transactions/{id}/verify` and
 *     `GET /v3/transactions/verify_by_reference?tx_ref=` — server-side
 *     verification. The verified amount and currency are what the order is
 *     checked against; a client-reported success is never trusted.
 *
 * Two deliberate constraints:
 *
 *   * **No card data.** This module never accepts or forwards a card number,
 *     CVV or expiry. The hosted redirect collects card details on Flutterwave's
 *     own page, which is what keeps the site out of PCI scope entirely. There is
 *     no field for any of it by construction.
 *   * **No simulated success.** When credentials are absent, every function
 *     returns an explicit `unconfigured` result. Nothing here ever returns a
 *     success it did not receive from the provider.
 */

const FLUTTERWAVE_API_BASE = "https://api.flutterwave.com/v3";

/** Currency the store transacts in. Kept explicit rather than assumed. */
export const PAYMENT_CURRENCY = "XAF";

export type ProviderChargeRequest = {
  txRef: string;
  amountMinor: number;
  currency: string;
  /** Idempotency key sent with the request, so a retry returns the same charge. */
  idempotencyKey: string;
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  method: "card" | "mobile_money_mtn" | "mobile_money_orange";
  /** Where the provider returns the customer after the hosted page. */
  redirectUrl: string;
  /** Shown on the customer's statement/handset. */
  narration: string;
};

export type ProviderChargeResult =
  | { ok: true; kind: "redirect"; link: string; providerReference: string | null }
  | { ok: true; kind: "pending"; providerReference: string | null }
  | { ok: false; error: string; retryable: boolean };

export type ProviderVerification =
  | {
      ok: true;
      status: "succeeded" | "failed" | "pending";
      amountMinor: number;
      currency: string;
      providerReference: string | null;
      /** Flutterwave's own status string, for the audit trail. */
      providerStatus: string;
    }
  | { ok: false; error: string; retryable: boolean };

/** True when the provider can be called at all. */
export function isProviderConfigured(): boolean {
  return (
    serverEnv.flutterwaveSecretKey !== null &&
    serverEnv.flutterwavePublicKey !== null
  );
}

/**
 * The public key, for the payment form.
 *
 * Read through the server module and passed down explicitly, rather than read
 * directly from a `NEXT_PUBLIC_*` variable in a component. One source of truth
 * means the key cannot drift between the client and a server-side check.
 */
export function getPublicKey(): string | null {
  return serverEnv.flutterwavePublicKey;
}

function secretKey(): string | null {
  return serverEnv.flutterwaveSecretKey;
}

const ZERO_DECIMAL = new Set(["XAF", "XOF", "XPF", "JPY", "KRW", "VND"]);

/**
 * Amount in the currency's major unit.
 *
 * Flutterwave expects a decimal number. XAF has no minor unit (ISO 4217
 * exponent 0), so 50 000 XAF is sent as 50000, not 500.00 — dividing by 100
 * would under-charge by a factor of 100. The divisor therefore follows the
 * currency rather than assuming two decimal places, matching `minorUnitDivisor`
 * on the display side.
 */
function amountForProvider(amountMinor: number, currency: string): number {
  return ZERO_DECIMAL.has(currency.toUpperCase())
    ? amountMinor
    : Math.round(amountMinor) / 100;
}

/** Convert a provider amount back to minor units. */
export function amountToMinor(amount: number, currency: string): number {
  return Math.round(
    amount * (ZERO_DECIMAL.has(currency.toUpperCase()) ? 1 : 100),
  );
}

/**
 * Map our payment method to Flutterwave's `payment_type` value.
 *
 * Flutterwave identifies the network by the customer's phone prefix rather than
 * a separate field, so MTN and Orange share the `mobilemoney` type; the operator
 * distinction is carried in our own `payments.method` for reporting.
 */
function providerPaymentType(method: ProviderChargeRequest["method"]): string {
  return method === "card" ? "card" : "mobilemoney";
}

/**
 * Create a charge.
 *
 * Sends our idempotency key so a retried request (a dropped connection, a
 * double-submitted checkout) returns the original charge instead of creating a
 * second one.
 *
 * Uses the hosted `redirect_url` for both payment types: that is what keeps card
 * data off this server, and mobile money approval happens on the customer's
 * handset regardless.
 */
export async function createCharge(
  request: ProviderChargeRequest,
): Promise<ProviderChargeResult> {
  const secret = secretKey();
  if (!secret) return { ok: false, error: "unconfigured", retryable: false };

  const body = {
    tx_ref: request.txRef,
    amount: amountForProvider(request.amountMinor, request.currency),
    currency: request.currency,
    redirect_url: request.redirectUrl,
    payment_type: providerPaymentType(request.method),
    narration: request.narration,
    // Non-sensitive customer detail only. No card fields exist on this shape.
    customer: {
      email: request.customerEmail,
      name: request.customerName,
      ...(request.customerPhone ? { phonenumber: request.customerPhone } : {}),
    },
    // Carried in metadata as well as the header, so the key survives a proxy
    // that strips unknown headers.
    meta: { idempotency_key: request.idempotencyKey },
    customizations: {
      title: "KC Technology Corporation",
      description: request.narration.slice(0, 100),
    },
  };

  try {
    const response = await fetch(`${FLUTTERWAVE_API_BASE}/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": request.idempotencyKey,
      },
      body: JSON.stringify(body),
      // A hung provider must not hold the request open; the customer gets a
      // clear retry rather than a spinning page.
      signal: AbortSignal.timeout(20_000),
    });

    const payload = (await response.json()) as {
      status?: string;
      message?: string;
      data?: { link?: string; id?: number | string; status?: string };
    };

    if (!response.ok || payload.status === "error") {
      return {
        ok: false,
        error: payload.message ?? `provider_http_${response.status}`,
        // A 5xx or a timeout is worth retrying; a 4xx is a request problem.
        retryable: response.status >= 500,
      };
    }

    const providerReference =
      payload.data?.id != null ? String(payload.data.id) : null;

    if (payload.data?.link) {
      return {
        ok: true,
        kind: "redirect",
        link: payload.data.link,
        providerReference,
      };
    }

    // Mobile money returns no link; the customer approves on their handset.
    return { ok: true, kind: "pending", providerReference };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return {
      ok: false,
      error: timedOut ? "provider_timeout" : "provider_unreachable",
      retryable: true,
    };
  }
}

/**
 * Verify a transaction server-side.
 *
 * THE authority on whether a payment succeeded. A webhook body *claims* success;
 * this asks the provider directly and the caller compares the verified amount
 * and currency against the order. A webhook that says "successful" for an amount
 * the provider does not confirm is not a payment.
 *
 * Pass `txRef` to verify by our reference (used on the return URL, where the
 * provider id may not be present) or `providerReference` to verify by the
 * provider's id (used from a webhook, which carries it).
 */
export async function verifyTransaction(input: {
  txRef?: string;
  providerReference?: string;
}): Promise<ProviderVerification> {
  const secret = secretKey();
  if (!secret) return { ok: false, error: "unconfigured", retryable: false };

  const url = input.providerReference
    ? `${FLUTTERWAVE_API_BASE}/transactions/${encodeURIComponent(input.providerReference)}/verify`
    : input.txRef
      ? `${FLUTTERWAVE_API_BASE}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(input.txRef)}`
      : null;

  if (!url) return { ok: false, error: "missing_reference", retryable: false };

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(20_000),
    });

    const payload = (await response.json()) as {
      status?: string;
      message?: string;
      data?: {
        status?: string;
        amount?: number;
        currency?: string;
        id?: number | string;
        tx_ref?: string;
      };
    };

    if (!response.ok || payload.status === "error" || !payload.data) {
      return {
        ok: false,
        error: payload.message ?? `provider_http_${response.status}`,
        retryable: response.status >= 500,
      };
    }

    const providerStatus = (payload.data.status ?? "").toLowerCase();
    // Flutterwave's success token is the literal "successful".
    const status: "succeeded" | "failed" | "pending" =
      providerStatus === "successful" || providerStatus === "success"
        ? "succeeded"
        : providerStatus === "pending"
          ? "pending"
          : "failed";

    const currency = (payload.data.currency ?? "").toUpperCase();

    return {
      ok: true,
      status,
      amountMinor: amountToMinor(payload.data.amount ?? 0, currency),
      currency,
      providerReference:
        payload.data.id != null ? String(payload.data.id) : null,
      providerStatus: providerStatus || "unknown",
    };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return {
      ok: false,
      error: timedOut ? "provider_timeout" : "provider_unreachable",
      retryable: true,
    };
  }
}

/**
 * Verify a webhook signature.
 *
 * Flutterwave sends the value of `FLUTTERWAVE_WEBHOOK_SECRET` in the
 * `verif-hash` header. The comparison is constant-time: a byte-by-byte early
 * exit would leak the secret's prefix through response timing, which is enough
 * to reconstruct it against a webhook that echoes nothing.
 *
 * Returns false when no secret is configured. A webhook that cannot be verified
 * must not be trusted, so an unconfigured deployment rejects rather than
 * accepts.
 */
export function verifyWebhookSignature(input: {
  headerHash: string | null;
}): boolean {
  const secret = serverEnv.flutterwaveWebhookSecret;
  if (!secret || !input.headerHash) return false;

  // `timingSafeEqual` throws on a length mismatch, which would itself be a
  // (weaker) timing signal, so compare fixed-length digests of each instead.
  const expectedDigest = createHash("sha256").update(secret, "utf8").digest();
  const receivedDigest = createHash("sha256")
    .update(input.headerHash, "utf8")
    .digest();

  return timingSafeEqual(expectedDigest, receivedDigest);
}

/**
 * Derive a stable provider event id from a webhook body.
 *
 * The replay guard needs an id that is identical across two deliveries of the
 * same event and different between distinct events. Flutterwave's payload has no
 * single guaranteed-unique field across all event types, so the id is derived
 * from the fields that identify the event: the transaction id, our reference,
 * its status and the amount. Two deliveries of one event produce the same digest;
 * a genuine second event (a refund after a charge) changes the status and
 * produces a new one.
 *
 * Falls back to a digest of the whole body when those fields are absent, which
 * still makes an exact replay a no-op.
 */
export function deriveEventId(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const record = body as Record<string, unknown>;
  const data =
    typeof record.data === "object" && record.data !== null
      ? (record.data as Record<string, unknown>)
      : record;

  const parts = [
    record.event ?? record["event.type"] ?? "",
    data.id ?? "",
    data.tx_ref ?? "",
    data.status ?? "",
    data.amount ?? "",
  ].map((value) => String(value));

  const source = parts.some((part) => part.length > 0)
    ? parts.join("|")
    : JSON.stringify(body);

  return createHash("sha256").update(source).digest("hex");
}

/** An opaque, unguessable reference for `tx_ref`. */
export function newTransactionReference(prefix = "KC"): string {
  // 16 bytes → 32 hex chars. Long enough that collisions are not a concern and
  // the value cannot be guessed from another order's reference.
  const random = randomBytes(16).toString("hex");
  return `${prefix}-${Date.now().toString(36)}-${random}`.slice(0, 120);
}
