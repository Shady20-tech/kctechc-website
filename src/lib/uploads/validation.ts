import { randomUUID } from "node:crypto";

import {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENT_COUNT,
  MAX_AVATAR_BYTES,
  MAX_CONTENT_IMAGE_BYTES,
  MAX_KYC_DOCUMENT_BYTES,
  MAX_KYC_VIDEO_BYTES,
  MAX_PRODUCT_IMAGE_BYTES,
  MAX_PROJECT_IMAGE_BYTES,
  MAX_PROPERTY_IMAGE_BYTES,
} from "./limits";

export {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENT_COUNT,
  MAX_AVATAR_BYTES,
  MAX_CONTENT_IMAGE_BYTES,
  MAX_KYC_DOCUMENT_BYTES,
  MAX_KYC_VIDEO_BYTES,
  MAX_PRODUCT_IMAGE_BYTES,
  MAX_PROJECT_IMAGE_BYTES,
  MAX_PROPERTY_IMAGE_BYTES,
};

/**
 * Upload validation.
 *
 * The governing rule is that a file's declared MIME type and its filename
 * extension are both attacker-controlled and neither is evidence of anything. A
 * `.jpg` can contain a PDF, a script or an executable, and a browser will happily
 * send `image/jpeg` for a file that is not an image. So the type is determined by
 * inspecting the file's leading bytes, and the declared type is used only to
 * decide whether it is worth inspecting at all.
 *
 * This is deliberately independent of the storage provider: it produces a verdict
 * and a safe object path, and the caller decides where to put the bytes. That
 * keeps the security decision testable without a bucket.
 *
 * The byte limits themselves live in `./limits`, a leaf module the admin forms
 * and `next.config.ts` can also import without pulling in `node:crypto`.
 */

export type UploadKind =
  | "attachment"
  | "project-image"
  | "content-image"
  | "avatar"
  | "product-image"
  | "property-image"
  | "kyc-document"
  | "kyc-video";

/**
 * The MIME types an attachment may have.
 *
 * Images for photographs of an installation, and PDF for a drawing, a previous
 * inspection report or a specification the visitor already has. Nothing else:
 * no archives (a ZIP is a container that can hold anything, and its declared type
 * says nothing about its contents), no office documents (they are macro-capable
 * and we never render them), and no SVG (it is an XML document that can carry
 * script, and it is not needed for a photograph).
 */
export const ALLOWED_ATTACHMENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
] as const;

/** Project images are photographs for the public site, so images only. */
export const ALLOWED_PROJECT_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

/**
 * Avatar images.
 *
 * The same conservative image set as project media, minus AVIF: a profile
 * picture is rendered small and uploaded rarely, and every browser that can
 * display the site supports JPEG/PNG/WebP. Dropping AVIF keeps the accepted set
 * aligned with the `avatars` bucket's own `allowed_mime_types`.
 */
export const ALLOWED_AVATAR_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/**
 * KYC documents: an identity document, a proof of address or a land title.
 *
 * Images plus PDF, the same conservative set as an inquiry attachment. A land
 * title is often a scan, so PDF is essential; nothing executable and no archive
 * is accepted, because a ZIP's declared type says nothing about its contents.
 */
export const ALLOWED_KYC_DOCUMENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
] as const;

/**
 * The KYC face video.
 *
 * Three container types, which is what a phone or a laptop browser produces:
 * MP4 (the near-universal camera default), WebM (Chrome's `MediaRecorder`
 * default) and QuickTime/MOV (iOS Safari). The bytes are still checked — a file
 * is accepted only when its leading bytes match one of these containers — so a
 * `.mp4` that is not an MP4 is refused.
 */
export const ALLOWED_KYC_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;

/** Byte limit per upload kind, matching each bucket's `file_size_limit`. */
const LIMIT_FOR_KIND: Record<UploadKind, number> = {
  attachment: MAX_ATTACHMENT_BYTES,
  "project-image": MAX_PROJECT_IMAGE_BYTES,
  "content-image": MAX_CONTENT_IMAGE_BYTES,
  avatar: MAX_AVATAR_BYTES,
  "product-image": MAX_PRODUCT_IMAGE_BYTES,
  "property-image": MAX_PROPERTY_IMAGE_BYTES,
  "kyc-document": MAX_KYC_DOCUMENT_BYTES,
  "kyc-video": MAX_KYC_VIDEO_BYTES,
};

/** Accepted MIME types per upload kind. */
const TYPES_FOR_KIND: Record<UploadKind, readonly string[]> = {
  attachment: ALLOWED_ATTACHMENT_TYPES,
  "project-image": ALLOWED_PROJECT_IMAGE_TYPES,
  "content-image": ALLOWED_PROJECT_IMAGE_TYPES,
  avatar: ALLOWED_AVATAR_TYPES,
  "product-image": ALLOWED_PROJECT_IMAGE_TYPES,
  "property-image": ALLOWED_PROJECT_IMAGE_TYPES,
  "kyc-document": ALLOWED_KYC_DOCUMENT_TYPES,
  "kyc-video": ALLOWED_KYC_VIDEO_TYPES,
};

/** The file extension to use for a detected type. Never taken from the upload. */
const EXTENSION_FOR_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/avif": "avif",
  "application/pdf": "pdf",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

/**
 * Detect a file's type from its leading bytes.
 *
 * Signatures, not extensions. Every one of these formats has a fixed header at a
 * known offset, which is what makes the check meaningful: a file that claims to
 * be a JPEG but does not begin with the JPEG start-of-image marker is rejected
 * regardless of what the browser said.
 *
 * HEIC/HEIF is the awkward case. It is an ISO base media file, so its header is
 * an `ftyp` box whose brand identifies the variant, and the brand sits at offset
 * 8. An MP4 and a QuickTime movie share the same box structure, so the brand is
 * what separates a still image from a video — and each is returned as its own
 * type, so a video is refused by the image kinds (whose allowed list excludes
 * it) rather than being silently accepted as a photograph.
 *
 * Returns null when nothing matches, which the caller treats as a rejection. An
 * unknown type is not assumed to be safe.
 */
export function detectMimeType(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  // WebP: "RIFF" .... "WEBP"
  if (matchesAscii(bytes, 0, "RIFF") && matchesAscii(bytes, 8, "WEBP")) {
    return "image/webp";
  }

  // PDF: "%PDF-"
  if (matchesAscii(bytes, 0, "%PDF-")) {
    return "application/pdf";
  }

  // WebM / Matroska: the EBML header 1A 45 DF A3. The container's DocType string
  // ("webm" or "matroska") sits in the header, so the magic alone does not
  // distinguish them; the DocType is searched for in the first 64 bytes, and a
  // Matroska file (which is not a web video and has no accepted extension) is
  // refused by returning null rather than being mislabelled.
  if (
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  ) {
    const window = bytes.subarray(0, Math.min(bytes.length, 64));
    let ascii = "";
    for (const byte of window) ascii += String.fromCharCode(byte);
    return ascii.includes("webm") ? "video/webm" : null;
  }

  // ISO base media (HEIC/HEIF/AVIF/MP4/QuickTime): box size, then "ftyp", then a
  // brand.
  if (matchesAscii(bytes, 4, "ftyp")) {
    const brand = asciiAt(bytes, 8, 4);
    if (brand === null) return null;

    // AVIF brands.
    if (brand === "avif" || brand === "avis") return "image/avif";

    // HEIF still-image brands. `heic`, `heix`, `hevc`, `hevx` are HEVC-coded
    // stills; `heim`, `heis`, `hevm`, `hevs` are the multi-image variants.
    if (
      brand === "heic" ||
      brand === "heix" ||
      brand === "hevc" ||
      brand === "hevx" ||
      brand === "heim" ||
      brand === "heis" ||
      brand === "hevm" ||
      brand === "hevs"
    ) {
      return "image/heic";
    }

    if (brand === "mif1" || brand === "msf1") return "image/heif";

    // QuickTime, which iOS Safari's camera produces.
    if (brand === "qt  ") return "video/quicktime";

    // MP4. The brand varies by muxer, so the accepted set is the ISO base media
    // and MP4 brands a phone or browser produces. A brand outside it (an unknown
    // or a Matroska-in-MP4 container) returns null rather than being assumed.
    if (
      brand === "isom" ||
      brand === "iso2" ||
      brand === "iso4" ||
      brand === "iso5" ||
      brand === "iso6" ||
      brand === "mp41" ||
      brand === "mp42" ||
      brand === "avc1" ||
      brand === "mmp4" ||
      brand === "M4V " ||
      brand === "dash"
    ) {
      return "video/mp4";
    }

    return null;
  }

  return null;
}

/** Compare ASCII bytes at an offset without allocating a string per call. */
function matchesAscii(bytes: Uint8Array, offset: number, text: string): boolean {
  if (offset + text.length > bytes.length) return false;
  for (let i = 0; i < text.length; i += 1) {
    if (bytes[offset + i] !== text.charCodeAt(i)) return false;
  }
  return true;
}

/** Read ASCII at an offset, or null when out of range. */
function asciiAt(
  bytes: Uint8Array,
  offset: number,
  length: number,
): string | null {
  if (offset + length > bytes.length) return null;
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += String.fromCharCode(bytes[offset + i] ?? 0);
  }
  return out;
}

export type UploadRejectionReason =
  | "empty"
  | "too_large"
  | "type_not_allowed"
  | "unknown_type";

export type UploadVerdict =
  | {
      ok: true;
      /** The type determined from the file's content. */
      mime: string;
      extension: string;
      byteSize: number;
    }
  | { ok: false; reason: UploadRejectionReason; detected?: string | null };

/**
 * Validate one uploaded file.
 *
 * The order matters: size is checked before the content is inspected, so an
 * oversized file is rejected without reading it into memory. A zero-byte file is
 * rejected before either, because an empty upload is a failed transfer rather
 * than a file.
 */
export function validateUpload(
  bytes: Uint8Array,
  declaredType: string | undefined,
  options: { kind: UploadKind },
): UploadVerdict {
  if (bytes.length === 0) return { ok: false, reason: "empty" };

  const limit = LIMIT_FOR_KIND[options.kind];
  if (bytes.length > limit) return { ok: false, reason: "too_large" };

  const allowed = TYPES_FOR_KIND[options.kind];

  // The declared type is only used to reject early when it is not even in the
  // accepted set. It is never used to accept: passing this check is not
  // sufficient, and the content check below is what decides.
  if (declaredType && !allowed.includes(declaredType)) {
    return { ok: false, reason: "type_not_allowed", detected: declaredType };
  }

  const detected = detectMimeType(bytes);
  if (detected === null) {
    return { ok: false, reason: "unknown_type", detected: null };
  }
  if (!allowed.includes(detected)) {
    return { ok: false, reason: "type_not_allowed", detected };
  }

  const extension = EXTENSION_FOR_MIME[detected];
  if (!extension) {
    // Unreachable while every allowed type has an extension, but returning a
    // rejection rather than asserting keeps a future type addition from silently
    // producing a path with no extension.
    return { ok: false, reason: "type_not_allowed", detected };
  }

  return { ok: true, mime: detected, extension, byteSize: bytes.length };
}

/**
 * Build a safe, deterministic object path for an upload.
 *
 * The filename is NEVER taken from the upload. A visitor-supplied name can
 * contain traversal (`../../`), a null byte, a second extension (`photo.jpg.php`)
 * or a path separator, and any of those used to build a storage key is a
 * vulnerability. The path is therefore assembled from a caller-supplied namespace
 * and a fresh UUID, with the extension derived from the detected content type.
 *
 * `namespace` must be a UUID or a slug-shaped identifier, which is asserted here:
 * a namespace that could contain `/` or `..` would reintroduce the problem the
 * UUID solves.
 *
 * The original filename is returned separately so it can be recorded for the
 * record and displayed escaped — never used to build the path.
 */
export function buildObjectPath(namespace: string, extension: string): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(namespace)) {
    throw new Error("Invalid upload namespace");
  }
  if (!/^[a-z0-9]{2,5}$/.test(extension)) {
    throw new Error("Invalid upload extension");
  }
  return `${namespace}/${randomUUID()}.${extension}`;
}

/**
 * Normalize an original filename for storage and display.
 *
 * Keeps a human-readable name for the record while removing the characters that
 * make a name dangerous or unreadable: path separators and traversal, control
 * characters, and anything outside a conservative printable set. The result is
 * bounded in length and is never empty.
 *
 * This is a display/storage convenience only. The value is still escaped at the
 * point of rendering, because a filename is untrusted text no matter how it was
 * normalized.
 */
export function sanitizeOriginalFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "";
  const cleaned = base
    // Control characters, including NUL.
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^A-Za-z0-9._ -]/g, "_")
    .replace(/^\.+/, "")
    .trim();
  const bounded = cleaned.slice(0, 200);
  return bounded.length > 0 ? bounded : "upload";
}

/** A short, human-readable description of the allowed types, for a message. */
export function describeAllowedTypes(kind: UploadKind): string {
  return TYPES_FOR_KIND[kind]
    .map((type) => (EXTENSION_FOR_MIME[type] ?? type).toUpperCase())
    .join(", ");
}

/** Format a byte limit for display, e.g. 10 MB. */
export function formatByteLimit(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return Number.isInteger(mb) ? `${mb} MB` : `${mb.toFixed(1)} MB`;
}
