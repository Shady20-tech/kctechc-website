import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  OAUTH_ONBOARDING_ERROR_KEYS,
  oauthOnboardingSchema,
} from "@/lib/validation/auth";

const MIGRATIONS = join(process.cwd(), "supabase", "migrations");

describe("oauth onboarding schema", () => {
  it("accepts a complete answer", () => {
    const result = oauthOnboardingSchema.safeParse({
      accountType: "landlord",
      permanentResidency: "true",
      phone: "+237 679 202 265",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an omitted phone, because the provider may not supply one", () => {
    expect(
      oauthOnboardingSchema.safeParse({
        accountType: "buyer",
        permanentResidency: "false",
      }).success,
    ).toBe(true);
  });

  it("treats a blank phone as not given rather than an error", () => {
    expect(
      oauthOnboardingSchema.safeParse({
        accountType: "buyer",
        permanentResidency: "false",
        phone: "",
      }).success,
    ).toBe(true);
  });

  it("rejects a phone that is not a phone number", () => {
    const result = oauthOnboardingSchema.safeParse({
      accountType: "buyer",
      permanentResidency: "false",
      phone: "call me",
    });
    expect(result.success).toBe(false);
  });

  it("requires a residency answer, because collecting it is the point of the step", () => {
    // Unlike the password form, "not stated" here would mean the step did
    // nothing at all.
    for (const value of [undefined, "", "maybe"]) {
      const result = oauthOnboardingSchema.safeParse({
        accountType: "buyer",
        permanentResidency: value,
      });
      expect(result.success).toBe(false);
    }
  });

  it("rejects an unknown account type", () => {
    const result = oauthOnboardingSchema.safeParse({
      accountType: "admin",
      permanentResidency: "true",
    });
    expect(result.success).toBe(false);
  });

  it("has no role field, so a privilege cannot be posted", () => {
    const result = oauthOnboardingSchema.safeParse({
      accountType: "buyer",
      permanentResidency: "true",
      role: "super_admin",
    });
    expect(result.success).toBe(true);
    // Zod strips unknown keys, so the value cannot reach the update payload.
    expect(result.success && "role" in result.data).toBe(false);
  });

  it("maps every field to a message key that exists in both dictionaries", () => {
    const keys = Object.values(OAUTH_ONBOARDING_ERROR_KEYS);
    expect(keys.length).toBeGreaterThan(0);
    for (const locale of ["en", "fr"] as const) {
      const messages = JSON.parse(
        readFileSync(
          join(process.cwd(), "src", "lib", "i18n", "messages", `${locale}.json`),
          "utf8",
        ),
      ) as { auth: Record<string, unknown> };
      for (const key of keys) {
        // `errorBody` is the shared form-level message; the rest live under auth.
        expect(
          Object.hasOwn(messages.auth, key),
          `${locale}.auth.${key} is missing`,
        ).toBe(true);
      }
    }
  });
});

describe("declared account type is never an authorization input", () => {
  it("is not read by any RLS policy in the migration set", () => {
    // The brief's central rule: a user-selected account type never grants
    // privilege. A capability exists only when an approved KYC application
    // writes one. If a future policy reads the declaration, the rule is broken.
    const offenders: string[] = [];
    for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql"))) {
      const sql = readFileSync(join(MIGRATIONS, file), "utf8");
      const policies = sql.match(/create policy[\s\S]*?;/gi) ?? [];
      for (const policy of policies) {
        if (policy.includes("declared_account_type")) {
          offenders.push(file);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
