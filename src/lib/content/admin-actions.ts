"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuthState } from "@/lib/auth/session";
import { isContentManagerRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAudit } from "@/lib/security/audit";
import { CONTENT_MEDIA_BUCKET } from "@/lib/uploads/media";
import { buildObjectPath, validateUpload } from "@/lib/uploads/validation";

/**
 * Insight (blog article) authoring.
 *
 * Unlike the store and property surfaces, which predate the console and use the
 * service-role client directly, this module does the row write through the
 * cookie-bound client so the `is_admin()` policy on `insights` governs it. The
 * service-role client is used only for the Storage upload, because the media
 * buckets deliberately have no browser-insert policy — a file may only reach them
 * through an authorized Server Action.
 *
 * Publishing has a database rule (`insights_published_requires_author_and_date`)
 * requiring an author and a date; the action sets `published_at` at the moment of
 * publication and refuses to publish without an author, so the editor sees the
 * constraint's meaning as a message instead of a raw check violation.
 */

export type ContentState =
  | { ok: true; id: string; message: string }
  | { ok: false; error: string; fields?: Record<string, string> };

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const insightSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(160)
    .regex(slugPattern, "Use lowercase words separated by hyphens."),
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(1).max(320),
  body: z.string().trim().min(1).max(60_000),
  categoryId: z.string().uuid().nullable(),
  departmentId: z.string().uuid().nullable(),
  authorId: z.string().uuid().nullable(),
  isFeatured: z.boolean(),
  publishState: z.enum(["draft", "published", "archived"]),
});

function uuidOrNull(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in out)) out[key] = issue.message;
  }
  return out;
}

async function requireElevated(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const auth = await getAuthState();
  if (auth.status !== "authenticated" || !auth.profile) {
    return { ok: false, error: "unauthenticated" };
  }
  if (!isContentManagerRole(auth.profile.role)) return { ok: false, error: "forbidden" };
  return { ok: true, userId: auth.profile.id };
}

export async function createInsightAction(formData: FormData): Promise<ContentState> {
  const gate = await requireElevated();
  if (!gate.ok) return { ok: false, error: gate.error };

  const parsed = insightSchema.safeParse({
    slug: formData.get("slug"),
    title: formData.get("title"),
    summary: formData.get("summary"),
    body: formData.get("body"),
    categoryId: uuidOrNull(formData.get("categoryId")),
    departmentId: uuidOrNull(formData.get("departmentId")),
    authorId: uuidOrNull(formData.get("authorId")),
    isFeatured: formData.get("isFeatured") === "on",
    publishState: String(formData.get("publishState") ?? "draft"),
  });

  if (!parsed.success) {
    return { ok: false, error: "invalid", fields: fieldErrors(parsed.error) };
  }
  const input = parsed.data;

  if (input.publishState === "published" && !input.authorId) {
    return { ok: false, error: "need_author", fields: { authorId: "Required to publish." } };
  }

  const supabase = await createClientOrAdmin();
  if (!supabase) return { ok: false, error: "unconfigured" };

  const { data, error } = await supabase
    .from("insights")
    .insert({
      slug: input.slug,
      title: input.title,
      summary: input.summary,
      body: input.body,
      category_id: input.categoryId,
      department_id: input.departmentId,
      author_id: input.authorId,
      is_featured: input.isFeatured,
      publish_state: input.publishState,
      published_at: input.publishState === "published" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error || !data) {
    if ((error?.message ?? "").includes("slug")) {
      return { ok: false, error: "duplicate", fields: { slug: "That slug is taken." } };
    }
    return { ok: false, error: "write_failed" };
  }

  await recordAudit({
    actorId: gate.userId,
    action: "content_created",
    entityType: "insight",
    entityId: data.id,
    metadata: { slug: input.slug, publish_state: input.publishState },
  });

  revalidatePath("/admin/content");
  return { ok: true, id: data.id, message: "created" };
}

export async function updateInsightAction(formData: FormData): Promise<ContentState> {
  const gate = await requireElevated();
  if (!gate.ok) return { ok: false, error: gate.error };

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "not_found" };

  const parsed = insightSchema.safeParse({
    slug: formData.get("slug"),
    title: formData.get("title"),
    summary: formData.get("summary"),
    body: formData.get("body"),
    categoryId: uuidOrNull(formData.get("categoryId")),
    departmentId: uuidOrNull(formData.get("departmentId")),
    authorId: uuidOrNull(formData.get("authorId")),
    isFeatured: formData.get("isFeatured") === "on",
    publishState: String(formData.get("publishState") ?? "draft"),
  });
  if (!parsed.success) {
    return { ok: false, error: "invalid", fields: fieldErrors(parsed.error) };
  }
  const input = parsed.data;
  if (input.publishState === "published" && !input.authorId) {
    return { ok: false, error: "need_author", fields: { authorId: "Required to publish." } };
  }

  const supabase = await createClientOrAdmin();
  if (!supabase) return { ok: false, error: "unconfigured" };

  // Read the current publish state so `published_at` is set once, on the
  // draft→published transition, and kept on later edits. Rewriting it on every
  // save would move an article's date every time a typo was fixed.
  const { data: current } = await supabase
    .from("insights")
    .select("publish_state, published_at")
    .eq("id", id)
    .maybeSingle();
  if (!current) return { ok: false, error: "not_found" };

  const publishedAt =
    input.publishState === "published"
      ? (current.published_at ?? new Date().toISOString())
      : null;

  const { error } = await supabase
    .from("insights")
    .update({
      slug: input.slug,
      title: input.title,
      summary: input.summary,
      body: input.body,
      category_id: input.categoryId,
      department_id: input.departmentId,
      author_id: input.authorId,
      is_featured: input.isFeatured,
      publish_state: input.publishState,
      published_at: publishedAt,
    })
    .eq("id", id);

  if (error) {
    if ((error.message ?? "").includes("slug")) {
      return { ok: false, error: "duplicate", fields: { slug: "That slug is taken." } };
    }
    return { ok: false, error: "write_failed" };
  }

  await recordAudit({
    actorId: gate.userId,
    action: input.publishState === "published" ? "content_published" : "content_updated",
    entityType: "insight",
    entityId: id,
    metadata: { slug: input.slug, publish_state: input.publishState },
  });

  revalidatePath("/admin/content");
  revalidatePath(`/admin/content/${id}`);
  return { ok: true, id, message: "updated" };
}

export async function uploadInsightCoverAction(formData: FormData): Promise<ContentState> {
  const gate = await requireElevated();
  if (!gate.ok) return { ok: false, error: gate.error };

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "not_found" };

  const file = formData.get("cover");
  if (!(file instanceof File)) return { ok: false, error: "no_file" };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const verdict = validateUpload(bytes, file.type, { kind: "content-image" });
  if (!verdict.ok) return { ok: false, error: verdict.reason };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "unconfigured" };

  const objectPath = buildObjectPath(id, verdict.extension);
  const { error: uploadError } = await admin.storage
    .from(CONTENT_MEDIA_BUCKET)
    .upload(objectPath, bytes, { contentType: verdict.mime, upsert: false });
  if (uploadError) return { ok: false, error: "upload_failed" };

  const { data: current } = await admin
    .from("insights")
    .select("cover_image_path")
    .eq("id", id)
    .maybeSingle();

  const supabase = await createClientOrAdmin();
  const { error: updateError } = await (supabase ?? admin)
    .from("insights")
    .update({ cover_image_path: objectPath })
    .eq("id", id);

  if (updateError) {
    await admin.storage.from(CONTENT_MEDIA_BUCKET).remove([objectPath]);
    return { ok: false, error: "update_failed" };
  }

  const previous = current?.cover_image_path;
  if (previous && previous !== objectPath) {
    await admin.storage.from(CONTENT_MEDIA_BUCKET).remove([previous]);
  }

  await recordAudit({
    actorId: gate.userId,
    action: "content_updated",
    entityType: "insight",
    entityId: id,
    metadata: { field: "cover_image" },
  });

  revalidatePath("/admin/content");
  revalidatePath(`/admin/content/${id}`);
  return { ok: true, id, message: "cover_updated" };
}

/**
 * The cookie-bound client when configured, otherwise the service-role client.
 *
 * The cookie client is preferred because its RLS policies are the control; the
 * fallback exists so the action still works in an environment where the anon key
 * is absent but a service-role key is present, which is the shape a server-only
 * deployment can take.
 */
async function createClientOrAdmin() {
  const { createClient } = await import("@/lib/supabase/server");
  const cookie = await createClient();
  if (cookie) return cookie;
  return createAdminClient();
}

