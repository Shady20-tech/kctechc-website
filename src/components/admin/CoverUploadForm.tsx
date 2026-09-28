"use client";

import Image from "next/image";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import {
  uploadInsightCoverAction,
  type ContentState,
} from "@/lib/content/admin-actions";

/**
 * Cover-image upload for an article.
 *
 * A separate form from the text fields because the two have different failure
 * modes: a rejected image should not discard unsaved prose. The hidden `id` ties
 * the upload to the article that already exists — an article must be created
 * before it can have a cover, which is why this control lives on the edit page
 * and not the create form.
 */
export function CoverUploadForm({
  id,
  currentUrl,
  labels,
}: {
  id: string;
  currentUrl: string | null;
  labels: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(
    async (_prev: ContentState | null, formData: FormData) =>
      uploadInsightCoverAction(formData),
    null as ContentState | null,
  );

  return (
    <section aria-labelledby="cover-heading" className="space-y-4">
      <div>
        <h2 id="cover-heading" className="text-lg font-semibold text-ink-900">
          {labels.coverHeading}
        </h2>
        <p className="mt-1 text-sm text-body">{labels.coverIntro}</p>
      </div>

      {state && !state.ok ? (
        <Notice tone="error">
          {labels[`errors.${state.error}`] ??
            labels["errors.upload_failed"] ??
            ""}
        </Notice>
      ) : null}
      {state?.ok ? <Notice tone="success">{labels.coverUpdated}</Notice> : null}

      {currentUrl ? (
        <Image
          src={currentUrl}
          alt=""
          width={480}
          height={270}
          className="h-auto w-full max-w-sm rounded-card border border-border object-cover"
          unoptimized
        />
      ) : null}

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="id" value={id} />
        <input
          type="file"
          name="cover"
          accept="image/jpeg,image/png,image/webp,image/avif"
          required
          className="block text-sm text-body file:mr-3 file:rounded-field file:border file:border-border-strong file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium"
        />
        <UploadButton
          label={labels.coverUpload}
          pendingLabel={labels.coverUploading}
        />
      </form>
      {pending ? <span className="visually-hidden">…</span> : null}
    </section>
  );
}

function UploadButton({
  label,
  pendingLabel,
}: {
  label: string | undefined;
  pendingLabel: string | undefined;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending} aria-busy={pending}>
      {pending ? (pendingLabel ?? "…") : (label ?? "Upload")}
    </Button>
  );
}
