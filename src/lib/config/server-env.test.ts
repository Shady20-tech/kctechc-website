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
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "legacy-service-role-jwt");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");

    const { serverEnv, isSupabaseAdminConfigured } = await loadServerEnv();

    expect(serverEnv.supabaseServiceRoleKey).toBe("legacy-service-role-jwt");
    expect(serverEnv.supabaseServiceRoleKeySource).toBe(
      "SUPABASE_SERVICE_ROLE_KEY",
    );
    expect(isSupabaseAdminConfigured()).toBe(true);
  });

  it("accepts the newer secret-key variable as a fallback", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_test");

    const { serverEnv, isSupabaseAdminConfigured } = await loadServerEnv();

    expect(serverEnv.supabaseServiceRoleKey).toBe("sb_secret_test");
    expect(serverEnv.supabaseServiceRoleKeySource).toBe("SUPABASE_SECRET_KEY");
    expect(isSupabaseAdminConfigured()).toBe(true);
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
});
