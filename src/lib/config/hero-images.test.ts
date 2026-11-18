import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { CORPORATE_PAGE_HEROES, DEPARTMENTS } from "@/lib/config/site";

/**
 * Department hero images are referenced by path from `DEPARTMENTS`, and a
 * mistyped path fails quietly: `next/image` still renders the element, the
 * browser shows an empty box, and the hero looks broken rather than erroring.
 * This asserts each configured path resolves to a real JPEG under `public/`.
 */
const PUBLIC_DIR = join(process.cwd(), "public");

const JPEG_SOI = 0xffd8;
const JPEG_EOI = 0xffd9;

describe("department hero images", () => {
  it("points every department at a public path", () => {
    for (const department of DEPARTMENTS) {
      expect(department.heroImage.startsWith("/hero/")).toBe(true);
      expect(department.heroImage.endsWith(".jpg")).toBe(true);
    }
  });

  it("resolves every configured image to a complete JPEG on disk", () => {
    for (const department of DEPARTMENTS) {
      const file = join(PUBLIC_DIR, department.heroImage);
      expect(existsSync(file), `${department.slug}: ${file} is missing`).toBe(
        true,
      );

      const bytes = readFileSync(file);
      expect(
        bytes.readUInt16BE(0),
        `${department.slug}: not a JPEG (bad start-of-image)`,
      ).toBe(JPEG_SOI);
      expect(
        bytes.readUInt16BE(bytes.length - 2),
        `${department.slug}: truncated JPEG (bad end-of-image)`,
      ).toBe(JPEG_EOI);
    }
  });

  it("gives each department its own image", () => {
    const paths = DEPARTMENTS.map((department) => department.heroImage);
    expect(new Set(paths).size).toBe(paths.length);
  });

  // The four corporate pages used to share one backdrop (About and Contact) or
  // borrow a department's (Gallery used Electrical Services), which made them
  // read as the same page. Each now has its own photograph.
  it("gives each corporate page its own image, distinct from every department", () => {
    const paths = CORPORATE_PAGE_HEROES.map((entry) => entry.image);
    expect(new Set(paths).size).toBe(paths.length);
    const departmentPaths = new Set(
      DEPARTMENTS.map((department) => department.heroImage),
    );
    for (const path of paths) {
      expect(
        departmentPaths.has(path),
        `${path} is also a department hero`,
      ).toBe(false);
    }
  });

  // A CC BY image obliges us to credit it. The obligation travels with the
  // entry so it cannot be dropped by editing a page, and a CC0 file carries no
  // credit rather than an unnecessary one.
  it("declares a credit exactly where the licence requires it", () => {
    const needsCredit = new Set(["services", "gallery", "contact"]);
    for (const entry of CORPORATE_PAGE_HEROES) {
      if (needsCredit.has(entry.page)) {
        expect(entry.credit, `${entry.page} needs a credit`).toBeTruthy();
        expect(entry.credit?.label).toContain("Wikimedia Commons");
        expect(entry.credit?.href).toMatch(
          /^https:\/\/commons\.wikimedia\.org\//,
        );
      } else {
        expect(
          entry.credit,
          `${entry.page} is CC0 and carries no credit`,
        ).toBeUndefined();
      }
    }
  });

  // A hero renders full-bleed, so a thumbnail would be stretched across the
  // viewport. The placeholder assets that shipped first were 246x113–275x183 —
  // valid JPEGs that the two structural tests above happily accepted. These
  // bounds catch a regression to a placeholder-sized asset.
  //
  // The floor is deliberately 600 rather than 1920: `next/image` never upscales,
  // so the widest variant a browser can receive is capped at the source width.
  // Three of the four hero sources top out below 1920 (626–1749), and asking
  // for a bigger file than exists simply returns the smaller one — silently.
  // Raising this floor above 626 would fail real-estate, whose upstream asset
  // has no larger version to fetch.
  it("ships hero-sized, landscape images", () => {
    // The corporate backdrop is referenced by path from two pages rather than
    // from DEPARTMENTS, so it is checked explicitly instead of being missed.
    const paths = [
      ...DEPARTMENTS.map((department) => department.heroImage),
      "/hero/corporate-v3.jpg",
      ...CORPORATE_PAGE_HEROES.map((page) => page.image),
    ];
    for (const path of paths) {
      const file = join(PUBLIC_DIR, path);
      expect(existsSync(file), `${path} is missing`).toBe(true);
      const { width, height } = jpegDimensions(readFileSync(file));
      expect(
        width,
        `${path}: ${width}x${height} is too small for a full-bleed hero`,
      ).toBeGreaterThanOrEqual(600);
      expect(
        width,
        `${path}: ${width}x${height} is not landscape`,
      ).toBeGreaterThan(height);
    }
  });
});

/**
 * The founder's portrait is referenced by path from `ChairmanMessage`, so a
 * mistyped or missing file fails the same silent way a hero does. It is a
 * portrait rather than a landscape, so it is asserted separately instead of
 * being folded into the hero check above.
 *
 * The path is asserted to match the component's constant rather than being
 * hard-coded twice: the filename carries a version suffix so a byte swap
 * actually reaches the browser past the image optimiser's cache, and a bump in
 * one place without the other would leave the test passing against a file
 * nothing renders.
 */
describe("chairman portrait", () => {
  const source = readFileSync(
    join(process.cwd(), "src/components/ui/ChairmanMessage.tsx"),
    "utf8",
  );
  const declared = /const PORTRAIT_SRC = "([^"]+)"/.exec(source)?.[1];

  it("declares a portrait path", () => {
    expect(declared).toBeTruthy();
  });

  it("resolves to a complete, portrait-oriented JPEG", () => {
    const file = join(PUBLIC_DIR, declared!);
    expect(existsSync(file), `${file} is missing`).toBe(true);
    const bytes = readFileSync(file);
    expect(bytes.readUInt16BE(0), "not a JPEG").toBe(JPEG_SOI);
    expect(bytes.readUInt16BE(bytes.length - 2), "truncated JPEG").toBe(
      JPEG_EOI,
    );
    const { width, height } = jpegDimensions(bytes);
    expect(width, `${width}x${height} is too small`).toBeGreaterThanOrEqual(
      600,
    );
    expect(
      height,
      `${width}x${height} should be portrait (height > width)`,
    ).toBeGreaterThan(width);
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
    // SOF0-SOF15, excluding the non-frame markers DHT (c4), JPG (c8) and DAC (cc).
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
