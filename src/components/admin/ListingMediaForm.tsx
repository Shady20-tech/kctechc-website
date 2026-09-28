"use client";

import Image from "next/image";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { propertyMediaPublicUrl } from "@/lib/real-estate/storage";
import {
  removeListingImageAction,
  uploadListingImageAction,
  type ListingMediaState,
} from "@/lib/real-estate/media-actions";
import type { ListingImage } from "@/lib/real-estate/types";

/**
 * Listing gallery manager.
 *
 * Two forms — one to add an image, one per existing image to remove it — kept
 * apart so an upload rejection and a delete confirmation never share an outcome.
 * Each delete form carries its own `useActionState`, which is what makes the
 * failure land next to the thumbnail it belongs to instead of under the wrong
 * one.
 *
 * The gallery order is positional and the first image is the card image, so the
 * list is rendered in the order the database returns and the primary one is
 * labelled rather than being visually inferred from its size.
 */
export function ListingMediaForm({
  listingId,
  images,
  labels,
}: {
  listingId: string;
  images: readonly ListingImage[];
  labels: Record<string, string>;
}) {
  const [uploadState, uploadAction] = useActionState(
    async (_prev: ListingMediaState | null, formData: FormData) =>
      uploadListingImageAction(formData),
    null as ListingMediaState | null,
  );

  return (
    <div className="space-y-8">
      <section aria-labelledby="listing-images-heading" className="space-y-4">
        <div>
          <h2
            id="listing-images-heading"
            className="text-lg font-semibold text-ink-900"
          >
            {labels.imagesHeading}
          </h2>
          <p className="mt-1 text-sm text-body">{labels.imagesIntro}</p>
        </div>

        {uploadState && !uploadState.ok ? (
          <Notice tone="error">
            {labels[`errors.${uploadState.error}`] ??
              labels["errors.upload_failed"]}
          </Notice>
        ) : null}
        {uploadState?.ok ? (
          <Notice tone="success">{labels.imageAdded}</Notice>
        ) : null}

        {images.length === 0 ? (
          <p className="text-sm text-muted">{labels.noImagesYet}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((image) => {
              const url = propertyMediaPublicUrl(image.storagePath);
              return (
                <li
                  key={image.id}
                  className="space-y-3 rounded-card border border-border p-3"
                >
                  {url ? (
                    <Image
                      src={url}
                      alt={image.alt}
                      width={480}
                      height={320}
                      className="h-40 w-full rounded-card object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="h-40 w-full rounded-card bg-ink-100" />
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

                  {image.caption ? (
                    <p className="text-xs text-body">{image.caption}</p>
                  ) : null}

                  <RemoveImageForm
                    listingId={listingId}
                    mediaId={image.id}
                    labels={labels}
                  />
                </li>
              );
            })}
          </ul>
        )}

        <form action={uploadAction} className="space-y-3">
          <input type="hidden" name="listingId" value={listingId} />
          <label className="block text-sm font-medium text-ink-900">
            {labels.altLabel}
            <input
              type="text"
              name="altText"
              required
              maxLength={300}
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
            className="block text-sm text-body file:mr-3 file:rounded-field file:border file:border-border-strong file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium"
          />
          <SubmitButton
            label={labels.imageUpload}
            pendingLabel={labels.imageUploading}
          />
        </form>
      </section>
    </div>
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
  listingId,
  mediaId,
  labels,
}: {
  listingId: string;
  mediaId: string;
  labels: Record<string, string>;
}) {
  const [state, action] = useActionState(
    async (_prev: ListingMediaState | null, formData: FormData) =>
      removeListingImageAction(formData),
    null as ListingMediaState | null,
  );

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="mediaId" value={mediaId} />
      {state && !state.ok ? (
        <p className="text-xs text-danger">
          {labels[`errors.${state.error}`] ?? labels["errors.write_failed"]}
        </p>
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
  variant,
}: {
  label: string | undefined;
  pendingLabel: string | undefined;
  variant?: "danger";
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="sm"
      variant={variant}
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? (pendingLabel ?? "…") : (label ?? "Save")}
    </Button>
  );
}
