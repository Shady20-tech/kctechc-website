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
  it("requests a code without a redirect link and lands on the localized reset page", async () => {
    await expect(
      forgotPasswordAction(
        { status: "idle" },
        formData({ email: "amina@example.com" }),
      ),
    ).rejects.toThrow("REDIRECT:/fr/reset-password?email=amina%40example.com");

    expect(resetPasswordForEmail).toHaveBeenCalledWith("amina@example.com");
    expect(redirect).toHaveBeenCalledWith(
      "/fr/reset-password?email=amina%40example.com",
    );
  });
});

describe("resetPasswordAction", () => {
  it("verifies the recovery OTP, updates the password and signs out", async () => {
    const result = await resetPasswordAction(
      { status: "idle" },
      formData({
        email: "amina@example.com",
        token: "123456",
        password: "new-passphrase",
        confirmPassword: "new-passphrase",
      }),
    );

    expect(verifyOtp).toHaveBeenCalledWith({
      email: "amina@example.com",
      token: "123456",
      type: "recovery",
    });
    expect(updateUser).toHaveBeenCalledWith({ password: "new-passphrase" });
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

  it("stops without updating when the code is refused", async () => {
    verifyOtp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: "invalid" },
    });

    const result = await resetPasswordAction(
      { status: "idle" },
      formData({
        email: "amina@example.com",
        token: "123456",
        password: "new-passphrase",
        confirmPassword: "new-passphrase",
      }),
    );

    expect(result).toEqual({
      status: "error",
      errors: { form: "invalidOtp" },
    });
    expect(updateUser).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });
});
