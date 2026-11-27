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

  it("offers publish-now or save-as-draft on every create form", () => {
    for (const path of [
      "src/components/admin/ProductForm.tsx",
      "src/components/admin/InsightForm.tsx",
      "src/components/admin/ProjectForm.tsx",
      "src/components/admin/ListingForm.tsx",
    ]) {
      const form = source(path);
      expect(form, path).toContain('name="publishState"');
      expect(form, path).toContain('value="published"');
    }

    const productAction = source("src/lib/store/admin-actions.ts");
    expect(productAction).toContain("setProductPublishedAction(publishForm)");
    expect(productAction).toContain('publishWarning = "image_required"');

    const listingAction = source("src/lib/real-estate/admin-actions.ts");
    expect(listingAction).toContain(
      'setListingStatusAction(data.id, "published")',
    );
    expect(listingAction).toContain('publishWarning = "failed"');

    const dashboardForm = source(
      "src/components/account/DashboardListingForm.tsx",
    );
    expect(dashboardForm).toContain("ImageUploadField");
    expect(dashboardForm).toContain('name="publishState"');
    expect(dashboardForm).toContain('value="review"');

    const dashboardAction = source("src/lib/real-estate/dashboard-actions.ts");
    expect(dashboardAction).toContain("attachDashboardListingImages");
    expect(dashboardAction).toContain(
      'submitListingForReviewAction(kind, data.id, "")',
    );
  });

  it("does not ask the editor to save first in the create notices", () => {
    const en = JSON.parse(source("src/lib/i18n/messages/en.json"));
    expect(en.admin.store.imageUploadNotice).not.toMatch(
      /save the product first/i,
    );
    expect(en.admin.store.draftNoticeBody).not.toMatch(/save it, then/i);
  });
});
