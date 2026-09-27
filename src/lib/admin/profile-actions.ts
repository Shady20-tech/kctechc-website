"use server";

import { revalidatePath } from "next/cache";

import { getAuthState } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAudit } from "@/lib/security/audit";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { AVATAR_BUCKET } from "@/lib/uploads/media";
import { buildObjectPath, validateUpload } from "@/lib/uploads/validation";

/**
 * Self-service account actions: profile details, profile picture, password.
 *
 * These run for the signed-in user on their own row, which is why they use the
 * cookie-bound client for the profile write rather than the service-role client:
 * the `profiles_update_own` policy is the control, and it pins `role` to its
 * stored value, so a crafted request cannot promote the caller. The service-role
 * client is used only for the Storage upload, because the media buckets have no
 * `storage.objects` insert policy — uploads are meant to go through authorized
 * application code, never straight from a browser session.
 *
 * The `email` column is intentionally not editable here. Changing the address a
 * user signs in with is an identity change that must go through the auth
 * provider's confirmation flow, not a profile form.
 */

export type ProfileUpdateState =
  | { ok: true; message: string }
  | { ok: false; error: string };

const MAX_NAME = 120;
const MAX_PHONE = 40;

export async function updateProfileAction(
  _previous: ProfileUpdateState | null,
  formData: FormData,
): Promise<ProfileUpdateState> {
  const auth = await getAuthState();
  if (auth.status !== "authenticated" || !auth.profile) {
    return { ok: false, error: "unauthenticated" };
  }

  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const locale = String(formData.get("locale") ?? "").trim();

  if (fullName.length > MAX_NAME) return { ok: false, error: "name_too_long" };
  if (phone.length > MAX_PHONE) return { ok: false, error: "phone_too_long" };
  if (locale !== "en" && locale !== "fr") {
    return { ok: false, error: "invalid_locale" };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "unconfigured" };

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName || null,
      phone: phone || null,
      locale,
    })
    .eq("id", auth.profile.id);

  if (error) return { ok: false, error: "update_failed" };

  await recordAudit({
    actorId: auth.profile.id,
    action: "profile_updated",
    entityType: "profile",
    entityId: auth.profile.id,
    metadata: { self: true, fields: "full_name,phone,locale" },
  });

  revalidatePath("/admin/profile");
  revalidatePath("/admin");
  return { ok: true, message: "updated" };
}

export async function uploadAvatarAction(
  _previous: ProfileUpdateState | null,
  formData: FormData,
): Promise<ProfileUpdateState> {
  const auth = await getAuthState();
  if (auth.status !== "authenticated" || !auth.profile) {
    return { ok: false, error: "unauthenticated" };
  }

  // Image uploads are cheap to attempt and expensive to store, so a runaway loop
  // is worth throttling. Ten per minute is far above any honest use.
  const limit = checkRateLimit(`avatar:${auth.profile.id}`, {
    limit: 10,
    windowSeconds: 60,
  });
  if (!limit.allowed) return { ok: false, error: "rate_limited" };

  const file = formData.get("avatar");
  if (!(file instanceof File)) return { ok: false, error: "no_file" };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const verdict = validateUpload(bytes, file.type, { kind: "avatar" });
  if (!verdict.ok) return { ok: false, error: verdict.reason };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "unconfigured" };

  // Namespaced by user id so one user's pictures cannot collide with another's,
  // and so a future "delete my media" is a single prefix delete. The filename
  // comes from a UUID, never from the uploaded name.
  const objectPath = buildObjectPath(auth.profile.id, verdict.extension);

  const { error: uploadError } = await admin.storage
    .from(AVATAR_BUCKET)
    .upload(objectPath, bytes, {
      contentType: verdict.mime,
      upsert: false,
    });

  if (uploadError) return { ok: false, error: "upload_failed" };

  const previousPath = auth.profile.avatarPath;

  const { error: updateError } = await admin
    .from("profiles")
    .update({ avatar_path: objectPath })
    .eq("id", auth.profile.id);

  if (updateError) {
    // The new object is orphaned if the row could not be pointed at it; remove it
    // rather than leaving an unreachable file paying for storage forever.
    await admin.storage.from(AVATAR_BUCKET).remove([objectPath]);
    return { ok: false, error: "update_failed" };
  }

  if (previousPath && previousPath !== objectPath) {
    await admin.storage.from(AVATAR_BUCKET).remove([previousPath]);
  }

  await recordAudit({
    actorId: auth.profile.id,
    action: "avatar_changed",
    entityType: "profile",
    entityId: auth.profile.id,
    metadata: { self: true, action: "upload" },
  });

  revalidatePath("/admin/profile");
  revalidatePath("/admin");
  return { ok: true, message: "avatar_updated" };
}

export async function removeAvatarAction(): Promise<void> {
  const auth = await getAuthState();
  if (auth.status !== "authenticated" || !auth.profile) return;

  const admin = createAdminClient();
  if (!admin) return;

  const current = auth.profile.avatarPath;
  const { error } = await admin
    .from("profiles")
    .update({ avatar_path: null })
    .eq("id", auth.profile.id);
  if (error) return;

  if (current) await admin.storage.from(AVATAR_BUCKET).remove([current]);

  await recordAudit({
    actorId: auth.profile.id,
    action: "avatar_changed",
    entityType: "profile",
    entityId: auth.profile.id,
    metadata: { self: true, action: "remove" },
  });

  revalidatePath("/admin/profile");
}

export async function changePasswordAction(
  _previous: ProfileUpdateState | null,
  formData: FormData,
): Promise<ProfileUpdateState> {
  const auth = await getAuthState();
  if (auth.status !== "authenticated" || !auth.profile) {
    return { ok: false, error: "unauthenticated" };
  }

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 12) return { ok: false, error: "password_too_short" };
  if (password !== confirm) return { ok: false, error: "password_mismatch" };

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "unconfigured" };

  // Supabase Auth owns the password hash; the application never sees or stores
  // it. A failure here is reported as a generic message so the response cannot be
  // used to probe password policy.
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: "password_failed" };

  await recordAudit({
    actorId: auth.profile.id,
    action: "password_changed",
    entityType: "profile",
    entityId: auth.profile.id,
    metadata: { self: true },
  });

  return { ok: true, message: "password_updated" };
}
