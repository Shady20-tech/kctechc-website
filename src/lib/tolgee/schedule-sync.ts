import "server-only";

import { after } from "next/server";

import { isTolgeeSyncConfigured } from "@/lib/tolgee/server-client";

export type TranslationSyncSchedule =
  | "scheduled"
  | "unconfigured"
  | "unavailable";

/**
 * Drain the translation queue after the action response.
 *
 * Every translatable entity writes its index rows and enqueues sync jobs from a
 * database trigger, so each authoring surface must also ask the worker to drain
 * them. Doing that inline made a save wait on up to N sequential Tolgee calls;
 * `after()` keeps the durable queue and removes that wait. When the runtime has no
 * request scope, the jobs stay queued for the next run.
 */
export function scheduleTranslationSync(limit = 25): TranslationSyncSchedule {
  if (!isTolgeeSyncConfigured()) return "unconfigured";

  try {
    after(async () => {
      try {
        const { runTranslationSync } = await import("@/lib/tolgee/sync-worker");
        await runTranslationSync({ limit });
      } catch (error) {
        console.error("[tolgee] background sync failed", error);
      }
    });
    return "scheduled";
  } catch {
    return "unavailable";
  }
}
