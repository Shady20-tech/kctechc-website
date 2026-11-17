"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import {
  MAX_PRODUCT_IMAGE_BYTES,
  exceedsSizeLimit,
  megabytes,
} from "@/lib/uploads/limits";
import {
  removeProductImageAction,
  setProductPrimaryImageAction,
  setProductPublishedAction,
  uploadProductImageAction,
  type ProductMediaState,
} from "@/lib/store/media-actions";

/** One image as the admin page resolves it for display. */
export type ProductGalleryImage = {
  id: string;
  url: string | null;
  alt: string;
  isPrimary: boolean;
  position: number;
};

/**
 * Product gallery and publish controls.
 *
 * Three separate forms, because they have different prerequisites: images can be
 * added at any time, the card image may be chosen once there is more than one, and
 * publishing is only possible once at least one image exists. Keeping them apart
 * means a rejected upload or a blocked publish never discards the other's outcome,
 * and the editor can see which of them is outstanding.
 *
 * The gallery is a list, so a product shows every photograph the editor uploads —
 * the card image is the one flagged primary, and the rest are gallery only. The
 * file input accepts several files at once, so a whole set of product photographs
 * is one submit. Each image is removed by its own form, so a failure lands beside
 * the thumbnail it belongs to rather than under the wrong one.
 *
 * The publish control is disabled rather than hidden when there is no image, so
 * the reason the product is still a draft stays visible instead of the button
 * quietly not being there.
 */
export function ProductMediaForm({
  productId,
  images,
  altText,
  published,
  labels,
}: {
  productId: string;
  images: readonly ProductGalleryImage[];
  altText: string;
  published: boolean;
  labels: Record<string, string>;
}) {
  const [imageState, imageAction] = useActionState(
    async (_prev: ProductMediaState | null, formData: FormData) =>
      uploadProductImageAction(formData),
    null as ProductMediaState | null,
  );
  const [publishState, publishAction] = useActionState(
    async (_prev: ProductMediaState | null, formData: FormData) =>
      setProductPublishedAction(formData),
    null as ProductMediaState | null,
  );

  const hasImage = images.length > 0;

  // A phone photograph is often larger than the accepted limit, and the Server
  // Action refuses it after the bytes have crossed the network. Catching it here
  // reports the problem while the editor is still choosing files.
  const [fileTooLarge, setFileTooLarge] = useState(false);

  return (
    <div className="space-y-8">
      <section aria-labelledby="product-image-heading" className="space-y-4">
        <div>
          <h2
            id="product-image-heading"
            className="text-lg font-semibold text-ink-900"
          >
            {labels.imagesHeading}
          </h2>
          <p className="mt-1 text-sm text-body">{labels.imagesIntro}</p>
        </div>

        {imageState && !imageState.ok ? (
          <Notice tone="error">
            {labels[`errors.${imageState.error}`] ??
              labels["errors.upload_failed"]}
          </Notice>
        ) : null}
        {imageState?.ok ? (
          <Notice tone="success">
            {imageState.message === "image_added_partial"
              ? labels.imageAddedPartial
              : labels.imageAdded}
          </Notice>
        ) : null}
        {fileTooLarge ? (
          <Notice tone="error">
            {labels["errors.too_large"] ?? labels["errors.upload_failed"]}
          </Notice>
        ) : null}

        {images.length === 0 ? (
          <p className="text-sm text-muted">{labels.noImageYet}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((image) => (
              <li
                key={image.id}
                className="space-y-3 rounded-card border border-border p-3"
              >
                {image.url ? (
                  <Image
                    src={image.url}
                    alt={image.alt}
                    width={480}
                    height={480}
                    className="h-44 w-full rounded-card object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="h-44 w-full rounded-card bg-ink-100" />
                )}

                <div className="flex items-center gap-2">
                  {image.isPrimary ? (
                    <span className="rounded-pill bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">
                      {labels.primaryBadge}
                    </span>
                  ) : null}
                  <span className="text-xs text-muted">
                    {labels.positionLabel} {image.position + 1}
                  </span>
                </div>

                <p className="text-xs text-body">{image.alt}</p>

                <div className="flex flex-wrap items-center gap-2">
                  {!image.isPrimary ? (
                    <PrimaryImageForm
                      productId={productId}
                      mediaId={image.id}
                      labels={labels}
                    />
                  ) : null}
                  <RemoveImageForm
                    productId={productId}
                    mediaId={image.id}
                    labels={labels}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}

        <form action={imageAction} className="space-y-3">
          <input type="hidden" name="productId" value={productId} />
          <label className="block text-sm font-medium text-ink-900">
            {labels.altLabel}
            <input
              type="text"
              name="altText"
              required
              maxLength={300}
              defaultValue={images.length === 0 ? altText : ""}
              placeholder={labels.altPlaceholder}
              className="mt-1 block w-full rounded-field border border-border bg-surface px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-xs text-muted">
              {labels.altHint}
            </span>
          </label>
          <input
            type="file"
            name="image"
            accept="image/jpeg,image/png,image/webp,image/avif"
            required
            multiple
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              setFileTooLarge(
                files.some((file) =>
                  exceedsSizeLimit(file, MAX_PRODUCT_IMAGE_BYTES),
                ),
              );
            }}
            className="block text-sm text-body file:mr-3 file:rounded-field file:border file:border-border-strong file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium"
          />
          <p className="text-xs text-muted">
            {labels.imagesLimitHint?.replace(
              "{size}",
              String(megabytes(MAX_PRODUCT_IMAGE_BYTES)),
            )}{" "}
            {labels.imageUploadMultipleHint}
          </p>
          <SubmitButton
            label={labels.imageUpload}
            pendingLabel={labels.imageUploading}
          />
        </form>
      </section>

      <section aria-labelledby="product-publish-heading" className="space-y-4">
        <div>
          <h2
            id="product-publish-heading"
            className="text-lg font-semibold text-ink-900"
          >
            {labels.publishHeading}
          </h2>
          <p className="mt-1 text-sm text-body">
            {hasImage ? labels.publishIntro : labels.publishNeedsImage}
          </p>
        </div>

        {publishState && !publishState.ok ? (
          <Notice tone="error">
            {labels[`errors.${publishState.error}`] ??
              labels["errors.write_failed"]}
          </Notice>
        ) : null}
        {publishState?.ok ? (
          <Notice tone="success">
            {published ? labels.publishedNotice : labels.unpublishedNotice}
          </Notice>
        ) : null}

        <form action={publishAction}>
          <input type="hidden" name="productId" value={productId} />
          <input
            type="hidden"
            name="publish"
            value={published ? "false" : "true"}
          />
          <SubmitButton
            label={published ? labels.unpublish : labels.publish}
            pendingLabel={labels.saving}
            disabled={!published && !hasImage}
          />
        </form>
      </section>
    </div>
  );
}

/**
 * Promote one image to be the card image.
 *
 * Its own component because `useActionState` is a hook and cannot be called inside
 * the map above, and because the outcome belongs beside the thumbnail it acts on.
 */
function PrimaryImageForm({
  productId,
  mediaId,
  labels,
}: {
  productId: string;
  mediaId: string;
  labels: Record<string, string>;
}) {
  const [state, action] = useActionState(
    async (_prev: ProductMediaState | null, formData: FormData) =>
      setProductPrimaryImageAction(formData),
    null as ProductMediaState | null,
  );

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="mediaId" value={mediaId} />
      {state && !state.ok ? (
        <p className="text-xs text-danger">
          {labels[`errors.${state.error}`] ?? labels["errors.write_failed"]}
        </p>
      ) : null}
      {state?.ok ? (
        <p className="text-xs text-success">{labels.primarySet}</p>
      ) : null}
      <SubmitButton
        label={labels.makePrimary}
        pendingLabel={labels.saving}
        variant="secondary"
      />
    </form>
  );
}

/**
 * Remove one image.
 *
 * Its own component because `useActionState` is a hook and cannot be called
 * inside the map above. Splitting it also keeps each pending and error state
 * scoped to the row it belongs to.
 */
function RemoveImageForm({
  productId,
  mediaId,
  labels,
}: {
  productId: string;
  mediaId: string;
  labels: Record<string, string>;
}) {
  const [state, action] = useActionState(
    async (_prev: ProductMediaState | null, formData: FormData) =>
      removeProductImageAction(formData),
    null as ProductMediaState | null,
  );

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="mediaId" value={mediaId} />
      {state && !state.ok ? (
        <p className="text-xs text-danger">
          {labels[`errors.${state.error}`] ?? labels["errors.write_failed"]}
        </p>
      ) : null}
      {state?.ok ? (
        <p className="text-xs text-success">{labels.imageRemoved}</p>
      ) : null}
      <SubmitButton
        label={labels.imageRemove}
        pendingLabel={labels.saving}
        variant="danger"
      />
    </form>
  );
}

function SubmitButton({
  label,
  pendingLabel,
  disabled,
  variant,
}: {
  label: string | undefined;
  pendingLabel: string | undefined;
  disabled?: boolean;
  variant?: "danger" | "secondary";
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="sm"
      variant={variant}
      disabled={pending || disabled}
      aria-busy={pending}
    >
      {pending ? (pendingLabel ?? "…") : (label ?? "Save")}
    </Button>
  );
}
