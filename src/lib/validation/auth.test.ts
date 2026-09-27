import { describe, expect, it } from "vitest";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "./auth";

/**
 * Auth request validation.
 *
 * The schemas are the server-side boundary for every auth form, so these assert
 * the properties that matter for security rather than merely that the happy path
 * parses: that a role cannot be smuggled into sign-up, that consent is required,
 * and that a password mismatch cannot be posted directly.
 */

const VALID_SIGN_UP = {
  fullName: "Amina Njoya",
  email: "amina@example.com",
  password: "correct-horse",
  confirmPassword: "correct-horse",
  acceptPrivacy: true as const,
};

describe("signInSchema", () => {
  it("accepts valid credentials", () => {
    const result = signInSchema.safeParse({
      email: "amina@example.com",
      password: "correct-horse",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a relative next path", () => {
    const result = signInSchema.safeParse({
      email: "amina@example.com",
      password: "correct-horse",
      next: "/admin/orders",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an absolute redirect target", () => {
    const result = signInSchema.safeParse({
      email: "amina@example.com",
      password: "correct-horse",
      next: "https://evil.example.com",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a protocol-relative redirect target", () => {
    const result = signInSchema.safeParse({
      email: "amina@example.com",
      password: "correct-horse",
      next: "//evil.example.com",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown email shape", () => {
    const result = signInSchema.safeParse({
      email: "not-an-email",
      password: "correct-horse",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a short password before it reaches the network", () => {
    const result = signInSchema.safeParse({
      email: "amina@example.com",
      password: "short",
    });
    expect(result.success).toBe(false);
  });
});

describe("signUpSchema", () => {
  it("accepts a complete registration", () => {
    expect(signUpSchema.safeParse(VALID_SIGN_UP).success).toBe(true);
  });

  it("trims the submitted name", () => {
    const result = signUpSchema.safeParse({
      ...VALID_SIGN_UP,
      fullName: "  Amina Njoya  ",
    });
    expect(result.success && result.data.fullName).toBe("Amina Njoya");
  });

  it("requires the two passwords to match", () => {
    const result = signUpSchema.safeParse({
      ...VALID_SIGN_UP,
      confirmPassword: "something-else",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["confirmPassword"]);
    }
  });

  it("requires the privacy acknowledgement", () => {
    const { acceptPrivacy: _omitted, ...withoutConsent } = VALID_SIGN_UP;
    const result = signUpSchema.safeParse(withoutConsent);
    expect(result.success).toBe(false);
  });

  it("rejects an unchecked privacy acknowledgement expressed as false", () => {
    const result = signUpSchema.safeParse({
      ...VALID_SIGN_UP,
      acceptPrivacy: false,
    });
    expect(result.success).toBe(false);
  });

  it("ignores any client-supplied role", () => {
    // Stripping unknown keys is what stops self-registration from choosing its own
    // authorization. The parsed output must not carry a role at all.
    const result = signUpSchema.safeParse({
      ...VALID_SIGN_UP,
      role: "super_admin",
    });
    expect(result.success).toBe(true);
    expect(result.success && "role" in result.data).toBe(false);
  });
});

describe("forgotPasswordSchema", () => {
  it("accepts a valid email", () => {
    expect(
      forgotPasswordSchema.safeParse({ email: "amina@example.com" }).success,
    ).toBe(true);
  });

  it("rejects an invalid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "nope" }).success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("accepts matching passwords", () => {
    expect(
      resetPasswordSchema.safeParse({
        password: "new-passphrase",
        confirmPassword: "new-passphrase",
      }).success,
    ).toBe(true);
  });

  it("rejects a mismatch", () => {
    expect(
      resetPasswordSchema.safeParse({
        password: "new-passphrase",
        confirmPassword: "new-passphras",
      }).success,
    ).toBe(false);
  });

  it("rejects a password under the minimum length", () => {
    expect(
      resetPasswordSchema.safeParse({
        password: "short",
        confirmPassword: "short",
      }).success,
    ).toBe(false);
  });
});
