import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/config/env";

/**
 * Supabase Storage access for Electrical Services media.
 *
 * Two buckets, deliberately separate:
 *
 *   - `project-media` is PUBLIC. Project photography is marketing material meant
 *     to be seen, so its URL is derived from the object path rather than stored.
 *     Storing an absolute URL would bake the project ref into the database, so a
 *     project migration or a custom domain would break every image.
 *
 *   - `inquiry-attachments` is PRIVATE. Those are a visitor's photographs of
 *     their own installation, possibly of their home. They are written with the
 *     service-role client and read only through a short-lived signed URL. No
 *     public URL is ever constructed for them, which is why this module has no
 *     function that could.
 */

/** The public bucket project photography is uploaded to. */
export const PROJECT_MEDIA_BUCKET = "project-media";

/** The private bucket inquiry attachments are uploaded to. */
export const INQUIRY_ATTACHMENTS_BUCKET = "inquiry-attachments";

/** How long a signed attachment URL stays valid. */
const SIGNED_URL_TTL_SECONDS = 300;

/**
 * Build the public URL for a project media object.
 *
 * Returns null when Supabase is unconfigured rather than a broken relative URL,
 * so callers render a placeholder instead of a request that 404s.
 * `next.config.ts` whitelists exactly this host and path prefix in
 * `images.remotePatterns`, so a URL this module produces is the only kind
 * `next/image` will accept.
 */
export function projectMediaPublicUrl(objectPath: string): string | null {
  if (!publicEnv.supabaseUrl) return null;
  const base = publicEnv.supabaseUrl.replace(/\/$/, "");
  const clean = objectPath.replace(/^\/+/, "");
  if (clean.length === 0) return null;
  return `${base}/storage/v1/object/public/${PROJECT_MEDIA_BUCKET}/${clean}`;
}

/**
 * The storage path for a project image.
 *
 * Namespaced by project id so two projects cannot collide on a filename, and so
 * deleting a project's media is a single prefix delete.
 */
export function projectMediaPath(projectId: string, filename: string): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "-");
  return `projects/${projectId}/${safeName}`;
}

export type AttachmentUpload = {
  /** Storage-relative object path, as recorded in `inquiry_attachments`. */
  storagePath: string;
  detectedMime: string;
  byteSize: number;
  originalFilename: string;
};

/**
 * Upload one validated attachment to the private bucket.
 *
 * Uses the service-role client, because the bucket has no anonymous write policy
 * — a browser cannot upload directly. The object path was built by
 * `buildObjectPath` from a UUID and a content-derived extension, so nothing here
 * depends on the visitor's filename.
 *
 * `contentType` is the type the server DETECTED from the file's bytes, not the
 * type the browser declared. Passing the declared type would let a file be stored
 * and later served with a content type it does not actually have.
 */
export async function uploadInquiryAttachment(
  input: AttachmentUpload & { bytes: Uint8Array },
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, reason: "unconfigured" };

  const { error } = await admin.storage
    .from(INQUIRY_ATTACHMENTS_BUCKET)
    .upload(input.storagePath, input.bytes, {
      contentType: input.detectedMime,
      // No upsert: a path collision would mean two uploads landed on one object,
      // and the UUID makes that a genuine error rather than a routine overwrite.
      upsert: false,
    });

  if (error) return { ok: false, reason: "upload_failed" };
  return { ok: true };
}

/**
 * Remove an attachment object after a failed inquiry write.
 *
 * Called when the inquiry row could not be stored, so the bucket does not
 * accumulate orphaned uploads from submissions that never completed. A failure
 * here is not reported to the visitor: the submission has already failed for a
 * reason they can act on, and a stranded object is an operational concern rather
 * than something they could do anything about.
 */
export async function removeInquiryAttachment(
  storagePath: string,
): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  try {
    await admin.storage.from(INQUIRY_ATTACHMENTS_BUCKET).remove([storagePath]);
  } catch {
    // Best effort. The inquiry write already failed; leaving an orphan is
    // preferable to throwing from a cleanup path.
  }
}

/**
 * Create a short-lived signed URL for a private attachment.
 *
 * This is the ONLY way an attachment is read. The URL expires, so a leaked link
 * stops working, and it is generated server-side after an authorization check —
 * never handed to the browser by a public render path.
 *
 * Returns null when Supabase is unconfigured or signing fails, so a caller
 * renders "unavailable" rather than a broken link.
 */
export async function signedAttachmentUrl(
  storagePath: string,
): Promise<string | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  const { data, error } = await admin.storage
    .from(INQUIRY_ATTACHMENTS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/**
 * Read the attachment rows for an inquiry.
 *
 * Uses the RLS-bound client rather than the service-role client: the policy on
 * `inquiry_attachments` allows an admin only, so this returns rows for an
 * authorized caller and nothing for anyone else. Reading through RLS means the
 * authorization cannot be forgotten here.
 */
export async function loadInquiryAttachments(inquiryId: string): Promise<
  {
    id: string;
    storagePath: string;
    originalFilename: string;
    detectedMime: string;
    byteSize: number;
  }[]
> {
  const supabase = await createClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("inquiry_attachments")
    .select("id, storage_path, original_filename, detected_mime, byte_size")
    .eq("inquiry_id", inquiryId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    storagePath: row.storage_path,
    originalFilename: row.original_filename,
    detectedMime: row.detected_mime,
    byteSize: row.byte_size,
  }));
}
