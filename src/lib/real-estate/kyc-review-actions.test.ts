import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The KYC reviewer path is where a capability is created, so the tests that matter
 * here are the refusals rather than the happy path. Three independent controls are
 * asserted:
 *
 *  1. a non-super-admin caller is refused (a plain `real_estate_admin` especially —
 *     the brief says they must not decide identity);
 *  2. a refusal or a request for changes must carry a reason the applicant can act
 *     on, while an approval's note is optional;
 *  3. the approval goes through the service-role RPC, because
 *     `approve_kyc_application` is `security definer` and reachable by
 *     `service_role` only — a session-client write could not express it.
 */

const getAuthState = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getAuthState: () => getAuthState() }));

const recordAudit = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/security/audit", () => ({ recordAudit: (...a: unknown[]) => recordAudit(...a) }));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const checkRateLimit = vi.fn().mockReturnValue({ allowed: true });
vi.mock("@/lib/security/rate-limit", () => ({
  checkRateLimit: (...a: unknown[]) => checkRateLimit(...a),
}));

const rpc = vi.fn();
const createAdminClient = vi.fn();
const createClient = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => createAdminClient(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => createClient(),
}));

const signedKycUrl = vi.fn();
vi.mock("@/lib/uploads/kyc-storage", () => ({
  signedKycUrl: (...a: unknown[]) => signedKycUrl(...a),
}));

import {
  addKycNoteAction,
  getKycDocumentUrlAction,
  reviewKycApplicationAction,
} from "./kyc-review-actions";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}

/** A session-client stub for the update/insert paths. */
function stubSession(options: { updateError?: unknown; insertError?: unknown; selectData?: unknown } = {}) {
  const sessionUpdate = vi.fn().mockResolvedValue({ error: options.updateError ?? null });
  const sessionInsert = vi.fn().mockResolvedValue({ error: options.insertError ?? null });
  const maybeSingle = vi.fn().mockResolvedValue({ data: options.selectData ?? null });
  const select = vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) }));

  const client = {
    from: vi.fn(() => ({
      update: vi.fn(() => ({ eq: sessionUpdate })),
      insert: sessionInsert,
      select,
    })),
  };
  createClient.mockResolvedValue(client);
  return { client, sessionUpdate, sessionInsert, maybeSingle };
}

const SUPER_ADMIN = {
  status: "authenticated" as const,
  profile: { id: "u-super", role: "super_admin" },
};

beforeEach(() => {
  vi.clearAllMocks();
  getAuthState.mockResolvedValue(SUPER_ADMIN);
  checkRateLimit.mockReturnValue({ allowed: true });
  createAdminClient.mockReturnValue({ rpc });
  rpc.mockResolvedValue({ error: null });
});

describe("reviewKycApplicationAction — authorization", () => {
  it("refuses an unauthenticated caller", async () => {
    getAuthState.mockResolvedValue({ status: "unauthenticated", profile: null });
    const result = await reviewKycApplicationAction(
      "app-1",
      null,
      form({ decision: "approve" }),
    );
    expect(result).toEqual({ ok: false, error: "unauthenticated" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses a plain real-estate administrator", async () => {
    // The brief is explicit: managing listings is not deciding identity.
    getAuthState.mockResolvedValue({
      status: "authenticated",
      profile: { id: "u-re", role: "real_estate_admin" },
    });
    const result = await reviewKycApplicationAction(
      "app-1",
      null,
      form({ decision: "approve" }),
    );
    expect(result).toEqual({ ok: false, error: "forbidden" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses a customer", async () => {
    getAuthState.mockResolvedValue({
      status: "authenticated",
      profile: { id: "u-cust", role: "customer" },
    });
    const result = await reviewKycApplicationAction(
      "app-1",
      null,
      form({ decision: "approve" }),
    );
    expect(result).toEqual({ ok: false, error: "forbidden" });
  });

  it("refuses an unknown decision before checking the session", async () => {
    const result = await reviewKycApplicationAction(
      "app-1",
      null,
      form({ decision: "escalate" }),
    );
    expect(result).toEqual({ ok: false, error: "invalid_decision" });
    expect(getAuthState).not.toHaveBeenCalled();
  });

  it("rate-limits a reviewer who exceeds the window", async () => {
    checkRateLimit.mockReturnValue({ allowed: false });
    const result = await reviewKycApplicationAction(
      "app-1",
      null,
      form({ decision: "approve" }),
    );
    expect(result).toEqual({ ok: false, error: "rate_limited" });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("reviewKycApplicationAction — reasons", () => {
  it("requires a reason for a refusal", async () => {
    const result = await reviewKycApplicationAction(
      "app-1",
      null,
      form({ decision: "reject" }),
    );
    expect(result).toEqual({ ok: false, error: "reason_required" });
    expect(getAuthState).not.toHaveBeenCalled();
  });

  it("requires a reason for a request for changes", async () => {
    const result = await reviewKycApplicationAction(
      "app-1",
      null,
      form({ decision: "request_changes", reason: "   " }),
    );
    expect(result).toEqual({ ok: false, error: "reason_required" });
  });

  it("allows an approval with no reason, because the note is internal", async () => {
    stubSession();
    const result = await reviewKycApplicationAction(
      "app-1",
      null,
      form({ decision: "approve" }),
    );
    expect(result).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith(
      "approve_kyc_application",
      expect.objectContaining({ p_application_id: "app-1", p_reviewer: "u-super" }),
    );
  });
});

describe("reviewKycApplicationAction — approval writes the capability atomically", () => {
  it("calls the service-role RPC, not a session-client update", async () => {
    const { sessionUpdate } = stubSession();
    await reviewKycApplicationAction("app-1", null, form({ decision: "approve" }));
    expect(rpc).toHaveBeenCalledTimes(1);
    // The approval is a security-definer function; a session write could not
    // express it, which is the point.
    expect(sessionUpdate).not.toHaveBeenCalled();
  });

  it("passes the reviewer id and the note through", async () => {
    stubSession();
    await reviewKycApplicationAction(
      "app-1",
      null,
      form({ decision: "approve", reason: "Documents verified" }),
    );
    expect(rpc).toHaveBeenCalledWith("approve_kyc_application", {
      p_application_id: "app-1",
      p_reviewer: "u-super",
      p_note: "Documents verified",
    });
  });

  it("maps a database refusal to a forbidden result", async () => {
    // The function's own is_super_admin() guard is the real control; when it
    // fires, the caller must not see a generic write failure.
    rpc.mockResolvedValue({ error: { message: "insufficient_privilege" } });
    const result = await reviewKycApplicationAction(
      "app-1",
      null,
      form({ decision: "approve" }),
    );
    expect(result).toEqual({ ok: false, error: "forbidden" });
  });

  it("reports an already-decided application distinctly", async () => {
    rpc.mockResolvedValue({ error: { message: "application is already approved" } });
    const result = await reviewKycApplicationAction(
      "app-1",
      null,
      form({ decision: "approve" }),
    );
    expect(result).toEqual({ ok: false, error: "already_decided" });
  });

  it("reports an unsubmitted application distinctly", async () => {
    rpc.mockResolvedValue({ error: { message: "application has not been submitted" } });
    const result = await reviewKycApplicationAction(
      "app-1",
      null,
      form({ decision: "approve" }),
    );
    expect(result).toEqual({ ok: false, error: "not_submitted" });
  });

  it("records an audit entry for an approval", async () => {
    stubSession();
    await reviewKycApplicationAction("app-1", null, form({ decision: "approve" }));
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "kyc_approved",
        entityType: "real_estate_kyc_application",
        entityId: "app-1",
      }),
    );
  });
});

describe("reviewKycApplicationAction — refusal and request for changes", () => {
  it("writes a refusal through the session client with its reason", async () => {
    const { sessionUpdate } = stubSession();
    const result = await reviewKycApplicationAction(
      "app-1",
      null,
      form({ decision: "reject", reason: "Document unreadable" }),
    );
    expect(result).toEqual({ ok: true });
    expect(sessionUpdate).toHaveBeenCalled();
    // A refusal is not an approval: the capability function must not run.
    expect(rpc).not.toHaveBeenCalled();
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "kyc_rejected" }),
    );
  });

  it("records a request for changes under its own audit action", async () => {
    stubSession();
    await reviewKycApplicationAction(
      "app-1",
      null,
      form({ decision: "request_changes", reason: "Upload the reverse side" }),
    );
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "kyc_changes_requested" }),
    );
  });

  it("reports a write failure rather than claiming success", async () => {
    stubSession({ updateError: { message: "boom" } });
    const result = await reviewKycApplicationAction(
      "app-1",
      null,
      form({ decision: "reject", reason: "Nope" }),
    );
    expect(result).toEqual({ ok: false, error: "write_failed" });
    expect(recordAudit).not.toHaveBeenCalled();
  });
});

describe("addKycNoteAction", () => {
  it("refuses a non-reviewer", async () => {
    getAuthState.mockResolvedValue({
      status: "authenticated",
      profile: { id: "u-re", role: "real_estate_admin" },
    });
    const result = await addKycNoteAction("app-1", null, form({ note: "hi" }));
    expect(result).toEqual({ ok: false, error: "forbidden" });
  });

  it("refuses an empty note", async () => {
    const result = await addKycNoteAction("app-1", null, form({ note: "   " }));
    expect(result).toEqual({ ok: false, error: "note_required" });
  });

  it("writes a note for a reviewer", async () => {
    const { sessionInsert } = stubSession();
    const result = await addKycNoteAction("app-1", null, form({ note: "Cross-checked" }));
    expect(result).toEqual({ ok: true });
    expect(sessionInsert).toHaveBeenCalledWith(
      expect.objectContaining({ action: "note_added", note: "Cross-checked" }),
    );
  });
});

describe("getKycDocumentUrlAction", () => {
  it("refuses a non-reviewer, which is the only gate on a private document", async () => {
    getAuthState.mockResolvedValue({
      status: "authenticated",
      profile: { id: "u-re", role: "real_estate_admin" },
    });
    const result = await getKycDocumentUrlAction("doc-1");
    expect(result).toEqual({ ok: false, error: "forbidden" });
    expect(signedKycUrl).not.toHaveBeenCalled();
  });

  it("refuses an unauthenticated caller", async () => {
    getAuthState.mockResolvedValue({ status: "unauthenticated", profile: null });
    expect(await getKycDocumentUrlAction("doc-1")).toEqual({
      ok: false,
      error: "unauthenticated",
    });
  });

  it("returns not_found when the document is not visible to the caller", async () => {
    // The select runs through the session client, so RLS is the control: a row
    // the caller may not see simply is not there.
    stubSession({ selectData: null });
    const result = await getKycDocumentUrlAction("doc-1");
    expect(result).toEqual({ ok: false, error: "not_found" });
    expect(signedKycUrl).not.toHaveBeenCalled();
  });

  it("mints a signed URL for a visible document", async () => {
    stubSession({
      selectData: { storage_path: "applications/a1/id-front.jpg", application_id: "a1" },
    });
    signedKycUrl.mockResolvedValue("https://example.test/signed?token=abc");

    const result = await getKycDocumentUrlAction("doc-1");

    expect(result).toEqual({ ok: true, url: "https://example.test/signed?token=abc" });
    expect(signedKycUrl).toHaveBeenCalledWith("applications/a1/id-front.jpg");
  });

  it("reports unavailable rather than a broken link when signing fails", async () => {
    stubSession({
      selectData: { storage_path: "applications/a1/id-front.jpg", application_id: "a1" },
    });
    signedKycUrl.mockResolvedValue(null);
    expect(await getKycDocumentUrlAction("doc-1")).toEqual({
      ok: false,
      error: "unavailable",
    });
  });
});
