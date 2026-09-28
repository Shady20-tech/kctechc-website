"use client";

import Image from "next/image";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import {
  setProductPublishedAction,
  uploadProductImageAction,
  type ProductMediaState,
} from "@/lib/store/media-actions";

/**
 * Product image and publish controls.
 *
 * Two separate forms, because they have different prerequisites: the image can be
 * uploaded at any time, while publishing is only possible once an image exists.
 * Keeping them apart means a rejected upload or a blocked publish never discards
 * the other's outcome, and the editor can see which of the two is outstanding.
 *
 * The publish control is disabled rather than hidden when there is no image, so
 * the reason the product is still a draft stays visible instead of the button
 * quietly not being there.
 */
export function ProductMediaForm({
  productId,
  currentImageUrl,
  altText,
  published,
  hasImage,
  labels,
}: {
  productId: string;
  currentImageUrl: string | null;
  altText: string;
  published: boolean;
  hasImage: boolean;
  labels: Record<string, string>;
}) {
  const [imageState, imageAction, imagePending] = useActionState(
    async (_prev: ProductMediaState | null, formData: FormData) =>
      uploadProductImageAction(formData),
    null as ProductMediaState | null,
  );
  const [publishState, publishAction, publishPending] = useActionState(
    async (_prev: ProductMediaState | null, formData: FormData) =>
      setProductPublishedAction(formData),
    null as ProductMediaState | null,
  );
  void imagePending;
  void publishPending;

  return (
    <div className="space-y-8">
      <section aria-labelledby="product-image-heading" className="space-y-4">
        <div>
          <h2
            id="product-image-heading"
            className="text-lg font-semibold text-ink-900"
          >
            {labels.imageHeading}
          </h2>
          <p className="mt-1 text-sm text-body">{labels.imageIntro}</p>
        </div>

        {imageState && !imageState.ok ? (
          <Notice tone="error">
            {labels[`errors.${imageState.error}`] ?? labels["errors.upload_failed"]}
          </Notice>
        ) : null}
        {imageState?.ok ? (
          <Notice tone="success">{labels.imageAdded}</Notice>
        ) : null}

        {currentImageUrl ? (
          <Image
            src={currentImageUrl}
            alt={altText}
            width={480}
            height={480}
            className="h-auto w-full max-w-xs rounded-card border border-border object-cover"
            unoptimized
          />
        ) : (
          <p className="text-sm text-muted">{labels.noImageYet}</p>
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
              defaultValue={altText}
              placeholder={labels.altPlaceholder}
              className="mt-1 block w-full rounded-card border border-border bg-surface px-3 py-2 text-sm"
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
            className="block text-sm text-body file:mr-3 file:rounded-card file:border file:border-border-strong file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium"
          />
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
            {labels[`errors.${publishState.error}`] ?? labels["errors.write_failed"]}
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

function SubmitButton({
  label,
  pendingLabel,
  disabled,
}: {
  label: string | undefined;
  pendingLabel: string | undefined;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="sm"
      disabled={pending || disabled}
      aria-busy={pending}
    >
      {pending ? (pendingLabel ?? "…") : (label ?? "Save")}
    </Button>
  );
}
