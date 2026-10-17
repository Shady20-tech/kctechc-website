"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import {
  MAX_CONTENT_IMAGE_BYTES,
  exceedsSizeLimit,
  megabytes,
} from "@/lib/uploads/limits";
import {
  removeInsightImageAction,
  uploadInsightImageAction,
  type ContentState,
} from "@/lib/content/admin-actions";

export type InsightGalleryItem = {
  id: string;
  url: string | null;
  altText: string;
  caption: string | null;
  credit: string | null;
};

/**
 * Article photography.
 *
 * Upload and removal are separate forms so a rejected upload never discards the
 * outcome of a removal, and each image carries its own remove control — the
 * editor acts on the image they are looking at rather than on a hidden selection.
 *
 * The cover image stays on the article row; this is the gallery that sits inside
 * the post. An image added here is also reachable from the body: the editor can
 * place `![alt](url)` on its own line to render it in the article text, and the
 * upload result shows the exact snippet to copy.
 */
export function InsightGalleryForm({
  id,
  media,
  labels,
}: {
  id: string;
  media: readonly InsightGalleryItem[];
  labels: Record<string, string>;
}) {
  const [uploadState, uploadAction] = useActionState(
    async (_prev: ContentState | null, formData: FormData) =>
      uploadInsightImageAction(formData),
    null as ContentState | null,
  );
  const [fileTooLarge, setFileTooLarge] = useState(false);

  return (
    <section aria-labelledby="gallery-heading" className="space-y-6">
      <div>
        <h2 id="gallery-heading" className="text-lg font-semibold text-ink-900">
          {labels.galleryHeading}
        </h2>
        <p className="mt-1 text-sm text-body">{labels.galleryIntro}</p>
      </div>

      {uploadState && !uploadState.ok ? (
        <Notice tone="error">
          {labels[`errors.${uploadState.error}`] ??
            labels["errors.upload_failed"] ??
            ""}
        </Notice>
      ) : null}
      {uploadState?.ok ? (
        <Notice tone="success">{labels.galleryImageAdded}</Notice>
      ) : null}
      {fileTooLarge ? (
        <Notice tone="error">
          {labels["errors.too_large"] ?? labels["errors.upload_failed"] ?? ""}
        </Notice>
      ) : null}

      {media.length === 0 ? (
        <p className="text-sm text-muted">{labels.galleryEmpty}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {media.map((item) => (
            <li
              key={item.id}
              className="overflow-hidden rounded-card border border-border bg-surface"
            >
              {item.url ? (
                <Image
                  src={item.url}
                  alt={item.altText}
                  width={480}
                  height={320}
                  className="h-40 w-full object-cover"
                  unoptimized
                />
              ) : (
                <div className="h-40 w-full bg-surface-alt" />
              )}
              <div className="space-y-2 p-3">
                <p className="text-sm text-body">{item.altText}</p>
                {item.caption ? (
                  <p className="text-xs text-muted">{item.caption}</p>
                ) : null}
                {item.url ? (
                  <p className="break-all font-mono text-xs text-muted">
                    {`![${item.altText}](${item.url})`}
                  </p>
                ) : null}
                <RemoveImageForm
                  mediaId={item.id}
                  label={labels.galleryRemove}
                  pendingLabel={labels.saving}
                  errors={labels}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <form
        action={uploadAction}
        className="space-y-3 border-t border-border pt-4"
      >
        <input type="hidden" name="id" value={id} />

        <label className="block text-sm font-medium text-ink-900">
          {labels.altLabel}
          <input
            type="text"
            name="altText"
            required
            maxLength={300}
            className="mt-1 block w-full rounded-field border border-border bg-surface px-3 py-2 text-sm"
          />
          <span className="mt-1 block text-xs text-muted">
            {labels.altHint}
          </span>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-ink-900">
            {labels.captionLabel}
            <input
              type="text"
              name="caption"
              maxLength={400}
              className="mt-1 block w-full rounded-field border border-border bg-surface px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-ink-900">
            {labels.creditLabel}
            <input
              type="text"
              name="credit"
              maxLength={200}
              className="mt-1 block w-full rounded-field border border-border bg-surface px-3 py-2 text-sm"
            />
          </label>
        </div>

        <input
          type="file"
          name="image"
          accept="image/jpeg,image/png,image/webp,image/avif"
          required
          onChange={(event) =>
            setFileTooLarge(
              exceedsSizeLimit(
                event.target.files?.[0],
                MAX_CONTENT_IMAGE_BYTES,
              ),
            )
          }
          className="block text-sm text-body file:mr-3 file:rounded-field file:border file:border-border-strong file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium"
        />
        <p className="text-xs text-muted">
          {labels.galleryLimitHint?.replace(
            "{size}",
            String(megabytes(MAX_CONTENT_IMAGE_BYTES)),
          )}
        </p>

        <SubmitButton
          label={labels.galleryUpload}
          pendingLabel={labels.galleryUploading}
        />
      </form>
    </section>
  );
}

/** One image's removal control, with its own action state so errors stay local. */
function RemoveImageForm({
  mediaId,
  label,
  pendingLabel,
  errors,
}: {
  mediaId: string;
  label: string | undefined;
  pendingLabel: string | undefined;
  errors: Record<string, string>;
}) {
  const [state, action] = useActionState(
    async (_prev: ContentState | null, formData: FormData) =>
      removeInsightImageAction(formData),
    null as ContentState | null,
  );

  return (
    <form action={action}>
      <input type="hidden" name="mediaId" value={mediaId} />
      {state && !state.ok ? (
        <p className="text-xs text-danger">
          {errors[`errors.${state.error}`] ?? errors["errors.write_failed"]}
        </p>
      ) : null}
      <SubmitButton label={label} pendingLabel={pendingLabel} />
    </form>
  );
}

function SubmitButton({
  label,
  pendingLabel,
}: {
  label: string | undefined;
  pendingLabel: string | undefined;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending} aria-busy={pending}>
      {pending ? (pendingLabel ?? "…") : (label ?? "Save")}
    </Button>
  );
}
