"use server";

import { revalidatePath } from "next/cache";

import { getAuthState } from "@/lib/auth/session";
import { roleChangeSchema } from "@/lib/auth/role-assignment";
import { recordAudit } from "@/lib/security/audit";
import { createClient } from "@/lib/supabase/server";

/**
 * Grant or revoke a role. Super administrators only.
 *
 * The write goes through the **cookie-bound** client, never the service-role
 * client, so `profiles_update_super_admin` is the control: the policy's `using`
 * and `with check` both evaluate `is_super_admin()`, which reads the caller's
 * role from the database. A crafted POST from a lesser role is refused by RLS
 * regardless of what this function decides, and a crafted `profileId` for a row
 * the caller may not touch matches no row.
 *
 * That is also why this action does not use the service-role client even though
 * it is privileged: using it would bypass the very policy that makes the
 * boundary real, and the trigger `forbid_self_role_change` is a second line of
 * defence rather than the only one.
 *
 * A super administrator may not change **their own** role. It is not a privilege
 * question — the database would allow it — but a lockout one: if the only super
 * administrator demotes themselves there is no remaining account that can grant
 * the role back through the console, and recovery becomes a manual SQL edit.
 */

export type RoleChangeState =
  | { ok: true; message: string; role: string }
  | { ok: false; error: string };

export async function changeUserRoleAction(
  _previous: RoleChangeState | null,
  formData: FormData,
): Promise<RoleChangeState> {
  const auth = await getAuthState();
  if (auth.status !== "authenticated" || !auth.profile) {
    return { ok: false, error: "unauthenticated" };
  }
  if (auth.profile.role !== "super_admin") {
    return { ok: false, error: "forbidden" };
  }

  const parsed = roleChangeSchema.safeParse({
    profileId: String(formData.get("profileId") ?? ""),
    role: String(formData.get("role") ?? ""),
  });
  if (!parsed.success) return { ok: false, error: "invalid_request" };

  const { profileId, role } = parsed.data;

  if (profileId === auth.profile.id) {
    return { ok: false, error: "self_role_change" };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "unconfigured" };

  // Read the current role first so the audit entry can record the transition and
  // a no-op change is not written as if something happened. The select is itself
  // subject to `profiles_select_admin`, so an unknown id yields null here rather
  // than leaking whether the row exists.
  const { data: target, error: readError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", profileId)
    .maybeSingle();

  if (readError) return { ok: false, error: "update_failed" };
  if (!target) return { ok: false, error: "not_found" };

  if (target.role === role) {
    return { ok: true, message: "unchanged", role };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", profileId);

  if (error) {
    // A policy refusal arrives as `42501`. Reporting it distinctly is worth it:
    // "not permitted" and "try again" call for different actions from the reader.
    return {
      ok: false,
      error: error.code === "42501" ? "forbidden" : "update_failed",
    };
  }

  // The role is an authorization input, so every change is recorded with both
  // ends of the transition. `recordAudit` writes through the service-role client
  // because `audit_logs` is append-only and not writable from a browser session.
  await recordAudit({
    actorId: auth.profile.id,
    action: "role_changed",
    entityType: "profile",
    entityId: profileId,
    metadata: { from: target.role, to: role },
  });

  revalidatePath("/admin/users");
  return { ok: true, message: "role_updated", role };
}
