import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { DEPARTMENTS } from "@/lib/config/site";

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
});
