"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { canAccessDepartment } from "@/lib/auth/roles";
import { getAuthState, type Profile } from "@/lib/auth/session";
import { recordAudit } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { PROJECT_MEDIA_BUCKET, projectMediaPath } from "@/lib/uploads/storage";
import { validateUpload } from "@/lib/uploads/validation";

/**
 * Completed-work authoring ("Work Done").
 *
 * Two clients, each with a job:
 *
 *   * the row writes use the cookie-bound client, so the department-scoped RLS
 *     policies from `20260101000042_department_project_editing.sql` are the real
 *     control — a Digital Marketing editor physically cannot write an Electrical
 *     Services project, whatever the form posts;
 *   * the Storage upload uses the service-role client, because the media bucket
 *     has no browser-insert policy, exactly as the store and article paths do.
 *
 * The role check below is not a substitute for RLS; it exists so the editor gets
 * a message ("not your department") instead of a raw policy violation, and so a
 * write is never attempted at all when the department is not theirs.
 */

export type ProjectState =
  | { ok: true; id: string; message: string }
  | { ok: false; error: string; fields?: Record<string, string> };

export type ProjectMediaState =
  | { ok: true; message: string }
  | { ok: false; error: string };

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const projectSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(160)
    .regex(slugPattern, "Use lowercase words separated by hyphens."),
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(1).max(320),
  description: z.string().trim().max(20_000).optional(),
  scope: z.string().trim().max(4_000).optional(),
  outcome: z.string().trim().max(4_000).optional(),
  departmentId: z.string().uuid(),
  location: z.string().trim().max(160).optional(),
  propertyType: z.enum(["residential", "commercial", "industrial"]).nullable(),
  completedYear: z.coerce.number().int().min(1900).max(2100).nullable(),
  publishState: z.enum(["draft", "published", "archived"]),
});

function optionalText(value: FormDataEntryValue | null): string | undefined {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : undefined;
}

function nullableText(value: FormDataEntryValue | null): string | null {
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

/** A signed-in profile whose role may author work, or a reason it may not. */
async function requireEditor(): Promise<
  { ok: true; profile: Profile } | { ok: false; error: string }
> {
  const auth = await getAuthState();
  if (auth.status === "unconfigured")
    return { ok: false, error: "unconfigured" };
  if (auth.status !== "authenticated" || !auth.profile) {
    return { ok: false, error: "unauthenticated" };
  }
  return { ok: true, profile: auth.profile };
}

/** Resolve a department id to its slug, or null when it does not exist. */
async function departmentSlugForId(id: string): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("departments")
    .select("slug")
    .eq("id", id)
    .maybeSingle();
  return data?.slug ?? null;
}

function revalidateWork(departmentSlug: string): void {
  revalidatePath("/admin/work");
  for (const locale of ["en", "fr"]) {
    revalidatePath(`/${locale}/${departmentSlug}/projects`);
  }
}

/** Read the service ids chosen in a multi-select. */
function serviceIdsFrom(formData: FormData): string[] {
  return formData
    .getAll("serviceIds")
    .map((value) => String(value).trim())
    .filter((value) => value.length > 0);
}

export async function createProjectAction(
  formData: FormData,
): Promise<ProjectState> {
  const gate = await requireEditor();
  if (!gate.ok) return { ok: false, error: gate.error };

  const parsed = projectSchema.safeParse({
    slug: String(formData.get("slug") ?? ""),
    title: String(formData.get("title") ?? ""),
    summary: String(formData.get("summary") ?? ""),
    description: optionalText(formData.get("description")),
    scope: optionalText(formData.get("scope")),
    outcome: optionalText(formData.get("outcome")),
    departmentId: String(formData.get("departmentId") ?? ""),
    location: optionalText(formData.get("location")),
    propertyType: nullableText(formData.get("propertyType")) as
      | "residential"
      | "commercial"
      | "industrial"
      | null,
    completedYear: optionalText(formData.get("completedYear"))
      ? Number(String(formData.get("completedYear")).trim())
      : null,
    publishState: String(formData.get("publishState") ?? "draft") as
      | "draft"
      | "published"
      | "archived",
  });

  if (!parsed.success) {
    return { ok: false, error: "invalid", fields: fieldErrors(parsed.error) };
  }

  const slug = await departmentSlugForId(parsed.data.departmentId);
  if (!slug || !canAccessDepartment(gate.profile.role, slug)) {
    return { ok: false, error: "forbidden" };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "unconfigured" };

  const { data, error } = await supabase
    .from("electrical_projects")
    .insert({
      slug: parsed.data.slug,
      title: parsed.data.title,
      summary: parsed.data.summary,
      description: parsed.data.description ?? null,
      scope: parsed.data.scope ?? null,
      outcome: parsed.data.outcome ?? null,
      department_id: parsed.data.departmentId,
      location: parsed.data.location ?? null,
      property_type: parsed.data.propertyType,
      completed_year: parsed.data.completedYear,
      publish_state: parsed.data.publishState,
      // A published project must carry a date (the table's constraint), and the
      // moment of publication is the only date the editor has not had to supply.
      published_at:
        parsed.data.publishState === "published"
          ? new Date().toISOString()
          : null,
    })
    .select("id")
    .single();

  if (error || !data) {
    // 23505 is the slug unique constraint: a distinct outcome, not a retryable
    // failure, so it gets its own message.
    const code = (error as { code?: string } | null)?.code;
    return {
      ok: false,
      error: code === "23505" ? "duplicate" : "write_failed",
    };
  }

  await syncServices(supabase, data.id, serviceIdsFrom(formData));

  await recordAudit({
    actorId: gate.profile.id,
    action: "project_created",
    entityType: "electrical_project",
    entityId: data.id,
    metadata: { department: slug, state: parsed.data.publishState },
  });

  revalidateWork(slug);
  return { ok: true, id: data.id, message: "created" };
}

export async function updateProjectAction(
  formData: FormData,
): Promise<ProjectState> {
  const gate = await requireEditor();
  if (!gate.ok) return { ok: false, error: gate.error };

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, error: "not_found" };

  const parsed = projectSchema.safeParse({
    slug: String(formData.get("slug") ?? ""),
    title: String(formData.get("title") ?? ""),
    summary: String(formData.get("summary") ?? ""),
    description: optionalText(formData.get("description")),
    scope: optionalText(formData.get("scope")),
    outcome: optionalText(formData.get("outcome")),
    departmentId: String(formData.get("departmentId") ?? ""),
    location: optionalText(formData.get("location")),
    propertyType: nullableText(formData.get("propertyType")) as
      | "residential"
      | "commercial"
      | "industrial"
      | null,
    completedYear: optionalText(formData.get("completedYear"))
      ? Number(String(formData.get("completedYear")).trim())
      : null,
    publishState: String(formData.get("publishState") ?? "draft") as
      | "draft"
      | "published"
      | "archived",
  });

  if (!parsed.success) {
    return { ok: false, error: "invalid", fields: fieldErrors(parsed.error) };
  }

  const slug = await departmentSlugForId(parsed.data.departmentId);
  if (!slug || !canAccessDepartment(gate.profile.role, slug)) {
    return { ok: false, error: "forbidden" };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "unconfigured" };

  // The existing row is read first so `published_at` is set once, on the
  // transition into `published`, and preserved on later edits.
  const { data: existing } = await supabase
    .from("electrical_projects")
    .select("published_at")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { ok: false, error: "not_found" };

  const publishedAt =
    parsed.data.publishState === "published"
      ? (existing.published_at ?? new Date().toISOString())
      : existing.published_at;

  const { error } = await supabase
    .from("electrical_projects")
    .update({
      slug: parsed.data.slug,
      title: parsed.data.title,
      summary: parsed.data.summary,
      description: parsed.data.description ?? null,
      scope: parsed.data.scope ?? null,
      outcome: parsed.data.outcome ?? null,
      location: parsed.data.location ?? null,
      property_type: parsed.data.propertyType,
      completed_year: parsed.data.completedYear,
      publish_state: parsed.data.publishState,
      published_at: publishedAt,
    })
    .eq("id", id);

  if (error) {
    const code = (error as { code?: string }).code;
    return {
      ok: false,
      error: code === "23505" ? "duplicate" : "write_failed",
    };
  }

  await syncServices(supabase, id, serviceIdsFrom(formData));

  await recordAudit({
    actorId: gate.profile.id,
    action: "project_updated",
    entityType: "electrical_project",
    entityId: id,
    metadata: { department: slug, state: parsed.data.publishState },
  });

  revalidateWork(slug);
  revalidatePath(`/admin/work/${id}`);
  return { ok: true, id, message: "updated" };
}

/**
 * Replace a project's service links with the chosen set.
 *
 * Delete-then-insert rather than a diff: the set is small, and a partial update
 * would need to distinguish "unchanged" from "removed" for no benefit here.
 */
async function syncServices(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  serviceIds: readonly string[],
): Promise<void> {
  if (!supabase) return;
  await supabase
    .from("electrical_project_services")
    .delete()
    .eq("project_id", projectId);
  if (serviceIds.length === 0) return;
  await supabase.from("electrical_project_services").insert(
    serviceIds.map((serviceId) => ({
      project_id: projectId,
      service_id: serviceId,
    })),
  );
}

/**
 * Attach an image to a completed work record.
 *
 * The type is determined from the file's leading bytes, not the declared MIME
 * type, and the object path is built from the project id and a content-derived
 * extension, so nothing depends on the uploaded filename. The row is written
 * through the service-role client here because the upload must be recorded in the
 * same operation that stores the object; the department check below is what
 * authorizes it, and the project row it targets was itself loaded under RLS.
 */
export async function uploadProjectMediaAction(
  formData: FormData,
): Promise<ProjectMediaState> {
  const gate = await requireEditor();
  if (!gate.ok) return { ok: false, error: gate.error };

  const projectId = String(formData.get("projectId") ?? "").trim();
  if (!projectId) return { ok: false, error: "not_found" };

  const altText = String(formData.get("altText") ?? "").trim();
  if (altText.length === 0) return { ok: false, error: "alt_required" };

  const role = String(formData.get("role") ?? "general");
  if (role !== "before" && role !== "after" && role !== "general") {
    return { ok: false, error: "invalid" };
  }

  const file = formData.get("image");
  if (!(file instanceof File)) return { ok: false, error: "no_file" };

  const bytes = new Uint8Array(await file.arrayBuffer());
  // `project-image` matches the `project-media` bucket's configured 5 MiB limit
  // and its accepted types. Using `property-image` here would admit a 10 MiB file
  // the bucket then refuses, turning a size check into a generic upload failure.
  const verdict = validateUpload(bytes, file.type, { kind: "project-image" });
  if (!verdict.ok) return { ok: false, error: verdict.reason };

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "unconfigured" };

  // Loaded under RLS: if the project is not in a department the caller may edit,
  // this returns nothing and the upload is refused before any object is written.
  const { data: project } = await supabase
    .from("electrical_projects")
    .select("id, departments(slug)")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { ok: false, error: "not_found" };

  const slug = (project.departments as { slug: string } | null)?.slug ?? "";
  if (!slug || !canAccessDepartment(gate.profile.role, slug)) {
    return { ok: false, error: "forbidden" };
  }

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "unconfigured" };

  const objectPath = projectMediaPath(
    projectId,
    `${randomUUID()}.${verdict.extension}`,
  );

  const { error: uploadError } = await admin.storage
    .from(PROJECT_MEDIA_BUCKET)
    .upload(objectPath, bytes, { contentType: verdict.mime, upsert: false });
  if (uploadError) return { ok: false, error: "upload_failed" };

  // Position continues from the current maximum so a later image does not take
  // the first slot from an earlier one.
  const { data: last } = await admin
    .from("project_media")
    .select("position")
    .eq("project_id", projectId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error: rowError } = await admin.from("project_media").insert({
    project_id: projectId,
    storage_path: objectPath,
    alt_text: altText,
    caption: optionalText(formData.get("caption")) ?? null,
    credit: optionalText(formData.get("credit")) ?? null,
    role,
    position: (last?.position ?? -1) + 1,
  });

  if (rowError) {
    // A row that could not be written must not leave an orphan object behind.
    await admin.storage.from(PROJECT_MEDIA_BUCKET).remove([objectPath]);
    // 23505 on the before/after unique index is the honest "one each" message.
    const code = (rowError as { code?: string }).code;
    return {
      ok: false,
      error: code === "23505" ? "role_taken" : "write_failed",
    };
  }

  await recordAudit({
    actorId: gate.profile.id,
    action: "project_media_uploaded",
    entityType: "electrical_project",
    entityId: projectId,
    metadata: { role },
  });

  revalidateWork(slug);
  revalidatePath(`/admin/work/${projectId}`);
  return { ok: true, message: "uploaded" };
}

/** Detach an image, removing the stored object and its row. */
export async function removeProjectMediaAction(
  formData: FormData,
): Promise<ProjectMediaState> {
  const gate = await requireEditor();
  if (!gate.ok) return { ok: false, error: gate.error };

  const mediaId = String(formData.get("mediaId") ?? "").trim();
  if (!mediaId) return { ok: false, error: "not_found" };

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "unconfigured" };

  const { data: media } = await supabase
    .from("project_media")
    .select(
      "id, storage_path, project_id, electrical_projects(departments(slug))",
    )
    .eq("id", mediaId)
    .maybeSingle();
  if (!media) return { ok: false, error: "not_found" };

  const slug =
    (
      media.electrical_projects as {
        departments: { slug: string } | null;
      } | null
    )?.departments?.slug ?? "";
  if (!slug || !canAccessDepartment(gate.profile.role, slug)) {
    return { ok: false, error: "forbidden" };
  }

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "unconfigured" };

  // The row goes first: if the object removal then fails, the record is already
  // gone from the page and an orphan object is invisible rather than a broken
  // image pointing at a deleted row.
  const { error } = await admin
    .from("project_media")
    .delete()
    .eq("id", mediaId);
  if (error) return { ok: false, error: "write_failed" };

  await admin.storage.from(PROJECT_MEDIA_BUCKET).remove([media.storage_path]);

  await recordAudit({
    actorId: gate.profile.id,
    action: "project_media_removed",
    entityType: "electrical_project",
    entityId: media.project_id,
    metadata: {},
  });

  revalidateWork(slug);
  revalidatePath(`/admin/work/${media.project_id}`);
  return { ok: true, message: "removed" };
}
