"use server";

import { revalidatePath } from "next/cache";

import { getAuthState } from "@/lib/auth/session";
import { isRealEstateAdminRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { describeSupabaseError } from "@/lib/supabase/errors";

import type { MembershipStatus } from "./memberships";

/**
 * The staff decision on a membership application.
 *
 * The write uses the session client, so `real_estate_memberships_write_staff` is
 * the control: `is_real_estate_admin()` decides who may reach any row. The role
 * check here is a *message* — it turns a raw policy refusal into "you may not
 * review applications" — not the control itself, and the guard is repeated for the
 * same reason every other admin action repeats it: a missing guard is a confusing
 * failure rather than a hole, and the database refuses regardless.
 *
 * The audit entry is written by the `audit_membership_change` trigger on the
 * table, not here. A status change recorded by application code is absent exactly
 * when something bypasses the application, which is the case the trail exists for.
 * Writing one here as well would produce two rows for one decision.
 */

export type MembershipDecision =
  | "approve"
  | "reject"
  | "request_changes"
  | "suspend"
  | "reinstate";

export type MembershipReviewState =
  | { ok: true }
  | { ok: false; error: string; detail?: string };

/** The status a decision moves the membership to. */
const DECISION_STATUS = {
  approve: "approved",
  reject: "rejected",
  request_changes: "changes_requested",
  suspend: "suspended",
  reinstate: "approved",
} as const satisfies Record<MembershipDecision, MembershipStatus>;

export async function reviewMembershipAction(
  membershipId: string,
  _previous: MembershipReviewState | null,
  formData: FormData,
): Promise<MembershipReviewState> {
  const decision = String(formData.get("decision") ?? "") as MembershipDecision;
  const notes = String(formData.get("notes") ?? "");

  const auth = await getAuthState();
  if (auth.status === "unconfigured")
    return { ok: false, error: "unconfigured" };
  if (auth.status !== "authenticated" || !auth.profile) {
    return { ok: false, error: "unauthenticated" };
  }
  if (!isRealEstateAdminRole(auth.profile.role)) {
    return { ok: false, error: "forbidden" };
  }

  if (!(decision in DECISION_STATUS)) {
    return { ok: false, error: "invalid_decision" };
  }

  const trimmed = notes.trim();
  // A refusal, a request for changes and a suspension must carry a reason the
  // applicant can act on — the same rule the table's
  // `real_estate_memberships_decision_requires_notes` and
  // `..._suspension_requires_reason` constraints enforce. Checked here so the
  // operator gets a message rather than a constraint violation.
  if (
    (decision === "reject" ||
      decision === "request_changes" ||
      decision === "suspend") &&
    trimmed.length === 0
  ) {
    return { ok: false, error: "notes_required" };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "unconfigured" };

  const now = new Date().toISOString();
  const status = DECISION_STATUS[decision];

  // Built per decision rather than by spreading a base object, so the columns
  // that must be cleared (a suspension's reason on reinstatement, an approval's
  // reviewer on rejection) are cleared explicitly and the intent is legible.
  const update: {
    status: MembershipStatus;
    review_notes?: string | null;
    approved_by?: string | null;
    approved_at?: string | null;
    suspended_at?: string | null;
    suspension_reason?: string | null;
  } = { status };

  if (decision === "approve") {
    update.approved_by = auth.profile.id;
    update.approved_at = now;
    update.review_notes = trimmed || null;
    update.suspended_at = null;
    update.suspension_reason = null;
  } else if (decision === "reject" || decision === "request_changes") {
    update.review_notes = trimmed;
    update.approved_by = null;
    update.approved_at = null;
  } else if (decision === "suspend") {
    update.suspended_at = now;
    update.suspension_reason = trimmed;
    update.review_notes = trimmed;
  } else {
    // Reinstate: back to approved, and the suspension detail is cleared so a
    // reinstated member does not carry a stale reason a later report would read as
    // current.
    update.approved_by = auth.profile.id;
    update.approved_at = now;
    update.suspended_at = null;
    update.suspension_reason = null;
    if (trimmed) update.review_notes = trimmed;
  }

  const { error } = await supabase
    .from("real_estate_memberships")
    .update(update)
    .eq("id", membershipId);

  if (error) {
    return {
      ok: false,
      error: "write_failed",
      detail: describeSupabaseError(error),
    };
  }

  revalidatePath("/admin/real-estate/memberships");
  revalidatePath("/en/account");
  revalidatePath("/fr/account");

  return { ok: true };
}
