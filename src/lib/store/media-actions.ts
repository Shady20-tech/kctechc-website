"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { getAuthState } from "@/lib/auth/session";
import {
  canAccessDepartment,
  isDepartmentEditorRole,
  type AppRole,
} from "@/lib/auth/roles";
import { storePathFor } from "@/lib/config/navigation";
import { recordAudit } from "@/lib/security/audit";
import { PRODUCT_MEDIA_BUCKET, productMediaPath } from "@/lib/store/storage";
import {
  createAdminClient,
  missingAdminClientDetail,
} from "@/lib/supabase/admin";
import { describeSupabaseError } from "@/lib/supabase/errors";
import { validateUpload } from "@/lib/uploads/validation";

/**
 * Product media and publishing.
 *
 * A product is created as a draft because the database will not let it be
 * published without an image — `products_publish_requires_media` raises if a row
 * reaches `published` with no `product_media`. Adding the image is therefore the
 * step that makes publishing possible at all, which is why the two live together
 * in this module: an upload that cannot be followed by a publish would leave the
 * editor exactly where the empty-category bug left them.
 *
 * The image is validated by its leading bytes rather than its declared type, the
 * same rule the rest of the upload paths follow, and the object path is built
 * from the product id and a content-derived extension so nothing depends on the
 * filename the browser supplied.
 */

export type ProductMediaState =
  | { ok: true; message: string }
  | { ok: false; error: string; detail?: string };

async function requireEditor(): Promise<
  | { ok: true; userId: string; role: AppRole }
  | { ok: false; error: "unauthenticated" | "forbidden" | "unconfigured" }
> {
  const auth = await getAuthState();
  if (auth.status === "unconfigured")
    return { ok: false, error: "unconfigured" };
  if (auth.status !== "authenticated") {
    return { ok: false, error: "unauthenticated" };
  }
  if (!auth.profile || !isDepartmentEditorRole(auth.profile.role)) {
    return { ok: false, error: "forbidden" };
  }
  return { ok: true, userId: auth.userId, role: auth.profile.role };
}

/**
 * The department a product belongs to, read from the database.
 *
 * A product's department is its category's, so this walks the join rather than
 * trusting anything the form submitted. `null` means the product does not exist or
 * has no resolvable department, which callers treat as not-found.
 */
async function departmentSlugForProduct(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  productId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("products")
    .select("product_categories(departments(slug))")
    .eq("id", productId)
    .maybeSingle();
  const category = data?.product_categories as
    | { departments: { slug: string } | null }
    | null
    | undefined;
  return category?.departments?.slug ?? null;
}

/**
 * Append images to a product's gallery.
 *
 * A product is sold on its gallery, so the editor uploading a second photograph
 * means "show both" — this appends rather than replacing. The first image becomes
 * primary; later ones are appended, exactly as the property gallery behaves.
 *
 * The form accepts several files at once, so a whole set of product photographs
 * is one submit rather than one submit per image. The files are stored in the
 * order the editor chose them, and the gallery's positions follow the existing
 * count so an append never renumbers what is already there.
 *
 * The department comes from the product, never from the request, so a product in
 * a department the caller may not edit is treated as not-found and the action and
 * the RLS write policy agree on the boundary.
 */
export async function uploadProductImageAction(
  formData: FormData,
): Promise<ProductMediaState> {
  const gate = await requireEditor();
  if (!gate.ok) return { ok: false, error: gate.error };

  const productId = String(formData.get("productId") ?? "").trim();
  if (!productId) return { ok: false, error: "not_found" };

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

  // The department comes from the product, never from the request. A product in
  // a department the caller may not edit is treated as not-found, so the action
  // and the RLS write policy agree on the boundary.
  const departmentSlug = await departmentSlugForProduct(admin, productId);
  if (!departmentSlug || !canAccessDepartment(gate.role, departmentSlug)) {
    return { ok: false, error: "not_found" };
  }

  const { count } = await admin
    .from("product_media")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);

  let position = count ?? 0;
  let stored = 0;
  // The first upload in this batch is primary only when the gallery was empty.
  let primaryTaken = position > 0;

  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const verdict = validateUpload(bytes, file.type, { kind: "product-image" });
    if (!verdict.ok) {
      // A batch that is partly invalid leaves the valid files in place rather
      // than rolling back a completed upload: the editor can see what landed and
      // retry only the file the message names.
      return stored > 0
        ? { ok: true, message: "image_added_partial" }
        : { ok: false, error: verdict.reason };
    }

    // UUID-based name so two uploads in the same second cannot collide, and the
    // extension comes from the detected type rather than the supplied filename.
    const objectPath = productMediaPath(
      productId,
      `${randomUUID()}.${verdict.extension}`,
    );

    const { error: uploadError } = await admin.storage
      .from(PRODUCT_MEDIA_BUCKET)
      .upload(objectPath, bytes, {
        contentType: verdict.mime,
        upsert: false,
      });
    if (uploadError) {
      return stored > 0
        ? { ok: true, message: "image_added_partial" }
        : {
            ok: false,
            error: "upload_failed",
            detail: describeSupabaseError(uploadError),
          };
    }

    const { error: insertError } = await admin.from("product_media").insert({
      product_id: productId,
      storage_path: objectPath,
      alt_text: altText.slice(0, 300),
      // The first photograph is the card/OG image; later ones are gallery only. A
      // partial unique index permits at most one primary per product.
      is_primary: !primaryTaken,
      position,
    });
    if (insertError) {
      await admin.storage.from(PRODUCT_MEDIA_BUCKET).remove([objectPath]);
      return stored > 0
        ? { ok: true, message: "image_added_partial" }
        : {
            ok: false,
            error: "write_failed",
            detail: describeSupabaseError(insertError),
          };
    }

    primaryTaken = true;
    position += 1;
    stored += 1;
  }

  await recordAudit({
    actorId: gate.userId,
    action: "product_updated",
    entityType: "product",
    entityId: productId,
    metadata: { field: "media_added", count: stored },
  });

  revalidatePath("/admin/store");
  revalidatePath(`/admin/store/${productId}`);
  revalidatePath("/sitemap.xml");
  revalidatePath(`/en${storePathFor(departmentSlug)}`);
  revalidatePath(`/fr${storePathFor(departmentSlug)}`);
  return { ok: true, message: "image_added" };
}

/**
 * Remove one image from a product.
 *
 * The row is deleted first, then the object: if the object removal fails the
 * orphan costs a few kilobytes, whereas the reverse order would delete the bytes
 * behind a row that still renders, producing a broken image.
 *
 * When the removed image was the primary one, the next image is promoted so the
 * product always has a card image for as long as it has any image at all — which
 * matters because a published product cannot exist without media.
 */
export async function removeProductImageAction(
  formData: FormData,
): Promise<ProductMediaState> {
  const gate = await requireEditor();
  if (!gate.ok) return { ok: false, error: gate.error };

  const productId = String(formData.get("productId") ?? "").trim();
  const mediaId = String(formData.get("mediaId") ?? "").trim();
  if (!productId || !mediaId) return { ok: false, error: "not_found" };

  const admin = createAdminClient();
  if (!admin)
    return {
      ok: false,
      error: "unconfigured",
      detail: missingAdminClientDetail(),
    };

  const departmentSlug = await departmentSlugForProduct(admin, productId);
  if (!departmentSlug || !canAccessDepartment(gate.role, departmentSlug)) {
    return { ok: false, error: "not_found" };
  }

  const { data: media } = await admin
    .from("product_media")
    .select("id, product_id, storage_path, is_primary")
    .eq("id", mediaId)
    .eq("product_id", productId)
    .maybeSingle();
  if (!media) return { ok: false, error: "not_found" };

  const { error: deleteError } = await admin
    .from("product_media")
    .delete()
    .eq("id", mediaId);
  if (deleteError)
    return {
      ok: false,
      error: "write_failed",
      detail: describeSupabaseError(deleteError),
    };

  await admin.storage.from(PRODUCT_MEDIA_BUCKET).remove([media.storage_path]);

  if (media.is_primary) {
    const { data: next } = await admin
      .from("product_media")
      .select("id")
      .eq("product_id", productId)
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (next) {
      await admin
        .from("product_media")
        .update({ is_primary: true })
        .eq("id", next.id);
    }
  }

  await recordAudit({
    actorId: gate.userId,
    action: "product_updated",
    entityType: "product",
    entityId: productId,
    metadata: { field: "media_removed" },
  });

  revalidatePath("/admin/store");
  revalidatePath(`/admin/store/${productId}`);
  revalidatePath("/sitemap.xml");
  revalidatePath(`/en${storePathFor(departmentSlug)}`);
  revalidatePath(`/fr${storePathFor(departmentSlug)}`);
  return { ok: true, message: "image_removed" };
}

/**
 * Choose which image is the card image.
 *
 * The first uploaded image is primary by default, but "the first one I happened
 * to send" is not necessarily the best front-of-card shot. Promoting one image
 * demotes the rest in a single statement, because the partial unique index
 * permits at most one primary per product — so the demote must happen before the
 * promote or the index rejects the write.
 */
export async function setProductPrimaryImageAction(
  formData: FormData,
): Promise<ProductMediaState> {
  const gate = await requireEditor();
  if (!gate.ok) return { ok: false, error: gate.error };

  const productId = String(formData.get("productId") ?? "").trim();
  const mediaId = String(formData.get("mediaId") ?? "").trim();
  if (!productId || !mediaId) return { ok: false, error: "not_found" };

  const admin = createAdminClient();
  if (!admin)
    return {
      ok: false,
      error: "unconfigured",
      detail: missingAdminClientDetail(),
    };

  const departmentSlug = await departmentSlugForProduct(admin, productId);
  if (!departmentSlug || !canAccessDepartment(gate.role, departmentSlug)) {
    return { ok: false, error: "not_found" };
  }

  const { data: media } = await admin
    .from("product_media")
    .select("id")
    .eq("id", mediaId)
    .eq("product_id", productId)
    .maybeSingle();
  if (!media) return { ok: false, error: "not_found" };

  const { error: demoteError } = await admin
    .from("product_media")
    .update({ is_primary: false })
    .eq("product_id", productId)
    .eq("is_primary", true);
  if (demoteError)
    return {
      ok: false,
      error: "write_failed",
      detail: describeSupabaseError(demoteError),
    };

  const { error: promoteError } = await admin
    .from("product_media")
    .update({ is_primary: true })
    .eq("id", mediaId);
  if (promoteError)
    return {
      ok: false,
      error: "write_failed",
      detail: describeSupabaseError(promoteError),
    };

  await recordAudit({
    actorId: gate.userId,
    action: "product_updated",
    entityType: "product",
    entityId: productId,
    metadata: { field: "primary_image_set", media_id: mediaId },
  });

  revalidatePath("/admin/store");
  revalidatePath(`/admin/store/${productId}`);
  revalidatePath("/sitemap.xml");
  revalidatePath(`/en${storePathFor(departmentSlug)}`);
  revalidatePath(`/fr${storePathFor(departmentSlug)}`);
  return { ok: true, message: "primary_set" };
}

/**
 * Publish or unpublish a product.
 *
 * The publish branch is deliberately not "set the flag and hope": the database
 * rejects a product with no image, so the failure is caught and translated into a
 * message the editor can act on rather than surfacing as an unhandled error. The
 * same check is repeated here so the editor gets that message from the UI and not
 * only from the database.
 */
export async function setProductPublishedAction(
  formData: FormData,
): Promise<ProductMediaState> {
  const gate = await requireEditor();
  if (!gate.ok) return { ok: false, error: gate.error };

  const productId = String(formData.get("productId") ?? "").trim();
  if (!productId) return { ok: false, error: "not_found" };
  const publish = String(formData.get("publish") ?? "") === "true";

  const admin = createAdminClient();
  if (!admin)
    return {
      ok: false,
      error: "unconfigured",
      detail: missingAdminClientDetail(),
    };

  const departmentSlug = await departmentSlugForProduct(admin, productId);
  if (!departmentSlug || !canAccessDepartment(gate.role, departmentSlug)) {
    return { ok: false, error: "not_found" };
  }

  if (publish) {
    const { count } = await admin
      .from("product_media")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId);
    if (!count) return { ok: false, error: "no_image" };
  }

  const { error } = await admin
    .from("products")
    .update({
      publish_state: publish ? "published" : "draft",
      published_at: publish ? new Date().toISOString() : null,
    })
    .eq("id", productId);

  if (error)
    return {
      ok: false,
      error: "write_failed",
      detail: describeSupabaseError(error),
    };

  await recordAudit({
    actorId: gate.userId,
    action: publish ? "product_published" : "product_updated",
    entityType: "product",
    entityId: productId,
    metadata: { publish_state: publish ? "published" : "draft" },
  });

  revalidatePath("/admin/store");
  revalidatePath(`/admin/store/${productId}`);
  // The site reads the catalogue at request time, but the sitemap carries the
  // product's `lastmod`. Revalidating it is what tells a crawler the entry moved.
  revalidatePath("/sitemap.xml");
  revalidatePath(`/en${storePathFor(departmentSlug)}`);
  revalidatePath(`/fr${storePathFor(departmentSlug)}`);
  return { ok: true, message: publish ? "published" : "unpublished" };
}
