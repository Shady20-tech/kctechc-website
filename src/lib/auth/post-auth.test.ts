import { describe, expect, it } from "vitest";

import { resolvePostAuthPath } from "@/lib/auth/post-auth";

describe("resolvePostAuthPath", () => {
  it("sends an undeclared social account to onboarding", () => {
    expect(
      resolvePostAuthPath("fr", {
        role: "customer",
        declaredAccountType: null,
      }),
    ).toBe("/fr/account/onboarding");
  });

  it("sends a declared customer to the localized account hub", () => {
    expect(
      resolvePostAuthPath("en", {
        role: "customer",
        declaredAccountType: "buyer",
      }),
    ).toBe("/en/account");
  });

  it("sends staff to the non-localized console", () => {
    expect(
      resolvePostAuthPath("fr", {
        role: "super_admin",
        declaredAccountType: "buyer",
      }),
    ).toBe("/admin");
  });

  it("treats a missing profile as needing onboarding", () => {
    expect(resolvePostAuthPath("en", null)).toBe("/en/account/onboarding");
  });

  it("falls back to the customer landing for an unknown role", () => {
    expect(
      resolvePostAuthPath("en", {
        role: "not-a-role",
        declaredAccountType: "buyer",
      }),
    ).toBe("/en/account");
  });
});
