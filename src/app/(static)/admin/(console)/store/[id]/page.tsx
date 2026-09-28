import { notFound } from "next/navigation";

import { ProductMediaForm } from "@/components/admin/ProductMediaForm";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageIntro } from "@/components/ui/PageIntro";
import { requireRole } from "@/lib/auth/guards";
import { ELEVATED_ROLES } from "@/lib/auth/roles";
import { createTranslator } from "@/lib/i18n/translator";
import { loadProductForAdmin } from "@/lib/store/admin-queries";
import { storagePublicUrl } from "@/lib/store/storage";
import { primaryImage } from "@/lib/store/types";

export const dynamic = "force-dynamic";

/**
 * Admin: a single product, its image and its publish state.
 *
 * This is the page the create form promises ("add an image, then publish it from
 * the product list"). Without it a product could only ever be a draft: the schema
 * refuses to publish a product with no image, and there was nowhere to attach one.
 */
export default async function AdminProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole([...ELEVATED_ROLES], "/admin/store");
  const { id } = await params;
  const t = createTranslator("en").t;

  const product = await loadProductForAdmin(id);
  if (!product) notFound();

  const image = primaryImage(product.images);
  const currentImageUrl = image ? storagePublicUrl(image.storagePath) : null;
  const published = product.publishState === "published";

  const labels: Record<string, string> = {
    imageHeading: t("admin.store.imageHeading"),
    imageIntro: t("admin.store.imageIntro"),
    imageUpload: t("admin.store.imageUpload"),
    imageUploading: t("admin.store.imageUploading"),
    imageAdded: t("admin.store.imageAdded"),
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
            currentImageUrl={currentImageUrl}
            altText={image?.alt ?? product.title}
            published={published}
            hasImage={product.images.length > 0}
            labels={labels}
          />
        </div>
      </div>
    </>
  );
}
