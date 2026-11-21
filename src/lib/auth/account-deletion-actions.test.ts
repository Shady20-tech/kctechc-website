import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The two deletion actions, tested for their boundaries.
 *
 * The interesting cases are not the happy path but:
 *
 *  * the self-service action deletes the account the **session** names, never an
 *    id from the form — a `profileId` field there would be an unauthenticated
 *    request to delete an arbitrary account;
 *  * the admin action refuses a caller who is not a super administrator, refuses
 *    self-deletion, and reports an unknown id as `not_found` rather than leaking
 *    whether it exists;
 *  * both record an audit entry, and both refuse without a valid confirmation or
 *    reason before any write happens.
 *
 * The Supabase clients and the audit writer are stubbed; the code under test is
 * the real gating and validation.
 */

const getAuthState = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getAuthState: () => getAuthState() }));

const recordAudit = vi.fn().mockResolvedValue(true);
vi.mock("@/lib/security/audit", () => ({
  recordAudit: (...args: unknown[]) => recordAudit(...args),
}));

const checkRateLimit = vi.fn().mockReturnValue({ allowed: true });
vi.mock("@/lib/security/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimit(...args),
}));

const createAdminClient = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => createAdminClient(),
}));

const createClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => createClient(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// `redirect` throws in Next to unwind the render; the stub does the same so the
// action's control flow matches production rather than falling through.
const redirect = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
});
vi.mock("next/navigation", () => ({ redirect: (p: string) => redirect(p) }));

import { deleteOwnAccountAction } from "./delete-own-account";
import { deleteUserAccountAction } from "../admin/delete-user-actions";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";

type RpcResult = { data: unknown; error: unknown };

function formData(entries: Record<string, string>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(entries)) form.append(key, value);
  return form;
}

/** An admin client whose RPC, auth deletion and storage all succeed. */
function adminClient(
  options: {
    rpc?: RpcResult;
    deleteError?: { message: string } | null;
  } = {},
) {
  const remove = vi.fn().mockResolvedValue({ error: null });
  const deleteUser = vi
    .fn()
    .mockResolvedValue({ error: options.deleteError ?? null });
  return {
    rpc: vi.fn().mockResolvedValue(options.rpc ?? { data: [], error: null }),
    auth: { admin: { deleteUser } },
    storage: { from: () => ({ remove }) },
    __remove: remove,
    __deleteUser: deleteUser,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimit.mockReturnValue({ allowed: true });
  recordAudit.mockResolvedValue(true);
  createClient.mockResolvedValue({ auth: { signOut: vi.fn() } });
});

describe("deleteOwnAccountAction", () => {
  it("refuses without the exact confirmation phrase, before any write", async () => {
    getAuthState.mockResolvedValue({
      status: "authenticated",
      profile: { id: USER_ID, role: "customer" },
    });
    const admin = adminClient();
    createAdminClient.mockReturnValue(admin);

    const state = await deleteOwnAccountAction(
      null,
      formData({ confirmation: "delete", locale: "en" }),
    );

    expect(state).toEqual({ ok: false, error: "confirmation_mismatch" });
    expect(admin.rpc).not.toHaveBeenCalled();
    expect(admin.__deleteUser).not.toHaveBeenCalled();
  });

  it("refuses when there is no session", async () => {
    getAuthState.mockResolvedValue({ status: "unauthenticated" });
    const state = await deleteOwnAccountAction(
      null,
      formData({ confirmation: "DELETE" }),
    );
    expect(state).toEqual({ ok: false, error: "unauthenticated" });
  });

  it("deletes the account the session names and signs the user out", async () => {
    getAuthState.mockResolvedValue({
      status: "authenticated",
      profile: { id: USER_ID, role: "customer" },
    });
    const admin = adminClient();
    createAdminClient.mockReturnValue(admin);
    const signOut = vi.fn();
    createClient.mockResolvedValue({ auth: { signOut } });

    await expect(
      deleteOwnAccountAction(
        null,
        formData({ confirmation: "DELETE", locale: "fr" }),
      ),
    ).rejects.toThrow("REDIRECT:/fr/admin/login?reason=deleted");

    expect(admin.rpc).toHaveBeenCalledWith("detach_and_archive_user_content", {
      p_user_id: USER_ID,
    });
    expect(admin.__deleteUser).toHaveBeenCalledWith(USER_ID);
    expect(signOut).toHaveBeenCalled();
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "profile_deleted",
        entityId: USER_ID,
        metadata: expect.objectContaining({ self: true }),
      }),
    );
  });

  it("writes the audit row with a null actor, because the actor no longer exists", () => {
    // `audit_logs.actor_id` references `auth.users`. A self-deletion removes that
    // row before the audit write, so naming the deleted user as the actor makes
    // the insert fail the foreign key and `recordAudit` returns false — the trail
    // is lost and nothing surfaces it. The id belongs in the metadata instead.
    getAuthState.mockResolvedValue({
      status: "authenticated",
      profile: { id: USER_ID, role: "customer" },
    });
    const admin = adminClient();
    createAdminClient.mockReturnValue(admin);
    createClient.mockResolvedValue({ auth: { signOut: vi.fn() } });

    return deleteOwnAccountAction(
      null,
      formData({ confirmation: "DELETE", locale: "en" }),
    )
      .catch(() => undefined)
      .then(() => {
        expect(recordAudit).toHaveBeenCalledWith(
          expect.objectContaining({
            actorId: null,
            entityId: USER_ID,
            metadata: expect.objectContaining({ deletedUserId: USER_ID }),
          }),
        );
      });
  });

  it("ignores a profileId in the form and uses the session id", async () => {
    // The whole point: the only id this action will act on is the session's.
    getAuthState.mockResolvedValue({
      status: "authenticated",
      profile: { id: USER_ID, role: "customer" },
    });
    const admin = adminClient();
    createAdminClient.mockReturnValue(admin);

    await expect(
      deleteOwnAccountAction(
        null,
        formData({
          confirmation: "DELETE",
          locale: "en",
          profileId: OTHER_ID,
        }),
      ),
    ).rejects.toThrow("REDIRECT:");

    expect(admin.__deleteUser).toHaveBeenCalledWith(USER_ID);
    expect(admin.__deleteUser).not.toHaveBeenCalledWith(OTHER_ID);
  });

  it("reports the last-super-admin refusal rather than deleting", async () => {
    getAuthState.mockResolvedValue({
      status: "authenticated",
      profile: { id: USER_ID, role: "super_admin" },
    });
    const admin = adminClient({
      rpc: {
        data: null,
        error: {
          code: "23514",
          message: "The last super administrator cannot be deleted",
        },
      },
    });
    createAdminClient.mockReturnValue(admin);

    const state = await deleteOwnAccountAction(
      null,
      formData({ confirmation: "DELETE", locale: "en" }),
    );

    expect(state).toEqual({ ok: false, error: "last_super_admin" });
    expect(admin.__deleteUser).not.toHaveBeenCalled();
  });

  it("reports an unconfigured deployment instead of pretending to delete", async () => {
    getAuthState.mockResolvedValue({
      status: "authenticated",
      profile: { id: USER_ID, role: "customer" },
    });
    createAdminClient.mockReturnValue(null);

    const state = await deleteOwnAccountAction(
      null,
      formData({ confirmation: "DELETE", locale: "en" }),
    );
    expect(state).toEqual({ ok: false, error: "unconfigured" });
  });

  it("rate-limits repeated attempts", async () => {
    getAuthState.mockResolvedValue({
      status: "authenticated",
      profile: { id: USER_ID, role: "customer" },
    });
    checkRateLimit.mockReturnValue({ allowed: false });
    const admin = adminClient();
    createAdminClient.mockReturnValue(admin);

    const state = await deleteOwnAccountAction(
      null,
      formData({ confirmation: "DELETE", locale: "en" }),
    );
    expect(state).toEqual({ ok: false, error: "rate_limited" });
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("purges the storage objects the RPC reported", async () => {
    getAuthState.mockResolvedValue({
      status: "authenticated",
      profile: { id: USER_ID, role: "customer" },
    });
    const admin = adminClient({
      rpc: {
        data: [
          { object_bucket: "avatars", object_path: "avatars/x/a.jpg" },
          {
            object_bucket: "kyc-documents",
            object_path: "applications/y/b.jpg",
          },
        ],
        error: null,
      },
    });
    createAdminClient.mockReturnValue(admin);

    await expect(
      deleteOwnAccountAction(
        null,
        formData({ confirmation: "DELETE", locale: "en" }),
      ),
    ).rejects.toThrow("REDIRECT:");

    expect(admin.__remove).toHaveBeenCalledWith(["avatars/x/a.jpg"]);
    expect(admin.__remove).toHaveBeenCalledWith(["applications/y/b.jpg"]);
  });
});

describe("deleteUserAccountAction", () => {
  function authenticatedAs(role: string) {
    getAuthState.mockResolvedValue({
      status: "authenticated",
      profile: { id: USER_ID, role },
    });
  }

  /** A session client whose profile read returns the given row. */
  function sessionClient(
    row: { id: string; email: string; role: string } | null,
  ) {
    const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
    return {
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
    };
  }

  it("refuses a caller who is not a super administrator", async () => {
    authenticatedAs("real_estate_admin");
    const admin = adminClient();
    createAdminClient.mockReturnValue(admin);

    const state = await deleteUserAccountAction(
      null,
      formData({
        profileId: OTHER_ID,
        reason: "A perfectly adequate reason for this deletion.",
      }),
    );

    expect(state).toEqual({ ok: false, error: "forbidden" });
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("refuses self-deletion through the console", async () => {
    // Lockout guard: the console must not be able to remove the person holding
    // the console. The account page offers self-deletion instead.
    authenticatedAs("super_admin");
    const admin = adminClient();
    createAdminClient.mockReturnValue(admin);

    const state = await deleteUserAccountAction(
      null,
      formData({
        profileId: USER_ID,
        reason: "A perfectly adequate reason for this deletion.",
      }),
    );

    expect(state).toEqual({ ok: false, error: "self_delete" });
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("requires a substantive reason before any write", async () => {
    authenticatedAs("super_admin");
    const admin = adminClient();
    createAdminClient.mockReturnValue(admin);

    const state = await deleteUserAccountAction(
      null,
      formData({ profileId: OTHER_ID, reason: "short" }),
    );

    expect(state).toEqual({ ok: false, error: "reason_too_short" });
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("reports an unknown id as not_found without deleting", async () => {
    authenticatedAs("super_admin");
    const admin = adminClient();
    createAdminClient.mockReturnValue(admin);
    createClient.mockResolvedValue(sessionClient(null));

    const state = await deleteUserAccountAction(
      null,
      formData({
        profileId: OTHER_ID,
        reason: "A perfectly adequate reason for this deletion.",
      }),
    );

    expect(state).toEqual({ ok: false, error: "not_found" });
    expect(admin.__deleteUser).not.toHaveBeenCalled();
  });

  it("deletes the target and audits the actor, target role and reason", async () => {
    authenticatedAs("super_admin");
    const admin = adminClient();
    createAdminClient.mockReturnValue(admin);
    createClient.mockResolvedValue(
      sessionClient({
        id: OTHER_ID,
        email: "gone@example.test",
        role: "customer",
      }),
    );

    const state = await deleteUserAccountAction(
      null,
      formData({
        profileId: OTHER_ID,
        reason: "Customer requested erasure under their data rights.",
      }),
    );

    expect(state).toEqual({ ok: true, message: "user_deleted" });
    expect(admin.rpc).toHaveBeenCalledWith("detach_and_archive_user_content", {
      p_user_id: OTHER_ID,
    });
    expect(admin.__deleteUser).toHaveBeenCalledWith(OTHER_ID);
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: USER_ID,
        action: "profile_deleted",
        entityId: OTHER_ID,
        metadata: expect.objectContaining({
          self: false,
          deletedRole: "customer",
        }),
      }),
    );
  });

  it("does not report success when the auth deletion fails", async () => {
    authenticatedAs("super_admin");
    const admin = adminClient({ deleteError: { message: "boom" } });
    createAdminClient.mockReturnValue(admin);
    createClient.mockResolvedValue(
      sessionClient({
        id: OTHER_ID,
        email: "gone@example.test",
        role: "customer",
      }),
    );

    const state = await deleteUserAccountAction(
      null,
      formData({
        profileId: OTHER_ID,
        reason: "Customer requested erasure under their data rights.",
      }),
    );

    expect(state).toEqual({ ok: false, error: "delete_failed" });
    // No audit entry claims a deletion that did not happen.
    expect(recordAudit).not.toHaveBeenCalled();
  });
});
