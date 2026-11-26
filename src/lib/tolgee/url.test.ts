import { describe, expect, it } from "vitest";

import { DEFAULT_TOLGEE_API_URL, normalizeTolgeeApiUrl } from "./url";

describe("normalizeTolgeeApiUrl", () => {
  it("removes a trailing slash", () => {
    expect(normalizeTolgeeApiUrl("https://app.tolgee.io/")).toBe(
      "https://app.tolgee.io",
    );
  });

  it("removes an accidental /v2 suffix", () => {
    expect(normalizeTolgeeApiUrl("https://app.tolgee.io/v2")).toBe(
      "https://app.tolgee.io",
    );
    expect(normalizeTolgeeApiUrl("https://app.tolgee.io/v2/")).toBe(
      "https://app.tolgee.io",
    );
  });

  it("trims whitespace before normalizing", () => {
    expect(normalizeTolgeeApiUrl("  https://app.tolgee.io/v2/  ")).toBe(
      "https://app.tolgee.io",
    );
  });

  it("keeps a self-hosted subpath", () => {
    expect(
      normalizeTolgeeApiUrl("https://tolgee.example.com/platform/v2/"),
    ).toBe("https://tolgee.example.com/platform");
  });

  it("drops query strings and fragments", () => {
    expect(
      normalizeTolgeeApiUrl("https://app.tolgee.io/v2/?utm_source=docs#top"),
    ).toBe("https://app.tolgee.io");
  });

  it("falls back to the cloud endpoint for blank or invalid values", () => {
    expect(normalizeTolgeeApiUrl("")).toBe(DEFAULT_TOLGEE_API_URL);
    expect(normalizeTolgeeApiUrl("   ")).toBe(DEFAULT_TOLGEE_API_URL);
    expect(normalizeTolgeeApiUrl("not a url")).toBe(DEFAULT_TOLGEE_API_URL);
  });
});
