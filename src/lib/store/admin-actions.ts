"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthState } from "@/lib/auth/session";
import { contentDeletionErrorKey } from "@/lib/content/deletion-errors";
import { canAccessDepartment, isDepartmentEditorRole } from "@/lib/auth/roles";
import { slugifyTitle, uniqueSlug } from "@/lib/content/slug";
import { storePathFor } from "@/lib/config/navigation";
import {
  createAdminClient,
  missingAdminClientDetail,
} from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { describeSupabaseError } from "@/lib/supabase/errors";
import { PRODUCT_MEDIA_BUCKET } from "@/lib/store/storage";
import {
  DEFAULT_PRODUCT_CURRENCY,
  fieldErrors,
  productInputSchema,
  productUpdateSchema,
} from "@/lib/store/product-input";
import { scheduleTranslationSync } from "@/lib/tolgee/schedule-sync";
import {
  setProductPublishedAction,
  uploadProductImageAction,
} from "./media-actions";

/**
 * Create a product from the admin surface.
 *
 * The interesting part of this action is what it does NOT do: it never builds a
 * translation key, inserts a translation index row, or enqueues a sync job. Those
 * are the database's job — `products_sync_translation_index` and its sibling
 * triggers fire on the insert and do all of it, atomically, inside the same
 * transaction as the product.
 *
 * That is the correct division. If the application assembled the index, a product
 * written by any other path (a migration, a script, a future integration) would
 * silently have no translations, and a partial failure could leave a product
 * whose index disagrees with it. Putting the rule in a trigger means it holds for
 * every writer.
 *
 * This action's remaining responsibilities are the ones a trigger cannot do:
 * authorize the caller, validate the input, and — when Tolgee is configured —
 * attempt an immediate sync so an editor sees the result without waiting for the
 * scheduled worker. A failed sync is reported as a warning, never as a failure of
 * the product creation: the job is already durable in the queue and will be
 * retried.
 */

export type CreateProductResult =
  | {
      ok: true;
      productId: string;
      translationKeyCount: number;
      syncQueued: number;
      syncWarning?: string;
      seoWarning?: string;
      mediaCount?: number;
      mediaWarning?: "partial" | "failed";
      published?: boolean;
      publishWarning?: "image_required" | "failed";
    }
  | {
      ok: false;
      error: string;
      fields?: Record<string, string>;
      detail?: string;
    };

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

type CategoryDepartmentResult =
  | { ok: true; departmentSlug: string }
  | { ok: false; error: "lookup_failed" | "invalid"; detail: string };

/**
 * Resolve the category the editor picked to its department.
 *
 * Shared by create and update so the two cannot disagree about whether a read
 * failure is a database error, and so a real PostgREST message reaches the
 * console instead of being turned into "invalid".
 */
async function categoryDepartment(
  admin: AdminClient,
  categoryId: string,
): Promise<CategoryDepartmentResult> {
  let category: { departments: { slug: string } | null } | null;
  try {
    const { data, error } = await admin
      .from("product_categories")
      .select("id, departments(slug)")
      .eq("id", categoryId)
      .maybeSingle();
    if (error) {
      return {
        ok: false,
        error: "lookup_failed",
        detail: describeSupabaseError(error),
      };
    }
    category = data;
  } catch (error) {
    return {
      ok: false,
      error: "lookup_failed",
      detail: describeSupabaseError(error),
    };
  }

  const departmentSlug = category?.departments?.slug ?? null;
  if (!departmentSlug) {
    return {
      ok: false,
      error: "invalid",
      detail: "The selected category does not exist or has no department.",
    };
  }
  return { ok: true, departmentSlug };
}

function filesFrom(formData: FormData, field: string): File[] {
  return formData
    .getAll(field)
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
}

/**
 * Attach the files chosen in the create form.
 *
 * The create action and the gallery action share one uploader, so the storage
 * path, the primary-image rule and the partial-batch behaviour cannot drift.
 * A media failure does not undo the product: the row exists and the editor can
 * retry from its detail page, which is exactly what the success notice links to.
 */
async function attachProductImages(
  productId: string,
  title: string,
  files: readonly File[],
): Promise<{ count: number; warning?: "partial" | "failed" }> {
  if (files.length === 0) return { count: 0 };

  const media = new FormData();
  media.set("productId", productId);
  media.set("altText", title.slice(0, 300));
  for (const file of files) media.append("image", file);

  const result = await uploadProductImageAction(media);
  if (!result.ok) return { count: 0, warning: "failed" };
  if (result.message === "image_added_partial") {
    return { count: 0, warning: "partial" };
  }
  return { count: files.length };
}

export async function createProductAction(
  formData: FormData,
): Promise<CreateProductResult> {
  // Authorization first. `getAuthState` reads the role from the database through
  // RLS; hiding the form is not a control, so this check is the control.
  const auth = await getAuthState();
  if (auth.status !== "authenticated") {
    return { ok: false, error: "unauthenticated" };
  }
  if (!auth.profile || !isDepartmentEditorRole(auth.profile.role)) {
    return { ok: false, error: "forbidden" };
  }

  const titleValue = formData.get("title");
  const title = typeof titleValue === "string" ? titleValue.trim() : "";
  const parsed = productInputSchema.safeParse({
    title,
    slug: slugifyTitle(title, "product", 120),
    sku: formData.get("sku"),
    categoryId: formData.get("categoryId"),
    shortDescription: formData.get("shortDescription"),
    description: formData.get("description"),
    brand: formData.get("brand") ?? "",
    priceMinor: formData.get("priceMinor"),
    stock: formData.get("stock"),
    seoTitle: formData.get("seoTitle") ?? "",
    seoDescription: formData.get("seoDescription") ?? "",
  });

  if (!parsed.success) {
    return { ok: false, error: "invalid", fields: fieldErrors(parsed.error) };
  }

  const input = parsed.data;
  const admin = createAdminClient();
  if (!admin) {
    return {
      ok: false,
      error: "unconfigured",
      detail: missingAdminClientDetail(),
    };
  }

  // The department is the category's, so the category the editor picked decides
  // which department the product lands in. Reading it from the database rather
  // than from the submitted form is what makes the choice authoritative: the RLS
  // policy already refuses a cross-department write, but a department editor must
  // also get a message rather than a raw policy violation — and the console must
  // never offer another department's categories in the first place.
  const category = await categoryDepartment(admin, input.categoryId);
  if (!category.ok) {
    return {
      ok: false,
      error: category.error,
      detail: category.detail,
    };
  }
  if (!canAccessDepartment(auth.profile.role, category.departmentSlug)) {
    // Reported as its own code so the form shows a message rather than a raw
    // policy violation, and no field-level text is invented: the notice is the
    // whole story.
    return { ok: false, error: "forbidden_department" };
  }

  const supabase = admin;
  const slug = await uniqueSlug(
    input.slug,
    async (candidate) => {
      const { data } = await admin
        .from("products")
        .select("id")
        .eq("slug", candidate)
        .maybeSingle();
      return Boolean(data);
    },
    120,
  );

  // The product is inserted as a draft because publishing requires an image and
  // the image cannot be attached until the row exists. The requested publish
  // state is therefore applied after the media step, never on the insert.
  let product: { id: string } | null;
  let insertError: unknown;
  try {
    const { data, error } = await supabase
      .from("products")
      .insert({
        category_id: input.categoryId,
        slug,
        sku: input.sku,
        title: input.title,
        short_description: input.shortDescription,
        description: input.description,
        brand: input.brand || null,
        price_minor: input.priceMinor,
        currency: DEFAULT_PRODUCT_CURRENCY,
        stock: input.stock,
        publish_state: "draft",
      })
      .select("id")
      .single();
    product = data;
    insertError = error;
  } catch (error) {
    insertError = error;
    product = null;
  }

  if (insertError || !product) {
    // A unique violation on slug or sku is the common case and deserves a
    // message the editor can act on rather than a generic failure.
    const message =
      insertError && typeof insertError === "object"
        ? String((insertError as { message?: unknown }).message ?? "")
        : "";
    if (message.includes("slug") || message.includes("sku")) {
      return {
        ok: false,
        error: "duplicate",
        fields: {
          [message.includes("sku") ? "sku" : "slug"]:
            "A product already uses this value.",
        },
        detail: describeSupabaseError(insertError),
      };
    }
    return {
      ok: false,
      error: "write_failed",
      detail: describeSupabaseError(insertError),
    };
  }

  const media = await attachProductImages(
    product.id,
    input.title,
    filesFrom(formData, "image"),
  );

  // Publishing needs the row to exist and at least one image to be attached, so
  // the request is honoured after the media step rather than by inserting a
  // published row. A refusal leaves the product as the draft it already is.
  const requestedPublish =
    String(formData.get("publishState") ?? "draft") === "published";
  let published = false;
  let publishWarning: "image_required" | "failed" | undefined;
  if (requestedPublish) {
    const publishForm = new FormData();
    publishForm.set("productId", product.id);
    publishForm.set("publish", "true");
    const publishResult = await setProductPublishedAction(publishForm);
    if (publishResult.ok) published = true;
    else if (publishResult.error === "no_image")
      publishWarning = "image_required";
    else publishWarning = "failed";
  }

  // SEO overrides live in `entity_seo`, not on the product row, and the product
  // page reads them from there. Writing them anywhere else would accept the
  // editor's text and never use it. The `entity_seo` trigger then indexes the
  // seo_title / seo_description keys and queues their sync jobs, which is why
  // this action does not touch the index itself.
  const seoTitle = input.seoTitle || null;
  const seoDescription = input.seoDescription || null;
  let seoWarning: string | undefined;

  if (seoTitle || seoDescription) {
    const { error: seoError } = await supabase.from("entity_seo").upsert(
      {
        entity_type: "product",
        entity_id: product.id,
        locale: "en",
        title: seoTitle,
        description: seoDescription,
        updated_by: auth.userId,
      },
      { onConflict: "entity_type,entity_id,locale" },
    );

    if (seoError) {
      // The product exists and is kept. Failing the whole action would be worse:
      // the editor would retry and hit a duplicate-slug error for a product that
      // was in fact created. The override did not save, so say so rather than
      // reporting a success the editor cannot rely on.
      seoWarning = "seo_write_failed";
    }
  }

  // Count this product's own index entries and queued jobs. Counting the whole
  // queue would report other editors' work as though it were this product's.
  const { data: entryRows } = await supabase
    .from("translation_entries")
    .select("id")
    .eq("entity_type", "product")
    .eq("entity_id", product.id);

  const entryIds = (entryRows ?? []).map((row) => row.id);
  let queued = 0;
  if (entryIds.length > 0) {
    const { count } = await supabase
      .from("translation_sync_jobs")
      .select("id", { count: "exact", head: true })
      .in("translation_entry_id", entryIds)
      .eq("status", "queued");
    queued = count ?? 0;
  }

  const syncStatus = scheduleTranslationSync();
  const syncWarning =
    syncStatus === "unavailable"
      ? "sync_deferred_unavailable"
      : syncStatus === "unconfigured"
        ? "tolgee_unconfigured"
        : undefined;

  revalidatePath(`/en${storePathFor(category.departmentSlug)}`);
  revalidatePath(`/fr${storePathFor(category.departmentSlug)}`);

  return {
    ok: true,
    productId: product.id,
    translationKeyCount: entryIds.length,
    syncQueued: queued,
    syncWarning,
    seoWarning,
    mediaCount: media.count,
    mediaWarning: media.warning,
    published,
    publishWarning,
  };
}

/**
 * Update an existing product.
 *
 * Mirrors `createProductAction`: the department is re-read from the category the
 * editor picked, never taken from the form, and the write goes through the
 * service-role client after the department check — the RLS policy is the same
 * boundary creation uses. SEO overrides live in `entity_seo`, so they are upserted
 * there and the `entity_seo` trigger re-indexes them; this action does not touch
 * the translation index.
 *
 * The slug and SKU are editable. Changing a slug changes the product's URL, which
 * is the editor's call; the store resolves the localized and canonical slugs, so
 * an inbound link to the old slug is not silently broken by this — it is a normal
 * slug change, the same as renaming at creation.
 */
export async function updateProductAction(
  formData: FormData,
): Promise<CreateProductResult> {
  const auth = await getAuthState();
  if (auth.status !== "authenticated") {
    return { ok: false, error: "unauthenticated" };
  }
  if (!auth.profile || !isDepartmentEditorRole(auth.profile.role)) {
    return { ok: false, error: "forbidden" };
  }

  const parsed = productUpdateSchema.safeParse({
    productId: formData.get("productId"),
    title: formData.get("title"),
    slug: formData.get("slug"),
    sku: formData.get("sku"),
    categoryId: formData.get("categoryId"),
    shortDescription: formData.get("shortDescription"),
    description: formData.get("description"),
    brand: formData.get("brand") ?? "",
    priceMinor: formData.get("priceMinor"),
    stock: formData.get("stock"),
    seoTitle: formData.get("seoTitle") ?? "",
    seoDescription: formData.get("seoDescription") ?? "",
  });

  if (!parsed.success) {
    return { ok: false, error: "invalid", fields: fieldErrors(parsed.error) };
  }

  const input = parsed.data;
  const admin = createAdminClient();
  if (!admin) {
    return {
      ok: false,
      error: "unconfigured",
      detail: missingAdminClientDetail(),
    };
  }

  // The product's current category decides which department it belongs to, and
  // the submitted category must resolve to a department the caller may edit.
  const category = await categoryDepartment(admin, input.categoryId);
  if (!category.ok) {
    return {
      ok: false,
      error: category.error,
      detail: category.detail,
    };
  }
  if (!canAccessDepartment(auth.profile.role, category.departmentSlug)) {
    return { ok: false, error: "forbidden_department" };
  }

  // Scoped read: a published product in another department is world-readable, so
  // a guessed id must not open an edit whose save the write policy would refuse.
  let existing: {
    product_categories: { departments: { slug: string } | null } | null;
  } | null;
  try {
    const { data, error } = await admin
      .from("products")
      .select("id, product_categories(departments(slug))")
      .eq("id", input.productId)
      .maybeSingle();
    if (error) {
      return {
        ok: false,
        error: "lookup_failed",
        detail: describeSupabaseError(error),
      };
    }
    existing = data;
  } catch (error) {
    return {
      ok: false,
      error: "lookup_failed",
      detail: describeSupabaseError(error),
    };
  }
  if (!existing) return { ok: false, error: "not_found" };

  const existingSlug = existing.product_categories?.departments?.slug ?? null;
  if (!existingSlug || !canAccessDepartment(auth.profile.role, existingSlug)) {
    return { ok: false, error: "not_found" };
  }

  let updateError: unknown;
  try {
    const { error } = await admin
      .from("products")
      .update({
        category_id: input.categoryId,
        slug: input.slug,
        sku: input.sku,
        title: input.title,
        short_description: input.shortDescription,
        description: input.description,
        brand: input.brand || null,
        price_minor: input.priceMinor,
        stock: input.stock,
      })
      .eq("id", input.productId);
    updateError = error;
  } catch (error) {
    updateError = error;
  }

  if (updateError) {
    const message =
      typeof updateError === "object" && updateError !== null
        ? String((updateError as { message?: unknown }).message ?? "")
        : "";
    if (message.includes("slug") || message.includes("sku")) {
      return {
        ok: false,
        error: "duplicate",
        fields: {
          [message.includes("sku") ? "sku" : "slug"]:
            "A product already uses this value.",
        },
        detail: describeSupabaseError(updateError),
      };
    }
    return {
      ok: false,
      error: "write_failed",
      detail: describeSupabaseError(updateError),
    };
  }

  const seoTitle = input.seoTitle || null;
  const seoDescription = input.seoDescription || null;
  let seoWarning: string | undefined;

  if (seoTitle || seoDescription) {
    const { error: seoError } = await admin.from("entity_seo").upsert(
      {
        entity_type: "product",
        entity_id: input.productId,
        locale: "en",
        title: seoTitle,
        description: seoDescription,
        updated_by: auth.userId,
      },
      { onConflict: "entity_type,entity_id,locale" },
    );
    if (seoError) seoWarning = "seo_write_failed";
  }

  const syncStatus = scheduleTranslationSync();

  revalidatePath(`/en${storePathFor(category.departmentSlug)}`);
  revalidatePath(`/fr${storePathFor(category.departmentSlug)}`);

  return {
    ok: true,
    productId: input.productId,
    translationKeyCount: 0,
    syncQueued: 0,
    syncWarning:
      syncStatus === "unavailable"
        ? "sync_deferred_unavailable"
        : syncStatus === "unconfigured"
          ? "tolgee_unconfigured"
          : undefined,
    seoWarning,
  };
}

/**
 * Permanently delete a product.
 *
 * A super admin may delete any product; a department editor may delete a product
 * in a department they author, including a draft that was never published. The
 * order-history safety is structural: `order_items.product_id` is
 * `on delete set null` and every line keeps its own title/sku/slug/price snapshot,
 * so removing a product does not rewrite a past order — it only drops the link.
 *
 * The role check here is a message; `delete_content_permanently`'s own
 * department-scoped guard is the control, and it also holds for a direct
 * PostgREST call.
 */
export async function deleteProductAction(
  productId: string,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await getAuthState();
  if (auth.status === "unconfigured")
    return { ok: false, error: "unconfigured" };
  if (auth.status !== "authenticated") {
    return { ok: false, error: "unauthenticated" };
  }
  if (!auth.profile || !isDepartmentEditorRole(auth.profile.role)) {
    return { ok: false, error: "forbidden" };
  }

  const trimmed = reason.trim();
  if (trimmed.length < 10) return { ok: false, error: "reason_required" };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "unconfigured" };

  // Read the object paths while the media rows still name them, but do not
  // remove anything until the RPC has authorized the caller. Otherwise a
  // department editor aiming at another department's product could destroy its
  // photographs before the database refused the row deletion.
  const { data: media } = await admin
    .from("product_media")
    .select("storage_path")
    .eq("product_id", productId);
  const paths = (media ?? []).map((row) => row.storage_path);

  // The session client, not the service-role one: `delete_content_permanently`
  // authorizes with the caller's JWT-derived role. A service-role call carries no
  // JWT subject, so the guard would refuse every deletion.
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "unconfigured" };

  const { error } = await supabase.rpc("delete_content_permanently", {
    p_entity_type: "product",
    p_entity_id: productId,
    p_reason: trimmed,
  });

  if (error) {
    return { ok: false, error: contentDeletionErrorKey(error.message) };
  }

  // The row and its media rows are gone; remove the now-orphaned objects. A
  // failed object removal does not undo the deletion, because an orphan object is
  // invisible to the site while a half-deleted product is not.
  if (paths.length > 0) {
    await admin.storage.from(PRODUCT_MEDIA_BUCKET).remove(paths);
  }

  revalidatePath("/admin/store");
  revalidatePath(`/admin/store/${productId}`);
  redirect("/admin/store");
}

/**
 * Re-queue a failed translation sync job.
 *
 * Delegates to the database's `requeue_translation_entry`, which resets the
 * attempt counter. Doing that in SQL rather than here means the backoff state is
 * reset consistently no matter who triggers the retry.
 */
export async function retryTranslationSyncAction(
  entityId: string,
): Promise<{ ok: boolean }> {
  const auth = await getAuthState();
  if (auth.status !== "authenticated" || !auth.profile) {
    return { ok: false };
  }
  if (!isDepartmentEditorRole(auth.profile.role)) return { ok: false };

  const supabase = createAdminClient();
  if (!supabase) return { ok: false };

  const { data: entry } = await supabase
    .from("translation_entries")
    .select("id")
    .eq("entity_type", "product")
    .eq("entity_id", entityId)
    .limit(1)
    .maybeSingle();

  if (!entry) return { ok: false };

  const { error } = await supabase.rpc("requeue_translation_entry", {
    p_entry_id: entry.id,
  });

  return { ok: !error };
}
