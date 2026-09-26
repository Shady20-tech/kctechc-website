import { describe, expect, it } from "vitest";
import {
  buildPendingTranslationRows,
  fieldErrors,
  productInputSchema,
} from "@/lib/store/product-input";

const VALID = {
  title: "ThinkPad X1 Carbon",
  slug: "thinkpad-x1",
  sku: "KC-LAP-01",
  categoryId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
  shortDescription: "A lightweight business laptop for the field.",
  description: "A full description of the machine and its warranty terms.",
  brand: "Lenovo",
  gtin: "1234567890123",
  priceMinor: 850000,
  stock: 4,
  seoTitle: "",
  seoDescription: "",
};

describe("productInputSchema", () => {
  it("accepts a well-formed product", () => {
    expect(productInputSchema.safeParse(VALID).success).toBe(true);
  });

  it("rejects an uppercase slug rather than normalizing it", () => {
    // Two different inputs silently becoming one slug is how a product ends up at
    // a URL nobody typed, so this is an error, not a correction.
    const result = productInputSchema.safeParse({
      ...VALID,
      slug: "ThinkPad-X1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a slug with underscores or spaces", () => {
    for (const slug of ["thinkpad_x1", "thinkpad x1", "thinkpad--x1", "-x1"]) {
      expect(
        productInputSchema.safeParse({ ...VALID, slug }).success,
        slug,
      ).toBe(false);
    }
  });

  it("rejects a zero price", () => {
    // A zero price on a published product is a free offer, not an empty field.
    expect(
      productInputSchema.safeParse({ ...VALID, priceMinor: 0 }).success,
    ).toBe(false);
  });

  it("rejects a negative price", () => {
    expect(
      productInputSchema.safeParse({ ...VALID, priceMinor: -1 }).success,
    ).toBe(false);
  });

  it("rejects a fractional price", () => {
    // Prices are whole francs; a fractional value would be rounded somewhere and
    // the customer would see a price the editor did not enter.
    expect(
      productInputSchema.safeParse({ ...VALID, priceMinor: 10.5 }).success,
    ).toBe(false);
  });

  it("accepts zero stock", () => {
    // Zero stock is a real state — the product exists and is out of stock.
    expect(productInputSchema.safeParse({ ...VALID, stock: 0 }).success).toBe(
      true,
    );
  });

  it("rejects negative stock", () => {
    expect(productInputSchema.safeParse({ ...VALID, stock: -1 }).success).toBe(
      false,
    );
  });

  it("coerces numeric strings from the form", () => {
    const result = productInputSchema.safeParse({
      ...VALID,
      priceMinor: "850000",
      stock: "4",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priceMinor).toBe(850000);
      expect(result.data.stock).toBe(4);
    }
  });

  it("accepts the GTIN lengths the standard allows", () => {
    for (const gtin of [
      "12345678",
      "123456789012",
      "1234567890123",
      "12345678901234",
    ]) {
      expect(
        productInputSchema.safeParse({ ...VALID, gtin }).success,
        gtin,
      ).toBe(true);
    }
  });

  it("rejects a GTIN of the wrong length", () => {
    for (const gtin of ["1234", "123456789", "123456789012345"]) {
      expect(
        productInputSchema.safeParse({ ...VALID, gtin }).success,
        gtin,
      ).toBe(false);
    }
  });

  it("rejects a GTIN containing letters", () => {
    expect(
      productInputSchema.safeParse({ ...VALID, gtin: "1234567890ABC" }).success,
    ).toBe(false);
  });

  it("treats an empty GTIN as absent", () => {
    const result = productInputSchema.safeParse({ ...VALID, gtin: "" });
    expect(result.success).toBe(true);
  });

  it("trims whitespace around text fields", () => {
    const result = productInputSchema.safeParse({
      ...VALID,
      title: "  ThinkPad  ",
      slug: "  thinkpad-x1  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("ThinkPad");
      expect(result.data.slug).toBe("thinkpad-x1");
    }
  });

  it("rejects a too-short title", () => {
    expect(productInputSchema.safeParse({ ...VALID, title: "A" }).success).toBe(
      false,
    );
  });

  it("rejects a too-short description", () => {
    expect(
      productInputSchema.safeParse({ ...VALID, description: "Too short." })
        .success,
    ).toBe(false);
  });

  it("rejects a category id that is not a uuid", () => {
    expect(
      productInputSchema.safeParse({ ...VALID, categoryId: "laptops" }).success,
    ).toBe(false);
  });
});

describe("fieldErrors", () => {
  it("keys messages by field so the form can place them", () => {
    const result = productInputSchema.safeParse({ ...VALID, slug: "Bad Slug" });
    expect(result.success).toBe(false);
    if (result.success) return;
    const errors = fieldErrors(result.error);
    expect(Object.keys(errors)).toContain("slug");
  });

  it("keeps the first message per field", () => {
    const result = productInputSchema.safeParse({ ...VALID, title: "" });
    if (result.success) return;
    const errors = fieldErrors(result.error);
    expect(typeof errors.title).toBe("string");
  });
});

describe("buildPendingTranslationRows", () => {
  it("creates an English row and a pending French row per field", () => {
    const rows = buildPendingTranslationRows({
      productId: "p1",
      values: { name: "ThinkPad", description: "A description." },
    });

    const english = rows.filter((row) => row.locale === "en");
    const french = rows.filter((row) => row.locale === "fr");

    expect(english).toHaveLength(2);
    expect(french).toHaveLength(2);
    expect(english.every((row) => row.state === "translated")).toBe(true);
  });

  it("leaves the French value empty and pending", () => {
    // Seeding the French row with the English text would mark the French as done
    // when it is not, and the page would show English as a translation.
    const rows = buildPendingTranslationRows({
      productId: "p1",
      values: { name: "ThinkPad" },
    });
    const french = rows.find((row) => row.locale === "fr");
    expect(french?.value).toBe("");
    expect(french?.state).toBe("pending");
  });

  it("skips a field with no source value", () => {
    const rows = buildPendingTranslationRows({
      productId: "p1",
      values: { name: "ThinkPad", seo_title: null, seo_description: "  " },
    });
    expect(rows.map((row) => row.field_name)).toEqual(["name", "name"]);
  });

  it("uses the entity type the trigger expects", () => {
    const rows = buildPendingTranslationRows({
      productId: "p1",
      values: { name: "ThinkPad" },
    });
    expect(rows.every((row) => row.entity_type === "product")).toBe(true);
  });

  it("attaches every row to the product id", () => {
    const rows = buildPendingTranslationRows({
      productId: "product-abc",
      values: { name: "A", description: "B" },
    });
    expect(rows.every((row) => row.entity_id === "product-abc")).toBe(true);
  });

  it("returns nothing when there is no source content", () => {
    expect(
      buildPendingTranslationRows({ productId: "p1", values: {} }),
    ).toEqual([]);
  });
});
