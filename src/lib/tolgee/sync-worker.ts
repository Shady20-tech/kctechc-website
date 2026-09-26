import "server-only";

import type { Database } from "@/lib/db/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { isTolgeeSyncConfigured, pushTranslation } from "@/lib/tolgee/server-client";

/**
 * Tolgee synchronisation worker.
 *
 * Drains the durable `translation_sync_jobs` queue. The queue exists so an admin
 * saving a product never waits on a remote HTTP call: the write completes, the
 * trigger enqueues work, and this worker does the talking. A Tolgee outage then
 * produces a recorded, retryable failure instead of a failed product save.
 *
 * Everything here is idempotent. `pushTranslation` upserts by key, and a job that
 * is re-run after a partial failure updates the same key rather than creating a
 * second one.
 */

type SyncJob = Database["public"]["Tables"]["translation_sync_jobs"]["Row"];

export type SyncRunResult = {
  /** False when Tolgee is unconfigured; the queue is left untouched. */
  ran: boolean;
  claimed: number;
  succeeded: number;
  failed: number;
  /** Failures that will not be retried, with their reason. */
  permanentFailures: { key: string; error: string }[];
  reason?: string;
};

type JobPayload = {
  key?: string;
  entityType?: string;
  entityId?: string;
  field?: string;
  sourceLocale?: string;
  targetLocales?: string[];
};

/**
 * Read the source value and any existing target value for an entry.
 *
 * The English value is the source of truth; a French value is only pushed when it
 * has actually been translated. Pushing an empty French string would overwrite a
 * translator's work in Tolgee with nothing, so an untranslated target is sent as
 * the source text marked for review rather than as a blank.
 */
async function loadEntryValues(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  entityType: string,
  entityId: string,
  field: string,
  targetLocales: readonly string[],
): Promise<{
  source: string | null;
  targets: Record<string, { value: string; translated: boolean }>;
}> {
  const { data } = await supabase
    .from("content_translations")
    .select("locale, value, state")
    .eq("entity_type", entityType as never)
    .eq("entity_id", entityId)
    .eq("field_name", field);

  const rows = data ?? [];
  const sourceRow = rows.find((row) => row.locale === "en");

  const targets: Record<string, { value: string; translated: boolean }> = {};
  for (const locale of targetLocales) {
    const row = rows.find((entry) => entry.locale === locale);
    targets[locale] = {
      value: row?.value ?? "",
      // `outdated` is deliberately not "translated": the value exists but the
      // source has moved on, so it must not be presented as current.
      translated: row?.state === "translated" || row?.state === "reviewed",
    };
  }

  return { source: sourceRow?.value ?? null, targets };
}

/**
 * Build the translations payload for one key.
 *
 * A target locale with a real translation is pushed as-is. A target with no
 * translation is pushed as the source value: Tolgee holds the key in every
 * configured language, and seeding the French entry with the English text is what
 * gives a translator something to edit and makes the missing translation visible
 * in Tolgee's "untranslated" filter. The database's `content_translations.state`
 * remains the authoritative record that the French is not done.
 */
function buildTranslations(
  source: string,
  targets: Record<string, { value: string; translated: boolean }>,
): Record<string, string> {
  const translations: Record<string, string> = { en: source };
  for (const [locale, target] of Object.entries(targets)) {
    translations[locale] =
      target.translated && target.value.trim().length > 0
        ? target.value
        : source;
  }
  return translations;
}

/**
 * Drain the queue once.
 *
 * Claims a batch atomically, pushes each key, then records success or failure.
 * Each job is independent: one permanent failure does not stop the rest of the
 * batch, because a single malformed entry must not block every other product's
 * translations.
 */
export async function runTranslationSync(options: {
  limit?: number;
} = {}): Promise<SyncRunResult> {
  if (!isTolgeeSyncConfigured()) {
    return {
      ran: false,
      claimed: 0,
      succeeded: 0,
      failed: 0,
      permanentFailures: [],
      reason: "Tolgee is not configured",
    };
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return {
      ran: false,
      claimed: 0,
      succeeded: 0,
      failed: 0,
      permanentFailures: [],
      reason: "Supabase service role is not configured",
    };
  }

  const { data: jobs, error } = await supabase.rpc("claim_translation_sync_jobs", {
    p_limit: options.limit ?? 20,
  });

  if (error || !jobs) {
    return {
      ran: false,
      claimed: 0,
      succeeded: 0,
      failed: 0,
      permanentFailures: [],
      reason: error?.message ?? "No jobs claimed",
    };
  }

  let succeeded = 0;
  let failed = 0;
  const permanentFailures: { key: string; error: string }[] = [];

  for (const job of jobs as SyncJob[]) {
    const payload = (job.payload ?? {}) as JobPayload;
    const key = payload.key;
    const entityType = payload.entityType;
    const entityId = payload.entityId;
    const field = payload.field;
    const targetLocales = payload.targetLocales ?? [];

    if (!key || !entityType || !entityId || !field) {
      // A malformed payload cannot be retried into correctness.
      await supabase.rpc("fail_translation_sync_job", {
        p_job_id: job.id,
        p_error: "Malformed job payload: missing key, entity or field",
      });
      failed += 1;
      permanentFailures.push({ key: key ?? job.id, error: "malformed payload" });
      continue;
    }

    const { source, targets } = await loadEntryValues(
      supabase,
      entityType,
      entityId,
      field,
      targetLocales,
    );

    if (source === null || source.trim().length === 0) {
      // Nothing to translate. The entry is not an error — the source field is
      // simply empty — so it is marked synced with nothing to push rather than
      // retried forever.
      await supabase.rpc("complete_translation_sync_job", {
        p_job_id: job.id,
      });
      succeeded += 1;
      continue;
    }

    const result = await pushTranslation({
      key,
      translations: buildTranslations(source, targets),
      description: `KC Technology Corporation — ${entityType} ${field}`,
    });

    if (result.ok) {
      await supabase.rpc("complete_translation_sync_job", {
        p_job_id: job.id,
        p_tolgee_key_id: result.data.id ? String(result.data.id) : undefined,
      });
      succeeded += 1;
      continue;
    }

    await supabase.rpc("fail_translation_sync_job", {
      p_job_id: job.id,
      p_error: result.error,
    });
    failed += 1;
    if (!result.retryable) {
      permanentFailures.push({ key, error: result.error });
    }
  }

  return {
    ran: true,
    claimed: jobs.length,
    succeeded,
    failed,
    permanentFailures,
  };
}
