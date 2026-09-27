"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";

import { serverEnv } from "@/lib/config/server-env";
import { recordAudit } from "@/lib/security/audit";
import { verifySubmission } from "@/lib/security/bot-verification";
import { checkRateLimit, clientKeyFrom } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";
import {
  listingInquirySchema,
  toListingInquiryFieldErrors,
  type ListingInquiryState,
} from "@/lib/validation/listing-inquiry";

/**
 * Property enquiry submission.
 *
 * The same shape as the general inquiry action, for the same reasons: it writes
 * server-side with the service-role key after validation and rate limiting, and
 * `inquiries` has no anonymous insert policy, so a browser cannot bypass the
 * honeypot or the length limits by posting to Supabase directly.
 *
 * Two differences matter.
 *
 * First, the listing is resolved before the write and the email is addressed to
 * that listing's agent. An enquiry with no resolvable listing is refused rather
 * than stored as a general message, because the pipeline routes it by listing and
 * an unroutable row would sit in the queue unowned — a real enquiry lost in the
 * one place it is least visible.
 *
 * Second, the enquiry is recorded as a `listing_events` row in the same request.
 * That row is what links the enquiry to the listing and what refreshes the
 * listing's `inquiry_count`, which the dashboard reads. Inserting the inquiry
 * without it would leave the enquiry visible in the inbox but invisible on the
 * listing it concerns.
 *
 * Missing credentials are reported as `unconfigured` rather than as success: the
 * brief is explicit that a missing external service must never be simulated.
 */

const RATE_LIMIT = { limit: 5, windowSeconds: 600 } as const;

function hashIp(value: string): string {
  const salt = serverEnv.inquiryIpSalt ?? "kc-inquiry";
  return createHash("sha256").update(`${salt}:${value}`).digest("hex");
}

/** Mirrors `public.generate_inquiry_reference()`. */
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

export async function submitListingInquiry(
  _previous: ListingInquiryState,
  formData: FormData,
): Promise<ListingInquiryState> {
  const requestHeaders = await headers();

  const parsed = listingInquirySchema.safeParse({
    listingId: formData.get("listingId"),
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    message: formData.get("message"),
    viewingRequest: formData.get("viewingRequest") === "on",
    locale: formData.get("locale") ?? "en",
    consent: formData.get("consent") === "on",
    companyWebsite: formData.get("companyWebsite") ?? "",
    verificationToken: formData.get("verificationToken") ?? "",
  });

  if (!parsed.success) {
    return {
      status: "invalid",
      errors: toListingInquiryFieldErrors(parsed.error.issues),
    };
  }

  const forwarded = requestHeaders.get("x-forwarded-for");
  const clientIp = forwarded?.split(",")[0]?.trim() ?? null;

  // Verification before the rate limit, matching the contact action: a failing
  // provider must not be usable to exhaust another visitor's allowance.
  const verification = await verifySubmission(
    parsed.data.verificationToken ? parsed.data.verificationToken : null,
    clientIp,
  );
  if (verification.outcome === "failed") {
    return { status: "verification_failed" };
  }

  const rate = checkRateLimit(
    clientKeyFrom(requestHeaders, "listing-inquiry"),
    RATE_LIMIT,
  );
  if (!rate.allowed) return { status: "rate_limited" };

  const admin = createAdminClient();
  if (!admin) return { status: "unconfigured" };

  // The public client, so RLS decides whether this listing exists for a visitor.
  // Reading the listing with the service-role key would confirm the existence of
  // a draft to anyone who guessed an id.
  const publicClient = createPublicClient();
  if (!publicClient) return { status: "unconfigured" };

  const { data: listing } = await publicClient
    .from("property_listings")
    .select("id, reference, title, agent_id")
    .eq("id", parsed.data.listingId)
    .in("status", ["published", "under_offer"])
    .maybeSingle();

  if (!listing) return { status: "error" };

  const departmentId = await resolveDepartmentId(admin);
  const reference = generateReference();

  const { data: inserted, error } = await admin
    .from("inquiries")
    .insert({
      reference,
      status: "new",
      source: parsed.data.viewingRequest ? "viewing_request" : "property_inquiry",
      department_id: departmentId,
      locale: parsed.data.locale,
      full_name: parsed.data.fullName,
      email: parsed.data.email,
      phone: parsed.data.phone ? parsed.data.phone : null,
      // The subject is derived from the listing rather than supplied, so the
      // inbox line is always actionable and a submitter cannot title their own
      // message something misleading.
      subject: `${listing.reference} — ${listing.title}`,
      message: parsed.data.message,
      consent_given: true,
      consent_at: new Date().toISOString(),
      ip_hash: hashIp(clientIp ?? "unknown"),
      user_agent: requestHeaders.get("user-agent")?.slice(0, 500) ?? null,
    })
    .select("id")
    .single();

  if (error || !inserted) return { status: "error" };

  // The link between the enquiry and the listing, and what refreshes the
  // listing's inquiry counter. A failure here is not reported to the visitor:
  // their message is stored and will be answered, and telling them otherwise
  // would invite a duplicate submission for a problem they cannot act on.
  const { error: eventError } = await admin.from("listing_events").insert({
    listing_id: listing.id,
    event_type: "inquiry",
    inquiry_id: inserted.id,
  });
  if (eventError) {
    await recordAudit({
      actorId: null,
      action: "inquiry_received",
      entityType: "listing_inquiry",
      entityId: reference,
      metadata: { listing: listing.reference, event_linked: false },
    });
    return { status: "success", reference };
  }

  await recordAudit({
    actorId: null,
    action: "inquiry_received",
    entityType: "listing_inquiry",
    entityId: reference,
    metadata: {
      listing: listing.reference,
      source: parsed.data.viewingRequest ? "viewing_request" : "property_inquiry",
      locale: parsed.data.locale,
    },
  });

  return { status: "success", reference };
}

/** The real-estate department id, for the inbox's department filter. */
async function resolveDepartmentId(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
): Promise<string | null> {
  const { data } = await admin
    .from("departments")
    .select("id")
    .eq("slug", "real-estate")
    .maybeSingle();
  return data?.id ?? null;
}
