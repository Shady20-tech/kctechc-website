"use server";

import { revalidatePath } from "next/cache";

import { isKycReviewerRole } from "@/lib/auth/roles";
import { getAuthState } from "@/lib/auth/session";
import { recordAudit } from "@/lib/security/audit";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { describeSupabaseError } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";
import { signedKycUrl } from "@/lib/uploads/kyc-storage";
import { kycDecisionSchema, kycNoteSchema } from "@/lib/validation/kyc";

import { KYC_DECISION_STATUS, type KycDecision } from "./kyc";

/**
 * The super-admin decision on a KYC application.
 *
 * ## Why this is the only place an approval exists
 *
 * The brief's central rule is that a user-selected account type never grants
 * posting permissions. A capability is created here and nowhere else, and this
 * module enforces three independent things:
 *
 *   1. **The caller is a super admin.** `getAuthState()` reads the role from the
 *      database, and the check below refuses everyone else — including a plain
 *      `real_estate_admin`, who the brief says must not hold KYC approval
 *      permission. This is the message; the control is next.
 *
 *   2. **The database refuses a non-super-admin too.** The approval runs through
 *      `approve_kyc_application`, whose own `is_super_admin()` guard raises
 *      `insufficient_privilege` for anyone else. A direct PostgREST call never
 *      runs this module, so the function's guard is what actually protects the
 *      capability — and the function is NOT granted to a browser key.
 *
 *   3. **The row write uses the service-role client, not the session client.**
 *      `approve_kyc_application` is `security definer` and only reachable by
 *      `service_role`, so it is called on the admin client. The session client
 *      would be refused — which is the point: an approval is not something a
 *      user's own session can express, however the request is crafted.
 *
 * The decision and the capability are written in ONE function call, so the
 * application status and the membership cannot disagree.
 */

export type KycReviewState =
  | { ok: true }
  | { ok: false; error: string; detail?: string };

/**
 * Record a decision: approve, reject, or request more information.
 *
 * A refusal and a request for changes must carry a reason the applicant can act
 * on; an approval's note is optional and internal. The reason is validated here
 * and again by the table's `kyc_decision_requires_reason` CHECK.
 */
export async function reviewKycApplicationAction(
  applicationId: string,
  _previous: KycReviewState | null,
  formData: FormData,
): Promise<KycReviewState> {
  const parsed = kycDecisionSchema.safeParse({
    decision: formData.get("decision"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) return { ok: false, error: "invalid_decision" };

  const { decision, reason } = parsed.data;

  if (
    (decision === "reject" || decision === "request_changes") &&
    reason.length === 0
  ) {
    return { ok: false, error: "reason_required" };
  }

  const auth = await getAuthState();
  if (auth.status === "unconfigured") return { ok: false, error: "unconfigured" };
  if (auth.status !== "authenticated" || !auth.profile) {
    return { ok: false, error: "unauthenticated" };
  }

  // The role check. A real-estate administrator is deliberately refused here,
  // which is the brief's requirement.
  if (!isKycReviewerRole(auth.profile.role)) {
    return { ok: false, error: "forbidden" };
  }

  const limit = checkRateLimit(`kyc-review:${auth.profile.id}`, {
    limit: 60,
    windowSeconds: 300,
  });
  if (!limit.allowed) return { ok: false, error: "rate_limited" };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "unconfigured" };

  if (decision === "approve") {
    // The atomic approval: application -> approved, membership -> active. The
    // function re-checks the super-admin guard internally.
    const { error } = await admin.rpc("approve_kyc_application", {
      p_application_id: applicationId,
      p_reviewer: auth.profile.id,
      p_note: reason || undefined,
    });

    if (error) {
      const detail = describeSupabaseError(error);
      if ((error.message ?? "").includes("insufficient_privilege")) {
        return { ok: false, error: "forbidden", detail };
      }
      if ((error.message ?? "").includes("already approved")) {
        return { ok: false, error: "already_decided", detail };
      }
      if ((error.message ?? "").includes("has not been submitted")) {
        return { ok: false, error: "not_submitted", detail };
      }
      return { ok: false, error: "write_failed", detail };
    }
  } else {
    // A refusal or a request for changes. Written with the session client so the
    // `kyc_applications_write_super_admin` policy is the control; the role check
    // above already refused a non-super-admin, and the policy refuses again.
    const supabase = await createClient();
    if (!supabase) return { ok: false, error: "unconfigured" };

    const status = KYC_DECISION_STATUS[decision as KycDecision];
    const now = new Date().toISOString();

    const { error } = await supabase
      .from("real_estate_kyc_applications")
      .update({
        status,
        decision_reason: reason,
        reviewed_by: auth.profile.id,
        reviewed_at: now,
      })
      .eq("id", applicationId);

    if (error) {
      return {
        ok: false,
        error: "write_failed",
        detail: describeSupabaseError(error),
      };
    }

    await supabase.from("real_estate_kyc_review_events").insert({
      application_id: applicationId,
      action: decision === "reject" ? "rejected" : "changes_requested",
      actor_id: auth.profile.id,
      note: reason,
    });
  }

  await recordAudit({
    actorId: auth.profile.id,
    action:
      decision === "approve"
        ? "kyc_approved"
        : decision === "reject"
          ? "kyc_rejected"
          : "kyc_changes_requested",
    entityType: "real_estate_kyc_application",
    entityId: applicationId,
    metadata: { decision },
  });

  revalidatePath("/admin/real-estate/kyc");
  revalidatePath(`/admin/real-estate/kyc/${applicationId}`);
  revalidatePath("/en/account");
  revalidatePath("/fr/account");

  return { ok: true };
}

/** Record an internal note on an application. Never shown to the applicant. */
export async function addKycNoteAction(
  applicationId: string,
  _previous: KycReviewState | null,
  formData: FormData,
): Promise<KycReviewState> {
  const parsed = kycNoteSchema.safeParse({ note: formData.get("note") ?? "" });
  if (!parsed.success) return { ok: false, error: "note_required" };

  const auth = await getAuthState();
  if (auth.status !== "authenticated" || !auth.profile) {
    return { ok: false, error: "unauthenticated" };
  }
  if (!isKycReviewerRole(auth.profile.role)) {
    return { ok: false, error: "forbidden" };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "unconfigured" };

  const { error } = await supabase.from("real_estate_kyc_review_events").insert({
    application_id: applicationId,
    action: "note_added",
    actor_id: auth.profile.id,
    note: parsed.data.note,
  });

  if (error) {
    return {
      ok: false,
      error: "write_failed",
      detail: describeSupabaseError(error),
    };
  }

  revalidatePath(`/admin/real-estate/kyc/${applicationId}`);
  return { ok: true };
}

/**
 * Mint a signed URL for one document, for the reviewer to look at.
 *
 * The super-admin check is repeated here because this is the only function that
 * hands out a pointer to a private object. A signed URL expires, so the link the
 * reviewer's browser receives stops working after a few minutes.
 */
export async function getKycDocumentUrlAction(
  documentId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const auth = await getAuthState();
  if (auth.status !== "authenticated" || !auth.profile) {
    return { ok: false, error: "unauthenticated" };
  }
  if (!isKycReviewerRole(auth.profile.role)) {
    return { ok: false, error: "forbidden" };
  }

  // The path is read with the session client, so `kyc_documents_select_super_admin`
  // is the control and a document the caller cannot see cannot be signed.
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "unconfigured" };

  const { data } = await supabase
    .from("real_estate_kyc_documents")
    .select("storage_path, application_id")
    .eq("id", documentId)
    .maybeSingle();

  if (!data) return { ok: false, error: "not_found" };

  const url = await signedKycUrl(data.storage_path);
  if (!url) return { ok: false, error: "unavailable" };

  // Record the view. The audit trigger mirrors it, so a reviewer looking at an
  // identity document is a trail entry, not just a page render.
  await supabase.from("real_estate_kyc_review_events").insert({
    application_id: data.application_id,
    action: "document_viewed",
    actor_id: auth.profile.id,
    document_id: documentId,
  });

  return { ok: true, url };
}
