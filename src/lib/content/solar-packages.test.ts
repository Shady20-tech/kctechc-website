import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  SOLAR_PACKAGES,
  SOLAR_PACKAGE_CATEGORIES,
  findSolarPackage,
  packageBySku,
  solarPackageImages,
  solarPackagesInCategory,
} from "@/lib/content/solar-packages";
import { createTranslator } from "@/lib/i18n/translator";
import { LOCALES } from "@/lib/i18n/locales";

/**
 * Solar package data and assets.
 *
 * The packages are a bundled data module referenced by path and by message key,
 * so the two failure modes that throw nothing are checked here: a mistyped image
 * path (an empty box) and a missing key (the dotted key rendered as visible
 * text). The seed migration mirrors these ids and SKUs, and `packageBySku` is
 * the join it relies on, so SKU uniqueness is asserted too.
 */
const PUBLIC_DIR = join(process.cwd(), "public");
const JPEG_SOI = 0xffd8;
const JPEG_EOI = 0xffd9;

describe("solar package data", () => {
  it("lists nine packages across four categories", () => {
    expect(SOLAR_PACKAGE_CATEGORIES).toHaveLength(4);
    expect(SOLAR_PACKAGES).toHaveLength(9);
  });

  it("uses unique ids, slugs and SKUs", () => {
    for (const [label, values] of [
      ["ids", SOLAR_PACKAGES.map((pkg) => pkg.id)],
      ["SKUs", SOLAR_PACKAGES.map((pkg) => pkg.sku)],
      ["category slugs", SOLAR_PACKAGE_CATEGORIES.map((c) => c.slug)],
      ["category ids", SOLAR_PACKAGE_CATEGORIES.map((c) => c.id)],
    ] as const) {
      expect(new Set(values).size, `${label} are not unique`).toBe(values.length);
    }
  });

  it("assigns every package to a declared category", () => {
    const categoryIds = new Set(SOLAR_PACKAGE_CATEGORIES.map((c) => c.id));
    for (const pkg of SOLAR_PACKAGES) {
      expect(categoryIds.has(pkg.categoryId), `${pkg.id} category`).toBe(true);
      expect(
        solarPackagesInCategory(pkg.categoryId).some((entry) => entry.id === pkg.id),
      ).toBe(true);
    }
  });

  it("keeps the component prices within the printed total", () => {
    for (const pkg of SOLAR_PACKAGES) {
      // The card prints materials, accessories, installation and total, all
      // copied from the brochure. The brochure's own figures do not always add
      // up exactly (premium-6kw is ~2.4% short, because its total was drawn from
      // a slightly different materials figure), so the invariant asserted here
      // is the one that matters for a customer: the total is never *less* than
      // the parts shown. Inventing a balancing number to force an exact sum
      // would put a figure in the UI that the source does not state.
      const components =
        pkg.materialsMinor + pkg.accessoriesMinor + pkg.installationMinor;
      expect(components, `${pkg.id} components exceed the total`).toBeLessThanOrEqual(
        pkg.priceMinor,
      );
      expect(pkg.priceMinor - components, `${pkg.id} total drifts too far`).toBeLessThan(
        pkg.priceMinor * 0.1,
      );
    }
  });

  it("resolves a package by id and by SKU", () => {
    const sample = SOLAR_PACKAGES[0]!;
    expect(findSolarPackage(sample.id)?.id).toBe(sample.id);
    expect(packageBySku(sample.sku)?.id).toBe(sample.id);
    expect(findSolarPackage("does-not-exist")).toBeUndefined();
    expect(packageBySku("KC-SOLAR-NOPE")).toBeUndefined();
  });

  it("points every image at a public electrical path", () => {
    for (const path of solarPackageImages()) {
      expect(path.startsWith("/products/electrical/")).toBe(true);
      expect(path.endsWith(".jpg")).toBe(true);
    }
  });

  it("resolves every image to a complete JPEG on disk", () => {
    for (const path of solarPackageImages()) {
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

  it("resolves every copy and line key in both locales", () => {
    for (const locale of LOCALES) {
      const { t } = createTranslator(locale);
      for (const category of SOLAR_PACKAGE_CATEGORIES) {
        for (const key of [
          `solarPackages.categories.${category.id}.name`,
          `solarPackages.categories.${category.id}.suitedFor`,
          `solarPackages.categories.${category.id}.summary`,
        ]) {
          expect(t(key), `${locale}: ${key} is missing`).not.toBe(key);
        }
      }
      for (const pkg of SOLAR_PACKAGES) {
        const keys = [
          `solarPackages.items.${pkg.id}.name`,
          `solarPackages.items.${pkg.id}.tag`,
          `solarPackages.items.${pkg.id}.suitedFor`,
          `solarPackages.items.${pkg.id}.summary`,
          `solarPackages.items.${pkg.id}.alt`,
          ...pkg.lines.map((line) => line.key),
        ];
        for (const key of keys) {
          // A missing key falls through to the key itself, a dotted identifier
          // rather than a sentence.
          expect(t(key), `${locale}: ${key} is missing`).not.toBe(key);
          expect(t(key).length).toBeGreaterThan(0);
        }
      }
    }
  });
});
