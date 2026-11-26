import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Granting a publisher verification badge.
 *
 * A verification badge is a public trust mark, so the tests that matter are the
 * refusals: only a super admin may grant one, the guard is deliberately narrower
 * than the real-estate administrator set, and the write goes through the session
 * client so the database trigger — not the application guard — is the boundary. A
 * caller whose update the trigger refuses (`42501`) must see `forbidden`, not a
 * generic failure, because that path is what a removed guard would expose.
 */

const getAuthState = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getAuthState: () => getAuthState() }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const recordAudit = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/security/audit", () => ({ recordAudit: (...a: unknown[]) => recordAudit(...a) }));

const createClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: () => createClient() }));

import { setPublisherVerificationAction } from "./verification-actions";

type UpdateCall = { row: Record<string, unknown>; column: string; value: string };

function stubClient(error: unknown = null): { calls: UpdateCall[] } {
  const calls: UpdateCall[] = [];
  createClient.mockResolvedValue({
    from: (table: string) => ({
      update: (row: Record<string, unknown>) => {
        expect(table).toBe("real_estate_memberships");
        return {
          eq: async (column: string, value: string) => {
            calls.push({ row, column, value });
            return { error };
          },
        };
      },
    }),
  });
  return { calls };
}

function form(membershipId: string, verified: boolean): FormData {
  const data = new FormData();
  data.set("membershipId", membershipId);
  data.set("verified", verified ? "true" : "false");
  return data;
}

function authWithRole(role: string) {
  return {
    status: "authenticated" as const,
    userId: "u-1",
    email: "staff@example.com",
    profile: { id: "u-1", role, fullName: "Staff", phone: "+237600000000" },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getAuthState.mockResolvedValue(authWithRole("super_admin"));
});

describe("setPublisherVerificationAction", () => {
  it("refuses an unauthenticated caller", async () => {
    getAuthState.mockResolvedValue({ status: "unauthenticated" });
    const result = await setPublisherVerificationAction(null, form("m-1", true));
    expect(result).toEqual({ ok: false, error: "unauthenticated" });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("refuses a real-estate admin, because deciding identity is not delegated", async () => {
    getAuthState.mockResolvedValue(authWithRole("real_estate_admin"));
    const result = await setPublisherVerificationAction(null, form("m-1", true));
    expect(result).toMatchObject({ ok: false, error: "forbidden" });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("refuses a department editor", async () => {
    getAuthState.mockResolvedValue(authWithRole("department_staff"));
    const result = await setPublisherVerificationAction(null, form("m-1", true));
    expect(result).toMatchObject({ ok: false, error: "forbidden" });
  });

  it("refuses a missing membership id before any client work", async () => {
    const result = await setPublisherVerificationAction(null, form("", true));
    expect(result).toEqual({ ok: false, error: "not_found" });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("grants the badge with the actor recorded as verifier", async () => {
    const { calls } = stubClient();
    const result = await setPublisherVerificationAction(null, form("m-1", true));

    expect(result).toEqual({ ok: true });
    expect(calls[0]!.column).toBe("id");
    expect(calls[0]!.value).toBe("m-1");
    expect(calls[0]!.row.verified_at).toEqual(expect.any(String));
    expect(calls[0]!.row.verified_by).toBe("u-1");
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "membership_verification_changed" }),
    );
  });

  it("revokes the badge by clearing both columns", async () => {
    const { calls } = stubClient();
    const result = await setPublisherVerificationAction(null, form("m-1", false));

    expect(result).toEqual({ ok: true });
    expect(calls[0]!.row.verified_at).toBeNull();
    expect(calls[0]!.row.verified_by).toBeNull();
  });

  it("maps the trigger's insufficient-privilege error to forbidden", async () => {
    // A non-super-admin reaches this if the application guard is ever removed; the
    // trigger is the boundary, so the message must reflect that.
    stubClient({ code: "42501", message: "insufficient privilege" });
    const result = await setPublisherVerificationAction(null, form("m-1", true));
    expect(result).toMatchObject({ ok: false, error: "forbidden" });
  });

  it("reports any other write error as a failure", async () => {
    stubClient({ code: "23503", message: "foreign key violation" });
    const result = await setPublisherVerificationAction(null, form("m-1", true));
    expect(result).toMatchObject({ ok: false, error: "write_failed" });
  });
});
