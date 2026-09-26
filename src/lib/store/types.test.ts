import { describe, expect, it } from "vitest";
import {
  availabilityLabelKey,
  conditionLabelKey,
  formatPrice,
  isPurchasable,
  minorUnitDivisor,
  parseSpecifications,
  priceForFeed,
  primaryImage,
  type ProductImage,
} from "@/lib/store/types";

describe("minorUnitDivisor", () => {
  it("treats XAF as a zero-decimal currency", () => {
    // The catalogue is priced in Central African francs, which have no
    // subdivision. Assuming two decimals would render 850000 XAF as 8,500.00.
    expect(minorUnitDivisor("XAF")).toBe(1);
  });

  it("treats a two-decimal currency as 100", () => {
    expect(minorUnitDivisor("EUR")).toBe(100);
    expect(minorUnitDivisor("USD")).toBe(100);
  });

  it("is case-insensitive", () => {
    expect(minorUnitDivisor("xaf")).toBe(1);
  });
});

describe("formatPrice", () => {
  it("renders whole francs with no fractional part", () => {
    const formatted = formatPrice(850000, "XAF", "en");
    expect(formatted).not.toContain(".00");
    expect(formatted).toContain("850");
  });

  it("renders a two-decimal currency with its decimals", () => {
    const formatted = formatPrice(85000, "EUR", "en");
    expect(formatted).toContain("850.00");
  });

  it("produces a different string per locale", () => {
    const en = formatPrice(850000, "XAF", "en");
    const fr = formatPrice(850000, "XAF", "fr");
    expect(typeof en).toBe("string");
    expect(typeof fr).toBe("string");
    expect(en.length).toBeGreaterThan(0);
    expect(fr.length).toBeGreaterThan(0);
  });

  it("degrades to a readable number for an unknown currency code", () => {
    const formatted = formatPrice(5000, "NOTACURRENCY", "en");
    expect(formatted).toContain("NOTACURRENCY");
  });
});

describe("priceForFeed", () => {
  it("emits a period decimal string, never a localized one", () => {
    // Merchant Center parses this with a period; a comma would be rejected.
    expect(priceForFeed(850000, "XAF")).toBe("850000");
    expect(priceForFeed(85000, "EUR")).toBe("850.00");
  });

  it("never emits a thousands separator", () => {
    expect(priceForFeed(1234567, "XAF")).toBe("1234567");
  });
});

describe("availabilityLabelKey", () => {
  it("maps each enum value to a translation key", () => {
    expect(availabilityLabelKey("in_stock")).toBe(
      "store.availability.in_stock",
    );
    expect(availabilityLabelKey("backorder")).toBe(
      "store.availability.backorder",
    );
  });
});

describe("conditionLabelKey", () => {
  it("maps each enum value to a translation key", () => {
    expect(conditionLabelKey("refurbished")).toBe(
      "store.condition.refurbished",
    );
  });
});

describe("isPurchasable", () => {
  it("allows in-stock, preorder and backorder", () => {
    expect(isPurchasable("in_stock")).toBe(true);
    expect(isPurchasable("preorder")).toBe(true);
    expect(isPurchasable("backorder")).toBe(true);
  });

  it("refuses out-of-stock and discontinued", () => {
    expect(isPurchasable("out_of_stock")).toBe(false);
    expect(isPurchasable("discontinued")).toBe(false);
  });
});

describe("primaryImage", () => {
  const images: ProductImage[] = [
    { storagePath: "b.jpg", alt: "B", isPrimary: false, position: 2 },
    { storagePath: "a.jpg", alt: "A", isPrimary: true, position: 1 },
  ];

  it("prefers the image flagged primary", () => {
    expect(primaryImage(images)?.storagePath).toBe("a.jpg");
  });

  it("falls back to the first image when none is flagged", () => {
    const unflagged = images.map((image) => ({ ...image, isPrimary: false }));
    expect(primaryImage(unflagged)?.storagePath).toBe("b.jpg");
  });

  it("returns undefined for an empty list", () => {
    expect(primaryImage([])).toBeUndefined();
  });
});

describe("parseSpecifications", () => {
  it("keeps well-formed pairs", () => {
    expect(parseSpecifications([{ label: "Weight", value: "1.1 kg" }])).toEqual(
      [{ label: "Weight", value: "1.1 kg" }],
    );
  });

  it("drops a half-populated pair", () => {
    // A label with no value would render a blank row.
    expect(
      parseSpecifications([{ label: "Weight" }, { value: "2 kg" }]),
    ).toEqual([]);
  });

  it("drops entries that are not objects", () => {
    expect(parseSpecifications(["nope", 42, null])).toEqual([]);
  });

  it("returns an empty list for a non-array value", () => {
    expect(parseSpecifications({ label: "Weight", value: "1 kg" })).toEqual([]);
    expect(parseSpecifications(null)).toEqual([]);
  });

  it("trims surrounding whitespace", () => {
    expect(
      parseSpecifications([{ label: "  Weight  ", value: "  1 kg  " }]),
    ).toEqual([{ label: "Weight", value: "1 kg" }]);
  });
});
