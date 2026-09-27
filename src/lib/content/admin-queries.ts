import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/db/database.types";

type PublishState = Database["public"]["Enums"]["publish_state"];

/**
 * Admin reads for insights (the blog).
 *
 * Writes go through Server Actions in `admin-actions.ts`; these reads use the
 * cookie-bound client so the `is_admin()` policy on `insights` is the boundary,
 * exactly as the public loader relies on its own policy for published rows. The
 * admin list deliberately sees the drafts the public list cannot.
 */

export type AdminInsightRow = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  publishState: PublishState;
  isFeatured: boolean;
  coverImagePath: string | null;
  categoryName: string | null;
  departmentName: string | null;
  authorName: string | null;
  publishedAt: string | null;
  updatedAt: string;
};

const INSIGHT_SELECT =
  "id, slug, title, summary, publish_state, is_featured, cover_image_path, published_at, updated_at, insight_categories(name), departments(name), authors(display_name)";

type InsightJoinRow = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  publish_state: PublishState;
  is_featured: boolean;
  cover_image_path: string | null;
  published_at: string | null;
  updated_at: string;
  insight_categories: { name: string } | null;
  departments: { name: string } | null;
  authors: { display_name: string } | null;
};

function mapInsight(row: InsightJoinRow): AdminInsightRow {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    publishState: row.publish_state,
    isFeatured: row.is_featured,
    coverImagePath: row.cover_image_path,
    categoryName: row.insight_categories?.name ?? null,
    departmentName: row.departments?.name ?? null,
    authorName: row.authors?.display_name ?? null,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
  };
}

export async function listAdminInsights(): Promise<AdminInsightRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("insights")
    .select(INSIGHT_SELECT)
    .order("updated_at", { ascending: false })
    .limit(200);
  return ((data ?? []) as unknown as InsightJoinRow[]).map(mapInsight);
}

export type AdminInsightDetail = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  publishState: PublishState;
  isFeatured: boolean;
  coverImagePath: string | null;
  categoryId: string | null;
  departmentId: string | null;
  authorId: string | null;
  relatedServiceSlugs: string[];
  publishedAt: string | null;
};

export async function getAdminInsight(id: string): Promise<AdminInsightDetail | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("insights")
    .select(
      "id, slug, title, summary, body, publish_state, is_featured, cover_image_path, category_id, department_id, author_id, related_service_slugs, published_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    slug: data.slug,
    title: data.title,
    summary: data.summary,
    body: data.body,
    publishState: data.publish_state,
    isFeatured: data.is_featured,
    coverImagePath: data.cover_image_path,
    categoryId: data.category_id,
    departmentId: data.department_id,
    authorId: data.author_id,
    relatedServiceSlugs: data.related_service_slugs ?? [],
    publishedAt: data.published_at,
  };
}

export type Option = { id: string; label: string };

export async function loadContentOptions(): Promise<{
  categories: Option[];
  departments: Option[];
  authors: Option[];
}> {
  const supabase = await createClient();
  if (!supabase) return { categories: [], departments: [], authors: [] };

  const [categories, departments, authors] = await Promise.all([
    supabase
      .from("insight_categories")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("departments")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("authors")
      .select("id, display_name")
      .eq("is_active", true)
      .order("display_name", { ascending: true }),
  ]);

  return {
    categories: (categories.data ?? []).map((row) => ({ id: row.id, label: row.name })),
    departments: (departments.data ?? []).map((row) => ({ id: row.id, label: row.name })),
    authors: (authors.data ?? []).map((row) => ({ id: row.id, label: row.display_name })),
  };
}
