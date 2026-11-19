import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `kyc-documents` is the one bucket holding identity evidence: ID cards, passport
 * images, a face video and land titles. Two properties matter more than any other
 * behaviour in this module, and neither is visible from the schema alone:
 *
 *  1. There is no way to build a *public* URL for an object in it. A public link
 *     to an identity document is a disclosure that cannot be recalled, so the
 *     module exposes no function that could construct one — this suite asserts
 *     that property directly rather than trusting the absence of a call site.
 *  2. Every read goes through a short-lived signed URL minted with the service
 *     role, and a signing failure returns null rather than a broken or durable
 *     link.
 *
 * The Supabase client is stubbed at the module boundary; the code under test is
 * the real path-building, upload and signing logic.
 */

const createAdminClient = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => createAdminClient(),
}));

import {
  KYC_BUCKET,
  kycObjectPath,
  legalDocumentObjectPath,
  removeKycObject,
  signedKycUrl,
  uploadKycObject,
} from "./kyc-storage";

/** A minimal stand-in for the parts of the Supabase storage API this module uses. */
function stubAdmin(overrides: {
  upload?: (path: string, bytes: Uint8Array, opts: unknown) => unknown;
  remove?: (paths: string[]) => unknown;
  createSignedUrl?: (path: string, ttl: number) => unknown;
} = {}) {
  const calls = {
    upload: [] as Array<{ path: string; bytes: Uint8Array; opts: unknown }>,
    remove: [] as string[][],
    createSignedUrl: [] as Array<{ path: string; ttl: number }>,
  };
  const client = {
    storage: {
      from(bucket: string) {
        expect(bucket).toBe(KYC_BUCKET);
        return {
          async upload(path: string, bytes: Uint8Array, opts: unknown) {
            calls.upload.push({ path, bytes, opts });
            return overrides.upload ? overrides.upload(path, bytes, opts) : { error: null };
          },
          async remove(paths: string[]) {
            calls.remove.push(paths);
            return overrides.remove ? overrides.remove(paths) : { error: null };
          },
          async createSignedUrl(path: string, ttl: number) {
            calls.createSignedUrl.push({ path, ttl });
            return overrides.createSignedUrl
              ? overrides.createSignedUrl(path, ttl)
              : { data: { signedUrl: `https://example.test/signed/${path}?token=abc` }, error: null };
          },
        };
      },
    },
  };
  createAdminClient.mockReturnValue(client);
  return calls;
}

beforeEach(() => {
  createAdminClient.mockReset();
});

describe("the KYC bucket is private and has no public-URL path", () => {
  it("names the private bucket", () => {
    expect(KYC_BUCKET).toBe("kyc-documents");
  });

  it("exposes no function that could build a public URL", async () => {
    // A `getPublicUrl`-shaped helper would be the disclosure risk: it returns a
    // durable, unauthenticated link to an identity document. Its absence is the
    // control, so assert on the module's surface rather than on a call site.
    const mod = await import("./kyc-storage");
    const names = Object.keys(mod);
    expect(names.some((n) => /publicurl/i.test(n))).toBe(false);
  });
});

describe("kycObjectPath", () => {
  const appId = "a0000000-0000-4000-8000-000000000001";

  it("namespaces by application id so two applications cannot collide", () => {
    const one = kycObjectPath(appId, "id-front.jpg");
    const two = kycObjectPath("a0000000-0000-4000-8000-000000000002", "id-front.jpg");
    expect(one).toBe(`applications/${appId}/id-front.jpg`);
    expect(one).not.toBe(two);
  });

  it("strips traversal and separators from the caller-supplied name", () => {
    const path = kycObjectPath(appId, "../../etc/passwd");
    // Separators are replaced, which is what makes traversal impossible: the
    // name cannot climb out of its namespace even though `..` survives as text.
    expect(path).not.toContain("/etc/");
    expect(path.startsWith(`applications/${appId}/`)).toBe(true);
    // Only the one namespacing separator survives the sanitization.
    expect(path.split("/").length).toBe(3);
    expect(path).toBe(`applications/${appId}/..-..-etc-passwd`);
  });
});

describe("legalDocumentObjectPath", () => {
  it("namespaces a listing's legal document under the listing, not an application", () => {
    const path = legalDocumentObjectPath("b0000000-0000-4000-8000-000000000001", "title.pdf");
    expect(path).toBe("listings/b0000000-0000-4000-8000-000000000001/title.pdf");
  });

  it("sanitizes the filename", () => {
    const path = legalDocumentObjectPath("b1", "a b\\c.pdf");
    expect(path).toBe("listings/b1/a-b-c.pdf");
  });
});

describe("uploadKycObject", () => {
  const base = {
    storagePath: "applications/a1/id-front.jpg",
    detectedMime: "image/jpeg",
    byteSize: 4,
    originalFilename: "id-front.jpg",
  };

  it("stores the detected MIME type, never the browser's claim", async () => {
    const calls = stubAdmin();
    const bytes = new Uint8Array([1, 2, 3, 4]);

    const result = await uploadKycObject({ ...base, bytes });

    expect(result).toEqual({ ok: true });
    expect(calls.upload).toHaveLength(1);
    expect(calls.upload[0]!.opts).toMatchObject({
      contentType: "image/jpeg",
      upsert: false,
    });
  });

  it("refuses to overwrite an existing object", async () => {
    // A path collision means two uploads landed on one object; the UUID in the
    // path makes that an error worth surfacing rather than a routine overwrite.
    const calls = stubAdmin();
    await uploadKycObject({ ...base, bytes: new Uint8Array([1]) });
    expect(calls.upload[0]!.opts).toMatchObject({ upsert: false });
  });

  it("reports unconfigured rather than pretending the upload succeeded", async () => {
    createAdminClient.mockReturnValue(null);
    const result = await uploadKycObject({ ...base, bytes: new Uint8Array([1]) });
    expect(result).toEqual({ ok: false, reason: "unconfigured" });
  });

  it("surfaces an upload failure as a reason, not an exception", async () => {
    stubAdmin({ upload: () => ({ error: { message: "bucket not found" } }) });
    const result = await uploadKycObject({ ...base, bytes: new Uint8Array([1]) });
    expect(result).toEqual({ ok: false, reason: "upload_failed" });
  });
});

describe("signedKycUrl", () => {
  it("mints a signed URL with the documented short TTL", async () => {
    const calls = stubAdmin();
    const url = await signedKycUrl("applications/a1/id-front.jpg");

    expect(url).toContain("token=");
    expect(calls.createSignedUrl).toHaveLength(1);
    // 300s: an identity document is opened, read and closed, so a leaked link
    // stops being useful quickly.
    expect(calls.createSignedUrl[0]!.ttl).toBe(300);
  });

  it("honours an explicit TTL", async () => {
    const calls = stubAdmin();
    await signedKycUrl("applications/a1/face.mp4", 120);
    expect(calls.createSignedUrl[0]!.ttl).toBe(120);
  });

  it("returns null when Supabase is unconfigured", async () => {
    createAdminClient.mockReturnValue(null);
    expect(await signedKycUrl("applications/a1/id-front.jpg")).toBeNull();
  });

  it("returns null on a signing error rather than a broken link", async () => {
    stubAdmin({ createSignedUrl: () => ({ data: null, error: { message: "not found" } }) });
    expect(await signedKycUrl("applications/a1/missing.jpg")).toBeNull();
  });

  it("returns null when the response carries no URL", async () => {
    stubAdmin({ createSignedUrl: () => ({ data: { signedUrl: "" }, error: null }) });
    expect(await signedKycUrl("applications/a1/id-front.jpg")).toBeNull();
  });
});

describe("removeKycObject", () => {
  it("removes the object at the given path", async () => {
    const calls = stubAdmin();
    await removeKycObject("applications/a1/id-front.jpg");
    expect(calls.remove).toEqual([["applications/a1/id-front.jpg"]]);
  });

  it("is a no-op when Supabase is unconfigured", async () => {
    createAdminClient.mockReturnValue(null);
    await expect(removeKycObject("applications/a1/id-front.jpg")).resolves.toBeUndefined();
  });

  it("swallows a removal failure, because the caller cannot act on it", async () => {
    // The caller has already succeeded or failed for a reason it can act on; a
    // stranded object is an operational concern, not a user-facing error.
    stubAdmin({
      remove: () => {
        throw new Error("network down");
      },
    });
    await expect(removeKycObject("applications/a1/id-front.jpg")).resolves.toBeUndefined();
  });
});
