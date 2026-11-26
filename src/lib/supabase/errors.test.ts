import { describe, expect, it } from "vitest";

import { describeMissingAdminClient, describeSupabaseError } from "./errors";

describe("describeSupabaseError", () => {
  it("keeps the PostgREST message and code", () => {
    expect(
      describeSupabaseError({
        message: "permission denied for table products",
        code: "42501",
      }),
    ).toBe("permission denied for table products (42501)");
  });

  it("falls back to the code when there is no message", () => {
    expect(describeSupabaseError({ code: "PGRST301" })).toContain("PGRST301");
  });

  it("uses a thrown Error message", () => {
    expect(describeSupabaseError(new Error("fetch failed"))).toBe(
      "fetch failed",
    );
  });

  it("never renders an empty detail", () => {
    expect(describeSupabaseError(null, "fallback")).toBe("fallback");
  });
});

describe("describeMissingAdminClient", () => {
  it("names the missing public configuration", () => {
    expect(
      describeMissingAdminClient({
        hasPublicConfig: false,
        hasServerKey: true,
      }),
    ).toContain("URL or publishable key");
  });

  it("names both accepted server-key variables", () => {
    const detail = describeMissingAdminClient({
      hasPublicConfig: true,
      hasServerKey: false,
    });
    expect(detail).toContain("SUPABASE_SECRET_KEY");
    expect(detail).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
