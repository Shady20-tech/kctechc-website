import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The one implementation of "delete this account".
 *
 * Both entry points — the customer deleting their own account and a super
 * administrator deleting someone else's — converge here, so the two cannot drift
 * into different definitions of what deletion means. It lives outside a
 * `"use server"` module because it is not itself an endpoint; the actions that
 * call it are.
 *
 * ## Order of operations, and why it is this order
 *
 * 1. `detach_and_archive_user_content` archives the account's listings, removes
 *    its agent profile, and returns the storage paths that belong to it.
 * 2. The auth user is deleted, which cascades the profile and everything hanging
 *    off it.
 * 3. The captured storage objects are purged.
 *
 * Steps 1 and 3 cannot be swapped. `property_listings.owner_id` and the KYC
 * tables are `on delete set null` / cascade, so once the auth row is gone there
 * is no longer any way to find the listings to archive or the paths to purge.
 * The paths are therefore read *before* the deletion and the objects removed
 * *after* it.
 *
 * The irreversible, security-relevant step is step 2. A failure in step 3 leaves
 * an orphaned object paying for storage, which is a cost problem, not an access
 * one; a failure in step 2 leaves the account intact with its listings already
 * archived, which an administrator can undo. Neither failure is reported as
 * success.
 */

export type AccountDeletionResult = { ok: true } | { ok: false; error: string };

/**
 * Delete an account and everything that belongs to it.
 *
 * The caller is responsible for authorization: `deleteOwnAccountAction` has
 * already established the session belongs to `userId`, and
 * `deleteUserAccountAction` has already established the caller is a super
 * administrator. The RPC re-checks the super-admin boundary for any caller that
 * has a browser identity, so a bug in either action does not become a hole.
 */
export async function deleteAccount(
  userId: string,
): Promise<AccountDeletionResult> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "unconfigured" };

  // Step 1. Content consequences, and the storage paths that must be purged.
  const { data: objects, error: cleanupError } = await admin.rpc(
    "detach_and_archive_user_content",
    { p_user_id: userId },
  );

  if (cleanupError) {
    // The RPC raises for the two conditions worth distinguishing: the last super
    // administrator, and a non-super-admin caller. Both are `check_violation` /
    // `insufficient_privilege`, so the message is the signal.
    const message = cleanupError.message ?? "";
    if (message.includes("last super administrator")) {
      return { ok: false, error: "last_super_admin" };
    }
    if (cleanupError.code === "42501") {
      return { ok: false, error: "forbidden" };
    }
    return { ok: false, error: "cleanup_failed" };
  }

  // Step 2. The auth user. This is what cascades the profile and its children.
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) return { ok: false, error: "delete_failed" };

  // Step 3. Best-effort object purge. The rows are gone, so a failure here can
  // only leave an unreachable file behind — it must not be reported as a failed
  // deletion, because the deletion did happen.
  await purgeObjects(admin, objects ?? []);

  return { ok: true };
}

/**
 * Remove the captured storage objects, grouped by bucket.
 *
 * Grouped because `storage.from(bucket).remove([...])` is scoped to one bucket
 * per call; a path from another bucket silently does nothing. Failures are
 * swallowed on purpose — see the note above on step 3.
 */
async function purgeObjects(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  objects: readonly { object_bucket: string; object_path: string }[],
): Promise<void> {
  const byBucket = new Map<string, string[]>();
  for (const object of objects) {
    if (!object.object_path) continue;
    const paths = byBucket.get(object.object_bucket) ?? [];
    paths.push(object.object_path);
    byBucket.set(object.object_bucket, paths);
  }

  for (const [bucket, paths] of byBucket) {
    try {
      await admin.storage.from(bucket).remove(paths);
    } catch {
      // An orphaned object is a storage cost, not an access-control problem, and
      // the account is already gone. Retrying inside the request would delay a
      // response that has nothing left to wait for.
    }
  }
}
