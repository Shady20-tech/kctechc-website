import { afterEach, describe, expect, it, vi } from "vitest";

async function loadServerEnv() {
  vi.resetModules();
  return import("./server-env");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Supabase server key resolution", () => {
  it("reads the legacy service-role variable", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "eyJhbGciOiJIUzI1NiJ9.payload.sig");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");

    const { serverEnv, isSupabaseAdminConfigured } = await loadServerEnv();

    expect(serverEnv.supabaseServiceRoleKey).toBe(
      "eyJhbGciOiJIUzI1NiJ9.payload.sig",
    );
    expect(serverEnv.supabaseServiceRoleKeySource).toBe(
      "SUPABASE_SERVICE_ROLE_KEY",
    );
    expect(serverEnv.supabaseServiceRoleKeyType).toBe("legacy_jwt");
    expect(isSupabaseAdminConfigured()).toBe(true);
  });

  it("accepts the newer secret-key variable as a fallback", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_test");

    const { serverEnv, isSupabaseAdminConfigured } = await loadServerEnv();

    expect(serverEnv.supabaseServiceRoleKey).toBe("sb_secret_test");
    expect(serverEnv.supabaseServiceRoleKeySource).toBe("SUPABASE_SECRET_KEY");
    expect(serverEnv.supabaseServiceRoleKeyType).toBe("secret");
    expect(isSupabaseAdminConfigured()).toBe(true);
  });

  it("flags a malformed key instead of treating it as valid", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "HmYxFNt9not-a-supabase-key");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");

    const { serverEnv } = await loadServerEnv();

    expect(serverEnv.supabaseServiceRoleKeyType).toBe("unknown");
  });

  it("prefers the service-role variable when both are set", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "legacy-service-role-jwt");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_test");

    const { serverEnv } = await loadServerEnv();

    expect(serverEnv.supabaseServiceRoleKey).toBe("legacy-service-role-jwt");
    expect(serverEnv.supabaseServiceRoleKeySource).toBe(
      "SUPABASE_SERVICE_ROLE_KEY",
    );
  });

  it("treats blank values as absent", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "   ");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");

    const { serverEnv, isSupabaseAdminConfigured } = await loadServerEnv();

    expect(serverEnv.supabaseServiceRoleKey).toBeNull();
    expect(serverEnv.supabaseServiceRoleKeySource).toBeNull();
    expect(isSupabaseAdminConfigured()).toBe(false);
  });

  it("exposes a pure resolver that every server consumer can share", async () => {
    const { resolveSupabaseServerKey } = await loadServerEnv();

    expect(
      resolveSupabaseServerKey({
        SUPABASE_SERVICE_ROLE_KEY: "",
        SUPABASE_SECRET_KEY: "sb_secret_only",
      }),
    ).toEqual({
      key: "sb_secret_only",
      source: "SUPABASE_SECRET_KEY",
      type: "secret",
    });
    expect(
      resolveSupabaseServerKey({
        SUPABASE_SERVICE_ROLE_KEY: "legacy",
        SUPABASE_SECRET_KEY: "sb_secret_only",
      }),
    ).toEqual({
      key: "legacy",
      source: "SUPABASE_SERVICE_ROLE_KEY",
      type: "unknown",
    });
    expect(resolveSupabaseServerKey({})).toEqual({
      key: null,
      source: null,
      type: null,
    });
  });
});
