import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Fapshi adapter.
 *
 * Covers the parts with security consequences and no external dependency:
 * amount conversion (a wrong divisor under-charges by 100x), the XAF-only and
 * minimum-amount guards (a rejected charge would otherwise reach the provider),
 * signature verification (a bypassed check lets anyone mark an order paid), and
 * event-id derivation (a non-deterministic id defeats replay protection).
 *
 * The network paths are exercised by mocking `fetch`, so the request *shape* is
 * asserted without pretending a real charge occurred.
 */

const ENV_KEYS = [
  "FAPSHI_API_USER",
  "FAPSHI_API_KEY",
  "FAPSHI_WEBHOOK_SECRET",
  "FAPSHI_BASE_URL",
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
  return import("./fapshi");
}

function configure() {
  process.env.FAPSHI_API_USER = "user-1";
  process.env.FAPSHI_API_KEY = "key-1";
}

const baseCharge = {
  txRef: "KCORD1-abc",
  amountMinor: 5000,
  currency: "XAF",
  customerEmail: "a@example.com",
  redirectUrl: "https://example.com/return",
  narration: "order",
} as const;

describe("configuration gating", () => {
  it("reports unconfigured when no credentials are present", async () => {
    const { isProviderConfigured } = await adapter();
    expect(isProviderConfigured()).toBe(false);
  });

  it("refuses to charge when unconfigured, instead of faking success", async () => {
    const { createCharge } = await adapter();
    const result = await createCharge({ ...baseCharge });
    // The critical property: no success is ever simulated.
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("unconfigured");
  });

  it("is configured only when both apiuser and apikey are present", async () => {
    process.env.FAPSHI_API_USER = "user-1";
    const userOnly = await adapter();
    expect(userOnly.isProviderConfigured()).toBe(false);

    process.env.FAPSHI_API_KEY = "key-1";
    // Fresh import so the module re-reads `serverEnv`; a cached module would
    // still hold the key-less snapshot.
    vi.resetModules();
    const both = await adapter();
    expect(both.isProviderConfigured()).toBe(true);
  });

  it("exposes no secret accessor and no browser key at all", async () => {
    configure();
    const mod = await adapter();
    // Fapshi needs no client-side credential, and the secret must not be
    // reachable through the module's surface.
    expect(Object.keys(mod)).not.toContain("getSecretKey");
    expect(Object.keys(mod)).not.toContain("getPublicKey");
  });
});

describe("amount and currency guards", () => {
  it("rejects a currency Fapshi does not settle in", async () => {
    configure();
    const { createCharge } = await adapter();
    const result = await createCharge({ ...baseCharge, currency: "USD" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("unsupported_currency");
  });

  it("rejects an amount below the provider minimum before calling out", async () => {
    configure();
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    const { createCharge } = await adapter();
    const result = await createCharge({ ...baseCharge, amountMinor: 50 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("amount_below_provider_minimum");
    // Nothing should have been sent: the guard exists so the failure is local
    // and actionable rather than a provider round-trip.
    expect(spy).not.toHaveBeenCalled();
  });

  it("converts to minor units correctly for zero-decimal XAF", async () => {
    const { amountToMinor } = await adapter();
    expect(amountToMinor(5000, "XAF")).toBe(5000);
    expect(amountToMinor(5000, "USD")).toBe(500_000);
  });
});

describe("webhook signature verification", () => {
  it("accepts the configured secret", async () => {
    process.env.FAPSHI_WEBHOOK_SECRET = "wh-secret-123";
    const { verifyWebhookSignature } = await adapter();
    expect(verifyWebhookSignature({ headerSecret: "wh-secret-123" })).toBe(true);
  });

  it("rejects a wrong secret", async () => {
    process.env.FAPSHI_WEBHOOK_SECRET = "wh-secret-123";
    const { verifyWebhookSignature } = await adapter();
    expect(verifyWebhookSignature({ headerSecret: "wh-secret-124" })).toBe(false);
    expect(verifyWebhookSignature({ headerSecret: "wh-secret" })).toBe(false);
    expect(verifyWebhookSignature({ headerSecret: "" })).toBe(false);
  });

  it("rejects a missing header", async () => {
    process.env.FAPSHI_WEBHOOK_SECRET = "wh-secret-123";
    const { verifyWebhookSignature } = await adapter();
    expect(verifyWebhookSignature({ headerSecret: null })).toBe(false);
  });

  it("rejects everything when no secret is configured", async () => {
    // An unconfigured deployment must fail closed, not open.
    const { verifyWebhookSignature } = await adapter();
    expect(verifyWebhookSignature({ headerSecret: "anything" })).toBe(false);
    expect(verifyWebhookSignature({ headerSecret: null })).toBe(false);
  });

  it("does not accept a prefix as a match", async () => {
    process.env.FAPSHI_WEBHOOK_SECRET = "wh-secret-123";
    const { verifyWebhookSignature } = await adapter();
    expect(verifyWebhookSignature({ headerSecret: "wh-secret-12" })).toBe(false);
  });
});

describe("event id derivation (replay protection)", () => {
  it("is deterministic for the same event", async () => {
    const { deriveEventId } = await adapter();
    const body = {
      transId: "ll7J2fl4",
      externalId: "KCORD1-abc",
      status: "SUCCESSFUL",
      amount: 5000,
    };
    expect(deriveEventId(body)).toBe(deriveEventId(body));
  });

  it("is stable across deliveries with reordered keys", async () => {
    const { deriveEventId } = await adapter();
    const a = { transId: "t1", externalId: "KC1", status: "SUCCESSFUL", amount: 10 };
    const b = { amount: 10, status: "SUCCESSFUL", externalId: "KC1", transId: "t1" };
    expect(deriveEventId(a)).toBe(deriveEventId(b));
  });

  it("differs when the status changes, so a later event is distinct", async () => {
    const { deriveEventId } = await adapter();
    const success = { transId: "t1", externalId: "KC1", status: "SUCCESSFUL", amount: 10 };
    const expired = { transId: "t1", externalId: "KC1", status: "EXPIRED", amount: 10 };
    expect(deriveEventId(success)).not.toBe(deriveEventId(expired));
  });

  it("differs for a different transaction", async () => {
    const { deriveEventId } = await adapter();
    const one = { transId: "t1", status: "SUCCESSFUL" };
    const two = { transId: "t2", status: "SUCCESSFUL" };
    expect(deriveEventId(one)).not.toBe(deriveEventId(two));
  });

  it("falls back to a body digest when the expected fields are absent", async () => {
    const { deriveEventId } = await adapter();
    const id = deriveEventId({ something: "else" });
    expect(id).toMatch(/^[0-9a-f]{64}$/);
    expect(deriveEventId({ something: "else" })).toBe(id);
  });

  it("returns null for a non-object body", async () => {
    const { deriveEventId } = await adapter();
    expect(deriveEventId("nope")).toBeNull();
    expect(deriveEventId(null)).toBeNull();
  });
});

describe("transaction references", () => {
  it("are unique and satisfy Fapshi's externalId pattern", async () => {
    const { newTransactionReference } = await adapter();
    const a = newTransactionReference("KCORD1");
    const b = newTransactionReference("KCORD1");
    expect(a).not.toBe(b);
    // Fapshi: ^[a-zA-Z0-9-_]{1,100}$
    expect(a).toMatch(/^[A-Za-z0-9_-]{1,100}$/);
    expect(a.length).toBeLessThanOrEqual(100);
  });
});

describe("createCharge request shape", () => {
  it("sends XAF without a decimal division and uses Fapshi's camelCase fields", async () => {
    configure();
    process.env.FAPSHI_BASE_URL = "sandbox";

    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(
        JSON.stringify({
          message: "Payment link generated successfully",
          link: "https://sandbox.fapshi.com/pay/xyz",
          transId: "ll7J2fl4",
          dateInitiated: "2025-06-25T11:34:04.450Z",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    const { createCharge } = await adapter();
    const result = await createCharge({
      txRef: "KCORD1-abc",
      // 50 000 XAF has no minor unit: it must go on the wire as 50000.
      amountMinor: 50_000,
      currency: "XAF",
      customerEmail: "a@example.com",
      redirectUrl: "https://example.com/return",
      narration: "order KC-ORD-1",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.kind).toBe("redirect");
      expect(result.link).toBe("https://sandbox.fapshi.com/pay/xyz");
      expect(result.providerReference).toBe("ll7J2fl4");
    }
    expect(calls).toHaveLength(1);

    // The base URL follows configuration, so a sandbox key cannot be aimed at
    // the live host.
    expect(calls[0]!.url).toBe("https://sandbox.fapshi.com/initiate-pay");

    const body = JSON.parse(String(calls[0]!.init.body)) as Record<string, unknown>;
    expect(body.amount).toBe(50_000); // not 500
    expect(body.email).toBe("a@example.com");
    expect(body.externalId).toBe("KCORD1-abc");
    expect(body.redirectUrl).toBe("https://example.com/return");
    // No currency field exists on this endpoint; sending one would be a
    // misunderstanding of the API, not a harmless extra.
    expect(body.currency).toBeUndefined();

    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers.apiuser).toBe("user-1");
    expect(headers.apikey).toBe("key-1");

    // No card field may be present in the payload. Fapshi collects payment data
    // on its own page.
    const serialized = JSON.stringify(body).toLowerCase();
    for (const forbidden of ["cardno", "card_number", "cvv", "cvv2", "expiry", "expirymonth"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("defaults to the live host when no base URL is configured", async () => {
    configure();
    const urls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      urls.push(url);
      return new Response(
        JSON.stringify({ link: "https://live.fapshi.com/pay/z", transId: "t" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    const { createCharge } = await adapter();
    await createCharge({ ...baseCharge });
    expect(urls[0]).toBe("https://live.fapshi.com/initiate-pay");
  });

  it("reports a provider failure as a failure, with retryability", async () => {
    configure();
    vi.stubGlobal("fetch", async () =>
      new Response(JSON.stringify({ message: "bad request" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      }),
    );

    const { createCharge } = await adapter();
    const result = await createCharge({ ...baseCharge });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("bad request");
      // A 4xx is a request problem, not worth retrying unchanged.
      expect(result.retryable).toBe(false);
    }
  });

  it("treats a 5xx as retryable", async () => {
    configure();
    vi.stubGlobal("fetch", async () =>
      new Response(JSON.stringify({ message: "server error" }), {
        status: 502,
        headers: { "content-type": "application/json" },
      }),
    );

    const { createCharge } = await adapter();
    const result = await createCharge({ ...baseCharge });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.retryable).toBe(true);
  });

  it("treats a 200 without a link as a failure, never a success", async () => {
    configure();
    vi.stubGlobal("fetch", async () =>
      new Response(JSON.stringify({ message: "no link" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const { createCharge } = await adapter();
    const result = await createCharge({ ...baseCharge });
    expect(result.ok).toBe(false);
  });
});

describe("verifyTransaction", () => {
  it("returns unconfigured rather than a status without credentials", async () => {
    const { verifyTransaction } = await adapter();
    const result = await verifyTransaction({ transId: "t1" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("unconfigured");
  });

  it("maps SUCCESSFUL to succeeded and reads the amount in XAF", async () => {
    configure();
    const urls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      urls.push(url);
      return new Response(
        JSON.stringify({
          transId: "ll7J2fl4",
          status: "SUCCESSFUL",
          medium: "mobile money",
          amount: 5000,
          externalId: "KCORD1-abc",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    const { verifyTransaction } = await adapter();
    const result = await verifyTransaction({ transId: "ll7J2fl4" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe("succeeded");
      expect(result.amountMinor).toBe(5000);
      expect(result.currency).toBe("XAF");
      expect(result.providerMedium).toBe("mobile money");
      expect(result.providerReference).toBe("ll7J2fl4");
      expect(result.providerStatus).toBe("successful");
    }
    // Verification is keyed on transId, not on our externalId.
    expect(urls[0]).toBe(
      "https://live.fapshi.com/payment-status/ll7J2fl4",
    );
  });

  it("maps CREATED and PENDING to pending", async () => {
    configure();
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      void init;
      return new Response(JSON.stringify({ transId: "t", status: "CREATED" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const { verifyTransaction } = await adapter();
    const created = await verifyTransaction({ transId: "t" });
    expect(created.ok && created.status).toBe("pending");

    vi.stubGlobal("fetch", async () =>
      new Response(JSON.stringify({ transId: "t", status: "PENDING" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const pending = await verifyTransaction({ transId: "t" });
    expect(pending.ok && pending.status).toBe("pending");
  });

  it("maps FAILED and EXPIRED to failed", async () => {
    configure();
    for (const status of ["FAILED", "EXPIRED"]) {
      vi.stubGlobal("fetch", async () =>
        new Response(JSON.stringify({ transId: "t", status }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
      const { verifyTransaction } = await adapter();
      const result = await verifyTransaction({ transId: "t" });
      expect(result.ok && result.status, status).toBe("failed");
    }
  });

  it("treats a 429 as retryable", async () => {
    configure();
    vi.stubGlobal("fetch", async () =>
      new Response(JSON.stringify({ message: "rate limited" }), {
        status: 429,
        headers: { "content-type": "application/json" },
      }),
    );
    const { verifyTransaction } = await adapter();
    const result = await verifyTransaction({ transId: "t" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.retryable).toBe(true);
  });
});
