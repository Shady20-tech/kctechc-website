import { describe, expect, it } from "vitest";

import { hashSearchTerm, sanitizeEvent, sanitizeItem } from "./redact";
import { SAFE_ITEM_KEYS, SAFE_PARAM_KEYS, type AnalyticsEvent } from "./events";

/**
 * Analytics redaction.
 *
 * The failure this suite guards against is silent: an event carrying a
 * customer's email looks exactly like a correct one in the GA4 debug view, and
 * by the time anyone notices it has been retained by a third party. So the
 * allowlist is asserted directly rather than only observed through a `track`
 * call.
 */

describe("sanitizeItem", () => {
  it("keeps allowlisted scalar fields", () => {
    const item = {
      item_id: "prod-1",
      item_name: "Solar Inverter",
      item_category: "electrical-services",
      price: 850000,
      quantity: 2,
      currency: "XAF",
      index: 0,
    };
    expect(sanitizeItem(item)).toEqual(item);
  });

  it("drops an unlisted field", () => {
    const item = {
      item_id: "prod-1",
      item_name: "Inverter",
      // Not on SAFE_ITEM_KEYS.
      customer_email: "buyer@example.com",
    } as never;
    const safe = sanitizeItem(item);
    expect(safe).not.toHaveProperty("customer_email");
    expect(Object.keys(safe)).toEqual(["item_id", "item_name"]);
  });

  it("drops a nested object even under an allowlisted key", () => {
    // This is how a leak actually arrives: `content_id` typechecks as unknown,
    // so a spread of an `any` can put personal data under an allowlisted name.
    const item = {
      item_id: { email: "buyer@example.com" },
      item_name: "Inverter",
    } as never;
    const safe = sanitizeItem(item) as Record<string, unknown>;
    expect(safe.item_id).toBeUndefined();
  });

  it("drops empty strings and null", () => {
    const safe = sanitizeItem({
      item_id: "p1",
      item_name: "",
      item_brand: null as never,
    });
    expect(safe).toEqual({ item_id: "p1" });
  });

  it("keeps a numeric zero, which is meaningful", () => {
    // index 0 is the first item in a list; dropping it would lose real data.
    expect(sanitizeItem({ item_id: "p1", item_name: "n", index: 0 }).index).toBe(0);
  });
});

describe("sanitizeEvent", () => {
  it("keeps only allowlisted event params", () => {
    const event = {
      name: "add_to_cart",
      params: {
        value: 850000,
        currency: "XAF",
        lead_source: "store",
        items: [{ item_id: "p1", item_name: "Inverter" }],
      },
    } as AnalyticsEvent;

    const { name, params } = sanitizeEvent(event);
    expect(name).toBe("add_to_cart");
    expect(Object.keys(params).sort()).toEqual(
      ["currency", "items", "lead_source", "value"].sort(),
    );
  });

  it("strips personal data smuggled into params", () => {
    // The realistic mistake: spreading a form state object into params.
    const formState = {
      value: 1000,
      currency: "XAF",
      fullName: "A Customer",
      email: "buyer@example.com",
      phone: "+237679000000",
      address: "12 Half-Mile, Limbe",
    };
    const { params } = sanitizeEvent({
      name: "begin_checkout",
      params: formState,
    } as never);

    const serialized = JSON.stringify(params);
    expect(serialized).not.toContain("buyer@example.com");
    expect(serialized).not.toContain("A Customer");
    expect(serialized).not.toContain("+237679000000");
    expect(serialized).not.toContain("Half-Mile");
    expect(params).toEqual({ value: 1000, currency: "XAF" });
  });

  it("sanitizes each item in the list", () => {
    const { params } = sanitizeEvent({
      name: "purchase",
      params: {
        items: [
          { item_id: "p1", item_name: "A", email: "a@example.com" },
          { item_id: "p2", item_name: "B", email: "b@example.com" },
        ],
      },
    } as never);

    for (const item of params.items as Record<string, unknown>[]) {
      expect(item).not.toHaveProperty("email");
    }
  });

  it("drops a non-array items value rather than forwarding it", () => {
    const { params } = sanitizeEvent({
      name: "view_item",
      params: { items: { email: "x@example.com" } },
    } as never);
    expect(params).not.toHaveProperty("items");
  });

  it("passes a hashed search term and can carry a result count", () => {
    const { params } = sanitizeEvent({
      name: "site_search",
      params: { search_term: "abc123deadbeef", result_count: 4 },
    } as AnalyticsEvent);
    expect(params.search_term).toBe("abc123deadbeef");
    expect(params.result_count).toBe(4);
  });

  it("never emits a key outside the allowlist", () => {
    const { params } = sanitizeEvent({
      name: "generate_lead",
      params: {
        lead_source: "quote",
        department: "electrical-services",
        content_id: "svc-1",
        content_type: "service",
        // Junk that must not survive.
        note: "call me",
        token: "secret",
      },
    } as never);

    for (const key of Object.keys(params)) {
      expect(SAFE_PARAM_KEYS).toContain(key);
    }
  });
});

describe("hashSearchTerm", () => {
  it("produces a stable hash for the same term", async () => {
    const a = await hashSearchTerm("solar panels");
    const b = await hashSearchTerm("solar panels");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is case- and whitespace-insensitive, so one term is one row", async () => {
    const a = await hashSearchTerm("  Solar Panels  ");
    const b = await hashSearchTerm("solar panels");
    expect(a).toBe(b);
  });

  it("differs for different terms", async () => {
    const a = await hashSearchTerm("solar");
    const b = await hashSearchTerm("sola");
    expect(a).not.toBe(b);
  });

  it("returns null for an empty term rather than hashing nothing", async () => {
    expect(await hashSearchTerm("")).toBeNull();
    expect(await hashSearchTerm("   ")).toBeNull();
  });

  it("does not return the raw term", async () => {
    // The whole point: a visitor may type an email into the search box.
    const term = "buyer@example.com";
    const hashed = await hashSearchTerm(term);
    expect(hashed).not.toBe(term);
    expect(hashed).not.toContain("buyer");
    expect(hashed).not.toContain("example.com");
  });
});

describe("allowlists", () => {
  it("contains no field that could hold personal data", () => {
    const forbidden = [
      "email",
      "phone",
      "name",
      "full_name",
      "fullName",
      "address",
      "message",
      "subject",
      "card",
      "cvv",
      "password",
    ];
    for (const key of [...SAFE_PARAM_KEYS, ...SAFE_ITEM_KEYS]) {
      expect(forbidden, `${key} must not be sendable`).not.toContain(key);
    }
  });
});
