"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getAuthState } from "@/lib/auth/session";
import {
  canAccessDepartment,
  isDepartmentEditorRole,
  type AppRole,
} from "@/lib/auth/roles";
import {
  createAdminClient,
  missingAdminClientDetail,
} from "@/lib/supabase/admin";
import { describeSupabaseError } from "@/lib/supabase/errors";
import { recordAudit } from "@/lib/security/audit";
import { CONTENT_MEDIA_BUCKET } from "@/lib/uploads/media";
import { buildObjectPath, validateUpload } from "@/lib/uploads/validation";
import { INSIGHTS_PATH } from "@/lib/config/navigation";
import { LOCALES } from "@/lib/i18n/locales";

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
  | {
      ok: false;
      error: string;
      fields?: Record<string, string>;
      detail?: string;
    };

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

/**
 * The authoring gate.
 *
 * Posting is open to the department editor roles — a department's staff and
 * admins, plus the cross-department roles — rather than only `ELEVATED_ROLES`.
 * The person who did the work is often the best placed to write about it, which
 * is the same reasoning behind the completed-work surface.
 *
 * The department boundary is the control, and it is enforced twice: here, so the
 * editor gets a message rather than a raw policy violation, and by the RLS policy
 * from `20260101000049_insight_media_and_department_authoring.sql`, which is what
 * actually refuses a cross-department write.
 */
async function requireAuthor(): Promise<
  { ok: true; userId: string; role: AppRole } | { ok: false; error: string }
> {
  const auth = await getAuthState();
  if (auth.status !== "authenticated" || !auth.profile) {
    return { ok: false, error: "unauthenticated" };
  }
  if (!isDepartmentEditorRole(auth.profile.role)) {
    return { ok: false, error: "forbidden" };
  }
  return { ok: true, userId: auth.profile.id, role: auth.profile.role };
}

/**
 * Whether `role` may author an article for `departmentId`.
 *
 * A department editor is confined to their own department. A cross-department
 * role may also leave the department unset, because a corporate announcement
 * belongs to no single department — and a department editor may not, because an
 * unset department is not one they can be shown to own.
 *
 * A failed read is returned as a failure, not as "not allowed": the old boolean
 * turned a missing admin key or a database error into `forbidden_department`,
 * which told the editor the wrong thing.
 */
type DepartmentAuthorisation =
  | { ok: true; allowed: boolean }
  | { ok: false; detail: string };

function authorisationFailure(
  check: DepartmentAuthorisation,
  forbiddenError = "forbidden",
): { ok: false; error: string; detail?: string } | null {
  if (!check.ok) {
    return { ok: false, error: "unconfigured", detail: check.detail };
  }
  if (!check.allowed) {
    return { ok: false, error: forbiddenError };
  }
  return null;
}

async function canAuthorForDepartment(
  role: AppRole,
  departmentId: string | null,
): Promise<DepartmentAuthorisation> {
  if (!departmentId) {
    return {
      ok: true,
      allowed: role === "super_admin" || role === "department_staff",
    };
  }

  const admin = createAdminClient();
  if (!admin) {
    return { ok: false, detail: missingAdminClientDetail() };
  }

  const { data, error } = await admin
    .from("departments")
    .select("slug")
    .eq("id", departmentId)
    .maybeSingle();
  if (error) {
    return { ok: false, detail: describeSupabaseError(error) };
  }

  return {
    ok: true,
    allowed: Boolean(data && canAccessDepartment(role, data.slug)),
  };
}

export async function createInsightAction(
  formData: FormData,
): Promise<ContentState> {
  const gate = await requireAuthor();
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
    return {
      ok: false,
      error: "need_author",
      fields: { authorId: "Required to publish." },
    };
  }

  const departmentCheck = await canAuthorForDepartment(
    gate.role,
    input.departmentId,
  );
  if (!departmentCheck.ok) {
    return { ok: false, error: "unconfigured", detail: departmentCheck.detail };
  }
  if (!departmentCheck.allowed) {
    return {
      ok: false,
      error: "forbidden_department",
      fields: { departmentId: "You cannot post for that department." },
    };
  }

  const supabase = await createClientOrAdmin();
  if (!supabase)
    return {
      ok: false,
      error: "unconfigured",
      detail: missingAdminClientDetail(),
    };

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
      published_at:
        input.publishState === "published" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error || !data) {
    if ((error?.message ?? "").includes("slug")) {
      return {
        ok: false,
        error: "duplicate",
        fields: { slug: "That slug is taken." },
      };
    }
    return {
      ok: false,
      error: "write_failed",
      detail: describeSupabaseError(error),
    };
  }

  await recordAudit({
    actorId: gate.userId,
    action: "content_created",
    entityType: "insight",
    entityId: data.id,
    metadata: { slug: input.slug, publish_state: input.publishState },
  });

  revalidatePath("/admin/content");
  // A new article is a new sitemap entry with a new `lastmod`.
  revalidatePath("/sitemap.xml");
  return { ok: true, id: data.id, message: "created" };
}

export async function updateInsightAction(
  formData: FormData,
): Promise<ContentState> {
  const gate = await requireAuthor();
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
    return {
      ok: false,
      error: "need_author",
      fields: { authorId: "Required to publish." },
    };
  }

  // The target department and the new department are both checked: an editor
  // must be allowed to touch the article as it stands *and* to move it to where
  // the form says. Checking only the new value would let an editor reassign
  // another department's article to their own.
  const departmentCheck = await canAuthorForDepartment(
    gate.role,
    input.departmentId,
  );
  if (!departmentCheck.ok) {
    return { ok: false, error: "unconfigured", detail: departmentCheck.detail };
  }
  if (!departmentCheck.allowed) {
    return {
      ok: false,
      error: "forbidden_department",
      fields: { departmentId: "You cannot post for that department." },
    };
  }

  const supabase = await createClientOrAdmin();
  if (!supabase)
    return {
      ok: false,
      error: "unconfigured",
      detail: missingAdminClientDetail(),
    };

  // Read the current publish state so `published_at` is set once, on the
  // draft→published transition, and kept on later edits. Rewriting it on every
  // save would move an article's date every time a typo was fixed.
  //
  // The current department is read in the same query so the pre-existing
  // ownership can be checked before the row is moved.
  const { data: current } = await supabase
    .from("insights")
    .select("publish_state, published_at, department_id")
    .eq("id", id)
    .maybeSingle();
  if (!current) return { ok: false, error: "not_found" };

  const currentCheck = await canAuthorForDepartment(
    gate.role,
    current.department_id,
  );
  const currentFailure = authorisationFailure(
    currentCheck,
    "forbidden_department",
  );
  if (currentFailure) return currentFailure;

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
      return {
        ok: false,
        error: "duplicate",
        fields: { slug: "That slug is taken." },
      };
    }
    return {
      ok: false,
      error: "write_failed",
      detail: describeSupabaseError(error),
    };
  }

  await recordAudit({
    actorId: gate.userId,
    action:
      input.publishState === "published"
        ? "content_published"
        : "content_updated",
    entityType: "insight",
    entityId: id,
    metadata: { slug: input.slug, publish_state: input.publishState },
  });

  revalidatePath("/admin/content");
  revalidatePath(`/admin/content/${id}`);
  // Editing or publishing an article moves its `lastmod`; so does unpublishing,
  // which removes the entry.
  revalidatePath("/sitemap.xml");
  return { ok: true, id, message: "updated" };
}

export async function uploadInsightCoverAction(
  formData: FormData,
): Promise<ContentState> {
  const gate = await requireAuthor();
  if (!gate.ok) return { ok: false, error: gate.error };

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "not_found" };

  const file = formData.get("cover");
  if (!(file instanceof File)) return { ok: false, error: "no_file" };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const verdict = validateUpload(bytes, file.type, { kind: "content-image" });
  if (!verdict.ok) return { ok: false, error: verdict.reason };

  const admin = createAdminClient();
  if (!admin)
    return {
      ok: false,
      error: "unconfigured",
      detail: missingAdminClientDetail(),
    };

  // The article's department decides whether the caller may touch it. Read with
  // the service-role client so the check is explicit rather than relying on a
  // read that RLS might already have narrowed.
  const { data: owned } = await admin
    .from("insights")
    .select("department_id, cover_image_path, slug")
    .eq("id", id)
    .maybeSingle();
  if (!owned) return { ok: false, error: "not_found" };
  const ownedCheck = await canAuthorForDepartment(
    gate.role,
    owned.department_id,
  );
  const ownedFailure = authorisationFailure(ownedCheck);
  if (ownedFailure) return ownedFailure;

  const objectPath = buildObjectPath(id, verdict.extension);
  const { error: uploadError } = await admin.storage
    .from(CONTENT_MEDIA_BUCKET)
    .upload(objectPath, bytes, { contentType: verdict.mime, upsert: false });
  if (uploadError)
    return {
      ok: false,
      error: "upload_failed",
      detail: describeSupabaseError(uploadError),
    };

  const supabase = await createClientOrAdmin();
  const { error: updateError } = await (supabase ?? admin)
    .from("insights")
    .update({ cover_image_path: objectPath })
    .eq("id", id);

  if (updateError) {
    await admin.storage.from(CONTENT_MEDIA_BUCKET).remove([objectPath]);
    return { ok: false, error: "update_failed" };
  }

  const previous = owned.cover_image_path;
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
  // The cover is the article's public hero and its card thumbnail, so the public
  // pages must be revalidated too. Without this the console shows the new image
  // while the article keeps serving the old one — the pages are prerendered and
  // nothing else invalidates them.
  for (const locale of LOCALES) {
    revalidatePath(`/${locale}${INSIGHTS_PATH}/${owned.slug}`);
    revalidatePath(`/${locale}${INSIGHTS_PATH}`);
  }
  return { ok: true, id, message: "cover_updated" };
}

/**
 * Attach a photograph to an article's gallery.
 *
 * The image is validated by its leading bytes rather than its declared type — the
 * same rule every other upload path follows — and the object path is built from
 * the article id and a content-derived extension, so nothing depends on the
 * filename the browser supplied.
 *
 * The row is written through the cookie-bound client so the `insight_media`
 * policy is the control; the object itself goes through the service-role client
 * because the media buckets deliberately have no browser-insert policy.
 */
export async function uploadInsightImageAction(
  formData: FormData,
): Promise<ContentState> {
  const gate = await requireAuthor();
  if (!gate.ok) return { ok: false, error: gate.error };

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, error: "not_found" };

  const altText = String(formData.get("altText") ?? "").trim();
  if (altText.length === 0) return { ok: false, error: "alt_required" };

  const files = formData
    .getAll("image")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (files.length === 0) return { ok: false, error: "no_file" };

  const admin = createAdminClient();
  if (!admin)
    return {
      ok: false,
      error: "unconfigured",
      detail: missingAdminClientDetail(),
    };

  const { data: article } = await admin
    .from("insights")
    .select("department_id")
    .eq("id", id)
    .maybeSingle();
  if (!article) return { ok: false, error: "not_found" };
  const articleCheck = await canAuthorForDepartment(
    gate.role,
    article.department_id,
  );
  const articleFailure = authorisationFailure(articleCheck);
  if (articleFailure) return articleFailure;

  // Position continues from the current maximum so a later image does not take
  // the first slot from an earlier one.
  const { data: last } = await admin
    .from("insight_media")
    .select("position")
    .eq("insight_id", id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const supabase = await createClientOrAdmin();
  const writer = supabase ?? admin;
  const caption = optionalText(formData.get("caption"));
  const credit = optionalText(formData.get("credit"));

  let position = (last?.position ?? -1) + 1;
  let stored = 0;

  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const verdict = validateUpload(bytes, file.type, { kind: "content-image" });
    if (!verdict.ok) {
      // A partly valid batch keeps the files that landed; the editor can see
      // what arrived and retry only the file the message names.
      return stored > 0
        ? { ok: true, id, message: "image_added_partial" }
        : { ok: false, error: verdict.reason };
    }

    const objectPath = buildObjectPath(id, verdict.extension);
    const { error: uploadError } = await admin.storage
      .from(CONTENT_MEDIA_BUCKET)
      .upload(objectPath, bytes, { contentType: verdict.mime, upsert: false });
    if (uploadError) {
      return stored > 0
        ? { ok: true, id, message: "image_added_partial" }
        : {
            ok: false,
            error: "upload_failed",
            detail: describeSupabaseError(uploadError),
          };
    }

    const { error: rowError } = await writer.from("insight_media").insert({
      insight_id: id,
      storage_path: objectPath,
      alt_text: altText.slice(0, 300),
      caption,
      credit,
      position,
    });

    if (rowError) {
      // A row that could not be written must not leave an orphan object behind.
      await admin.storage.from(CONTENT_MEDIA_BUCKET).remove([objectPath]);
      return stored > 0
        ? { ok: true, id, message: "image_added_partial" }
        : {
            ok: false,
            error: "write_failed",
            detail: describeSupabaseError(rowError),
          };
    }

    position += 1;
    stored += 1;
  }

  await recordAudit({
    actorId: gate.userId,
    action: "content_updated",
    entityType: "insight",
    entityId: id,
    metadata: { field: "gallery_image", count: stored },
  });

  revalidatePath(`/admin/content/${id}`);
  return {
    ok: true,
    id,
    message: stored > 1 ? "images_added" : "image_added",
  };
}

/** Detach a gallery image, removing the stored object and its row. */
export async function removeInsightImageAction(
  formData: FormData,
): Promise<ContentState> {
  const gate = await requireAuthor();
  if (!gate.ok) return { ok: false, error: gate.error };

  const mediaId = String(formData.get("mediaId") ?? "").trim();
  if (!mediaId) return { ok: false, error: "not_found" };

  const admin = createAdminClient();
  if (!admin)
    return {
      ok: false,
      error: "unconfigured",
      detail: missingAdminClientDetail(),
    };

  const { data: media } = await admin
    .from("insight_media")
    .select("id, storage_path, insight_id, insights(department_id)")
    .eq("id", mediaId)
    .maybeSingle();
  if (!media) return { ok: false, error: "not_found" };

  const departmentId =
    (media.insights as { department_id: string | null } | null)
      ?.department_id ?? null;
  const mediaDepartmentCheck = await canAuthorForDepartment(
    gate.role,
    departmentId,
  );
  const mediaDepartmentFailure = authorisationFailure(mediaDepartmentCheck);
  if (mediaDepartmentFailure) return mediaDepartmentFailure;

  const { error } = await admin
    .from("insight_media")
    .delete()
    .eq("id", mediaId);
  if (error)
    return {
      ok: false,
      error: "write_failed",
      detail: describeSupabaseError(error),
    };

  await admin.storage.from(CONTENT_MEDIA_BUCKET).remove([media.storage_path]);

  await recordAudit({
    actorId: gate.userId,
    action: "content_updated",
    entityType: "insight",
    entityId: media.insight_id,
    metadata: { field: "gallery_image", removed: true },
  });

  revalidatePath(`/admin/content/${media.insight_id}`);
  return { ok: true, id: media.insight_id, message: "image_removed" };
}

/** Trimmed optional text, or null when empty. */
function optionalText(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text.slice(0, 400) : null;
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

/**
 * Permanently delete an article.
 *
 * A super admin may delete any article; a department editor may delete an article
 * in a department they author, including a draft. The cover and gallery paths are
 * read before the RPC and the objects removed only after it succeeds, so an
 * unauthorized attempt cannot destroy another department's media. The row delete
 * cascades `insight_media`; the FK-less translation rows are cleared by
 * `delete_content_permanently`.
 */
export async function deleteInsightAction(
  insightId: string,
  reason: string,
): Promise<{ ok: boolean; error?: string; detail?: string }> {
  const auth = await getAuthState();
  if (auth.status === "unconfigured")
    return { ok: false, error: "unconfigured" };
  if (auth.status !== "authenticated" || !auth.profile) {
    return { ok: false, error: "unauthenticated" };
  }
  if (!isDepartmentEditorRole(auth.profile.role)) {
    return { ok: false, error: "forbidden" };
  }

  const trimmed = reason.trim();
  if (trimmed.length < 10) return { ok: false, error: "reason_required" };

  const admin = createAdminClient();
  if (!admin)
    return {
      ok: false,
      error: "unconfigured",
      detail: missingAdminClientDetail(),
    };

  // Remove stored objects first, while the media rows still name them.
  const [{ data: article }, { data: media }] = await Promise.all([
    admin
      .from("insights")
      .select("cover_image_path")
      .eq("id", insightId)
      .maybeSingle(),
    admin
      .from("insight_media")
      .select("storage_path")
      .eq("insight_id", insightId),
  ]);

  const paths = [
    ...(article?.cover_image_path ? [article.cover_image_path] : []),
    ...(media ?? []).map((row) => row.storage_path),
  ];

  // The session client, not the service-role one: `delete_content_permanently`
  // authorizes with the caller's JWT-derived role. A service-role call carries no
  // JWT subject, so the guard would refuse every deletion. The storage removal
  // below still uses the service-role client because the bucket has no browser
  // write policy.
  const { createClient } = await import("@/lib/supabase/server");
  const session = await createClient();
  if (!session) return { ok: false, error: "unconfigured" };

  const { error } = await session.rpc("delete_content_permanently", {
    p_entity_type: "insight",
    p_entity_id: insightId,
    p_reason: trimmed,
  });

  if (error) {
    if (error.message.includes("at least 10 characters")) {
      return { ok: false, error: "reason_required" };
    }
    if (error.message.includes("Unknown insight")) {
      return { ok: false, error: "not_found" };
    }
    return { ok: false, error: "write_failed" };
  }

  if (paths.length > 0) {
    await admin.storage.from(CONTENT_MEDIA_BUCKET).remove(paths);
  }

  revalidatePath("/admin/content");
  revalidatePath(`/admin/content/${insightId}`);
  redirect("/admin/content");
}
