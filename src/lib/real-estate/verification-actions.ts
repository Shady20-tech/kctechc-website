"use server";

import { revalidatePath } from "next/cache";

import { getAuthState } from "@/lib/auth/session";
import { isKycReviewerRole } from "@/lib/auth/roles";
import { recordAudit } from "@/lib/security/audit";
import { createClient } from "@/lib/supabase/server";

/**
 * Granting and revoking a publisher's verification badge.
 *
 * A verification badge is a public trust mark — "KC Technology reviewed this
 * person's identity" — and the brief is explicit that it must never be inferred
 * from an approval. So this is a deliberate super-admin action, and the write goes
 * through the **session** client so
 * `real_estate_memberships_enforce_verification` (which raises unless the caller is
 * a super admin) is the control. The role check here is a *message*; the trigger is
 * the boundary, and using the service-role client would bypass the very guard that
 * makes the badge meaningful.
 *
 * The badge is a property of an approved capability: the trigger clears it when the
 * membership leaves `approved`, so a suspension revokes the public mark without any
 * action here.
 */

export type VerificationState = { ok: true } | { ok: false; error: string };

export async function setPublisherVerificationAction(
  _previous: VerificationState | null,
  formData: FormData,
): Promise<VerificationState> {
  const membershipId = String(formData.get("membershipId") ?? "").trim();
  const grant = String(formData.get("verified") ?? "") === "true";

  if (!membershipId) return { ok: false, error: "not_found" };

  const auth = await getAuthState();
  if (auth.status === "unconfigured")
    return { ok: false, error: "unconfigured" };
  if (auth.status !== "authenticated" || !auth.profile) {
    return { ok: false, error: "unauthenticated" };
  }
  // The reviewer set is `super_admin` alone — deliberately narrower than the
  // real-estate administrator set, because deciding identity is not delegated to
  // the tier that manages listings.
  if (!isKycReviewerRole(auth.profile.role)) {
    return { ok: false, error: "forbidden" };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "unconfigured" };

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("real_estate_memberships")
    .update({
      verified_at: grant ? now : null,
      verified_by: grant ? auth.profile.id : null,
    })
    .eq("id", membershipId);

  if (error) {
    // `42501` is the trigger's insufficient-privilege error, which a
    // non-super-admin caller reaches if the application guard is ever removed.
    if (error.code === "42501") return { ok: false, error: "forbidden" };
    return { ok: false, error: "write_failed" };
  }

  await recordAudit({
    actorId: auth.profile.id,
    action: "membership_verification_changed",
    entityType: "real_estate_membership",
    entityId: membershipId,
    metadata: { verified: grant },
  });

  revalidatePath("/admin/real-estate/verification");
  revalidatePath("/en/real-estate/listings");
  revalidatePath("/fr/real-estate/listings");
  revalidatePath("/en/real-estate");
  revalidatePath("/fr/real-estate");

  return { ok: true };
}
