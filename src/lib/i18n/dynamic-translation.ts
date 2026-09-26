import type { Locale } from "@/lib/i18n/locales";

/**
 * Dynamic-content localization contracts.
 *
 * Canonical content lives in Supabase; localized values live in translation
 * tables so the site keeps working when Tolgee is unavailable. Later phases
 * implement the concrete sync flows for products, services, properties and
 * insights against these contracts.
 */

/** Entity types that participate in dynamic translation. */
export const TRANSLATABLE_ENTITY_TYPES = [
  "department",
  "service",
  "product",
  "category",
  "electrical_project",
  "property_listing",
  "insight",
  "site_setting",
] as const;

export type TranslatableEntityType = (typeof TRANSLATABLE_ENTITY_TYPES)[number];

/**
 * Lifecycle of a single field translation. `outdated` is set when the source
 * field changed after the translation was written; existing translations are
 * never destroyed by that change.
 */
export const TRANSLATION_STATES = [
  "missing",
  "pending",
  "in_progress",
  "translated",
  "reviewed",
  "outdated",
] as const;

export type TranslationState = (typeof TRANSLATION_STATES)[number];

/** Durable synchronization state for the Tolgee job queue. */
export const SYNC_STATES = [
  "not_required",
  "queued",
  "syncing",
  "synced",
  "failed",
] as const;

export type SyncState = (typeof SYNC_STATES)[number];

/** A row of the `translation_entries` index. */
export type TranslationEntry = {
  id: string;
  translationKey: string;
  entityType: TranslatableEntityType;
  entityId: string;
  fieldName: string;
  sourceLocale: Locale;
  targetLocales: Locale[];
  state: TranslationState;
  syncState: SyncState;
  tolgeeKeyId: string | null;
  lastSyncedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

/** A localized field value stored alongside its canonical source. */
export type LocalizedFieldValue = {
  entityType: TranslatableEntityType;
  entityId: string;
  fieldName: string;
  locale: Locale;
  value: string;
  state: TranslationState;
  sourceUpdatedAt: string | null;
  translatedAt: string | null;
};

/** Payload describing one field that needs an entry in the index. */
export type TranslationEntryDraft = {
  entityType: TranslatableEntityType;
  entityId: string;
  fieldName: string;
  sourceLocale: Locale;
  targetLocales: readonly Locale[];
};

/**
 * Deterministic translation key: `<entityType>.<entityId>.<field>`.
 * Determinism matters because the sync job is idempotent — re-running it must
 * resolve to the same Tolgee key rather than creating duplicates.
 */
export function buildTranslationKey(draft: {
  entityType: TranslatableEntityType;
  entityId: string;
  fieldName: string;
}): string {
  return `${draft.entityType}.${draft.entityId}.${draft.fieldName}`;
}

/**
 * Create index rows for a newly published entity.
 *
 * Non-source locales start `pending`, so publishing never requires an admin to
 * hand-create translation keys.
 */
export function buildTranslationEntries(
  drafts: readonly TranslationEntryDraft[],
  now: string = new Date().toISOString(),
): TranslationEntry[] {
  return drafts.flatMap((draft) =>
    draft.targetLocales
      .filter((locale) => locale !== draft.sourceLocale)
      .map((targetLocale) => {
        const key = `${buildTranslationKey(draft)}.${targetLocale}`;
        return {
          id: key,
          translationKey: key,
          entityType: draft.entityType,
          entityId: draft.entityId,
          fieldName: draft.fieldName,
          sourceLocale: draft.sourceLocale,
          targetLocales: [targetLocale],
          state: "pending" as const,
          syncState: "queued" as const,
          tolgeeKeyId: null,
          lastSyncedAt: null,
          errorMessage: null,
          createdAt: now,
          updatedAt: now,
        };
      }),
  );
}

/**
 * Mark downstream translations outdated after a source edit. Never deletes the
 * translated value; the previous translation remains until replaced.
 */
export function markOutdatedAfterSourceChange(
  currentState: TranslationState,
): TranslationState {
  return currentState === "missing" ? "missing" : "outdated";
}

/**
 * Decide which value to serve. Falls back to the source locale when the
 * requested translation is missing, so a page never renders an empty string for
 * real content.
 */
export function resolveLocalizedValue(
  requested: { locale: Locale; value: string | null; state: TranslationState },
  source: { locale: Locale; value: string },
): { locale: Locale; value: string; isFallback: boolean } {
  if (
    requested.value !== null &&
    requested.value.trim().length > 0 &&
    requested.state !== "missing"
  ) {
    return {
      locale: requested.locale,
      value: requested.value,
      isFallback: false,
    };
  }
  return { locale: source.locale, value: source.value, isFallback: true };
}
