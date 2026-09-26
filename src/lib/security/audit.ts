import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Audit trail writer for privileged operations.
 *
 * Writes go through the service-role client because `audit_logs` is
 * append-only and not writable by ordinary users. Failures are reported to the
 * caller rather than swallowed, so an unaudited privileged change is visible.
 */

export const AUDIT_ACTIONS = [
  "role_changed",
  "profile_created",
  "profile_deactivated",
  "content_published",
  "property_approved",
  "property_rejected",
  "payment_state_changed",
  "translation_synced",
  "site_setting_changed",
  "sign_in_succeeded",
  "sign_in_failed",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditEntry = {
  actorId: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  /** Non-sensitive structured context. Never place secrets or PII here. */
  metadata?: Record<string, string | number | boolean | null>;
};

export async function recordAudit(entry: AuditEntry): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return false;

  const { error } = await admin.from("audit_logs").insert({
    actor_id: entry.actorId,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    metadata: entry.metadata ?? {},
  });

  return !error;
}
