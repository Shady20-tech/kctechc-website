import { describe, expect, it } from "vitest";
import {
  MAX_ATTACHMENT_BYTES,
  MAX_PROJECT_IMAGE_BYTES,
  buildObjectPath,
  detectMimeType,
  sanitizeOriginalFilename,
  validateUpload,
} from "@/lib/uploads/validation";

/**
 * Upload validation is a security boundary: it decides what reaches the storage
 * bucket. The assertions below pin the behaviour that matters — type comes from
 * the bytes, never from the caller's claim, and an SVG (script-capable XML) is
 * never accepted even when the browser labels it an image.
 */

/** Build a byte array whose content begins with the given signature. */
function withHeader(header: readonly number[], size = 64): Uint8Array {
  const bytes = new Uint8Array(Math.max(size, header.length));
  bytes.set(header, 0);
  return bytes;
}

const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const GIF = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34];
const ZIP = [0x50, 0x4b, 0x03, 0x04];
const ELF = [0x7f, 0x45, 0x4c, 0x46];

function riffWebp(): Uint8Array {
  const bytes = new Uint8Array(32);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
  bytes.set([0x57, 0x45, 0x42, 0x50], 8); // "WEBP"
  return bytes;
}

function ftyp(brand: string): Uint8Array {
  const bytes = new Uint8Array(32);
  bytes.set([0x66, 0x74, 0x79, 0x70], 4); // "ftyp"
  bytes.set(
    [...brand].map((character) => character.charCodeAt(0)),
    8,
  );
  return bytes;
}

/** A minimal SVG document, which must never pass as an image. */
function svgBytes(): Uint8Array {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
  return new TextEncoder().encode(svg);
}

describe("detectMimeType", () => {
  it("detects JPEG, PNG, WebP and PDF from their signatures", () => {
    expect(detectMimeType(withHeader(JPEG))).toBe("image/jpeg");
    expect(detectMimeType(withHeader(PNG))).toBe("image/png");
    expect(detectMimeType(riffWebp())).toBe("image/webp");
    expect(detectMimeType(withHeader(PDF))).toBe("application/pdf");
  });

  it("detects the HEIC and AVIF brands", () => {
    expect(detectMimeType(ftyp("heic"))).toBe("image/heic");
    expect(detectMimeType(ftyp("heix"))).toBe("image/heic");
    expect(detectMimeType(ftyp("avif"))).toBe("image/avif");
    expect(detectMimeType(ftyp("mif1"))).toBe("image/heif");
  });

  it("refuses an ISO media file carrying a video brand", () => {
    // A `.mp4` must not be relabelled as an image just because it has a `ftyp`
    // box, so these brands resolve to nothing rather than to a still format.
    expect(detectMimeType(ftyp("isom"))).toBeNull();
    expect(detectMimeType(ftyp("mp42"))).toBeNull();
    expect(detectMimeType(ftyp("qt  "))).toBeNull();
  });

  it("does not accept an SVG as an image", () => {
    expect(detectMimeType(svgBytes())).toBeNull();
  });

  it("does not accept a GIF, ZIP or ELF header", () => {
    expect(detectMimeType(withHeader(GIF))).toBeNull();
    expect(detectMimeType(withHeader(ZIP))).toBeNull();
    expect(detectMimeType(withHeader(ELF))).toBeNull();
  });
});

describe("validateUpload", () => {
  it("accepts a JPEG attachment and reports the type from content", () => {
    const verdict = validateUpload(withHeader(JPEG), "image/jpeg", {
      kind: "attachment",
    });
    expect(verdict.ok).toBe(true);
    if (verdict.ok) {
      expect(verdict.mime).toBe("image/jpeg");
      expect(verdict.extension).toBe("jpg");
    }
  });

  it("stores the type from content, not the caller's claim", () => {
    // The browser says image/jpeg, the bytes are a PDF. The file is accepted
    // because a PDF is a permitted attachment, but the recorded type is the PDF
    // one — the claim is never trusted as the stored value. That is the property
    // that keeps a mislabelled upload from being served under an image type.
    const verdict = validateUpload(withHeader(PDF), "image/jpeg", {
      kind: "attachment",
    });
    expect(verdict.ok).toBe(true);
    if (verdict.ok) {
      expect(verdict.mime).toBe("application/pdf");
      expect(verdict.extension).toBe("pdf");
    }
  });

  it("rejects a mislabelled file when its real type is not allowed", () => {
    // Same mismatch, but a project photograph must be an image, so the detected
    // PDF is refused even though the caller called it a JPEG.
    const verdict = validateUpload(withHeader(PDF), "image/jpeg", {
      kind: "project-image",
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe("type_not_allowed");
  });

  it("rejects an empty file", () => {
    const verdict = validateUpload(new Uint8Array(0), "image/jpeg", {
      kind: "attachment",
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe("empty");
  });

  it("rejects an unrecognized header", () => {
    const verdict = validateUpload(withHeader(ELF), "application/pdf", {
      kind: "attachment",
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe("unknown_type");
  });

  it("rejects a file over the attachment limit", () => {
    const bytes = new Uint8Array(MAX_ATTACHMENT_BYTES + 1);
    bytes.set(JPEG, 0);
    const verdict = validateUpload(bytes, "image/jpeg", { kind: "attachment" });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe("too_large");
  });

  it("applies the smaller limit to project images", () => {
    const bytes = new Uint8Array(MAX_PROJECT_IMAGE_BYTES + 1);
    bytes.set(JPEG, 0);
    const verdict = validateUpload(bytes, "image/jpeg", {
      kind: "project-image",
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe("too_large");
  });

  it("refuses a PDF where a project photograph is required", () => {
    const verdict = validateUpload(withHeader(PDF), "application/pdf", {
      kind: "project-image",
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe("type_not_allowed");
  });

  it("refuses an SVG in either kind", () => {
    for (const kind of ["attachment", "project-image"] as const) {
      const verdict = validateUpload(svgBytes(), "image/svg+xml", { kind });
      expect(verdict.ok).toBe(false);
    }
  });
});

describe("buildObjectPath", () => {
  it("namespaces by the id and never uses a caller-supplied name", () => {
    const path = buildObjectPath("2f9a4c1e-0000-4000-8000-abcdefabcdef", "jpg");
    expect(path).toMatch(/^2f9a4c1e-0000-4000-8000-abcdefabcdef\//);
    expect(path.endsWith(".jpg")).toBe(true);
  });

  it("produces paths that satisfy the storage-path constraint", () => {
    // The same shape the database CHECK enforces: no leading slash, no `..`.
    for (let i = 0; i < 20; i += 1) {
      const path = buildObjectPath("inquiry-id", "pdf");
      expect(path).not.toMatch(/\.\./);
      expect(path.startsWith("/")).toBe(false);
      expect(path).toMatch(/^[a-zA-Z0-9][a-zA-Z0-9/_.-]*$/);
    }
  });
});

describe("sanitizeOriginalFilename", () => {
  it("strips path separators from a traversal attempt", () => {
    const name = sanitizeOriginalFilename("../../etc/passwd");
    expect(name).not.toContain("/");
    expect(name).not.toContain("..");
  });

  it("keeps an ordinary filename readable", () => {
    expect(sanitizeOriginalFilename("roof damage.jpg")).toContain("roof");
  });

  it("bounds the length", () => {
    const name = sanitizeOriginalFilename(`${"a".repeat(500)}.jpg`);
    expect(name.length).toBeLessThanOrEqual(255);
  });
});


/**
 * The product- and property-image kinds share the project-image MIME set but have
 * their own size ceilings, matching each bucket's `file_size_limit`. Pinning the
 * per-kind ceilings here means a future bucket change that forgets one of them
 * fails a test rather than silently allowing an oversized file.
 */
describe("per-kind upload limits", () => {
  const jpeg = withHeader(JPEG, 1024);

  it("accepts a small image under every image kind", () => {
    for (const kind of [
      "project-image",
      "content-image",
      "product-image",
      "property-image",
    ] as const) {
      expect(validateUpload(jpeg, "image/jpeg", { kind }).ok).toBe(true);
    }
  });

  it("rejects a 6 MB image where the ceiling is 5 MB", () => {
    const big = withHeader(JPEG, 6 * 1024 * 1024);
    expect(validateUpload(big, "image/jpeg", { kind: "product-image" }).ok).toBe(false);
    expect(validateUpload(big, "image/jpeg", { kind: "content-image" }).ok).toBe(false);
  });

  it("accepts a 6 MB image for a property, whose ceiling is 10 MB", () => {
    const big = withHeader(JPEG, 6 * 1024 * 1024);
    expect(validateUpload(big, "image/jpeg", { kind: "property-image" }).ok).toBe(true);
  });

  it("refuses a PDF as a product image", () => {
    const pdf = withHeader(PDF, 1024);
    const verdict = validateUpload(pdf, "application/pdf", { kind: "product-image" });
    expect(verdict.ok).toBe(false);
  });

  it("refuses an SVG disguised as a product image", () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    const verdict = validateUpload(svg, "image/svg+xml", { kind: "product-image" });
    expect(verdict.ok).toBe(false);
  });
});
