import "server-only";

import type { DepartmentSlug } from "@/lib/config/site";
import type { Locale } from "@/lib/i18n/locales";
import { createClient } from "@/lib/supabase/server";
import {
  findServiceRecord,
  localizeInsight,
  localizeService,
  serviceRecordsFor,
} from "./defaults";
import type {
  AuthorRecord,
  FaqItem,
  InsightRecord,
  LocalizedInsight,
  LocalizedService,
  SeoOverlay,
  ServiceRecord,
} from "./types";

/**
 * Supabase-backed content loading.
 *
 * Every loader follows the same contract, which mirrors `site-content.ts`:
 *
 *   - Read through the anonymous, RLS-bound client. Published rows are the only
 *     ones visible, so "draft content must not be public" is enforced by the
 *     database rather than by a filter this code could forget to apply.
 *   - On any failure — unconfigured, unreachable, empty, malformed — fall back to
 *     the bundled defaults instead of throwing or rendering an empty page.
 *
 * A database outage must never take the site down, and an environment without
 * credentials must still serve a correct Digital Marketing section. That is why
 * the fallback is the bundled content rather than an error state.
 */

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

/** Parse a jsonb column into the FAQ shape, discarding anything malformed. */
function asFaqs(value: unknown): FaqItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const record = entry as Record<string, unknown>;
    const question = asString(record.question);
    const answer = asString(record.answer);
    return question && answer ? [{ question, answer }] : [];
  });
}

/** Parse a jsonb/text column into a string list, discarding non-strings. */
function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => {
      const text = asString(entry);
      return text ? [text] : [];
    });
  }
  // Translations of list fields arrive as JSON text in content_translations.
  if (typeof value === "string") {
    try {
      return asStringList(JSON.parse(value));
    } catch {
      return [];
    }
  }
  return [];
}

type TranslationRow = {
  entity_id: string;
  field_name: string;
  locale: string;
  value: string;
};

/**
 * Group translation rows into per-entity, per-locale overlays.
 *
 * List-valued fields are stored as JSON text, so they are decoded here; a value
 * that will not decode is skipped rather than rendered as raw JSON.
 */
function groupTranslations(
  rows: readonly TranslationRow[],
): Map<string, Partial<Record<Locale, Record<string, unknown>>>> {
  const byEntity = new Map<
    string,
    Partial<Record<Locale, Record<string, unknown>>>
  >();

  for (const row of rows) {
    if (row.locale !== "en" && row.locale !== "fr") continue;
    const locale = row.locale as Locale;
    const fields = (byEntity.get(row.entity_id) ?? {}) as Partial<
      Record<Locale, Record<string, unknown>>
    >;
    const forLocale = fields[locale] ?? {};

    if (row.field_name === "features") {
      const list = asStringList(row.value);
      if (list.length > 0) forLocale.features = list;
    } else if (row.field_name === "faqs") {
      const faqs = asFaqs(JSON.parse(row.value || "[]"));
      if (faqs.length > 0) forLocale.faqs = faqs;
    } else if (row.field_name === "delivery_notes") {
      const text = asString(row.value);
      if (text) forLocale.deliveryNotes = text;
    } else if (
      row.field_name === "title" ||
      row.field_name === "summary" ||
      row.field_name === "description" ||
      row.field_name === "body"
    ) {
      const text = asString(row.value);
      if (text) forLocale[row.field_name] = text;
    }

    fields[locale] = forLocale;
    byEntity.set(row.entity_id, fields);
  }

  return byEntity;
}

function seoFromRow(row: {
  locale: string;
  title: string | null;
  description: string | null;
  canonical_override: string | null;
  og_image_path: string | null;
  noindex: boolean;
}): SeoOverlay {
  return {
    title: asString(row.title),
    description: asString(row.description),
    canonicalOverride: asString(row.canonical_override),
    ogImagePath: asString(row.og_image_path),
    noindex: row.noindex,
  };
}

/**
 * Load the published services for a department, localized.
 *
 * Falls back to bundled content when the database is unconfigured, unreachable
 * or has nothing published yet.
 */
export async function loadServices(
  department: DepartmentSlug,
  locale: Locale,
): Promise<LocalizedService[]> {
  const records = await loadServiceRecords(department);
  return records.map((record) => localizeService(record, locale));
}

export async function loadService(
  department: DepartmentSlug,
  slug: string,
  locale: Locale,
): Promise<LocalizedService | null> {
  const records = await loadServiceRecords(department);
  const record = records.find((entry) => entry.slug === slug);
  return record ? localizeService(record, locale) : null;
}

/** Canonical records for a department: database first, bundled defaults otherwise. */
async function loadServiceRecords(
  department: DepartmentSlug,
): Promise<readonly ServiceRecord[]> {
  const fallback = serviceRecordsFor(department);

  try {
    const supabase = await createClient();
    if (!supabase) return fallback;

    const { data: departmentRow } = await supabase
      .from("departments")
      .select("id")
      .eq("slug", department)
      .maybeSingle();

    if (!departmentRow) return fallback;

    const { data: rows, error } = await supabase
      .from("services")
      .select(
        "id, slug, title, summary, description, features, faqs, delivery_notes, published_at, updated_at",
      )
      .eq("department_id", departmentRow.id)
      .eq("publish_state", "published")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error || !rows || rows.length === 0) return fallback;

    const ids = rows.map((row) => row.id);

    const [{ data: translations }, { data: seoRows }] = await Promise.all([
      supabase
        .from("content_translations")
        .select("entity_id, field_name, locale, value")
        .eq("entity_type", "service")
        .in("entity_id", ids),
      supabase
        .from("entity_seo")
        .select(
          "entity_id, locale, title, description, canonical_override, og_image_path, noindex",
        )
        .eq("entity_type", "service")
        .in("entity_id", ids),
    ]);

    const overlays = groupTranslations(translations ?? []);

    const seoByEntity = new Map<string, Partial<Record<Locale, SeoOverlay>>>();
    for (const row of seoRows ?? []) {
      if (row.locale !== "en" && row.locale !== "fr") continue;
      const locale = row.locale as Locale;
      const forEntity = seoByEntity.get(row.entity_id) ?? {};
      forEntity[locale] = seoFromRow(row);
      seoByEntity.set(row.entity_id, forEntity);
    }

    return rows.map((row) => {
      const translationsForEntity = overlays.get(row.id) ?? {};
      const record: ServiceRecord = {
        slug: row.slug,
        department,
        title: row.title,
        summary: row.summary,
        description: row.description,
        features: asStringList(row.features),
        faqs: asFaqs(row.faqs),
        deliveryNotes: asString(row.delivery_notes),
        translations: translationsForEntity,
        seo: seoByEntity.get(row.id),
        publishedAt: asString(row.published_at),
        updatedAt: asString(row.updated_at),
      };
      return record;
    });
  } catch {
    return fallback;
  }
}

/** Resolve a canonical service by slug, preferring the database. */
export async function loadServiceRecord(
  department: DepartmentSlug,
  slug: string,
): Promise<ServiceRecord | null> {
  const records = await loadServiceRecords(department);
  return (
    records.find((entry) => entry.slug === slug) ??
    findServiceRecord(department, slug) ??
    null
  );
}

/** True when a department has at least one published service to show. */
export async function departmentHasPublishedServices(
  department: DepartmentSlug,
): Promise<boolean> {
  const records = await loadServiceRecords(department);
  return records.length > 0;
}

/**
 * Load published insights, localized and newest first.
 *
 * Returns an empty list rather than falling back to samples: there are no
 * articles in the business brief, and inventing them would put fabricated
 * content on a production path. The surface renders its empty state instead.
 */
export async function loadInsights(
  locale: Locale,
  options: { department?: DepartmentSlug; limit?: number } = {},
): Promise<LocalizedInsight[]> {
  const records = await loadInsightRecords(options);
  return records.map((record) => localizeInsight(record, locale));
}

export async function loadInsight(
  slug: string,
  locale: Locale,
): Promise<LocalizedInsight | null> {
  const records = await loadInsightRecords({});
  const record = records.find((entry) => entry.slug === slug);
  return record ? localizeInsight(record, locale) : null;
}

async function loadInsightRecords(options: {
  department?: DepartmentSlug;
  limit?: number;
}): Promise<readonly InsightRecord[]> {
  try {
    const supabase = await createClient();
    if (!supabase) return [];

    let departmentId: string | null = null;
    if (options.department) {
      const { data } = await supabase
        .from("departments")
        .select("id")
        .eq("slug", options.department)
        .maybeSingle();
      if (!data) return [];
      departmentId = data.id;
    }

    let query = supabase
      .from("insights")
      .select(
        "id, slug, title, summary, body, cover_image_path, related_service_slugs, is_featured, published_at, updated_at, department_id, category_id, author_id",
      )
      .eq("publish_state", "published")
      .order("published_at", { ascending: false });

    if (departmentId) query = query.eq("department_id", departmentId);
    if (options.limit) query = query.limit(options.limit);

    const { data: rows, error } = await query;
    if (error || !rows || rows.length === 0) return [];

    const ids = rows.map((row) => row.id);
    const categoryIds = rows
      .map((row) => row.category_id)
      .filter((id): id is string => typeof id === "string");
    const authorIds = rows
      .map((row) => row.author_id)
      .filter((id): id is string => typeof id === "string");

    const [{ data: translations }, { data: categories }, { data: authors }] =
      await Promise.all([
        supabase
          .from("content_translations")
          .select("entity_id, field_name, locale, value")
          .eq("entity_type", "insight")
          .in("entity_id", ids),
        categoryIds.length > 0
          ? supabase
              .from("insight_categories")
              .select("id, slug")
              .in("id", categoryIds)
          : Promise.resolve({ data: [] as { id: string; slug: string }[] }),
        authorIds.length > 0
          ? supabase.from("authors").select("id, slug").in("id", authorIds)
          : Promise.resolve({ data: [] as { id: string; slug: string }[] }),
      ]);

    const overlays = groupTranslations(translations ?? []);
    const categorySlugById = new Map(
      (categories ?? []).map((row) => [row.id, row.slug]),
    );
    const authorSlugById = new Map(
      (authors ?? []).map((row) => [row.id, row.slug]),
    );

    return rows.map((row) => ({
      slug: row.slug,
      department: options.department,
      categorySlug: row.category_id
        ? categorySlugById.get(row.category_id)
        : undefined,
      authorSlug: row.author_id ? authorSlugById.get(row.author_id) : undefined,
      title: row.title,
      summary: row.summary,
      body: row.body,
      coverImagePath: asString(row.cover_image_path),
      relatedServiceSlugs: row.related_service_slugs ?? [],
      isFeatured: row.is_featured,
      translations: overlays.get(row.id) ?? {},
      publishedAt: row.published_at ?? "",
      updatedAt: asString(row.updated_at),
    }));
  } catch {
    return [];
  }
}

/** Load a published author by slug, for the article byline. */
export async function loadAuthor(slug: string): Promise<AuthorRecord | null> {
  try {
    const supabase = await createClient();
    if (!supabase) return null;
    const { data } = await supabase
      .from("authors")
      .select("slug, display_name, role_title, bio")
      .eq("slug", slug)
      .maybeSingle();
    if (!data) return null;
    return {
      slug: data.slug,
      displayName: data.display_name,
      roleTitle: asString(data.role_title),
      bio: asString(data.bio),
    };
  } catch {
    return null;
  }
}
