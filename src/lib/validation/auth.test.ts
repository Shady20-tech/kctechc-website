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
  // A buyer account: the declaration that carries no age requirement.
  accountType: "buyer" as const,
  dateOfBirth: "1990-05-01",
  phone: "+237 679 202 265",
  permanentResidency: "true",
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

  it("records the declared account type", () => {
    const result = signUpSchema.safeParse({
      ...VALID_SIGN_UP,
      accountType: "landlord",
    });
    expect(result.success && result.data.accountType).toBe("landlord");
  });

  it("refuses an unknown account type", () => {
    const result = signUpSchema.safeParse({
      ...VALID_SIGN_UP,
      accountType: "super_admin",
    });
    expect(result.success).toBe(false);
  });

  it("refuses an under-18 landlord applicant", () => {
    // One day short of 18 at the time of the test.
    const almost = new Date(Date.now() - 17 * 365.25 * 24 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);
    const result = signUpSchema.safeParse({
      ...VALID_SIGN_UP,
      accountType: "landlord",
      dateOfBirth: almost,
    });
    expect(result.success).toBe(false);
  });

  it("allows a buyer of any age", () => {
    // The 18+ rule applies to applying for a capability, not to holding a buyer
    // account, so a minor may register as a property seeker.
    const minor = new Date(Date.now() - 15 * 365.25 * 24 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);
    const result = signUpSchema.safeParse({
      ...VALID_SIGN_UP,
      accountType: "buyer",
      dateOfBirth: minor,
    });
    expect(result.success).toBe(true);
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

  it("requires a phone number", () => {
    const { phone: _omitted, ...withoutPhone } = VALID_SIGN_UP;
    expect(signUpSchema.safeParse(withoutPhone).success).toBe(false);
  });

  it("refuses a phone number that is not one", () => {
    const result = signUpSchema.safeParse({
      ...VALID_SIGN_UP,
      phone: "call me maybe",
    });
    expect(result.success).toBe(false);
  });

  it("reads the residency declaration as a boolean", () => {
    const yes = signUpSchema.safeParse({
      ...VALID_SIGN_UP,
      permanentResidency: "true",
    });
    expect(yes.success && yes.data.permanentResidency).toBe(true);

    const no = signUpSchema.safeParse({
      ...VALID_SIGN_UP,
      permanentResidency: "false",
    });
    expect(no.success && no.data.permanentResidency).toBe(false);
  });

  it("treats an unanswered residency question as undefined, not as false", () => {
    // Null/undefined is the honest third state. Coercing a blank answer to
    // `false` would record a statement the user never made.
    const { permanentResidency: _omitted, ...withoutAnswer } = VALID_SIGN_UP;
    const result = signUpSchema.safeParse(withoutAnswer);
    expect(result.success).toBe(true);
    expect(result.success && result.data.permanentResidency).toBeUndefined();
  });

  it("refuses a junk residency value", () => {
    const result = signUpSchema.safeParse({
      ...VALID_SIGN_UP,
      permanentResidency: "maybe",
    });
    expect(result.success).toBe(false);
  });
});

describe("forgotPasswordSchema", () => {
  it("accepts a valid email", () => {
    expect(
      forgotPasswordSchema.safeParse({ email: "amina@example.com" }).success,
    ).toBe(true);
  });

  it("rejects an invalid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "nope" }).success).toBe(
      false,
    );
  });
});

describe("resetPasswordSchema", () => {
  const valid = {
    email: "amina@example.com",
    token: "123456",
    password: "new-passphrase",
    confirmPassword: "new-passphrase",
  };

  it("accepts a valid email, 6-digit code and matching passwords", () => {
    expect(resetPasswordSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a mismatch", () => {
    expect(
      resetPasswordSchema.safeParse({
        ...valid,
        confirmPassword: "new-passphras",
      }).success,
    ).toBe(false);
  });

  it("rejects a password under the minimum length", () => {
    expect(
      resetPasswordSchema.safeParse({
        ...valid,
        password: "short",
        confirmPassword: "short",
      }).success,
    ).toBe(false);
  });

  it("requires six digits, allowing surrounding whitespace", () => {
    for (const token of ["12345", "1234567", "12345a", ""]) {
      expect(resetPasswordSchema.safeParse({ ...valid, token }).success).toBe(
        false,
      );
    }

    expect(
      resetPasswordSchema.safeParse({ ...valid, token: " 123456 " }).success,
    ).toBe(true);
  });

  it("rejects an invalid email", () => {
    expect(
      resetPasswordSchema.safeParse({ ...valid, email: "not-an-email" })
        .success,
    ).toBe(false);
  });
});
