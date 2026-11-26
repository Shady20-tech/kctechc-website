import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

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

const createClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => createClient(),
}));

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

import { clearAuditLogsAction } from "./log-actions";

const SUPER_ID = "11111111-1111-4111-8111-111111111111";

function formData(entries: Record<string, string>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(entries)) form.append(key, value);
  return form;
}

function sessionClient(
  result: { error?: unknown; count?: number | null } = {},
) {
  const not = vi.fn().mockResolvedValue({
    error: result.error ?? null,
    count: result.count ?? 0,
  });
  const remove = vi.fn().mockReturnValue({ not });
  const from = vi.fn().mockReturnValue({ delete: remove });
  return { from, __delete: remove, __not: not };
}

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimit.mockReturnValue({ allowed: true });
  recordAudit.mockResolvedValue(true);
  getAuthState.mockResolvedValue({
    status: "authenticated",
    profile: { id: SUPER_ID, role: "super_admin" },
  });
  createClient.mockResolvedValue(sessionClient({ count: 7 }));
});

describe("clearAuditLogsAction", () => {
  it("refuses a non-super-admin before any delete", async () => {
    getAuthState.mockResolvedValue({
      status: "authenticated",
      profile: { id: SUPER_ID, role: "digital_marketing_admin" },
    });
    const client = sessionClient({ count: 7 });
    createClient.mockResolvedValue(client);

    const state = await clearAuditLogsAction(
      null,
      formData({ reason: "Rotate the audit trail for this quarter" }),
    );

    expect(state).toEqual({ ok: false, error: "forbidden" });
    expect(client.from).not.toHaveBeenCalled();
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("refuses an invalid reason before any delete", async () => {
    const client = sessionClient({ count: 7 });
    createClient.mockResolvedValue(client);

    const state = await clearAuditLogsAction(
      null,
      formData({ reason: "short" }),
    );

    expect(state).toEqual({ ok: false, error: "invalid_reason" });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("deletes every audit row through the session client and records the clear", async () => {
    const client = sessionClient({ count: 7 });
    createClient.mockResolvedValue(client);

    const state = await clearAuditLogsAction(
      null,
      formData({ reason: "Rotate the audit trail for this quarter" }),
    );

    expect(state).toEqual({ ok: true, deleted: 7, audited: true });
    expect(client.from).toHaveBeenCalledWith("audit_logs");
    expect(client.__delete).toHaveBeenCalledWith({ count: "exact" });
    expect(client.__not).toHaveBeenCalledWith("id", "is", null);
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: SUPER_ID,
        action: "audit_logs_cleared",
        entityType: "audit_logs",
        metadata: {
          deleted: 7,
          reason: "Rotate the audit trail for this quarter",
        },
      }),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/admin/logs");
  });

  it("reports a failed audit write without pretending the rows survived", async () => {
    recordAudit.mockResolvedValue(false);

    const state = await clearAuditLogsAction(
      null,
      formData({ reason: "Rotate the audit trail for this quarter" }),
    );

    expect(state).toEqual({ ok: true, deleted: 7, audited: false });
  });

  it("maps a policy refusal to forbidden and keeps the detail", async () => {
    createClient.mockResolvedValue(
      sessionClient({ error: { code: "42501", message: "permission denied" } }),
    );

    const state = await clearAuditLogsAction(
      null,
      formData({ reason: "Rotate the audit trail for this quarter" }),
    );

    expect(state).toMatchObject({
      ok: false,
      error: "forbidden",
      detail: expect.stringContaining("permission denied"),
    });
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("pins the database boundary to a super-admin-only DELETE policy", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20260101000085_clear_audit_logs.sql",
      ),
      "utf8",
    );

    expect(sql).toContain('create policy "audit_logs_delete_super_admin"');
    expect(sql).toContain("for delete");
    expect(sql).toContain("using (public.is_super_admin())");
    expect(sql).toContain("grant delete on public.audit_logs to authenticated");
  });
});
