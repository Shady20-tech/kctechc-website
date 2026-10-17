import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  MAX_ATTACHMENT_BYTES,
  MAX_CONTENT_IMAGE_BYTES,
  MAX_EDITOR_IMAGE_BYTES,
  MAX_PRODUCT_IMAGE_BYTES,
  MAX_PROJECT_IMAGE_BYTES,
  MAX_PROPERTY_IMAGE_BYTES,
  SERVER_ACTION_BODY_SIZE_LIMIT,
  exceedsSizeLimit,
  megabytes,
} from "@/lib/uploads/limits";

/**
 * Upload limits are a contract between three callers that cannot share code — the
 * server-side validator, the admin forms and `next.config.ts` — so the values
 * themselves are worth pinning.
 *
 * The load-bearing assertion is the last one: the Server Action body limit has to
 * clear the largest accepted image, or a legitimate upload is refused by Next.js
 * before any action runs and the editor sees an unexplained failure. This is the
 * bug that shipped while the limit sat at Next's 1 MB default.
 */
describe("upload limits", () => {
  it("accepts an editor image at the limit and rejects one byte over", () => {
    const atLimit = { size: MAX_PROPERTY_IMAGE_BYTES };
    const overLimit = { size: MAX_PROPERTY_IMAGE_BYTES + 1 };
    expect(exceedsSizeLimit(atLimit, MAX_PROPERTY_IMAGE_BYTES)).toBe(false);
    expect(exceedsSizeLimit(overLimit, MAX_PROPERTY_IMAGE_BYTES)).toBe(true);
  });

  it("treats a missing file as not oversized", () => {
    expect(exceedsSizeLimit(null, 1024)).toBe(false);
    expect(exceedsSizeLimit(undefined, 1024)).toBe(false);
  });

  it("reports a byte count as whole megabytes", () => {
    expect(megabytes(MAX_PRODUCT_IMAGE_BYTES)).toBe(5);
    expect(megabytes(MAX_ATTACHMENT_BYTES)).toBe(10);
  });

  it("derives the editor ceiling from the largest per-kind limit", () => {
    expect(MAX_EDITOR_IMAGE_BYTES).toBe(MAX_PROPERTY_IMAGE_BYTES);
    expect(MAX_EDITOR_IMAGE_BYTES).toBeGreaterThanOrEqual(
      Math.max(
        MAX_PRODUCT_IMAGE_BYTES,
        MAX_CONTENT_IMAGE_BYTES,
        MAX_PROJECT_IMAGE_BYTES,
      ),
    );
  });

  it("leaves the Server Action body limit room for multipart overhead", () => {
    expect(SERVER_ACTION_BODY_SIZE_LIMIT).toBeGreaterThan(
      MAX_EDITOR_IMAGE_BYTES,
    );
  });

  it("keeps next.config wired to the same limit the forms rely on", () => {
    const source = readFileSync(
      resolve(__dirname, "../../../next.config.ts"),
      "utf8",
    );
    // The config is transpiled standalone before the `@/` alias exists, so it can
    // only reach a leaf module; the assertion is that it actually reads the value
    // rather than restating a number that can drift from the forms.
    expect(source).toContain("SERVER_ACTION_BODY_SIZE_LIMIT");
    expect(source).toMatch(/bodySizeLimit:\s*SERVER_ACTION_BODY_SIZE_LIMIT/);
  });
});
