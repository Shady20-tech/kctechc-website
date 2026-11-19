import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  ELECTRICAL_WORK,
  ELECTRICAL_WORK_ALT_KEY,
  electricalWorkImages,
} from "@/lib/content/electrical-work";
import { createTranslator } from "@/lib/i18n/translator";
import { LOCALES } from "@/lib/i18n/locales";

/**
 * Completed-work photography.
 *
 * The gallery is referenced by path from a plain data module, so a mistyped path
 * fails quietly the way a hero does: `next/image` still renders the element, the
 * browser shows an empty box, and nothing throws. These checks resolve every path
 * on disk and confirm each file is a complete JPEG of usable size.
 *
 * The description is asserted in both locales for the same reason the product
 * showcase asserts its keys: a missing key renders the dotted identifier as
 * visible text, and that is the only alt text these images carry.
 */
const PUBLIC_DIR = join(process.cwd(), "public");
const JPEG_SOI = 0xffd8;
const JPEG_EOI = 0xffd9;

describe("completed work data", () => {
  it("lists eight photographs with unique ids and paths", () => {
    expect(ELECTRICAL_WORK).toHaveLength(8);
    const ids = ELECTRICAL_WORK.map((work) => work.id);
    const images = electricalWorkImages();
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(images).size).toBe(images.length);
  });

  it("points every photograph at a public path", () => {
    for (const work of ELECTRICAL_WORK) {
      expect(work.image.startsWith("/work/")).toBe(true);
      expect(work.image.endsWith(".jpg")).toBe(true);
    }
  });

  it("resolves every image to a complete JPEG on disk", () => {
    for (const path of electricalWorkImages()) {
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

  it("ships photographs large enough for a card", () => {
    for (const path of electricalWorkImages()) {
      const { width, height } = jpegDimensions(
        readFileSync(join(PUBLIC_DIR, path)),
      );
      expect(width, `${path}: ${width}x${height} is too narrow`).toBeGreaterThanOrEqual(
        600,
      );
      expect(height, `${path}: ${width}x${height} is too short`).toBeGreaterThanOrEqual(
        800,
      );
      // The tile is a 3:4 portrait box. The sources are all 3:4, so a future
      // replacement that is landscape would be cropped through the subject.
      expect(
        Math.abs(width / height - 3 / 4),
        `${path}: ${width}x${height} is not 3:4`,
      ).toBeLessThan(0.05);
    }
  });

  it("resolves the shared description in both locales", () => {
    for (const locale of LOCALES) {
      const { t } = createTranslator(locale);
      const alt = t(ELECTRICAL_WORK_ALT_KEY);
      expect(alt, `${locale}: ${ELECTRICAL_WORK_ALT_KEY} is missing`).not.toBe(
        ELECTRICAL_WORK_ALT_KEY,
      );
      expect(alt.length).toBeGreaterThan(20);
    }
  });
});

/** Reads width/height from a JPEG's first SOF marker. */
function jpegDimensions(bytes: Buffer): { width: number; height: number } {
  let offset = 2;
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
