import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createClient,
  resetPasswordForEmail,
  verifyOtp,
  updateUser,
  signOut,
  recordAudit,
  checkRateLimit,
  redirect,
} = vi.hoisted(() => ({
  createClient: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  verifyOtp: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  recordAudit: vi.fn(),
  checkRateLimit: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("next/headers", () => ({
  headers: () => new Headers({ "x-forwarded-for": "203.0.113.7" }),
  cookies: () => ({
    get: (name: string) => (name === "kc_locale" ? { value: "fr" } : undefined),
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirect(path),
}));

vi.mock("@/lib/config/env", () => ({
  isSupabaseConfigured: () => true,
  getSiteUrl: () => new URL("https://kctechc.example"),
}));

vi.mock("@/lib/security/audit", () => ({ recordAudit }));
vi.mock("@/lib/security/rate-limit", () => ({
  checkRateLimit,
  clientKeyFrom: () => "test-client",
}));

vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { forgotPasswordAction, resetPasswordAction } from "./actions";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

function formData(entries: Record<string, string>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(entries)) form.append(key, value);
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimit.mockReturnValue({ allowed: true });
  recordAudit.mockResolvedValue(true);
  resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
  verifyOtp.mockResolvedValue({
    data: { user: { id: USER_ID }, session: {} },
    error: null,
  });
  updateUser.mockResolvedValue({ data: {}, error: null });
  signOut.mockResolvedValue({ error: null });
  createClient.mockResolvedValue({
    auth: { resetPasswordForEmail, verifyOtp, updateUser, signOut },
  });
});

describe("forgotPasswordAction", () => {
  it("normalizes the address and lands on the localized reset page", async () => {
    await expect(
      forgotPasswordAction(
        { status: "idle" },
        formData({ email: "  Amina@Example.COM  " }),
      ),
    ).rejects.toThrow("REDIRECT:/fr/reset-password?email=amina%40example.com");

    expect(resetPasswordForEmail).toHaveBeenCalledWith("amina@example.com");
    expect(redirect).toHaveBeenCalledWith(
      "/fr/reset-password?email=amina%40example.com",
    );
  });
});

describe("resetPasswordAction", () => {
  it("verifies the trimmed recovery OTP with the lowercased address", async () => {
    const result = await resetPasswordAction(
      { status: "idle" },
      formData({
        email: "  Amina@Example.COM  ",
        token: " 123456 ",
        password: "Correct-horse1",
        confirmPassword: "Correct-horse1",
      }),
    );

    expect(verifyOtp).toHaveBeenCalledWith({
      email: "amina@example.com",
      token: "123456",
      type: "recovery",
    });
    expect(updateUser).toHaveBeenCalledWith({ password: "Correct-horse1" });
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: USER_ID,
        action: "password_changed",
        metadata: { source: "recovery_otp" },
      }),
    );
    expect(result).toEqual({ status: "updated" });
  });

  it("returns and logs the exact verifyOtp failure details", async () => {
    verifyOtp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: {
        status: 403,
        code: "otp_expired",
        message: "Token has expired or is invalid",
      },
    });

    const result = await resetPasswordAction(
      { status: "idle" },
      formData({
        email: "amina@example.com",
        token: "123456",
        password: "Correct-horse1",
        confirmPassword: "Correct-horse1",
      }),
    );

    expect(result).toEqual({
      status: "error",
      errors: { form: "invalidOtp" },
      debug: {
        step: "verifyOtp",
        status: 403,
        code: "otp_expired",
        message: "Token has expired or is invalid",
      },
    });
    expect(consoleError).toHaveBeenCalledWith(
      "[reset-password] verifyOtp failed",
      expect.objectContaining({
        step: "verifyOtp",
        status: 403,
        code: "otp_expired",
        message: "Token has expired or is invalid",
        email: "amina@example.com",
        tokenLength: 6,
      }),
    );
    expect(updateUser).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("returns and logs the exact updateUser failure details", async () => {
    updateUser.mockResolvedValueOnce({
      data: {},
      error: {
        status: 422,
        code: "weak_password",
        message: "Password is too weak",
      },
    });

    const result = await resetPasswordAction(
      { status: "idle" },
      formData({
        email: "amina@example.com",
        token: "123456",
        password: "Correct-horse1",
        confirmPassword: "Correct-horse1",
      }),
    );

    expect(result).toEqual({
      status: "error",
      errors: { password: "errPassword" },
      debug: {
        step: "updateUser",
        status: 422,
        code: "weak_password",
        message: "Password is too weak",
      },
    });
    expect(consoleError).toHaveBeenCalledWith(
      "[reset-password] updateUser failed",
      expect.objectContaining({
        step: "updateUser",
        status: 422,
        code: "weak_password",
        message: "Password is too weak",
        email: "amina@example.com",
      }),
    );
    expect(recordAudit).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });
});
