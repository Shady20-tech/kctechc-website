import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Supabase Storage access for KYC evidence.
 *
 * One bucket, and it is PRIVATE: `kyc-documents` holds identity-card images,
 * passport images, a face video and land titles. None of it is ever reachable by
 * a public URL — this module deliberately has no function that could construct
 * one, so a caller cannot accidentally turn a signed path into a durable link.
 *
 * The bytes are written with the service-role client, after the Server Action has
 * authorized the caller, and read only through a short-lived signed URL minted
 * server-side after a super-admin check. This mirrors `uploads/storage.ts` for
 * inquiry attachments, which is the same shape of secret.
 */

/** The private bucket KYC documents and videos are uploaded to. */
export const KYC_BUCKET = "kyc-documents";

/**
 * How long a signed KYC URL stays valid.
 *
 * Shorter than the inquiry attachment's 300s: a KYC document is an identity
 * document, and the reviewer opens it, looks, and closes it. Five minutes is
 * ample for that and keeps a leaked link from being useful for long. A video
 * preview may need longer than a still, so it is 300s too.
 */
const SIGNED_URL_TTL_SECONDS = 300;

/**
 * The storage path for a KYC object.
 *
 * Namespaced by the application id so two applications cannot collide, and so
 * deleting an application's evidence is a single prefix delete — which is the
 * "private document deletion" control. The filename segment is supplied by the
 * caller and is derived from the file's content type and a UUID by
 * `buildObjectPath`, never from the upload's own name.
 */
export function kycObjectPath(applicationId: string, objectName: string): string {
  const safeName = objectName.replace(/[^a-zA-Z0-9._-]/g, "-");
  return `applications/${applicationId}/${safeName}`;
}

/** The storage path for a listing's legal document. */
export function legalDocumentObjectPath(
  listingId: string,
  objectName: string,
): string {
  const safeName = objectName.replace(/[^a-zA-Z0-9._-]/g, "-");
  return `listings/${listingId}/${safeName}`;
}

export type KycUpload = {
  storagePath: string;
  /** The MIME type the server DETECTED, never the browser's claim. */
  detectedMime: string;
  byteSize: number;
  originalFilename: string;
};

/**
 * Upload one validated KYC object to the private bucket.
 *
 * Uses the service-role client, because the bucket has no browser write policy —
 * a visitor cannot upload directly, which is the "authenticated upload
 * authorization" control. `contentType` is the detected type, so a file is stored
 * with the type it actually has and later served correctly.
 *
 * `upsert: false`: a path collision would mean two uploads landed on one object,
 * and the UUID in the path makes that a genuine error rather than a routine
 * overwrite.
 */
export async function uploadKycObject(
  input: KycUpload & { bytes: Uint8Array },
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, reason: "unconfigured" };

  const { error } = await admin.storage
    .from(KYC_BUCKET)
    .upload(input.storagePath, input.bytes, {
      contentType: input.detectedMime,
      upsert: false,
    });

  if (error) return { ok: false, reason: "upload_failed" };
  return { ok: true };
}

/**
 * Remove a KYC object.
 *
 * Used when the row write fails after the upload (so the bucket does not
 * accumulate orphans), and for a deliberate deletion. A failure is not surfaced:
 * the caller has already succeeded or failed for a reason it can act on, and a
 * stranded object is an operational concern.
 */
export async function removeKycObject(storagePath: string): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  try {
    await admin.storage.from(KYC_BUCKET).remove([storagePath]);
  } catch {
    // Best effort.
  }
}

/**
 * Create a short-lived signed URL for a private KYC object.
 *
 * This is the ONLY way a KYC document or face video is read. The URL expires, so
 * a leaked link stops working, and it is generated server-side after an
 * authorization check — never handed to the browser by a public render path.
 *
 * Returns null when Supabase is unconfigured or signing fails, so a caller renders
 * "unavailable" rather than a broken link.
 */
export async function signedKycUrl(
  storagePath: string,
  ttlSeconds: number = SIGNED_URL_TTL_SECONDS,
): Promise<string | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  const { data, error } = await admin.storage
    .from(KYC_BUCKET)
    .createSignedUrl(storagePath, ttlSeconds);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
