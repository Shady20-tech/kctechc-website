"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { getAuthState } from "@/lib/auth/session";
import { isElevatedRole } from "@/lib/auth/roles";
import { recordAudit } from "@/lib/security/audit";
import { PRODUCT_MEDIA_BUCKET, productMediaPath } from "@/lib/store/storage";
import { createAdminClient } from "@/lib/supabase/admin";
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
  | { ok: false; error: string };

async function requireElevated(): Promise<
  | { ok: true; userId: string }
  | { ok: false; error: "unauthenticated" | "forbidden" | "unconfigured" }
> {
  const auth = await getAuthState();
  if (auth.status === "unconfigured")
    return { ok: false, error: "unconfigured" };
  if (auth.status !== "authenticated") {
    return { ok: false, error: "unauthenticated" };
  }
  if (!auth.profile || !isElevatedRole(auth.profile.role)) {
    return { ok: false, error: "forbidden" };
  }
  return { ok: true, userId: auth.userId };
}

/**
 * Attach an image to a product and make it the primary one.
 *
 * The first image a product receives becomes primary. A later upload replaces the
 * primary rather than appending, because the storefront renders one image per
 * card and the editor uploading a second photo means "use this one", not "keep
 * both and I cannot tell which is shown". The previous object is removed after the
 * row is repointed, so a failure mid-way leaves the old image in place.
 */
export async function uploadProductImageAction(
  formData: FormData,
): Promise<ProductMediaState> {
  const gate = await requireElevated();
  if (!gate.ok) return { ok: false, error: gate.error };

  const productId = String(formData.get("productId") ?? "").trim();
  if (!productId) return { ok: false, error: "not_found" };

  const altText = String(formData.get("altText") ?? "").trim();
  if (altText.length === 0) return { ok: false, error: "alt_required" };

  const file = formData.get("image");
  if (!(file instanceof File)) return { ok: false, error: "no_file" };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const verdict = validateUpload(bytes, file.type, { kind: "product-image" });
  if (!verdict.ok) return { ok: false, error: verdict.reason };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "unconfigured" };

  const { data: product } = await admin
    .from("products")
    .select("id")
    .eq("id", productId)
    .maybeSingle();
  if (!product) return { ok: false, error: "not_found" };

  const { data: existing } = await admin
    .from("product_media")
    .select("id, storage_path")
    .eq("product_id", productId)
    .eq("is_primary", true)
    .maybeSingle();

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
  if (uploadError) return { ok: false, error: "upload_failed" };

  // Demote the current primary before promoting the new row: a partial unique
  // index allows only one primary per product, so the order matters.
  if (existing) {
    const { error: demoteError } = await admin
      .from("product_media")
      .update({ is_primary: false })
      .eq("id", existing.id);
    if (demoteError) {
      await admin.storage.from(PRODUCT_MEDIA_BUCKET).remove([objectPath]);
      return { ok: false, error: "write_failed" };
    }
  }

  const { error: insertError } = await admin.from("product_media").insert({
    product_id: productId,
    storage_path: objectPath,
    alt_text: altText.slice(0, 300),
    is_primary: true,
    position: 0,
  });
  if (insertError) {
    if (existing) {
      await admin
        .from("product_media")
        .update({ is_primary: true })
        .eq("id", existing.id);
    }
    await admin.storage.from(PRODUCT_MEDIA_BUCKET).remove([objectPath]);
    return { ok: false, error: "write_failed" };
  }

  if (existing) {
    await admin.from("product_media").delete().eq("id", existing.id);
    if (existing.storage_path !== objectPath) {
      await admin.storage
        .from(PRODUCT_MEDIA_BUCKET)
        .remove([existing.storage_path]);
    }
  }

  await recordAudit({
    actorId: gate.userId,
    action: "product_updated",
    entityType: "product",
    entityId: productId,
    metadata: { field: "primary_image", bytes: bytes.byteLength },
  });

  revalidatePath("/admin/store");
  revalidatePath(`/admin/store/${productId}`);
  revalidatePath("/sitemap.xml");
  revalidatePath("/en/digital-marketing/store");
  revalidatePath("/fr/digital-marketing/store");
  return { ok: true, message: "image_added" };
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
  const gate = await requireElevated();
  if (!gate.ok) return { ok: false, error: gate.error };

  const productId = String(formData.get("productId") ?? "").trim();
  if (!productId) return { ok: false, error: "not_found" };
  const publish = String(formData.get("publish") ?? "") === "true";

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "unconfigured" };

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

  if (error) return { ok: false, error: "write_failed" };

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
  revalidatePath("/en/digital-marketing/store");
  revalidatePath("/fr/digital-marketing/store");
  return { ok: true, message: publish ? "published" : "unpublished" };
}
