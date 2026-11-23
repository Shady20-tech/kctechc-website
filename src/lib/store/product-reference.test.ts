import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { productInputSchema } from "./product-input";

/**
 * The GTIN field was removed because it asked a department admin to type a
 * manufacturer barcode with a valid GS1 check digit, which is a supply-chain
 * data-entry task rather than part of posting a product. The replacement is a
 * reference the database issues itself.
 *
 * These assertions guard the removal in both directions: the editor is never
 * asked for an identifier, and no code path still reads a column that no longer
 * exists.
 */

const MIGRATIONS = join(process.cwd(), "supabase", "migrations");

function migrationNamed(fragment: string): string {
  const file = readdirSync(MIGRATIONS).find(
    (name) => name.includes(fragment) && name.endsWith(".sql"),
  );
  if (!file) throw new Error(`no migration matching ${fragment}`);
  return readFileSync(join(MIGRATIONS, file), "utf8");
}

describe("product reference replaces GTIN", () => {
  const migration = migrationNamed("product_reference_replaces_gtin");

  it("drops the gtin column and its constraint", () => {
    expect(migration).toContain("drop constraint if exists products_gtin_valid");
    expect(migration).toContain("drop column if exists gtin");
    expect(migration).toContain("drop function if exists public.gtin_is_valid");
  });

  it("creates the reference before dropping anything", () => {
    // Order matters on a live database: the replacement must exist and be
    // backfilled before the old column goes, or the table briefly has neither.
    const addAt = migration.indexOf("add column if not exists product_reference");
    const dropAt = migration.indexOf("drop column if exists gtin");
    expect(addAt).toBeGreaterThan(-1);
    expect(dropAt).toBeGreaterThan(addAt);
  });

  it("generates the reference in the database, not the form", () => {
    expect(migration).toContain("create sequence if not exists public.product_reference_seq");
    expect(migration).toContain("KC-PR-");
    expect(migration).toContain("set default public.generate_product_reference()");
    expect(migration).toContain("set not null");
  });

  it("revokes the new function from browser roles", () => {
    // Phase 12 hardened the EXECUTE surface before this function existed, so the
    // revoke has to live in this migration or the function ships browser-callable.
    expect(migration).toContain(
      "revoke all on function public.generate_product_reference() from anon, authenticated",
    );
  });

  it("does not ask the editor for any identifier beyond the SKU", () => {
    const form = readFileSync(
      join(process.cwd(), "src", "components", "admin", "ProductForm.tsx"),
      "utf8",
    );
    expect(form).not.toMatch(/name="gtin"/);
    expect(form).not.toContain("fieldGtin");
    // The reference is displayed read-only when editing.
    expect(form).toContain("initial?.productReference");
  });

  it("does not accept a gtin through the input schema", () => {
    const result = productInputSchema.safeParse({
      title: "Solar panel",
      slug: "solar-panel",
      sku: "KC-SOL-1",
      categoryId: "00000000-0000-4000-8000-000000000000",
      shortDescription: "A panel for a roof.",
      description: "A solar panel suitable for a domestic roof installation.",
      priceMinor: 100000,
      stock: 3,
      departmentSlug: "electrical-services",
      gtin: "4006381333931",
    });
    expect(result.success).toBe(true);
    expect(result.success && "gtin" in result.data).toBe(false);
  });
});
