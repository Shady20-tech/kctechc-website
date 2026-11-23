"use server";

import { revalidatePath } from "next/cache";

import { getAuthState } from "@/lib/auth/session";
import { REVIEW_MODERATOR_ROLES } from "@/lib/reviews/types";
import type { AppRole } from "@/lib/auth/roles";
import { recordAudit } from "@/lib/security/audit";
import { createClient } from "@/lib/supabase/server";

import { reviewDecisionSchema, reviewSubmissionSchema } from "./schema";
import { decisionRequiresNote } from "./types";

/**
 * Review writes.
 *
 * Both actions write with the **session** client. That is the whole design: the
 * `reviews` policies restrict a submission to the caller's own `auth.uid()` and a
 * decision to a moderator, so the database refuses a write this module should
 * never have attempted. The role check below exists to give a useful message, not
 * to be the boundary — using the service-role client here would have made the
 * policies decorative, which is the exact failure mode the moderation is meant to
 * prevent.
 */

export type ReviewSubmitResult =
  | { status: "ok" }
  | { status: "unauthenticated" }
  | { status: "unconfigured" }
  | { status: "invalid"; fields: Record<string, string> }
  | { status: "error" };

export type ReviewDecisionResult =
  | { status: "ok"; decision: string }
  | { status: "unauthenticated" }
  | { status: "forbidden" }
  | { status: "not_found" }
  | { status: "invalid"; fields: Record<string, string> }
  | { status: "error" };

/** Field-level messages, keyed so the form can map each to a dictionary entry. */
function fieldErrors(error: {
  issues: readonly { path: readonly PropertyKey[]; message: string }[];
}): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fields[key]) {
      fields[key] = issue.message;
    }
  }
  return fields;
}

/**
 * Submit a review.
 *
 * The author is the signed-in user, never a caller-supplied id, so a review
 * cannot be posted in someone else's name. The row is always created
 * `pending_review` with consent recorded; the database policy refuses anything
 * else, and `status` is not read from the form at all.
 */
export async function submitReviewAction(
  formData: FormData,
): Promise<ReviewSubmitResult> {
  const auth = await getAuthState();
  if (auth.status === "unconfigured") return { status: "unconfigured" };
  if (auth.status !== "authenticated") return { status: "unauthenticated" };

  const parsed = reviewSubmissionSchema.safeParse({
    rating: formData.get("rating"),
    authorName: formData.get("authorName"),
    title: formData.get("title") ?? "",
    body: formData.get("body"),
    departmentSlug: formData.get("departmentSlug") ?? "",
    // An unchecked checkbox sends nothing at all, which must be a refusal.
    publishConsent: formData.get("publishConsent") === "on",
  });

  if (!parsed.success) {
    return { status: "invalid", fields: fieldErrors(parsed.error) };
  }

  const client = await createClient();
  if (!client) return { status: "unconfigured" };

  const { error } = await client.from("reviews").insert({
    author_id: auth.userId,
    author_name: parsed.data.authorName,
    rating: parsed.data.rating,
    title: parsed.data.title || null,
    body: parsed.data.body,
    department_slug: parsed.data.departmentSlug || null,
    publish_consent: true,
    // Explicit, even though it is the column default: the intent is that a
    // submission arrives pending, and stating it makes that visible here.
    status: "pending_review",
  });

  if (error) return { status: "error" };

  revalidatePath("/account/reviews");
  return { status: "ok" };
}

/**
 * Accept, refuse, or send a review back for changes.
 *
 * The decision is re-authorized against the role list here for a readable
 * message, but the `reviews_update_moderator` policy is what actually decides:
 * it requires `is_review_moderator()`, pins `reviewed_by` to the caller, and
 * refuses approving one's own review. An agent or a landlord reaches the
 * "forbidden" branch rather than the database's refusal.
 */
export async function decideReviewAction(
  formData: FormData,
): Promise<ReviewDecisionResult> {
  const auth = await getAuthState();
  if (auth.status !== "authenticated") return { status: "unauthenticated" };

  const role = auth.profile?.role as AppRole | undefined;
  if (!role || !REVIEW_MODERATOR_ROLES.includes(role as never)) {
    return { status: "forbidden" };
  }

  const parsed = reviewDecisionSchema.safeParse({
    reviewId: formData.get("reviewId"),
    decision: formData.get("decision"),
    note: formData.get("note") ?? "",
  });

  if (!parsed.success) {
    return { status: "invalid", fields: fieldErrors(parsed.error) };
  }

  // A refusal must say why, or the author is told "no" with nothing to act on.
  // The database enforces this too; checking here names the field.
  if (decisionRequiresNote(parsed.data.decision) && !parsed.data.note) {
    return {
      status: "invalid",
      fields: { note: "Give the author a reason for this decision." },
    };
  }

  const client = await createClient();
  if (!client) return { status: "error" };

  const { data, error } = await client
    .from("reviews")
    .update({
      status: parsed.data.decision,
      review_notes: parsed.data.note || null,
      reviewed_by: auth.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.reviewId)
    .select("id")
    .maybeSingle();

  if (error) return { status: "error" };
  // A policy refusal is not an error from PostgREST's point of view — the row
  // simply is not there to update, so a missing result is the refusal.
  if (!data) return { status: "not_found" };

  await recordAudit({
    actorId: auth.userId,
    action: "content_updated",
    entityType: "review",
    entityId: parsed.data.reviewId,
    metadata: { decision: parsed.data.decision },
  });

  revalidatePath("/admin/reviews");
  revalidatePath("/reviews");
  return { status: "ok", decision: parsed.data.decision };
}

/**
 * Withdraw or delete one's own review.
 *
 * Deleting an approved review removes it from the site, which is the author's
 * right. The `reviews_delete_own` policy scopes the delete to `auth.uid()`, so a
 * guessed id belonging to someone else matches nothing.
 */
export async function deleteOwnReviewAction(
  formData: FormData,
): Promise<{ status: "ok" | "unauthenticated" | "error" }> {
  const auth = await getAuthState();
  if (auth.status !== "authenticated") return { status: "unauthenticated" };

  const reviewId = String(formData.get("reviewId") ?? "");
  if (!reviewId) return { status: "error" };

  const client = await createClient();
  if (!client) return { status: "error" };

  const { error } = await client.from("reviews").delete().eq("id", reviewId);
  if (error) return { status: "error" };

  revalidatePath("/account/reviews");
  revalidatePath("/reviews");
  return { status: "ok" };
}
