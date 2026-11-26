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

  it("strips a pasted project path down to the origin", () => {
    expect(normalizeTolgeeApiUrl("https://app.tolgee.io/projects/35323")).toBe(
      "https://app.tolgee.io",
    );
    expect(
      normalizeTolgeeApiUrl(
        "https://app.tolgee.io/projects/35323/translations",
      ),
    ).toBe("https://app.tolgee.io");
  });

  it("trims whitespace before normalizing", () => {
    expect(normalizeTolgeeApiUrl("  https://app.tolgee.io/v2/  ")).toBe(
      "https://app.tolgee.io",
    );
  });

  it("keeps a self-hosted origin including its port", () => {
    expect(
      normalizeTolgeeApiUrl("https://tolgee.example.com:8443/platform/v2/"),
    ).toBe("https://tolgee.example.com:8443");
  });

  it("drops query strings and fragments", () => {
    expect(
      normalizeTolgeeApiUrl("https://app.tolgee.io/v2/?utm_source=docs#top"),
    ).toBe("https://app.tolgee.io");
  });

  it("falls back to the cloud endpoint for blank, invalid or non-http values", () => {
    expect(normalizeTolgeeApiUrl("")).toBe(DEFAULT_TOLGEE_API_URL);
    expect(normalizeTolgeeApiUrl("   ")).toBe(DEFAULT_TOLGEE_API_URL);
    expect(normalizeTolgeeApiUrl("not a url")).toBe(DEFAULT_TOLGEE_API_URL);
    expect(normalizeTolgeeApiUrl("javascript:alert(1)")).toBe(
      DEFAULT_TOLGEE_API_URL,
    );
  });
});
