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

  /**
   * The two wordmarks shipped swapped once: `sako-power.png` held the HIKVISION
   * mark and `hikvision.png` held SAKO POWER's. Nothing caught it, because the
   * checks above only prove each path resolves to a complete PNG with a sane
   * shape — properties that are equally true of the wrong file. A swap is
   * invisible to the type checker, to the component tests (which assert the
   * *names*, not the pixels) and to a screenshot review of a stylised wordmark.
   *
   * The marks differ in one structural way that survives a rename: SAKO POWER is
   * a stacked lockup — the name on one line, a "SINCE 1997" strapline beneath it —
   * so it is roughly 2:1. HIKVISION is a single line of nine letters, so it is
   * roughly 6:1. The aspect ratios therefore order the pair, and swapping the
   * files inverts that order. The bounds are wide enough to absorb a re-export at
   * a different size but far too tight to be met by the other mark.
   */
  it("ships each wordmark in the file named for it", () => {
    const sako = pngDimensions(
      readFileSync(join(PUBLIC_DIR, "/brand/partners/sako-power.png")),
    );
    const hik = pngDimensions(
      readFileSync(join(PUBLIC_DIR, "/brand/partners/hikvision.png")),
    );
    const sakoAspect = sako.width / sako.height;
    const hikAspect = hik.width / hik.height;

    expect(
      sakoAspect,
      `sako-power.png is ${sako.width}x${sako.height}: a stacked two-line lockup should be under 3:1, so this looks like the HIKVISION file`,
    ).toBeLessThan(3);
    expect(
      hikAspect,
      `hikvision.png is ${hik.width}x${hik.height}: a single-line wordmark should be over 4:1, so this looks like the SAKO POWER file`,
    ).toBeGreaterThan(4);
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
