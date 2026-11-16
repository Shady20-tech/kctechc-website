"use server";

import { revalidatePath } from "next/cache";

import { getAuthState } from "@/lib/auth/session";
import { recordAudit } from "@/lib/security/audit";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import {
  kycObjectPath,
  removeKycObject,
  uploadKycObject,
} from "@/lib/uploads/kyc-storage";
import {
  buildObjectPath,
  sanitizeOriginalFilename,
  validateUpload,
} from "@/lib/uploads/validation";
import {
  kycApplicationSchema,
  kycConsentSchema,
  kycDocumentMetaSchema,
  type KycFieldErrors,
} from "@/lib/validation/kyc";

import {
  isKycDocumentKind,
  missingRequiredDocuments,
  type KycDocumentKind,
  type KycMembershipType,
  type KycStatus,
} from "./kyc";

/**
 * The applicant's KYC workflow, as Server Actions.
 *
 * Two clients, each with a job, exactly as the project-media path does:
 *
 *   * the ROW writes use the cookie-bound client, so the `kyc_*_own` RLS policies
 *     are the real control — an applicant can only write their own application,
 *     and only while it is in a state they may answer;
 *   * the STORAGE upload uses the service-role client, because the private bucket
 *     has no browser write policy.
 *
 * The role check below is not a substitute for RLS; it exists so the applicant
 * gets a message rather than a raw policy violation, and so a write is never
 * attempted at all when the session is not theirs.
 *
 * Approval is deliberately NOT here. Moving an application to `approved` is a
 * super-admin decision and lives in `kyc-review-actions.ts`.
 */

export type KycActionState =
  | { ok: true; status: KycStatus }
  | { ok: false; error: string; fields?: KycFieldErrors };

export type KycDocumentState =
  | { ok: true; message: string }
  | { ok: false; error: string };

function fieldErrors(
  issues: readonly { path: PropertyKey[]; message: string }[],
): KycFieldErrors {
  const fields: KycFieldErrors = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form") as keyof KycFieldErrors;
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

/** A stable key for the applicant's application, derived from their account. */
function revalidateApplicant(locale: string) {
  revalidatePath(`/${locale}/account`);
  revalidatePath(`/${locale}/account/kyc`);
  revalidatePath("/admin/real-estate/kyc");
}

/**
 * Create or update the applicant's KYC application.
 *
 * Upserted rather than inserted, because the unique key is (user, capability): a
 * re-application is the same application revisited. The write goes through the
 * session client, so the `with check` on `kyc_applications_insert_own` /
 * `_update_own` refuses an already-approved row and refuses a reviewer being
 * supplied.
 *
 * The `intent` parameter decides whether the row is saved as a draft (a work in
 * progress the applicant may return to) or submitted (consents given, ready for
 * review). A submission additionally requires the consents and the two required
 * documents to be present.
 */
export async function saveKycApplicationAction(
  membershipType: KycMembershipType,
  intent: "draft" | "submit",
  locale: string,
  _previous: KycActionState | null,
  formData: FormData,
): Promise<KycActionState> {
  const auth = await getAuthState();
  if (auth.status === "unconfigured") return { ok: false, error: "unconfigured" };
  if (auth.status !== "authenticated" || !auth.profile) {
    return { ok: false, error: "unauthenticated" };
  }

  const limit = checkRateLimit(`kyc-save:${auth.profile.id}`, {
    limit: 20,
    windowSeconds: 300,
  });
  if (!limit.allowed) return { ok: false, error: "rate_limited" };

  const parsed = kycApplicationSchema.safeParse({
    membershipType,
    fullLegalName: formData.get("fullLegalName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    countryOfResidence: formData.get("countryOfResidence"),
    currentLocation: formData.get("currentLocation") ?? "",
    residencyStatus: formData.get("residencyStatus"),
    dateOfBirth: formData.get("dateOfBirth"),
    idType: formData.get("idType"),
    idIssuingCountry: formData.get("idIssuingCountry"),
    idNumberLast4: formData.get("idNumberLast4") ?? "",
  });

  if (!parsed.success) {
    return { ok: false, error: "invalid", fields: fieldErrors(parsed.error.issues) };
  }

  const input = parsed.data;
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "unconfigured" };

  // A submission must carry both consents. Checked here so the applicant gets a
  // message; the database CHECK is the real control.
  let videoConsentAt: string | null = null;
  let declarationAcceptedAt: string | null = null;

  if (intent === "submit") {
    const consent = kycConsentSchema.safeParse({
      videoConsent:
        formData.get("videoConsent") === "on" ? true : undefined,
      declaration: formData.get("declaration") === "on" ? true : undefined,
    });
    if (!consent.success) {
      const fields: KycFieldErrors = {};
      for (const issue of consent.error.issues) {
        const key = String(issue.path[0]) as keyof KycFieldErrors;
        fields[key] = issue.message;
      }
      return { ok: false, error: "consent_required", fields };
    }

    // The two required documents must already be attached. This is the rule the
    // brief states ("provide the required document image or PDF" and a face
    // video); checking it here means the applicant is told what is missing rather
    // than the submission silently succeeding without evidence. The documents
    // reference the application id, which is only known after the upsert, so the
    // check itself runs there.
    const now = new Date().toISOString();
    videoConsentAt = now;
    declarationAcceptedAt = now;
  }

  const status: KycStatus = intent === "submit" ? "submitted" : "draft";

  const { data, error } = await supabase
    .from("real_estate_kyc_applications")
    .upsert(
      {
        user_id: auth.profile.id,
        membership_type: membershipType,
        status,
        full_legal_name: input.fullLegalName,
        email: input.email,
        phone: input.phone,
        country_of_residence: input.countryOfResidence,
        current_location: input.currentLocation || null,
        residency_status: input.residencyStatus,
        date_of_birth: input.dateOfBirth,
        id_type: input.idType,
        id_issuing_country: input.idIssuingCountry,
        id_number_last4: input.idNumberLast4 || null,
        // A re-application clears the previous decision, so a rejected row does
        // not keep a stale reason beside a fresh submission.
        decision_reason: null,
        reviewed_by: null,
        reviewed_at: null,
        ...(intent === "submit"
          ? {
              submitted_at: new Date().toISOString(),
              video_consent_at: videoConsentAt,
              declaration_accepted_at: declarationAcceptedAt,
            }
          : {}),
      },
      { onConflict: "user_id,membership_type" },
    )
    .select("id, status")
    .single();

  if (error || !data) {
    if ((error?.message ?? "").includes("row-level security")) {
      return { ok: false, error: "already_decided" };
    }
    if ((error?.message ?? "").includes("kyc_applicant_is_adult")) {
      return { ok: false, error: "invalid", fields: { dateOfBirth: "underage" } };
    }
    return { ok: false, error: "write_failed" };
  }

  // On a submission, refuse it if the required evidence is missing — after the
  // upsert, because the documents reference the application id. The application is
  // reverted to a draft so it is not left sitting in the review queue without its
  // evidence.
  if (intent === "submit") {
    const { data: docs } = await supabase
      .from("real_estate_kyc_documents")
      .select("kind")
      .eq("application_id", data.id);

    const missing = missingRequiredDocuments(
      (docs ?? []).map((row) => row.kind as KycDocumentKind),
    );

    if (missing.length > 0) {
      await supabase
        .from("real_estate_kyc_applications")
        .update({ status: "draft", submitted_at: null })
        .eq("id", data.id);

      return {
        ok: false,
        error: "documents_missing",
        fields: { form: missing.join(",") },
      };
    }
  }

  await recordAudit({
    actorId: auth.profile.id,
    action: intent === "submit" ? "kyc_submitted" : "kyc_status_changed",
    entityType: "real_estate_kyc_application",
    entityId: data.id,
    metadata: { membershipType, status },
  });

  revalidateApplicant(locale);
  return { ok: true, status: data.status as KycStatus };
}

/**
 * Attach one document to the applicant's application.
 *
 * The file is validated by its BYTES (type, size) before anything is stored, and
 * the object path is built from a UUID and the content-derived extension — never
 * from the uploaded filename. The upload uses the service-role client; the row
 * write uses the session client, so the policy is the control.
 */
export async function uploadKycDocumentAction(
  membershipType: KycMembershipType,
  locale: string,
  _previous: KycDocumentState | null,
  formData: FormData,
): Promise<KycDocumentState> {
  const auth = await getAuthState();
  if (auth.status === "unconfigured") return { ok: false, error: "unconfigured" };
  if (auth.status !== "authenticated" || !auth.profile) {
    return { ok: false, error: "unauthenticated" };
  }

  const limit = checkRateLimit(`kyc-upload:${auth.profile.id}`, {
    limit: 30,
    windowSeconds: 600,
  });
  if (!limit.allowed) return { ok: false, error: "rate_limited" };

  const meta = kycDocumentMetaSchema.safeParse({
    kind: formData.get("kind"),
    issuingCountry: formData.get("issuingCountry") ?? "",
    note: formData.get("note") ?? "",
  });
  if (!meta.success) return { ok: false, error: "invalid_kind" };

  const kind = meta.data.kind;
  if (!isKycDocumentKind(kind)) return { ok: false, error: "invalid_kind" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "file_required" };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  // The video kind accepts video types and a larger limit; every other kind is a
  // document.
  const uploadKind = kind === "face_video" ? "kyc-video" : "kyc-document";
  const verdict = validateUpload(bytes, file.type, { kind: uploadKind });
  if (!verdict.ok) {
    return { ok: false, error: verdict.reason };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "unconfigured" };

  // The application must already exist and belong to the caller — the policy
  // would refuse otherwise, but checking here gives a message.
  const { data: application } = await supabase
    .from("real_estate_kyc_applications")
    .select("id, status")
    .eq("user_id", auth.profile.id)
    .eq("membership_type", membershipType)
    .maybeSingle();

  if (!application) return { ok: false, error: "application_required" };
  if (application.status === "approved") {
    return { ok: false, error: "already_decided" };
  }

  const objectName = buildObjectPath(application.id, verdict.extension);
  const storagePath = kycObjectPath(application.id, objectName);

  const uploaded = await uploadKycObject({
    storagePath,
    detectedMime: verdict.mime,
    byteSize: verdict.byteSize,
    originalFilename: sanitizeOriginalFilename(file.name),
    bytes,
  });
  if (!uploaded.ok) return { ok: false, error: uploaded.reason };

  // The row write goes through the session client, so `kyc_documents_insert_own`
  // is the control. A failure removes the object so the bucket does not keep an
  // orphan.
  const { error } = await supabase.from("real_estate_kyc_documents").insert({
    application_id: application.id,
    kind,
    storage_path: storagePath,
    original_filename: sanitizeOriginalFilename(file.name),
    detected_mime: verdict.mime,
    byte_size: verdict.byteSize,
    issuing_country: meta.data.issuingCountry || null,
    note: meta.data.note || null,
  });

  if (error) {
    await removeKycObject(storagePath);
    return { ok: false, error: "write_failed" };
  }

  await recordAudit({
    actorId: auth.profile.id,
    action: "kyc_document_uploaded",
    entityType: "real_estate_kyc_application",
    entityId: application.id,
    metadata: { kind, byteSize: verdict.byteSize },
  });

  revalidateApplicant(locale);
  return { ok: true, message: "uploaded" };
}

/**
 * Remove one of the applicant's own documents.
 *
 * The row is deleted through the session client (so the policy is the control)
 * and the object is removed afterwards with the service-role client. The object
 * removal is best-effort: the row is the record, and a stranded object is an
 * operational concern rather than something the applicant can act on.
 */
export async function removeKycDocumentAction(
  documentId: string,
  locale: string,
): Promise<KycDocumentState> {
  const auth = await getAuthState();
  if (auth.status !== "authenticated" || !auth.profile) {
    return { ok: false, error: "unauthenticated" };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "unconfigured" };

  // Read the path first (the delete below removes the row), through the session
  // client so a document the caller cannot see cannot be deleted.
  const { data: row } = await supabase
    .from("real_estate_kyc_documents")
    .select("storage_path, application_id")
    .eq("id", documentId)
    .maybeSingle();

  if (!row) return { ok: false, error: "not_found" };

  const { error } = await supabase
    .from("real_estate_kyc_documents")
    .delete()
    .eq("id", documentId);

  if (error) return { ok: false, error: "write_failed" };

  await removeKycObject(row.storage_path);

  await recordAudit({
    actorId: auth.profile.id,
    action: "kyc_document_removed",
    entityType: "real_estate_kyc_application",
    entityId: row.application_id,
    metadata: {},
  });

  revalidateApplicant(locale);
  return { ok: true, message: "removed" };
}
