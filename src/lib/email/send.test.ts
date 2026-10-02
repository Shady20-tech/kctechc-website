import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Resend transactional email.
 *
 * Covers the parts with business consequences and no external dependency: that
 * an unconfigured deployment reports `unconfigured` rather than pretending to
 * have sent, that a provider error or a thrown network error is returned as a
 * value instead of escaping into the request that triggered the notification,
 * and that visitor input is HTML-escaped before it reaches the message body.
 *
 * The network is mocked, so the request *shape* is asserted without sending
 * mail. The gating tests are the ones that matter most: the brief is explicit
 * that a missing external service must be reported, never simulated.
 */

const ENV_KEYS = ["RESEND_API_KEY", "EMAIL_FROM", "EMAIL_CONTACT_TO"] as const;

const saved: Record<string, string | undefined> = {};

/** The most recent `emails.send` argument, captured by the mock. */
let lastSend: Record<string, unknown> | null = null;
let sendResult: { data: { id: string } | null; error: unknown } = {
  data: { id: "email-1" },
  error: null,
};
let sendThrows = false;

vi.mock("resend", () => ({
  Resend: class {
    emails = {
      send: async (input: Record<string, unknown>) => {
        lastSend = input;
        if (sendThrows) throw new Error("network down");
        return sendResult;
      },
    };
  },
}));

beforeEach(() => {
  lastSend = null;
  sendResult = { data: { id: "email-1" }, error: null };
  sendThrows = false;
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
});

/** Import the module fresh, so it re-reads `serverEnv` with the current env. */
async function email() {
  return import("./send");
}

function configure() {
  process.env.RESEND_API_KEY = "re_test";
  process.env.EMAIL_FROM = "KC Technology <orders@kctechc.com>";
  process.env.EMAIL_CONTACT_TO = "inbox@kctechc.com";
}

describe("configuration gating", () => {
  it("reports unconfigured without a RESEND_API_KEY", async () => {
    const { sendOrderConfirmation } = await email();
    const result = await sendOrderConfirmation({
      reference: "KC-ORD-1",
      email: "buyer@example.com",
      fullName: "Buyer",
      totalFormatted: "5 000 FCFA",
      locale: "en",
    });
    expect(result).toEqual({ ok: false, error: "unconfigured" });
    expect(lastSend).toBeNull();
  });

  it("reports unconfigured without an EMAIL_FROM", async () => {
    process.env.RESEND_API_KEY = "re_test";
    const { sendOrderConfirmation } = await email();
    const result = await sendOrderConfirmation({
      reference: "KC-ORD-1",
      email: "buyer@example.com",
      fullName: "Buyer",
      totalFormatted: "5 000 FCFA",
      locale: "en",
    });
    expect(result).toEqual({ ok: false, error: "unconfigured" });
    expect(lastSend).toBeNull();
  });
});

describe("sendInquiryNotification", () => {
  it("sends to the internal inbox with the visitor as reply-to", async () => {
    configure();
    const { sendInquiryNotification } = await email();
    const result = await sendInquiryNotification({
      reference: "KC-INQ-1",
      fullName: "Awa Ngum",
      email: "awa@example.com",
      phone: "+237 679 000 000",
      subject: "Solar quote",
      message: "Please quote a 3kW system.",
      department: "electrical-services",
      service: "solar",
      source: "quote_request",
      locale: "en",
    });

    expect(result).toEqual({ ok: true, id: "email-1" });
    expect(lastSend?.to).toBe("inbox@kctechc.com");
    expect(lastSend?.replyTo).toBe("awa@example.com");
    expect(lastSend?.from).toBe("KC Technology <orders@kctechc.com>");
    expect(String(lastSend?.subject)).toContain("KC-INQ-1");
    expect(String(lastSend?.html)).toContain("Solar quote");
  });

  it("falls back to the public email when EMAIL_CONTACT_TO is unset", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "orders@kctechc.com";
    const { sendInquiryNotification } = await email();
    await sendInquiryNotification({
      reference: "KC-INQ-1",
      fullName: "Awa Ngum",
      email: "awa@example.com",
      phone: null,
      subject: "Hello",
      message: "Hi",
      department: null,
      service: null,
      source: "contact_form",
      locale: "en",
    });
    expect(lastSend?.to).toBe("kctechc@gmail.com");
  });

  it("escapes HTML in visitor-supplied fields", async () => {
    configure();
    const { sendInquiryNotification } = await email();
    await sendInquiryNotification({
      reference: "KC-INQ-2",
      fullName: "<script>alert(1)</script>",
      email: "awa@example.com",
      phone: null,
      subject: "A & B",
      message: "<img src=x onerror=alert(1)>",
      department: null,
      service: null,
      source: "contact_form",
      locale: "en",
    });

    const html = String(lastSend?.html);
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp;");
  });

  it("renders the confirmation in the visitor's locale", async () => {
    configure();
    const { sendOrderConfirmation } = await email();
    await sendOrderConfirmation({
      reference: "KC-ORD-2",
      email: "client@example.com",
      fullName: "Client",
      totalFormatted: "5 000 FCFA",
      locale: "fr",
    });
    expect(String(lastSend?.html)).toContain("Commande reçue");
  });
});

describe("provider failure handling", () => {
  it("returns send_failed when the provider reports an error", async () => {
    configure();
    sendResult = { data: null, error: { message: "invalid from" } };
    const { sendOrderConfirmation } = await email();
    const result = await sendOrderConfirmation({
      reference: "KC-ORD-3",
      email: "buyer@example.com",
      fullName: "Buyer",
      totalFormatted: "5 000 FCFA",
      locale: "en",
    });
    expect(result).toEqual({ ok: false, error: "send_failed" });
  });

  it("returns send_failed instead of throwing when the network fails", async () => {
    configure();
    sendThrows = true;
    const { sendInquiryNotification } = await email();
    const result = await sendInquiryNotification({
      reference: "KC-INQ-3",
      fullName: "Awa",
      email: "awa@example.com",
      phone: null,
      subject: "Hello",
      message: "Hi",
      department: null,
      service: null,
      source: "contact_form",
      locale: "en",
    });
    expect(result).toEqual({ ok: false, error: "send_failed" });
  });
});
