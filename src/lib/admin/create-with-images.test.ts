import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const source = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

describe("create forms attach images in the same submission", () => {
  it("creates a product and then attaches the chosen files", () => {
    const action = source("src/lib/store/admin-actions.ts");
    expect(action).toContain("attachProductImages(");
    expect(action).toContain('filesFrom(formData, "image")');
    expect(action).toContain("uploadProductImageAction(media)");

    const form = source("src/components/admin/ProductForm.tsx");
    expect(form).toContain("<ImageUploadField");
    expect(form).toContain('name="image"');
  });

  it("creates an article with its cover and gallery", () => {
    const action = source("src/lib/content/admin-actions.ts");
    expect(action).toContain("attachInsightMedia(");
    expect(action).toContain("uploadInsightCoverAction(coverForm)");
    expect(action).toContain("uploadInsightImageAction(galleryForm)");

    const form = source("src/components/admin/InsightForm.tsx");
    expect(form).toContain('name="cover"');
    expect(form).toContain('name="image"');
  });

  it("creates finished work with its photography", () => {
    const action = source("src/lib/content/project-admin-actions.ts");
    expect(action).toContain("attachProjectMedia(");
    expect(action).toContain("uploadProjectMediaAction(media)");

    const form = source("src/components/admin/ProjectForm.tsx");
    expect(form).toContain("<ImageUploadField");
    expect(form).toContain('name="image"');
  });

  it("creates a listing with its photographs", () => {
    const action = source("src/lib/real-estate/admin-actions.ts");
    expect(action).toContain("attachListingImages(");
    expect(action).toContain("uploadListingImageAction(media)");

    const form = source("src/components/admin/ListingForm.tsx");
    expect(form).toContain("<ImageUploadField");
    expect(form).toContain('name="image"');
  });

  it("does not ask the editor to save first in the create notices", () => {
    const en = JSON.parse(source("src/lib/i18n/messages/en.json"));
    expect(en.admin.store.imageUploadNotice).not.toMatch(
      /save the product first/i,
    );
    expect(en.admin.store.draftNoticeBody).not.toMatch(/save it, then/i);
  });
});
