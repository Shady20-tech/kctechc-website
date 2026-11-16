"use server";

import { revalidatePath } from "next/cache";

import { getAuthState } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { membershipApplicationSchema } from "@/lib/validation/membership";

import {
  MEMBERSHIP_TYPES,
  type MembershipStatus,
  type MembershipType,
} from "./memberships";

/**
 * Membership application, as a Server Action.
 *
 * The write goes through the cookie-bound client, never the service-role client.
 * That is the whole control: `real_estate_memberships_insert_own` permits a row
 * only where `user_id = auth.uid()` and `status` is one of the pending states,
 * and `real_estate_memberships_update_own` holds the same line on a re-application.
 * An action that used the service role here would make the self-escalation guard
 * decorative, because the service role bypasses RLS.
 *
 * Approval is deliberately NOT here. Moving a membership to `approved` is a staff
 * decision with its own audit entry, and it lives with the other real-estate
 * administration.
 */

export type MembershipActionState =
  | { ok: true; status: MembershipStatus }
  | { ok: false; error: string; fields?: Record<string, string> };

/**
 * Apply for a capability, or re-apply after a rejection or a request for changes.
 *
 * Upserted rather than inserted, because `real_estate_memberships_unique_per_type`
 * allows one row per (user, capability): a second application is the same
 * membership revisited, not a second membership. The update path is what makes
 * "allow users to request an additional membership later" work for a capability
 * they were previously refused.
 */
export async function applyForMembershipAction(
  membershipType: MembershipType,
  _previous: MembershipActionState | null,
  formData: FormData,
): Promise<MembershipActionState> {
  const auth = await getAuthState();
  if (auth.status === "unconfigured")
    return { ok: false, error: "unconfigured" };
  if (auth.status !== "authenticated" || !auth.profile) {
    return { ok: false, error: "unauthenticated" };
  }

  // An application is a considered act, not something to retry in a loop.
  const limit = checkRateLimit(`membership:${auth.profile.id}`, {
    limit: 5,
    windowSeconds: 300,
  });
  if (!limit.allowed) return { ok: false, error: "rate_limited" };

  if (!(MEMBERSHIP_TYPES as readonly string[]).includes(membershipType)) {
    return { ok: false, error: "invalid_type" };
  }

  const parsed = membershipApplicationSchema.safeParse({
    membershipType,
    kycReference: String(formData.get("kycReference") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });

  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fields[String(issue.path[0] ?? "form")] ??= issue.message;
    }
    return { ok: false, error: "invalid", fields };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "unconfigured" };

  // The capability is always submitted in a pending state. An approved row is
  // refused by the policy, and asking for one here would be the escalation the
  // migration exists to prevent.
  const { data, error } = await supabase
    .from("real_estate_memberships")
    .upsert(
      {
        user_id: auth.profile.id,
        membership_type: membershipType,
        status: "pending_review",
        kyc_reference: parsed.data.kycReference || null,
        // A re-application clears the previous decision, so a rejected row does
        // not keep a stale reason beside a fresh submission.
        review_notes: null,
        approved_by: null,
        approved_at: null,
        suspended_at: null,
        suspension_reason: null,
      },
      { onConflict: "user_id,membership_type" },
    )
    .select("status")
    .single();

  if (error || !data) {
    // A row that is already approved cannot be reset to pending by its owner —
    // the update policy refuses it, and the honest message is that they already
    // hold the capability.
    if ((error?.message ?? "").includes("row-level security")) {
      return { ok: false, error: "already_member" };
    }
    return { ok: false, error: "write_failed" };
  }

  revalidatePath("/en/account");
  revalidatePath("/fr/account");
  revalidatePath("/admin/real-estate/memberships");

  return { ok: true, status: data.status as MembershipStatus };
}
