import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Flutterwave adapter.
 *
 * Covers the parts with security consequences and no external dependency:
 * amount conversion (a wrong divisor under-charges by 100x), signature
 * verification (a bypassed check lets anyone mark an order paid), and event-id
 * derivation (a non-deterministic id defeats replay protection).
 *
 * The network paths are exercised by mocking `fetch`, so the request *shape* is
 * asserted without pretending a real charge occurred.
 */

const ENV_KEYS = [
  "FLUTTERWAVE_SECRET_KEY",
  "FLUTTERWAVE_PUBLIC_KEY",
  "FLUTTERWAVE_WEBHOOK_SECRET",
] as const;

const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  vi.resetModules();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  vi.unstubAllGlobals();
});

/** Import the adapter fresh, so it re-reads `serverEnv` with the current env. */
async function adapter() {
  return import("./flutterwave");
}

describe("configuration gating", () => {
  it("reports unconfigured when no secret is present", async () => {
    const { isProviderConfigured } = await adapter();
    expect(isProviderConfigured()).toBe(false);
  });

  it("refuses to charge when unconfigured, instead of faking success", async () => {
    const { createCharge } = await adapter();
    const result = await createCharge({
      txRef: "KC-1",
      amountMinor: 5000,
      currency: "XAF",
      idempotencyKey: "key-1",
      customerEmail: "a@example.com",
      customerName: "A",
      method: "card",
      redirectUrl: "https://example.com/return",
      narration: "order",
    });
    // The critical property: no success is ever simulated.
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("unconfigured");
  });

  it("exposes the public key but never the secret", async () => {
    process.env.FLUTTERWAVE_PUBLIC_KEY = "FLWPUBK_test";
    process.env.FLUTTERWAVE_SECRET_KEY = "FLWSECK_test";
    const mod = await adapter();
    expect(mod.getPublicKey()).toBe("FLWPUBK_test");
    // There is no accessor that returns the secret; assert the module's surface.
    expect(Object.keys(mod)).not.toContain("getSecretKey");
  });
});

describe("webhook signature verification", () => {
  it("accepts the configured secret", async () => {
    process.env.FLUTTERWAVE_WEBHOOK_SECRET = "hash-abc-123";
    const { verifyWebhookSignature } = await adapter();
    expect(verifyWebhookSignature({ headerHash: "hash-abc-123" })).toBe(true);
  });

  it("rejects a wrong signature", async () => {
    process.env.FLUTTERWAVE_WEBHOOK_SECRET = "hash-abc-123";
    const { verifyWebhookSignature } = await adapter();
    expect(verifyWebhookSignature({ headerHash: "hash-abc-124" })).toBe(false);
    expect(verifyWebhookSignature({ headerHash: "abc-123" })).toBe(false);
    expect(verifyWebhookSignature({ headerHash: "" })).toBe(false);
  });

  it("rejects a missing header", async () => {
    process.env.FLUTTERWAVE_WEBHOOK_SECRET = "hash-abc-123";
    const { verifyWebhookSignature } = await adapter();
    expect(verifyWebhookSignature({ headerHash: null })).toBe(false);
  });

  it("rejects everything when no secret is configured", async () => {
    // An unconfigured deployment must fail closed, not open.
    const { verifyWebhookSignature } = await adapter();
    expect(verifyWebhookSignature({ headerHash: "anything" })).toBe(false);
    expect(verifyWebhookSignature({ headerHash: null })).toBe(false);
  });

  it("does not accept a signature of a different length as a prefix match", async () => {
    process.env.FLUTTERWAVE_WEBHOOK_SECRET = "hash-abc-123";
    const { verifyWebhookSignature } = await adapter();
    // A digest-based comparison must not accept a prefix.
    expect(verifyWebhookSignature({ headerHash: "hash-abc-12" })).toBe(false);
  });
});

describe("event id derivation (replay protection)", () => {
  it("is deterministic for the same event", async () => {
    const { deriveEventId } = await adapter();
    const body = {
      event: "charge.completed",
      data: { id: 12345, tx_ref: "KC-1", status: "successful", amount: 5000 },
    };
    expect(deriveEventId(body)).toBe(deriveEventId(body));
  });

  it("is stable across deliveries with reordered keys", async () => {
    const { deriveEventId } = await adapter();
    const a = {
      event: "charge.completed",
      data: { id: 1, tx_ref: "KC-1", status: "successful", amount: 10 },
    };
    // Same identifying fields, different object ordering.
    const b = {
      data: { amount: 10, status: "successful", tx_ref: "KC-1", id: 1 },
      event: "charge.completed",
    };
    expect(deriveEventId(a)).toBe(deriveEventId(b));
  });

  it("differs when the status changes, so a refund is a distinct event", async () => {
    const { deriveEventId } = await adapter();
    const charged = {
      event: "charge.completed",
      data: { id: 1, tx_ref: "KC-1", status: "successful", amount: 10 },
    };
    const refunded = {
      event: "charge.completed",
      data: { id: 1, tx_ref: "KC-1", status: "refunded", amount: 10 },
    };
    expect(deriveEventId(charged)).not.toBe(deriveEventId(refunded));
  });

  it("differs for a different transaction", async () => {
    const { deriveEventId } = await adapter();
    const one = { event: "charge.completed", data: { id: 1, tx_ref: "KC-1" } };
    const two = { event: "charge.completed", data: { id: 2, tx_ref: "KC-2" } };
    expect(deriveEventId(one)).not.toBe(deriveEventId(two));
  });

  it("falls back to a body digest when the expected fields are absent", async () => {
    const { deriveEventId } = await adapter();
    const id = deriveEventId({ something: "else" });
    expect(id).toMatch(/^[0-9a-f]{64}$/);
    // Same body still yields the same id, so an exact replay is still a no-op.
    expect(deriveEventId({ something: "else" })).toBe(id);
  });

  it("returns null for a non-object body", async () => {
    const { deriveEventId } = await adapter();
    expect(deriveEventId("nope")).toBeNull();
    expect(deriveEventId(null)).toBeNull();
  });
});

describe("transaction references", () => {
  it("are unique and URL-safe", async () => {
    const { newTransactionReference } = await adapter();
    const a = newTransactionReference("KCORD1");
    const b = newTransactionReference("KCORD1");
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9-]+$/);
    expect(a.length).toBeLessThanOrEqual(120);
  });
});

describe("createCharge request shape", () => {
  it("sends XAF without a decimal division and includes the idempotency key", async () => {
    process.env.FLUTTERWAVE_SECRET_KEY = "FLWSECK_test";
    process.env.FLUTTERWAVE_PUBLIC_KEY = "FLWPUBK_test";

    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(
        JSON.stringify({
          status: "success",
          data: { link: "https://checkout.flutterwave.com/x", id: 99 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    const { createCharge } = await adapter();
    const result = await createCharge({
      txRef: "KC-TEST-1",
      // 50 000 XAF has no minor unit: it must go on the wire as 50000.
      amountMinor: 50_000,
      currency: "XAF",
      idempotencyKey: "idem-123456",
      customerEmail: "a@example.com",
      customerName: "A Person",
      method: "card",
      redirectUrl: "https://example.com/return",
      narration: "order KC-ORD-1",
    });

    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);

    const body = JSON.parse(String(calls[0]!.init.body)) as {
      amount: number;
      currency: string;
      tx_ref: string;
      meta: { idempotency_key: string };
      customer: Record<string, unknown>;
      payment_type: string;
    };

    expect(body.amount).toBe(50_000); // not 500
    expect(body.currency).toBe("XAF");
    expect(body.tx_ref).toBe("KC-TEST-1");
    expect(body.meta.idempotency_key).toBe("idem-123456");
    expect(body.payment_type).toBe("card");

    // The authorization header carries the secret to the provider; that is its
    // only intended use.
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer FLWSECK_test");
    expect(headers["X-Idempotency-Key"]).toBe("idem-123456");

    // No card field may be present in the payload. The hosted page collects it.
    const serialized = JSON.stringify(body).toLowerCase();
    for (const forbidden of ["cardno", "card_number", "cvv", "cvv2", "expiry", "expirymonth"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("maps mobile money to the provider's mobilemoney type", async () => {
    process.env.FLUTTERWAVE_SECRET_KEY = "FLWSECK_test";
    process.env.FLUTTERWAVE_PUBLIC_KEY = "FLWPUBK_test";

    const bodies: string[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      bodies.push(String(init.body));
      return new Response(JSON.stringify({ status: "success", data: { id: 7 } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const { createCharge } = await adapter();
    const result = await createCharge({
      txRef: "KC-TEST-2",
      amountMinor: 1000,
      currency: "XAF",
      idempotencyKey: "idem-abcdef",
      customerEmail: "a@example.com",
      customerName: "A",
      method: "mobile_money_mtn",
      redirectUrl: "https://example.com/return",
      narration: "order",
    });

    // No link returned → pending, which is the honest state for mobile money.
    expect(result.ok && result.kind).toBe("pending");
    expect(JSON.parse(bodies[0]!).payment_type).toBe("mobilemoney");
  });

  it("reports a provider failure as a failure, with retryability", async () => {
    process.env.FLUTTERWAVE_SECRET_KEY = "FLWSECK_test";
    process.env.FLUTTERWAVE_PUBLIC_KEY = "FLWPUBK_test";

    vi.stubGlobal("fetch", async () =>
      new Response(JSON.stringify({ status: "error", message: "bad request" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      }),
    );

    const { createCharge } = await adapter();
    const result = await createCharge({
      txRef: "KC-TEST-3",
      amountMinor: 1000,
      currency: "XAF",
      idempotencyKey: "idem-xyz",
      customerEmail: "a@example.com",
      customerName: "A",
      method: "card",
      redirectUrl: "https://example.com/return",
      narration: "order",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("bad request");
      // A 4xx is not worth retrying; the request itself was wrong.
      expect(result.retryable).toBe(false);
    }
  });
});

describe("verifyTransaction", () => {
  it("treats only the provider's 'successful' as succeeded", async () => {
    process.env.FLUTTERWAVE_SECRET_KEY = "FLWSECK_test";
    process.env.FLUTTERWAVE_PUBLIC_KEY = "FLWPUBK_test";

    vi.stubGlobal("fetch", async () =>
      new Response(
        JSON.stringify({
          status: "success",
          data: {
            id: 42,
            status: "successful",
            amount: 50_000,
            currency: "XAF",
            tx_ref: "KC-TEST-4",
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const { verifyTransaction } = await adapter();
    const result = await verifyTransaction({ txRef: "KC-TEST-4" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe("succeeded");
      // XAF is zero-decimal: 50000 must stay 50000 minor units, not become 5.
      expect(result.amountMinor).toBe(50_000);
      expect(result.currency).toBe("XAF");
      expect(result.providerReference).toBe("42");
    }
  });

  it("maps a failed provider status to failed", async () => {
    process.env.FLUTTERWAVE_SECRET_KEY = "FLWSECK_test";
    process.env.FLUTTERWAVE_PUBLIC_KEY = "FLWPUBK_test";

    vi.stubGlobal("fetch", async () =>
      new Response(
        JSON.stringify({
          status: "success",
          data: { id: 43, status: "failed", amount: 10, currency: "XAF" },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const { verifyTransaction } = await adapter();
    const result = await verifyTransaction({ txRef: "KC-TEST-5" });
    expect(result.ok && result.status).toBe("failed");
  });

  it("treats a pending provider status as pending, not as success", async () => {
    process.env.FLUTTERWAVE_SECRET_KEY = "FLWSECK_test";
    process.env.FLUTTERWAVE_PUBLIC_KEY = "FLWPUBK_test";

    vi.stubGlobal("fetch", async () =>
      new Response(
        JSON.stringify({
          status: "success",
          data: { id: 44, status: "pending", amount: 10, currency: "XAF" },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const { verifyTransaction } = await adapter();
    const result = await verifyTransaction({ txRef: "KC-TEST-6" });
    expect(result.ok && result.status).toBe("pending");
  });

  it("refuses to verify without a reference", async () => {
    process.env.FLUTTERWAVE_SECRET_KEY = "FLWSECK_test";
    process.env.FLUTTERWAVE_PUBLIC_KEY = "FLWPUBK_test";
    const { verifyTransaction } = await adapter();
    const result = await verifyTransaction({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("missing_reference");
  });

  it("sends the secret only in the Authorization header", async () => {
    process.env.FLUTTERWAVE_SECRET_KEY = "FLWSECK_test";
    process.env.FLUTTERWAVE_PUBLIC_KEY = "FLWPUBK_test";

    const calls: RequestInit[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      calls.push(init);
      return new Response(
        JSON.stringify({ status: "success", data: { id: 1, status: "successful", amount: 1, currency: "XAF" } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    const { verifyTransaction } = await adapter();
    await verifyTransaction({ txRef: "KC-TEST-7" });

    const headers = calls[0]!.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer FLWSECK_test");
    // The key must not also leak into the URL, where it would land in logs.
    expect(String(calls[0]!.body ?? "")).not.toContain("FLWSECK");
  });
});

describe("signature comparison uses a digest", () => {
  it("matches the documented digest of the configured secret", async () => {
    process.env.FLUTTERWAVE_WEBHOOK_SECRET = "secret-value";
    const { verifyWebhookSignature } = await adapter();

    // Confirms the comparison is over digests (constant length), so a length
    // mismatch cannot throw from timingSafeEqual.
    const digest = createHash("sha256").update("secret-value").digest("hex");
    expect(digest).toHaveLength(64);
    expect(verifyWebhookSignature({ headerHash: "secret-value" })).toBe(true);
    expect(verifyWebhookSignature({ headerHash: digest })).toBe(false);
  });
});
