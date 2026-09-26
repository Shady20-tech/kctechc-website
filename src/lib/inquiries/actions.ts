"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { serverEnv } from "@/lib/config/server-env";
import { verifySubmission } from "@/lib/security/bot-verification";
import { recordAudit } from "@/lib/security/audit";
import { checkRateLimit, clientKeyFrom } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  inquirySchema,
  toFieldErrors,
  type InquiryState,
} from "@/lib/validation/inquiry";

/**
 * Inquiry submission.
 *
 * The write runs server-side with the service-role key after validation and rate
 * limiting, and `inquiries` has no anonymous insert policy — so a browser cannot
 * bypass the honeypot, the consent requirement or the length limits by posting to
 * Supabase directly.
 *
 * Missing credentials are reported as `unconfigured` rather than as success. The
 * brief is explicit that a missing external service must never be simulated, and
 * the same applies here: telling a visitor their message was received when
 * nothing was stored would lose real business.
 */

const RATE_LIMIT = { limit: 5, windowSeconds: 600 } as const;

/**
 * Hash the client IP before storage. The record stays useful for abuse forensics
 * without retaining a directly identifying network address.
 */
function hashIp(value: string): string {
  const salt = serverEnv.inquiryIpSalt ?? "kc-inquiry";
  return createHash("sha256").update(`${salt}:${value}`).digest("hex");
}

/**
 * Mirrors `public.generate_inquiry_reference()` in the migration. Generated here
 * so the reference can be shown to the visitor on the same request.
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

export async function submitInquiry(
  _previous: InquiryState,
  formData: FormData,
): Promise<InquiryState> {
  const requestHeaders = await headers();

  const parsed = inquirySchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    department: formData.get("department") ?? "",
    service: formData.get("service") ?? "",
    subject: formData.get("subject"),
    message: formData.get("message"),
    // An unchecked checkbox is absent from FormData entirely.
    consent: formData.get("consent") === "on",
    locale: formData.get("locale") ?? "en",
    companyWebsite: formData.get("companyWebsite") ?? "",
    verificationToken: formData.get("verificationToken") ?? "",
  });

  if (!parsed.success) {
    return { status: "invalid", errors: toFieldErrors(parsed.error.issues) };
  }

  const forwarded = requestHeaders.get("x-forwarded-for");
  const clientIp = forwarded?.split(",")[0]?.trim() ?? null;

  // Verification runs before the rate limit so a failing provider cannot be used
  // to exhaust another visitor's allowance, and before the write so an unverified
  // submission never reaches the database.
  const verification = await verifySubmission(
    parsed.data.verificationToken ? parsed.data.verificationToken : null,
    clientIp,
  );
  if (verification.outcome === "failed") {
    return { status: "verification_failed" };
  }

  const rate = checkRateLimit(
    clientKeyFrom(requestHeaders, "inquiry"),
    RATE_LIMIT,
  );
  if (!rate.allowed) return { status: "rate_limited" };

  const admin = createAdminClient();
  if (!admin) return { status: "unconfigured" };

  const departmentSlug = parsed.data.department;
  const serviceSlug = parsed.data.service ?? "";
  let departmentId: string | null = null;

  if (departmentSlug) {
    const { data: department } = await admin
      .from("departments")
      .select("id")
      .eq("slug", departmentSlug)
      .maybeSingle();
    departmentId = department?.id ?? null;
  }

  // Resolve the service within the chosen department. An unresolvable slug is
  // stored as no service rather than failing the submission, so a stale or
  // hand-edited link still lets the customer reach the business.
  let serviceId: string | null = null;
  if (departmentId && serviceSlug) {
    const { data: service } = await admin
      .from("services")
      .select("id")
      .eq("department_id", departmentId)
      .eq("slug", serviceSlug)
      .maybeSingle();
    serviceId = service?.id ?? null;
  }

  const reference = generateReference();

  const { error } = await admin.from("inquiries").insert({
    reference,
    status: "new",
    // A tagged submission is recorded as a service inquiry so the inbox can
    // separate it from general contact traffic.
    source: serviceId ? "service_inquiry" : "contact_form",
    department_id: departmentId,
    service_id: serviceId,
    locale: parsed.data.locale,
    full_name: parsed.data.fullName,
    email: parsed.data.email,
    phone: parsed.data.phone ? parsed.data.phone : null,
    subject: parsed.data.subject,
    message: parsed.data.message,
    consent_given: true,
    consent_at: new Date().toISOString(),
    ip_hash: hashIp(clientIp ?? "unknown"),
    user_agent: requestHeaders.get("user-agent")?.slice(0, 500) ?? null,
  });

  if (error) return { status: "error" };

  // Audited after the row is stored, so the trail can never claim a submission
  // that was not persisted. No PII is placed in the metadata.
  await recordAudit({
    actorId: null,
    action: "inquiry_received",
    entityType: "inquiry",
    entityId: reference,
    metadata: {
      source: serviceId ? "service_inquiry" : "contact_form",
      department: departmentSlug || null,
      service: serviceId ? serviceSlug : null,
      locale: parsed.data.locale,
    },
  });

  return { status: "success", reference };
}
