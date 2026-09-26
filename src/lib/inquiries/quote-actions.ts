"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { serverEnv } from "@/lib/config/server-env";
import { findRegion } from "@/lib/content/regions";
import { recordAudit } from "@/lib/security/audit";
import { verifySubmission } from "@/lib/security/bot-verification";
import { checkRateLimit, clientKeyFrom } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildObjectPath,
  formatByteLimit,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENT_COUNT,
  sanitizeOriginalFilename,
  validateUpload,
} from "@/lib/uploads/validation";
import { removeInquiryAttachment, uploadInquiryAttachment } from "@/lib/uploads/storage";
import {
  quoteRequestSchema,
  todayIso,
  toQuoteFieldErrors,
  type QuoteFormState,
} from "@/lib/validation/quote";

/**
 * Electrical Services quote / site-visit submission.
 *
 * The lead lands in the SAME `inquiries` table as every other public contact
 * route, tagged with the department, the service and the source. That is what the
 * brief asks for — one central inbox — and it is why this action does not create
 * a parallel `quote_requests` table. The extra quote fields (property type,
 * region, locality, contact method) are columns on the inquiry row.
 *
 * The order of operations is the security design:
 *
 *   1. Validate the text fields. A submission that cannot be stored is rejected
 *      before any bytes are read or any object is written.
 *   2. Bot verification, BEFORE the rate limit — so a failing provider cannot be
 *      used to exhaust another visitor's allowance — and before any write, so an
 *      unverified submission never reaches the database or the bucket.
 *   3. Rate limit.
 *   4. Validate each file's CONTENT. A declared type is not evidence, so this
 *      inspects the bytes; the storage path is then built from a UUID and the
 *      detected type, never from the visitor's filename.
 *   5. Write the inquiry. Only then upload, so a failed inquiry does not leave
 *      objects in the bucket with no row pointing at them.
 *
 * Missing credentials are reported as `unconfigured`, never as success. Telling a
 * visitor their request was received when nothing was stored would lose real
 * business, and the brief is explicit that a missing external service must not be
 * simulated.
 */

const RATE_LIMIT = { limit: 5, windowSeconds: 600 } as const;

const ELECTRICAL_DEPARTMENT_SLUG = "electrical-services";

/**
 * Hash the client IP before storage. The record stays useful for abuse forensics
 * without retaining a directly identifying network address.
 */
function hashIp(value: string): string {
  const salt = serverEnv.inquiryIpSalt ?? "kc-inquiry";
  return createHash("sha256").update(`${salt}:${value}`).digest("hex");
}

/**
 * Mirrors `public.generate_inquiry_reference()`. Generated here so the reference
 * can be shown to the visitor on the same request.
 */
function generateReference(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 6; i += 1) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  const now = new Date();
  const date = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
  ].join("");
  return `KC-${date}-${suffix}`;
}

/** Build the inquiry subject line from the chosen service and property type. */
function buildSubject(serviceLabel: string | null, propertyType: string): string {
  const scope = serviceLabel ? `Quote: ${serviceLabel}` : "Quote request";
  return `${scope} (${propertyType})`.slice(0, 200);
}

export async function submitQuoteRequest(
  _previous: QuoteFormState,
  formData: FormData,
): Promise<QuoteFormState> {
  const requestHeaders = await headers();

  const rawFiles = formData
    .getAll("attachments")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  const parsed = quoteRequestSchema(todayIso()).safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    location: formData.get("location"),
    region: formData.get("region") ?? "",
    service: formData.get("service") ?? "",
    propertyType: formData.get("propertyType") ?? "",
    contactMethod: formData.get("contactMethod") ?? "",
    contactDetails: formData.get("contactDetails") ?? "",
    description: formData.get("description"),
    // An unchecked checkbox is absent from FormData entirely.
    appointmentRequested: formData.get("appointmentRequested") === "on",
    appointmentDate: formData.get("appointmentDate") ?? "",
    appointmentWindow: formData.get("appointmentWindow") ?? "",
    appointmentNotes: formData.get("appointmentNotes") ?? "",
    consent: formData.get("consent") === "on",
    locale: formData.get("locale") ?? "en",
    companyWebsite: formData.get("companyWebsite") ?? "",
    verificationToken: formData.get("verificationToken") ?? "",
  });

  if (!parsed.success) {
    return { status: "invalid", errors: toQuoteFieldErrors(parsed.error.issues) };
  }

  // File count is checked after the text fields so the visitor fixes their text
  // first, and before any file is read.
  if (rawFiles.length > MAX_ATTACHMENT_COUNT) {
    return {
      status: "invalid",
      errors: { attachments: "tooManyFiles" },
    };
  }

  const forwarded = requestHeaders.get("x-forwarded-for");
  const clientIp = forwarded?.split(",")[0]?.trim() ?? null;

  const verification = await verifySubmission(
    parsed.data.verificationToken ? parsed.data.verificationToken : null,
    clientIp,
  );
  if (verification.outcome === "failed") {
    return { status: "verification_failed" };
  }

  const rate = checkRateLimit(
    clientKeyFrom(requestHeaders, "quote"),
    RATE_LIMIT,
  );
  if (!rate.allowed) return { status: "rate_limited" };

  const admin = createAdminClient();
  if (!admin) return { status: "unconfigured" };

  // ---------------------------------------------------------------------------
  // File validation. Content-based, before anything is written.
  //
  // Each file is read into memory, checked against the byte limit first (so an
  // oversized file is not read), then inspected for a known image/PDF signature.
  // A file whose content does not match an allowed type is rejected outright —
  // the submission fails rather than silently dropping the attachment, because a
  // visitor who attached the wrong file needs to know.
  // ---------------------------------------------------------------------------
  const validatedFiles: {
    bytes: Uint8Array;
    mime: string;
    extension: string;
    byteSize: number;
    originalFilename: string;
  }[] = [];

  for (const file of rawFiles) {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return {
        status: "invalid",
        errors: { attachments: "fileTooLarge" },
      };
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const verdict = validateUpload(bytes, file.type || undefined, {
      kind: "attachment",
    });

    if (!verdict.ok) {
      return {
        status: "invalid",
        errors: {
          attachments:
            verdict.reason === "type_not_allowed" ||
            verdict.reason === "unknown_type"
              ? "fileTypeNotAllowed"
              : verdict.reason === "too_large"
                ? "fileTooLarge"
                : "fileEmpty",
        },
      };
    }

    validatedFiles.push({
      bytes,
      mime: verdict.mime,
      extension: verdict.extension,
      byteSize: verdict.byteSize,
      originalFilename: sanitizeOriginalFilename(file.name),
    });
  }

  // ---------------------------------------------------------------------------
  // Resolve the department and the chosen service.
  // ---------------------------------------------------------------------------
  const { data: department } = await admin
    .from("departments")
    .select("id")
    .eq("slug", ELECTRICAL_DEPARTMENT_SLUG)
    .maybeSingle();
  const departmentId = department?.id ?? null;

  const serviceSlug = parsed.data.service ?? "";
  let serviceId: string | null = null;
  let serviceLabel: string | null = null;

  if (departmentId && serviceSlug) {
    const { data: service } = await admin
      .from("services")
      .select("id, title")
      .eq("department_id", departmentId)
      .eq("slug", serviceSlug)
      .maybeSingle();
    // An unresolvable slug is stored as no service rather than failing the
    // submission, so a stale or hand-edited link still lets the customer reach
    // the business.
    serviceId = service?.id ?? null;
    serviceLabel = service?.title ?? null;
  }

  const region = parsed.data.region ? findRegion(parsed.data.region) : undefined;
  let regionId: string | null = null;
  if (region) {
    const { data: regionRow } = await admin
      .from("regions")
      .select("id")
      .eq("slug", region.slug)
      .maybeSingle();
    regionId = regionRow?.id ?? null;
  }

  const appointmentRequested = parsed.data.appointmentRequested;
  const reference = generateReference();

  // A site-visit request is recorded with its own source so the CRM can filter
  // visits from quotes. The enum value is added by migration 14.
  const source = appointmentRequested ? "site_visit_request" : "quote_request";

  const { data: inquiry, error } = await admin
    .from("inquiries")
    .insert({
      reference,
      status: "new",
      source,
      department_id: departmentId,
      service_id: serviceId,
      locale: parsed.data.locale,
      full_name: parsed.data.fullName,
      email: parsed.data.email,
      phone: parsed.data.phone ? parsed.data.phone : null,
      subject: buildSubject(serviceLabel, parsed.data.propertyType),
      message: parsed.data.description,
      consent_given: true,
      consent_at: new Date().toISOString(),
      ip_hash: hashIp(clientIp ?? "unknown"),
      user_agent: requestHeaders.get("user-agent")?.slice(0, 500) ?? null,
      // Quote-request detail (migration 14).
      property_type: parsed.data.propertyType,
      region_id: regionId,
      locality: parsed.data.location,
      contact_method: parsed.data.contactMethod,
      preferred_contact: parsed.data.contactDetails
        ? parsed.data.contactDetails
        : null,
    })
    .select("id")
    .single();

  if (error || !inquiry) return { status: "error" };

  // ---------------------------------------------------------------------------
  // Upload attachments and the site-visit request, after the inquiry exists.
  //
  // Uploading first would risk objects in the bucket with no row referencing
  // them if the inquiry write failed. Writing the inquiry first means a failed
  // upload leaves an inquiry with fewer attachments, which is recoverable — the
  // team can ask the visitor to resend — rather than an orphaned object.
  // ---------------------------------------------------------------------------
  let attachmentWarning = false;

  for (const file of validatedFiles) {
    const storagePath = buildObjectPath(inquiry.id, file.extension);
    const uploaded = await uploadInquiryAttachment({
      storagePath,
      bytes: file.bytes,
      detectedMime: file.mime,
      byteSize: file.byteSize,
      originalFilename: file.originalFilename,
    });

    if (!uploaded.ok) {
      attachmentWarning = true;
      continue;
    }

    const { error: attachmentError } = await admin
      .from("inquiry_attachments")
      .insert({
        inquiry_id: inquiry.id,
        storage_path: storagePath,
        original_filename: file.originalFilename,
        detected_mime: file.mime,
        byte_size: file.byteSize,
      });

    if (attachmentError) {
      // The object exists but no row points at it, so remove it rather than
      // leaving an unreferenced upload in the bucket.
      await removeInquiryAttachment(storagePath);
      attachmentWarning = true;
    }
  }

  if (appointmentRequested) {
    const { error: appointmentError } = await admin
      .from("appointments")
      .insert({
        inquiry_id: inquiry.id,
        status: "requested",
        preferred_date: parsed.data.appointmentDate
          ? parsed.data.appointmentDate
          : todayIso(),
        // The schema yields either a real enum member or `undefined`, so this
        // falls back to the database default rather than passing an empty string.
        preferred_window: parsed.data.appointmentWindow ?? "anytime",
        notes: parsed.data.appointmentNotes
          ? parsed.data.appointmentNotes
          : null,
      });

    // The inquiry is the lead and it is already stored, so a failed appointment
    // write must not fail the submission: the request still reaches the team, who
    // can see the visit request in the message body and arrange it. Failing the
    // whole submission here would lose the lead to save a child row.
    if (appointmentError) {
      await admin.from("inquiry_events").insert({
        inquiry_id: inquiry.id,
        event_type: "appointment_write_failed",
        note: "Site-visit request could not be recorded on the appointments table.",
        metadata: { source },
      });
    }
  }

  // Audited after the rows are stored, so the trail can never claim a submission
  // that was not persisted. No PII is placed in the metadata.
  await recordAudit({
    actorId: null,
    action: "inquiry_received",
    entityType: "inquiry",
    entityId: reference,
    metadata: {
      source,
      department: ELECTRICAL_DEPARTMENT_SLUG,
      service: serviceId ? serviceSlug : null,
      propertyType: parsed.data.propertyType,
      region: region?.slug ?? null,
      locale: parsed.data.locale,
      attachments: validatedFiles.length,
      attachmentWarning,
      siteVisitRequested: appointmentRequested,
    },
  });

  return { status: "success", reference, appointmentRequested };
}

/** Re-exported so the form can render the limit without importing the module. */
export async function attachmentLimits(): Promise<{
  maxFiles: number;
  maxSize: string;
}> {
  return {
    maxFiles: MAX_ATTACHMENT_COUNT,
    maxSize: formatByteLimit(MAX_ATTACHMENT_BYTES),
  };
}
