"use server";

import { revalidatePath } from "next/cache";

import { deleteUserAccountSchema } from "@/lib/auth/account-deletion";
import { deleteAccount } from "@/lib/auth/account-deletion-service";
import { getAuthState } from "@/lib/auth/session";
import { recordAudit } from "@/lib/security/audit";
import { createClient } from "@/lib/supabase/server";

/**
 * A super administrator deleting another account.
 *
 * The role check here is a *message*; the boundary is the
 * `detach_and_archive_user_content` guard, which raises for any caller holding a
 * browser identity that is not a super administrator. The read of the target row
 * goes through the cookie-bound client so `profiles_select_admin` also applies —
 * an id the caller may not see yields `not_found` rather than leaking whether it
 * exists.
 *
 * A super administrator may not delete **their own** account here. Not a
 * privilege question — they are entitled to delete it — but a lockout one, the
 * same reasoning as `changeUserRoleAction`'s self-role guard: the console's
 * "delete user" control should not be the thing that removes the person holding
 * the console. Self-deletion is offered on the account page instead, where the
 * typed confirmation lives and the last-super-admin rule is enforced.
 *
 * A substantive reason is required and recorded, matching every other permanent
 * deletion in this repository.
 */
export type DeleteUserState =
  | { ok: true; message: string }
  | { ok: false; error: string };

export async function deleteUserAccountAction(
  _previous: DeleteUserState | null,
  formData: FormData,
): Promise<DeleteUserState> {
  const auth = await getAuthState();
  if (auth.status === "unconfigured")
    return { ok: false, error: "unconfigured" };
  if (auth.status !== "authenticated" || !auth.profile) {
    return { ok: false, error: "unauthenticated" };
  }
  if (auth.profile.role !== "super_admin") {
    return { ok: false, error: "forbidden" };
  }

  const parsed = deleteUserAccountSchema.safeParse({
    profileId: String(formData.get("profileId") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.message;
    return {
      ok: false,
      error:
        issue === "reason_too_short" ? "reason_too_short" : "invalid_request",
    };
  }

  const { profileId, reason } = parsed.data;

  if (profileId === auth.profile.id) {
    return { ok: false, error: "self_delete" };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "unconfigured" };

  // Read first so an unknown or invisible id is reported as `not_found` and the
  // audit entry can name the account that was removed.
  const { data: target, error: readError } = await supabase
    .from("profiles")
    .select("id, email, role")
    .eq("id", profileId)
    .maybeSingle();

  if (readError) return { ok: false, error: "delete_failed" };
  if (!target) return { ok: false, error: "not_found" };

  const result = await deleteAccount(profileId);
  if (!result.ok) return { ok: false, error: result.error };

  await recordAudit({
    actorId: auth.profile.id,
    action: "profile_deleted",
    entityType: "profile",
    entityId: profileId,
    metadata: {
      self: false,
      deletedUserId: profileId,
      deletedRole: target.role,
      reason,
    },
  });

  revalidatePath("/admin/users");
  return { ok: true, message: "user_deleted" };
}
