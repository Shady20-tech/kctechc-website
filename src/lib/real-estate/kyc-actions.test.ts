import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The applicant's KYC Server Actions.
 *
 * The requirements this covers, and why each is a boundary rather than a
 * convenience:
 *
 *  * **Application creation** — a draft is saved, a submission additionally needs
 *    both consents and the required evidence, and a submission missing evidence is
 *    reverted to a draft so it does not sit in the review queue without it.
 *  * **Ownership protection** — the application and document writes go through the
 *    cookie-bound session client, so RLS is the control; a document for an
 *    application the caller does not own is simply not there.
 *  * **Invalid file rejection** — the file's real bytes are validated, and a
 *    rejected file never reaches the bucket.
 *
 * The Supabase client and the storage calls are stubbed; the code under test is
 * the real validation, gating and sequencing.
 */

const getAuthState = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getAuthState: () => getAuthState() }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const recordAudit = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/security/audit", () => ({ recordAudit: (...a: unknown[]) => recordAudit(...a) }));

const checkRateLimit = vi.fn().mockReturnValue({ allowed: true });
vi.mock("@/lib/security/rate-limit", () => ({
  checkRateLimit: (...a: unknown[]) => checkRateLimit(...a),
}));

const createClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: () => createClient() }));

const uploadKycObject = vi.fn();
const removeKycObject = vi.fn();
vi.mock("@/lib/uploads/kyc-storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/uploads/kyc-storage")>();
  return {
    ...actual,
    uploadKycObject: (...a: unknown[]) => uploadKycObject(...a),
    removeKycObject: (...a: unknown[]) => removeKycObject(...a),
  };
});

import {
  removeKycDocumentAction,
  saveKycApplicationAction,
  uploadKycDocumentAction,
} from "./kyc-actions";

const AUTH = {
  status: "authenticated" as const,
  userId: "u-app",
  email: "applicant@example.com",
  profile: { id: "u-app", fullName: "Applicant", phone: "+237600000000" },
};

const JPEG = new Uint8Array(64);
JPEG.set([0xff, 0xd8, 0xff, 0xe0], 0);

function svgBytes(): Uint8Array {
  return new TextEncoder().encode(
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
  );
}

/**
 * jsdom's `File` does not implement `arrayBuffer`, which the action calls to read
 * the bytes. A real `File` is used (so `instanceof File` holds) with the method
 * added, rather than a plain object.
 */
function fileWithBytes(bytes: Uint8Array, name: string, type: string): File {
  // Copy into a plain ArrayBuffer so the value satisfies `BlobPart` and the
  // returned buffer is a real `ArrayBuffer`, not a possibly-shared view.
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const file = new File([buffer], name, { type });
  Object.defineProperty(file, "arrayBuffer", { value: async () => buffer });
  return file;
}

function applicationForm(overrides: Record<string, string> = {}): FormData {
  const fields: Record<string, string> = {
    fullLegalName: "Ngwa Emmanuel",
    email: "applicant@example.com",
    phone: "+237 679-202-265",
    countryOfResidence: "Cameroon",
    currentLocation: "Limbe",
    residencyStatus: "permanent",
    dateOfBirth: "1990-05-14",
    idType: "national_id_card",
    idIssuingCountry: "Cameroon",
    idNumberLast4: "4821",
    ...overrides,
  };
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}

type KycCalls = {
  upsert: { table: string; row: Record<string, unknown> }[];
  update: { table: string; row: Record<string, unknown> }[];
  insert: { table: string; row: Record<string, unknown> }[];
  deleted: string[];
};

/** A thenable that also chains, so both `await x.eq()` and `x.eq().maybeSingle()` work. */
function chainable(result: unknown) {
  const builder: Record<string, unknown> = {
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
    maybeSingle: async () => result,
    single: async () => result,
  };
  builder.eq = () => builder;
  builder.select = () => builder;
  return builder;
}

function stubClient(
  options: {
    upsertResult?: unknown;
    updateResult?: unknown;
    insertResult?: unknown;
    deleteResult?: unknown;
    selectSingle?: unknown;
    selectList?: unknown;
  } = {},
): KycCalls {
  const calls: KycCalls = { upsert: [], update: [], insert: [], deleted: [] };

  const client = {
    from: (table: string) => ({
      upsert: (row: Record<string, unknown>) => {
        calls.upsert.push({ table, row });
        return {
          select: () => ({
            single: async () => options.upsertResult ?? { data: { id: "app-1", status: row.status }, error: null },
          }),
        };
      },
      update: (row: Record<string, unknown>) => {
        calls.update.push({ table, row });
        return chainable(options.updateResult ?? { error: null });
      },
      insert: (row: Record<string, unknown>) => {
        calls.insert.push({ table, row });
        return Promise.resolve(options.insertResult ?? { error: null });
      },
      delete: () => ({
        eq: (_col: string, value: string) => {
          calls.deleted.push(value);
          return Promise.resolve(options.deleteResult ?? { error: null });
        },
      }),
      select: () => chainable(options.selectSingle ?? options.selectList ?? { data: null }),
    }),
  };

  // The document-list read awaits `.eq()` and expects `{ data: [...] }`.
  const originalFrom = client.from;
  client.from = (table: string) => {
    const base = originalFrom(table);
    return {
      ...base,
      select: () => {
        const builder = chainable(options.selectSingle ?? { data: null });
        // Awaited directly for the document list.
        (builder as Record<string, unknown>).then = (resolve: (v: unknown) => unknown) =>
          Promise.resolve(options.selectList ?? { data: [] }).then(resolve);
        return builder;
      },
    };
  };

  createClient.mockResolvedValue(client);
  return calls;
}

beforeEach(() => {
  vi.clearAllMocks();
  getAuthState.mockResolvedValue(AUTH);
  checkRateLimit.mockReturnValue({ allowed: true });
  uploadKycObject.mockResolvedValue({ ok: true });
  removeKycObject.mockResolvedValue(undefined);
});

describe("saveKycApplicationAction", () => {
  it("refuses an unauthenticated caller", async () => {
    getAuthState.mockResolvedValue({ status: "unauthenticated" });
    const result = await saveKycApplicationAction("landlord", "draft", "en", null, applicationForm());
    expect(result).toEqual({ ok: false, error: "unauthenticated" });
  });

  it("saves a draft without requiring the consents", async () => {
    const calls = stubClient({ upsertResult: { data: { id: "app-1", status: "draft" }, error: null } });
    const result = await saveKycApplicationAction("landlord", "draft", "en", null, applicationForm());
    expect(result).toEqual({ ok: true, status: "draft" });
    expect(calls.upsert[0]!.row.status).toBe("draft");
    expect(calls.upsert[0]!.row).not.toHaveProperty("video_consent_at");
  });

  it("refuses a submission without both consents", async () => {
    stubClient();
    const result = await saveKycApplicationAction("landlord", "submit", "en", null, applicationForm());
    expect(result).toMatchObject({ ok: false, error: "consent_required" });
  });

  it("reverts a submission to a draft when the required evidence is missing", async () => {
    // A submission without its documents must not sit in the review queue.
    const calls = stubClient({
      upsertResult: { data: { id: "app-1", status: "submitted" }, error: null },
      selectList: { data: [{ kind: "id_front" }] }, // face_video missing
    });
    const result = await saveKycApplicationAction(
      "landlord",
      "submit",
      "en",
      null,
      applicationForm({ videoConsent: "on", declaration: "on" }),
    );
    expect(result).toMatchObject({ ok: false, error: "documents_missing" });
    expect(calls.update[0]!.row.status).toBe("draft");
  });

  it("accepts a submission that carries both consents and the required documents", async () => {
    stubClient({
      upsertResult: { data: { id: "app-1", status: "submitted" }, error: null },
      selectList: { data: [{ kind: "id_front" }, { kind: "face_video" }] },
    });
    const result = await saveKycApplicationAction(
      "landlord",
      "submit",
      "en",
      null,
      applicationForm({ videoConsent: "on", declaration: "on" }),
    );
    expect(result).toEqual({ ok: true, status: "submitted" });
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "kyc_submitted" }),
    );
  });

  it("reports an already-decided application rather than a generic failure", async () => {
    // The RLS `with check` refuses an update to an approved row.
    stubClient({ upsertResult: { data: null, error: { message: "new row violates row-level security policy" } } });
    const result = await saveKycApplicationAction("landlord", "draft", "en", null, applicationForm());
    expect(result).toEqual({ ok: false, error: "already_decided" });
  });

  it("maps the age-gate constraint to a date-of-birth field error", async () => {
    stubClient({
      upsertResult: { data: null, error: { message: 'violates check constraint "kyc_applicant_is_adult"' } },
    });
    const result = await saveKycApplicationAction("landlord", "draft", "en", null, applicationForm());
    expect(result).toMatchObject({ ok: false, error: "invalid", fields: { dateOfBirth: "underage" } });
  });

  it("refuses an invalid form before any write", async () => {
    const calls = stubClient();
    const result = await saveKycApplicationAction(
      "landlord",
      "draft",
      "en",
      null,
      applicationForm({ email: "not-an-email" }),
    );
    expect(result).toMatchObject({ ok: false, error: "invalid" });
    expect(calls.upsert).toHaveLength(0);
  });

  it("rate-limits a rapid repeat", async () => {
    checkRateLimit.mockReturnValue({ allowed: false });
    const result = await saveKycApplicationAction("landlord", "draft", "en", null, applicationForm());
    expect(result).toEqual({ ok: false, error: "rate_limited" });
  });
});

describe("uploadKycDocumentAction", () => {
  function uploadForm(file: File | null, kind = "id_front"): FormData {
    const data = new FormData();
    data.set("kind", kind);
    if (file) data.set("file", file);
    return data;
  }

  it("refuses a file whose bytes are not an accepted type", async () => {
    // An SVG is script-capable XML and must never reach the bucket, whatever the
    // browser labelled it.
    stubClient({ selectSingle: { data: { id: "app-1", status: "draft" } } });
    const svg = fileWithBytes(svgBytes(), "id.svg", "image/svg+xml");
    const result = await uploadKycDocumentAction("landlord", "en", null, uploadForm(svg));
    expect(result).toMatchObject({ ok: false, error: "type_not_allowed" });
    expect(uploadKycObject).not.toHaveBeenCalled();
  });

  it("refuses a missing or empty file", async () => {
    stubClient();
    const result = await uploadKycDocumentAction("landlord", "en", null, uploadForm(null));
    expect(result).toEqual({ ok: false, error: "file_required" });
    expect(uploadKycObject).not.toHaveBeenCalled();
  });

  it("refuses an unknown document kind", async () => {
    stubClient();
    const jpeg = fileWithBytes(JPEG, "id.jpg", "image/jpeg");
    const result = await uploadKycDocumentAction("landlord", "en", null, uploadForm(jpeg, "selfie"));
    expect(result).toEqual({ ok: false, error: "invalid_kind" });
  });

  it("requires an existing application, which is the ownership check", async () => {
    // The lookup is scoped by user_id, so a caller with no application (or someone
    // else's) gets a message instead of a policy violation.
    stubClient({ selectSingle: { data: null } });
    const jpeg = fileWithBytes(JPEG, "id.jpg", "image/jpeg");
    const result = await uploadKycDocumentAction("landlord", "en", null, uploadForm(jpeg));
    expect(result).toEqual({ ok: false, error: "application_required" });
    expect(uploadKycObject).not.toHaveBeenCalled();
  });

  it("refuses to attach evidence to an already-approved application", async () => {
    stubClient({ selectSingle: { data: { id: "app-1", status: "approved" } } });
    const jpeg = fileWithBytes(JPEG, "id.jpg", "image/jpeg");
    const result = await uploadKycDocumentAction("landlord", "en", null, uploadForm(jpeg));
    expect(result).toEqual({ ok: false, error: "already_decided" });
  });

  it("uploads a valid file and records the row with the detected type", async () => {
    const calls = stubClient({
      selectSingle: { data: { id: "app-1", status: "draft" } },
      insertResult: { error: null },
    });
    const jpeg = fileWithBytes(JPEG, "my id.jpg", "image/jpeg");
    const result = await uploadKycDocumentAction("landlord", "en", null, uploadForm(jpeg));

    expect(result).toEqual({ ok: true, message: "uploaded" });
    expect(uploadKycObject).toHaveBeenCalledTimes(1);
    const uploadArg = uploadKycObject.mock.calls[0]![0] as { detectedMime: string; storagePath: string };
    expect(uploadArg.detectedMime).toBe("image/jpeg");
    expect(uploadArg.storagePath.startsWith("applications/app-1/")).toBe(true);

    const row = calls.insert[0]!.row;
    expect(row).toMatchObject({ application_id: "app-1", kind: "id_front", detected_mime: "image/jpeg" });
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "kyc_document_uploaded" }),
    );
  });

  it("removes the uploaded object when the row write fails", async () => {
    // The row is the record; an object with no row would be an orphan.
    stubClient({
      selectSingle: { data: { id: "app-1", status: "draft" } },
      insertResult: { error: { message: "boom" } },
    });
    const jpeg = fileWithBytes(JPEG, "id.jpg", "image/jpeg");
    const result = await uploadKycDocumentAction("landlord", "en", null, uploadForm(jpeg));

    expect(result).toEqual({ ok: false, error: "write_failed" });
    expect(uploadKycObject).toHaveBeenCalledTimes(1);
    expect(removeKycObject).toHaveBeenCalledTimes(1);
  });
});

describe("removeKycDocumentAction", () => {
  it("reports not_found for a document the caller cannot see", async () => {
    stubClient({ selectSingle: { data: null } });
    const result = await removeKycDocumentAction("doc-1", "en");
    expect(result).toEqual({ ok: false, error: "not_found" });
    expect(removeKycObject).not.toHaveBeenCalled();
  });

  it("removes the row and then the object", async () => {
    const calls = stubClient({
      selectSingle: { data: { storage_path: "applications/a1/id.jpg", application_id: "a1" } },
    });
    const result = await removeKycDocumentAction("doc-1", "en");
    expect(result).toEqual({ ok: true, message: "removed" });
    expect(calls.deleted).toContain("doc-1");
    expect(removeKycObject).toHaveBeenCalledWith("applications/a1/id.jpg");
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "kyc_document_removed" }),
    );
  });
});
