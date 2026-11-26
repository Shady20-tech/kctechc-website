"use server";

import { revalidatePath } from "next/cache";

import { getAuthState } from "@/lib/auth/session";
import { recordAudit } from "@/lib/security/audit";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { describeSupabaseError } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";

export type ClearAuditLogsState =
  | { ok: true; deleted: number; audited: boolean }
  | { ok: false; error: string; detail?: string };

/**
 * Clear the audit trail. Super administrators only.
 *
 * The delete uses the cookie-bound client, so `audit_logs_delete_super_admin`
 * is the boundary: a crafted POST from a lesser role matches no deletable row.
 * The role check here is the message that turns a policy refusal into "only a
 * super administrator may clear the logs"; it is not the control.
 *
 * The clear is itself audited. `recordAudit` runs after the delete through the
 * service-role client, so the trail ends with one `audit_logs_cleared` row
 * carrying the reason and the number removed. If that write fails the rows are
 * still gone — the action reports `audited: false` rather than pretending the
 * clear did not happen.
 */
export async function clearAuditLogsAction(
  _previous: ClearAuditLogsState | null,
  formData: FormData,
): Promise<ClearAuditLogsState> {
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 10 || reason.length > 500) {
    return { ok: false, error: "invalid_reason" };
  }

  const auth = await getAuthState();
  if (auth.status === "unconfigured") {
    return { ok: false, error: "unconfigured" };
  }
  if (auth.status !== "authenticated" || !auth.profile) {
    return { ok: false, error: "unauthenticated" };
  }
  if (auth.profile.role !== "super_admin") {
    return { ok: false, error: "forbidden" };
  }

  const limit = checkRateLimit(`audit-log-clear:${auth.profile.id}`, {
    limit: 3,
    windowSeconds: 600,
  });
  if (!limit.allowed) return { ok: false, error: "rate_limited" };

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "unconfigured" };

  const { error, count } = await supabase
    .from("audit_logs")
    .delete({ count: "exact" })
    .not("id", "is", null);

  if (error) {
    return {
      ok: false,
      error: error.code === "42501" ? "forbidden" : "delete_failed",
      detail: describeSupabaseError(error),
    };
  }

  const deleted = count ?? 0;
  const audited = await recordAudit({
    actorId: auth.profile.id,
    action: "audit_logs_cleared",
    entityType: "audit_logs",
    entityId: null,
    metadata: { deleted, reason },
  });

  revalidatePath("/admin/logs");
  return { ok: true, deleted, audited };
}
