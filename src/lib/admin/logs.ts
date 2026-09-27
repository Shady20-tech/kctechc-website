import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Audit-log reader for the super-admin system-log page.
 *
 * Reads through the cookie-bound client so the `audit_logs_select_admin` policy
 * is what gates the rows; the page additionally restricts to `super_admin`, so
 * the two controls agree. The service-role client is used only to resolve actor
 * names, which requires reading `profiles` rows the viewer's RLS may not expose
 * for every actor — and that read returns names, never credentials.
 *
 * `audit_logs` is append-only: this module has no write or delete function, by
 * design. The only writer is `src/lib/security/audit.ts`.
 */

export type AuditLogRow = {
  id: string;
  createdAt: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
};

export type AuditLogFilters = {
  action?: string;
  entityType?: string;
  limit?: number;
};

const DEFAULT_LIMIT = 100;

export async function listAuditLogs(
  filters: AuditLogFilters,
): Promise<AuditLogRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  const limit = Math.min(Math.max(filters.limit ?? DEFAULT_LIMIT, 1), 500);

  let query = supabase
    .from("audit_logs")
    .select("id, created_at, action, entity_type, entity_id, metadata, actor_id")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filters.action) query = query.eq("action", filters.action);
  if (filters.entityType) query = query.eq("entity_type", filters.entityType);

  const { data, error } = await query;
  if (error || !data) return [];

  const actorIds = Array.from(
    new Set(data.map((row) => row.actor_id).filter((id): id is string => !!id)),
  );

  const actors = new Map<string, { name: string | null; email: string | null }>();
  if (actorIds.length > 0) {
    const admin = createAdminClient();
    if (admin) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, full_name, email")
        .in("id", actorIds);
      for (const profile of profiles ?? []) {
        actors.set(profile.id, {
          name: profile.full_name,
          email: profile.email,
        });
      }
    }
  }

  return data.map((row) => {
    const actor = row.actor_id ? actors.get(row.actor_id) : undefined;
    return {
      id: row.id,
      createdAt: row.created_at,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      metadata:
        row.metadata && typeof row.metadata === "object"
          ? (row.metadata as Record<string, unknown>)
          : {},
      actorId: row.actor_id,
      actorName: actor?.name ?? null,
      actorEmail: actor?.email ?? null,
    };
  });
}

/** The distinct action and entity-type values that actually appear, for filters. */
export async function listAuditFacets(): Promise<{
  actions: string[];
  entityTypes: string[];
}> {
  const supabase = await createClient();
  if (!supabase) return { actions: [], entityTypes: [] };

  // A bounded read is enough to build the filter lists; the console has no need
  // to enumerate every value the trail has ever contained.
  const { data } = await supabase
    .from("audit_logs")
    .select("action, entity_type")
    .order("created_at", { ascending: false })
    .limit(500);

  const actions = new Set<string>();
  const entityTypes = new Set<string>();
  for (const row of data ?? []) {
    actions.add(row.action);
    entityTypes.add(row.entity_type);
  }

  return {
    actions: [...actions].sort(),
    entityTypes: [...entityTypes].sort(),
  };
}
