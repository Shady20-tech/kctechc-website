import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  ELECTRICAL_BRANDS,
  electricalBrandLogos,
} from "@/lib/content/electrical-brands";
import { createTranslator } from "@/lib/i18n/translator";
import { LOCALES } from "@/lib/i18n/locales";

/**
 * Brand partner marks.
 *
 * The logos are referenced by path from a plain data module, so a mistyped path
 * renders an empty box rather than throwing. These checks resolve every path on
 * disk, confirm each file is a complete PNG, and confirm the stored dimensions
 * are sane for a 4rem-tall card box — a 1:1 monogram and a 6:1 wordmark both have
 * to survive the same container.
 */
const PUBLIC_DIR = join(process.cwd(), "public");
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("electrical brand data", () => {
  it("names the three suppliers with unique ids and logos", () => {
    expect(ELECTRICAL_BRANDS.map((brand) => brand.name)).toEqual([
      "SAKO POWER",
      "DEYE",
      "HIKVISION",
    ]);
    const ids = ELECTRICAL_BRANDS.map((brand) => brand.id);
    const logos = electricalBrandLogos();
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(logos).size).toBe(logos.length);
  });

  it("resolves every logo to a complete PNG on disk", () => {
    for (const path of electricalBrandLogos()) {
      const file = join(PUBLIC_DIR, path);
      expect(existsSync(file), `${path} is missing`).toBe(true);
      const bytes = readFileSync(file);
      expect(
        bytes.subarray(0, 8).equals(PNG_SIGNATURE),
        `${path}: not a PNG`,
      ).toBe(true);
      // IEND chunk closes a complete PNG; a truncated download loses it.
      expect(
        bytes.subarray(-8).includes(Buffer.from("IEND")),
        `${path}: truncated PNG`,
      ).toBe(true);
    }
  });

  it("ships logos with a sane aspect ratio for the card box", () => {
    for (const path of electricalBrandLogos()) {
      const { width, height } = pngDimensions(
        readFileSync(join(PUBLIC_DIR, path)),
      );
      // A 4rem-tall box with `object-contain` fits anything, but a logo narrower
      // than it is tall would render as a speck next to a long wordmark.
      expect(width, `${path}: ${width}x${height}`).toBeGreaterThanOrEqual(height);
      expect(height, `${path}: ${width}x${height} is too small`).toBeGreaterThanOrEqual(
        60,
      );
    }
  });

  it("resolves every category key in both locales", () => {
    for (const locale of LOCALES) {
      const { t } = createTranslator(locale);
      for (const brand of ELECTRICAL_BRANDS) {
        expect(
          t(brand.categoryKey),
          `${locale}: ${brand.categoryKey} is missing`,
        ).not.toBe(brand.categoryKey);
      }
    }
  });
});

/** Reads width/height from a PNG's IHDR chunk. */
function pngDimensions(bytes: Buffer): { width: number; height: number } {
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}
