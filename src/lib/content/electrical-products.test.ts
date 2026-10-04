import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  ELECTRICAL_PRODUCTS,
  electricalProductImages,
} from "@/lib/content/electrical-products";
import { createTranslator } from "@/lib/i18n/translator";
import { LOCALES } from "@/lib/i18n/locales";

/**
 * Product showcase data and assets.
 *
 * The showcase is referenced by path from a plain data module, so a mistyped
 * path or a half-written file fails quietly the way a hero does: `next/image`
 * still renders the element, the browser shows an empty box, and nothing throws.
 * These checks resolve every path on disk and confirm each image is a complete,
 * square, card-sized JPEG.
 *
 * The message keys are checked here too rather than only in the locale parity
 * test: parity proves en and fr have the same *shape*, but a product entry whose
 * key does not exist in either dictionary would still be missing from both, and
 * the translator would render the dotted key as visible text.
 */
const PUBLIC_DIR = join(process.cwd(), "public");
const JPEG_SOI = 0xffd8;
const JPEG_EOI = 0xffd9;

describe("electrical product data", () => {
  it("lists six products with unique ids and images", () => {
    expect(ELECTRICAL_PRODUCTS).toHaveLength(6);
    const ids = ELECTRICAL_PRODUCTS.map((product) => product.id);
    const images = electricalProductImages();
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(images).size).toBe(images.length);
  });

  it("points every product at a public square-card path", () => {
    for (const product of ELECTRICAL_PRODUCTS) {
      expect(product.image.startsWith("/products/electrical/")).toBe(true);
      expect(product.image.endsWith(".jpg")).toBe(true);
    }
  });

  it("resolves every image to a complete JPEG on disk", () => {
    for (const path of electricalProductImages()) {
      const file = join(PUBLIC_DIR, path);
      expect(existsSync(file), `${path} is missing`).toBe(true);
      const bytes = readFileSync(file);
      expect(bytes.readUInt16BE(0), `${path}: not a JPEG`).toBe(JPEG_SOI);
      expect(
        bytes.readUInt16BE(bytes.length - 2),
        `${path}: truncated JPEG`,
      ).toBe(JPEG_EOI);
    }
  });

  it("ships square, card-sized images", () => {
    for (const path of electricalProductImages()) {
      const { width, height } = jpegDimensions(
        readFileSync(join(PUBLIC_DIR, path)),
      );
      // The tile renders in a 1:1 media box, so a non-square source is cropped
      // by `object-cover` and the subject can fall outside the crop.
      expect(width, `${path}: ${width}x${height} is not square`).toBe(height);
      expect(
        width,
        `${path}: ${width}x${height} is too small for a card`,
      ).toBeGreaterThanOrEqual(600);
    }
  });

  it("resolves every copy key in both locales", () => {
    for (const locale of LOCALES) {
      const { t } = createTranslator(locale);
      for (const product of ELECTRICAL_PRODUCTS) {
        for (const key of [product.nameKey, product.specKey, product.altKey]) {
          // A missing key falls through to the key itself, which is a dotted
          // identifier rather than a sentence.
          expect(t(key), `${locale}: ${key} is missing`).not.toBe(key);
          expect(t(key).length).toBeGreaterThan(0);
        }
      }
    }
  });
});

/** Reads width/height from a JPEG's first SOF marker. */
function jpegDimensions(bytes: Buffer): { width: number; height: number } {
  let offset = 2; // skip SOI
  while (offset < bytes.length - 1) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1] ?? 0;
    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc
    ) {
      return {
        height: bytes.readUInt16BE(offset + 5),
        width: bytes.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + bytes.readUInt16BE(offset + 2);
  }
  throw new Error("no SOF marker found");
}
