import { notFound } from "next/navigation";

import { DeleteContentForm } from "@/components/admin/DeleteContentForm";
import { ProductForm } from "@/components/admin/ProductForm";
import { ProductMediaForm } from "@/components/admin/ProductMediaForm";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageIntro } from "@/components/ui/PageIntro";
import { requireRole } from "@/lib/auth/guards";
import { DEPARTMENT_EDITOR_ROLES, isSuperAdminRole } from "@/lib/auth/roles";
import {
  departmentsForRole,
  loadEditableDepartments,
} from "@/lib/content/project-admin-queries";
import { createTranslator } from "@/lib/i18n/translator";
import { deleteProductAction } from "@/lib/store/admin-actions";
import { loadProductForAdmin } from "@/lib/store/admin-queries";
import { loadCategoryOptions } from "@/lib/store/loaders";
import { storagePublicUrl } from "@/lib/store/storage";
import { primaryImage } from "@/lib/store/types";

export const dynamic = "force-dynamic";

/**
 * Admin: a single product, its image and its publish state.
 *
 * This is the page the create form promises ("add an image, then publish it from
 * the product list"). Without it a product could only ever be a draft: the schema
 * refuses to publish a product with no image, and there was nowhere to attach one.
 *
 * The read is scoped to the departments the caller may author, so a guessed id for
 * another department's published product 404s rather than opening a form whose
 * save the department write policy would then refuse — the same treatment
 * `getAdminProject` gives a project.
 */
export default async function AdminProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireRole(
    [...DEPARTMENT_EDITOR_ROLES],
    "/admin/store",
  );
  const { id } = await params;
  const t = createTranslator("en").t;

  const product = await loadProductForAdmin(
    id,
    departmentsForRole(profile.role),
  );
  if (!product) notFound();

  const [categories, editableDepartments] = await Promise.all([
    loadCategoryOptions(),
    loadEditableDepartments(profile.role),
  ]);
  const allowed = new Set<string>(
    editableDepartments.map((row) => row.slug),
  );
  const offeredCategories = categories
    .filter((category) => allowed.has(category.departmentSlug))
    .map((category) => ({
      id: category.id,
      name: category.name,
      departmentSlug: category.departmentSlug,
    }));
  const offeredDepartments = editableDepartments.map((row) => ({
    slug: row.slug,
    name: row.name,
  }));
  const canDelete = isSuperAdminRole(profile.role);

  const image = primaryImage(product.images);
  const published = product.publishState === "published";

  // Admin shows the *uploaded* assets only. A seeded package's `storage_path` is a
  // placeholder with no object behind it, and showing its bundled brochure image
  // here would imply an upload the editor could replace.
  const gallery = product.images.map((entry) => ({
    id: entry.id,
    url: entry.storagePath ? storagePublicUrl(entry.storagePath) : null,
    alt: entry.alt,
    isPrimary: entry.isPrimary,
    position: entry.position,
  }));

  const labels: Record<string, string> = {
    imagesHeading: t("admin.store.imagesHeading"),
    imagesIntro: t("admin.store.imagesIntro"),
    imageUpload: t("admin.store.imageUpload"),
    imageUploading: t("admin.store.imageUploading"),
    imageAdded: t("admin.store.imageAdded"),
    imageAddedPartial: t("admin.store.imageAddedPartial"),
    imageUploadMultipleHint: t("admin.store.imageUploadMultipleHint"),
    makePrimary: t("admin.store.makePrimary"),
    primarySet: t("admin.store.primarySet"),
    imageRemove: t("admin.store.imageRemove"),
    imageRemoved: t("admin.store.imageRemoved"),
    primaryBadge: t("admin.store.primaryBadge"),
    positionLabel: t("admin.store.positionLabel"),
    noImageYet: t("admin.store.noImageYet"),
    altLabel: t("admin.store.altLabel"),
    altPlaceholder: t("admin.store.altPlaceholder"),
    altHint: t("admin.store.altHint"),
    publishHeading: t("admin.store.publishHeading"),
    publishIntro: t("admin.store.publishIntro"),
    publishNeedsImage: t("admin.store.publishNeedsImage"),
    publish: t("admin.store.publish"),
    unpublish: t("admin.store.unpublish"),
    publishedNotice: t("admin.store.publishedNotice"),
    unpublishedNotice: t("admin.store.unpublishedNotice"),
    imagesLimitHint: t("admin.store.imageLimitHint"),
    saving: t("adminContent.saving"),
  };
  for (const key of [
    "unauthenticated",
    "forbidden",
    "unconfigured",
    "not_found",
    "no_file",
    "alt_required",
    "upload_failed",
    "write_failed",
    "no_image",
    "too_large",
    "type_not_allowed",
    "unknown_type",
  ]) {
    labels[`errors.${key}`] = t(`admin.store.errors.${key}`);
  }

  return (
    <>
      <PageIntro
        eyebrow={t("admin.store.catalogueHeading")}
        heading={product.title}
        intro={`${product.sku} · ${product.categoryName}`}
      />

      <div className="mt-6">
        <Badge tone={published ? "success" : "neutral"}>
          {published
            ? t("admin.store.statusPublished")
            : t("admin.store.statusDraft")}
        </Badge>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <Card as="section">
          <h2 className="text-lg font-semibold text-ink-900">
            {t("admin.store.detailsHeading")}
          </h2>
          <dl className="mt-3 space-y-2 text-sm">
            {[
              [t("admin.store.columnPrice"), product.priceMinor.toLocaleString("en")],
              [t("admin.store.columnStock"), String(product.stock)],
              [t("admin.store.columnStatus"), product.publishState],
              [t("admin.store.columnSku"), product.sku],
              [t("admin.store.columnCategory"), product.categoryName],
            ].map(([term, value]) => (
              <div key={term} className="flex justify-between gap-4">
                <dt className="text-muted">{term}</dt>
                <dd className="text-body">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm text-body">{product.shortDescription}</p>
        </Card>

        <div>
          <ProductMediaForm
            productId={product.id}
            images={gallery}
            altText={image?.alt ?? product.title}
            published={published}
            labels={labels}
          />
        </div>
      </div>

      <section className="mt-12" aria-labelledby="product-edit-heading">
        <h2
          id="product-edit-heading"
          className="font-display text-xl font-bold text-ink-900"
        >
          {t("admin.store.editHeading")}
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-body">
          {t("admin.store.editIntro")}
        </p>
        <div className="mt-6">
          <ProductForm
            categories={offeredCategories}
            departments={offeredDepartments}
            locale="en"
            initial={{
              id: product.id,
              title: product.title,
              slug: product.slug,
              sku: product.sku,
              categoryId: product.categoryId,
              shortDescription: product.shortDescription,
              description: product.description,
              brand: product.brand,
              productReference: product.productReference,
              priceMinor: product.priceMinor,
              stock: product.stock,
              departmentSlug: product.departmentSlug,
              seoTitle: product.seoTitle,
              seoDescription: product.seoDescription,
            }}
          />
        </div>
      </section>

      {canDelete ? (
        <div className="mt-12">
          <DeleteContentForm
            entityLabel={t("admin.deleteForm.entityProduct")}
            action={deleteProductAction.bind(null, product.id)}
            locale="en"
          />
        </div>
      ) : null}
    </>
  );
}
