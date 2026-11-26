import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const pagePath = resolve(
  process.cwd(),
  "src/app/(static)/admin/(console)/reviews/page.tsx",
);
const source = readFileSync(pagePath, "utf8");

/**
 * The reviews console lives under the non-localized `/admin` tree. It once read
 * `params.locale`, failed `isLocale`, and returned `null` for every moderator —
 * the page was completely blank. These assertions pin the route's shape so a
 * later "localize the admin" edit cannot silently bring the blank page back
 * without also moving the route under `[locale]`.
 */
describe("admin reviews route", () => {
  it("does not read a locale from route params", () => {
    expect(source).not.toMatch(/\bparams\s*:/);
    expect(source).not.toContain("await params");
    expect(source).not.toContain("isLocale(");
    expect(source).not.toContain("buildMetadata(");
  });

  it("uses the console's English translator", () => {
    expect(source).toContain('createTranslator("en")');
  });

  it("renders the queue rather than returning null on an unknown locale", () => {
    expect(source).not.toMatch(/return null/);
    expect(source).toContain("loadReviewQueue");
    expect(source).toContain("ReviewDecisionForm");
  });
});
