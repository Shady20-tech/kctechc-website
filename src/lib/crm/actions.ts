"use server";

import { revalidatePath } from "next/cache";

import { getAuthState } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { recordAudit } from "@/lib/security/audit";
import { isInquiryPriority, isInquiryStatus, isInquiryType } from "@/lib/crm/queries";
import type { Database } from "@/lib/db/database.types";

/**
 * CRM updates: status, priority, type, assignment and a free-text note.
 *
 * Every change is written through the cookie-bound client, so the `is_admin()`
 * policy on `inquiries` is the control; the action additionally verifies the
 * caller is an admin so it can return a clean error rather than an RLS denial.
 *
 * A change also appends an `inquiry_events` row. The event is what makes the
 * timeline meaningful — without it the console could show the current status but
 * not who moved it there or when, which is most of the value of a shared inbox.
 * The two writes are sequential rather than transactional because Supabase's
 * client API does not expose a transaction; the event insert is best-effort and
 * its failure does not roll back the status change, which is the behaviour we
 * want: losing the note is better than losing the update.
 */

export type CrmUpdateState =
  | { ok: true; message: string }
  | { ok: false; error: string };

type InquiryUpdate = Database["public"]["Tables"]["inquiries"]["Update"];

export async function updateInquiryAction(
  _previous: CrmUpdateState | null,
  formData: FormData,
): Promise<CrmUpdateState> {
  const auth = await getAuthState();
  if (auth.status !== "authenticated" || !auth.profile) {
    return { ok: false, error: "unauthenticated" };
  }
  if (!isAdminRole(auth.profile.role)) return { ok: false, error: "forbidden" };

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "not_found" };

  const status = String(formData.get("status") ?? "");
  const priority = String(formData.get("priority") ?? "");
  const type = String(formData.get("type") ?? "");
  const assignedToRaw = String(formData.get("assignedTo") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!isInquiryStatus(status)) return { ok: false, error: "invalid_status" };
  if (!isInquiryPriority(priority)) return { ok: false, error: "invalid_priority" };
  if (!isInquiryType(type)) return { ok: false, error: "invalid_type" };
  if (note.length > 2000) return { ok: false, error: "note_too_long" };

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "unconfigured" };

  const { data: current, error: readError } = await supabase
    .from("inquiries")
    .select("status, priority, inquiry_type, assigned_to, responded_at")
    .eq("id", id)
    .maybeSingle();

  if (readError || !current) return { ok: false, error: "not_found" };

  const assignedTo = assignedToRaw || null;
  const now = new Date().toISOString();

  // Derived timestamps, set here rather than left to the caller: moving an
  // enquiry to `responded` should stamp the response time, and reopening a closed
  // enquiry should clear it. Encoding that in the write keeps every surface that
  // changes status producing the same, consistent record.
  const respondedAt =
    status === "responded" && !current.responded_at ? now : current.responded_at;
  const closedAt = status === "closed" ? now : null;
  const assignedAt = assignedTo !== current.assigned_to ? now : undefined;

  const update: InquiryUpdate = {
    status,
    priority,
    inquiry_type: type,
    assigned_to: assignedTo,
    responded_at: respondedAt,
    closed_at: closedAt,
  };
  if (assignedAt !== undefined) update.assigned_at = assignedAt;

  const { error: updateError } = await supabase
    .from("inquiries")
    .update(update)
    .eq("id", id);

  if (updateError) return { ok: false, error: "update_failed" };

  // The activity trigger on `inquiries` maintains `last_activity_at`; the event
  // below records the human-readable detail.
  const changes: string[] = [];
  if (status !== current.status) changes.push(`status: ${current.status} → ${status}`);
  if (priority !== current.priority) changes.push(`priority: ${current.priority} → ${priority}`);
  if (type !== current.inquiry_type) changes.push(`type: ${current.inquiry_type} → ${type}`);
  if (assignedTo !== current.assigned_to) {
    changes.push(assignedTo ? "assigned" : "unassigned");
  }

  if (changes.length > 0 || note) {
    await supabase.from("inquiry_events").insert({
      inquiry_id: id,
      event_type: "updated",
      actor_id: auth.profile.id,
      from_status: current.status,
      to_status: status,
      note: [changes.join("; "), note].filter(Boolean).join(" — ") || null,
    });
  }

  await recordAudit({
    actorId: auth.profile.id,
    action: status !== current.status ? "inquiry_status_changed" : "inquiry_assigned",
    entityType: "inquiry",
    entityId: id,
    metadata: {
      from_status: current.status,
      to_status: status,
      changed: changes.length,
    },
  });

  revalidatePath("/admin/crm");
  revalidatePath(`/admin/crm/${id}`);
  return { ok: true, message: changes.length === 0 && !note ? "no_change" : "updated" };
}
