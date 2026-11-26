"use server";

import { revalidatePath } from "next/cache";
import { getAuthState } from "@/lib/auth/session";
import {
  canAccessDepartment,
  isDepartmentEditorRole,
  isSuperAdminRole,
} from "@/lib/auth/roles";
import { storePathFor } from "@/lib/config/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { PRODUCT_MEDIA_BUCKET } from "@/lib/store/storage";
import {
  DEFAULT_PRODUCT_CURRENCY,
  fieldErrors,
  productInputSchema,
  productUpdateSchema,
} from "@/lib/store/product-input";
import { isTolgeeSyncConfigured } from "@/lib/tolgee/server-client";

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
    }
  | { ok: false; error: string; fields?: Record<string, string> };

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

  const parsed = productInputSchema.safeParse({
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
  if (!admin) return { ok: false, error: "unconfigured" };

  // The department is the category's, so the category the editor picked decides
  // which department the product lands in. Reading it from the database rather
  // than from the submitted form is what makes the choice authoritative: the RLS
  // policy already refuses a cross-department write, but a department editor must
  // also get a message rather than a raw policy violation — and the console must
  // never offer another department's categories in the first place.
  const { data: category } = await admin
    .from("product_categories")
    .select("id, departments(slug)")
    .eq("id", input.categoryId)
    .maybeSingle();

  const departmentSlug =
    (category?.departments as { slug: string } | null)?.slug ?? null;
  if (!category || !departmentSlug) {
    // A category id that does not resolve means a crafted POST; the generic
    // invalid message is the right response.
    return { ok: false, error: "invalid" };
  }
  if (!canAccessDepartment(auth.profile.role, departmentSlug)) {
    // Reported as its own code so the form shows a message rather than a raw
    // policy violation, and no field-level text is invented: the notice is the
    // whole story.
    return { ok: false, error: "forbidden_department" };
  }

  const supabase = admin;

  // The product is inserted as a draft. Publishing requires an image, and the
  // image cannot be attached until the product row exists to attach it to, so a
  // new product starts unpublished and becomes visible when an image is added.
  const { data: product, error } = await supabase
    .from("products")
    .insert({
      category_id: input.categoryId,
      slug: input.slug,
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

  if (error || !product) {
    // A unique violation on slug or sku is the common case and deserves a
    // message the editor can act on rather than a generic failure.
    const message = error?.message ?? "";
    if (message.includes("slug") || message.includes("sku")) {
      return {
        ok: false,
        error: "duplicate",
        fields: {
          [message.includes("sku") ? "sku" : "slug"]:
            "A product already uses this value.",
        },
      };
    }
    return { ok: false, error: "write_failed" };
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

  let syncWarning: string | undefined;
  if (isTolgeeSyncConfigured()) {
    // Best-effort immediate push. The queue is durable, so a failure here costs
    // nothing but latency; it must not fail the creation.
    const { runTranslationSync } = await import("@/lib/tolgee/sync-worker");
    const result = await runTranslationSync({ limit: 50 });
    if (!result.ran) {
      syncWarning = result.reason ?? "sync_unavailable";
    } else if (result.permanentFailures.length > 0) {
      syncWarning = result.permanentFailures[0]?.error ?? "sync_failed";
    }
  } else {
    syncWarning = "tolgee_unconfigured";
  }

  revalidatePath(`/en${storePathFor(departmentSlug)}`);
  revalidatePath(`/fr${storePathFor(departmentSlug)}`);

  return {
    ok: true,
    productId: product.id,
    translationKeyCount: entryIds.length,
    syncQueued: queued,
    syncWarning,
    seoWarning,
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
  if (!admin) return { ok: false, error: "unconfigured" };

  // The product's current category decides which department it belongs to, and
  // the submitted category must resolve to a department the caller may edit.
  const { data: category } = await admin
    .from("product_categories")
    .select("id, departments(slug)")
    .eq("id", input.categoryId)
    .maybeSingle();

  const departmentSlug =
    (category?.departments as { slug: string } | null)?.slug ?? null;
  if (!category || !departmentSlug) {
    return { ok: false, error: "invalid" };
  }
  if (!canAccessDepartment(auth.profile.role, departmentSlug)) {
    return { ok: false, error: "forbidden_department" };
  }

  // Scoped read: a published product in another department is world-readable, so
  // a guessed id must not open an edit whose save the write policy would refuse.
  const { data: existing } = await admin
    .from("products")
    .select("id, product_categories(departments(slug))")
    .eq("id", input.productId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "not_found" };

  const existingSlug =
    (
      existing.product_categories as {
        departments: { slug: string } | null;
      } | null
    )?.departments?.slug ?? null;
  if (!existingSlug || !canAccessDepartment(auth.profile.role, existingSlug)) {
    return { ok: false, error: "not_found" };
  }

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

  if (error) {
    const message = error.message ?? "";
    if (message.includes("slug") || message.includes("sku")) {
      return {
        ok: false,
        error: "duplicate",
        fields: {
          [message.includes("sku") ? "sku" : "slug"]:
            "A product already uses this value.",
        },
      };
    }
    return { ok: false, error: "write_failed" };
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

  revalidatePath(`/en${storePathFor(departmentSlug)}`);
  revalidatePath(`/fr${storePathFor(departmentSlug)}`);

  return {
    ok: true,
    productId: input.productId,
    translationKeyCount: 0,
    syncQueued: 0,
    seoWarning,
  };
}

/**
 * Permanently delete a product. Super-admin only.
 *
 * The order-history safety is structural: `order_items.product_id` is
 * `on delete set null` and every line keeps its own title/sku/slug/price snapshot,
 * so removing a product does not rewrite a past order — it only drops the link.
 * The role check here is a message; `delete_content_permanently`'s own
 * `is_super_admin()` guard is the control.
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
  if (!auth.profile || !isSuperAdminRole(auth.profile.role)) {
    return { ok: false, error: "forbidden" };
  }

  const trimmed = reason.trim();
  if (trimmed.length < 10) return { ok: false, error: "reason_required" };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "unconfigured" };

  // Remove the stored objects first, while the media rows still name them. The
  // product delete cascades `product_media`, but nothing removes the objects, so
  // without this a deleted product would leave its photographs orphaned in the
  // bucket. The read and the removal use the service-role client because the
  // bucket has no browser write policy; the row delete below does not.
  const { data: media } = await admin
    .from("product_media")
    .select("storage_path")
    .eq("product_id", productId);
  const paths = (media ?? []).map((row) => row.storage_path);
  if (paths.length > 0) {
    await admin.storage.from(PRODUCT_MEDIA_BUCKET).remove(paths);
  }

  // The session client, not the service-role one: `delete_content_permanently`
  // authorizes with `is_super_admin()`, which reads `auth.uid()`. A service-role
  // call carries no JWT subject, so the guard would refuse every deletion.
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "unconfigured" };

  const { error } = await supabase.rpc("delete_content_permanently", {
    p_entity_type: "product",
    p_entity_id: productId,
    p_reason: trimmed,
  });

  if (error) {
    if (error.message.includes("at least 10 characters")) {
      return { ok: false, error: "reason_required" };
    }
    if (error.message.includes("Unknown product")) {
      return { ok: false, error: "not_found" };
    }
    return { ok: false, error: "write_failed" };
  }

  revalidatePath("/admin/store");
  return { ok: true };
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
