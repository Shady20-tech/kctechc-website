import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Guards the multi-image upload paths.
 *
 * A marketplace listing is sold on its gallery, and an editor photographing a
 * property produces a set of images rather than one. The behaviour that matters —
 * every chosen file is stored, positions append without renumbering what is
 * already there, and exactly one image is primary — lives inside a Server Action
 * that talks to Supabase and Storage, so it cannot be exercised without a live
 * project. These assertions pin the *shape* of that behaviour in the source, the
 * same database-free complement the owner-listing-workflow test uses: a later edit
 * that drops `multiple`, reverts to a single-file read, or promotes every image to
 * primary fails here rather than only in a browser.
 */

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const ACTIONS = {
  product: "src/lib/store/media-actions.ts",
  listingAdmin: "src/lib/real-estate/media-actions.ts",
  listingDashboard: "src/lib/real-estate/dashboard-actions.ts",
} as const;

const FORMS = {
  product: "src/components/admin/ProductMediaForm.tsx",
  listingAdmin: "src/components/admin/ListingMediaForm.tsx",
  listingDashboard: "src/components/account/DashboardMediaPanel.tsx",
} as const;

describe("multi-image upload actions", () => {
  for (const [name, path] of Object.entries(ACTIONS)) {
    it(`${name}: reads every chosen file, not just the first`, () => {
      const source = read(path);
      expect(source).toContain('.getAll("image")');
      // A single-file read would silently drop every image after the first.
      expect(source).not.toMatch(/formData\.get\("image"\)/);
    });

    it(`${name}: appends positions and keeps exactly one primary`, () => {
      const source = read(path);
      // The gallery is appended, so positions follow the existing count.
      expect(source).toMatch(/let position = count \?\? 0/);
      expect(source).toMatch(/position \+= 1/);
      // Primary is taken once, by the first upload into an empty gallery.
      expect(source).toContain("primaryTaken");
      expect(source).toMatch(/is_primary: !primaryTaken/);
    });
  }

  it("product: offers a control to choose the card image", () => {
    const source = read(ACTIONS.product);
    const start = source.indexOf(
      "export async function setProductPrimaryImageAction",
    );
    expect(start).toBeGreaterThan(-1);
    // Scope to this function's body, so an earlier promotion elsewhere in the
    // module (the remove path) cannot satisfy the ordering check.
    const body = source.slice(start, source.indexOf("\n}\n", start));
    const demote = body.indexOf(".update({ is_primary: false })");
    const promote = body.indexOf(".update({ is_primary: true })");
    expect(demote).toBeGreaterThan(-1);
    // The demote must precede the promote: the partial unique index permits at
    // most one primary per product.
    expect(promote).toBeGreaterThan(demote);
  });
});

describe("multi-image upload forms", () => {
  for (const [name, path] of Object.entries(FORMS)) {
    it(`${name}: the file input accepts several files`, () => {
      const source = read(path);
      expect(source).toMatch(/name="image"[\s\S]*?multiple/);
      expect(source).toMatch(/accept="image\/jpeg,image\/png,image\/webp/);
    });

    it(`${name}: checks every chosen file against the limit`, () => {
      const source = read(path);
      expect(source).toMatch(/Array\.from\(event\.target\.files \?\? \[\]\)/);
      expect(source).toMatch(/\.some\(/);
    });
  }
});
