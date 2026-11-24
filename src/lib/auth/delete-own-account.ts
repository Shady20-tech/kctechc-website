"use server";

import { redirect } from "next/navigation";

import { deleteOwnAccountSchema } from "@/lib/auth/account-deletion";
import { deleteAccount } from "@/lib/auth/account-deletion-service";
import { getAuthState } from "@/lib/auth/session";
import { recordAudit } from "@/lib/security/audit";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

/**
 * A signed-in user deleting their own account.
 *
 * The account being deleted is taken from the **session**, never from the form.
 * A `profileId` field here would be a request to delete an arbitrary account
 * with no role check behind it; the only id this action will ever act on is
 * `auth.profile.id`, which the session established.
 *
 * The session client is used to read that id and to sign the user out, so the
 * auth cookies are revoked server-side. The deletion itself goes through the
 * Admin API, which is the only supported way to remove an `auth.users` row.
 *
 * A typed confirmation phrase is required (`DELETE_ACCOUNT_CONFIRMATION`), and
 * the check happens before any write. Deletion is irreversible, so the guard is
 * against an accidental submission rather than against an attacker — an attacker
 * with the session could do this anyway.
 *
 * On success the user is redirected to the sign-in page rather than returned a
 * state, because their session no longer exists: leaving them on the account page
 * would render a page whose data just disappeared. `redirect()` from the action
 * also works without JavaScript, which is the same reasoning checkout uses.
 */
export type DeleteOwnAccountState = { ok: true } | { ok: false; error: string };

export async function deleteOwnAccountAction(
  _previous: DeleteOwnAccountState | null,
  formData: FormData,
): Promise<DeleteOwnAccountState> {
  const auth = await getAuthState();
  if (auth.status === "unconfigured")
    return { ok: false, error: "unconfigured" };
  if (auth.status !== "authenticated" || !auth.profile) {
    return { ok: false, error: "unauthenticated" };
  }

  const parsed = deleteOwnAccountSchema.safeParse({
    confirmation: String(formData.get("confirmation") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, error: "confirmation_mismatch" };
  }

  // Deletion is expensive and irreversible; a runaway client should not be able
  // to hammer the Admin API. A handful per hour is far above any honest use.
  const limit = checkRateLimit(`delete-account:${auth.profile.id}`, {
    limit: 5,
    windowSeconds: 3600,
  });
  if (!limit.allowed) return { ok: false, error: "rate_limited" };

  const userId = auth.profile.id;
  const result = await deleteAccount(userId);
  if (!result.ok) return { ok: false, error: result.error };

  // Recorded after the deletion, with a null actor on purpose. `actor_id` is a
  // foreign key to `auth.users` and this account no longer has a row there, so
  // passing the id would make the insert fail the constraint and the audit call
  // would silently return false — losing the very trail this row exists for. The
  // `on delete set null` cascade only rewrites rows that already existed; it
  // cannot help an insert that names a deleted user. The deleted id is carried in
  // the metadata instead, which is the durable record of who was removed.
  await recordAudit({
    actorId: null,
    action: "profile_deleted",
    entityType: "profile",
    entityId: userId,
    metadata: { self: true, deletedUserId: userId },
  });

  // Revoke the auth cookies. The user row is already gone, so this is a
  // courtesy that also clears a session pointing at nothing.
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();

  // Same target shape `customerSignOutAction` uses: the locale is validated
  // rather than trusted, so a crafted value cannot turn this into an open
  // redirect. `reason=deleted` reuses the sign-in form's existing notice slot,
  // so the page acknowledges the deletion without a second mechanism.
  const locale = String(formData.get("locale") ?? "");
  const base = /^[a-z]{2}$/.test(locale) ? `/${locale}/login` : "/login";
  redirect(`${base}?reason=deleted`);
}
