"use client";

import Image from "next/image";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { SelectField } from "@/components/ui/Form";
import {
  removeProjectMediaAction,
  uploadProjectMediaAction,
  type ProjectMediaState,
} from "@/lib/content/project-admin-actions";

export type ProjectMediaItem = {
  id: string;
  url: string | null;
  altText: string;
  caption: string | null;
  role: string;
};

/**
 * Completed-work photography.
 *
 * Upload and removal are separate forms so a rejected upload never discards the
 * outcome of a removal, and each image carries its own remove control — the
 * editor acts on the image they are looking at rather than on a hidden selection.
 *
 * The role select exists because a before/after pair is a claim about the work;
 * the database allows at most one of each per project, and a rejected second one
 * is reported as `role_taken` rather than a generic failure.
 */
export function ProjectMediaForm({
  projectId,
  media,
  labels,
}: {
  projectId: string;
  media: readonly ProjectMediaItem[];
  labels: Record<string, string>;
}) {
  const [uploadState, uploadAction] = useActionState(
    async (_prev: ProjectMediaState | null, formData: FormData) =>
      uploadProjectMediaAction(formData),
    null as ProjectMediaState | null,
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-ink-900">
          {labels.mediaHeading}
        </h2>
        <p className="mt-1 text-sm text-body">{labels.mediaIntro}</p>
      </div>

      {uploadState && !uploadState.ok ? (
        <Notice tone="error">
          {labels[`errors.${uploadState.error}`] ??
            labels["errors.upload_failed"]}
        </Notice>
      ) : null}
      {uploadState?.ok ? (
        <Notice tone="success">{labels.mediaAdded}</Notice>
      ) : null}

      {media.length === 0 ? (
        <p className="text-sm text-muted">{labels.mediaEmpty}</p>
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
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {labels[`role.${item.role}`] ?? item.role}
                </p>
                <p className="text-sm text-body">{item.altText}</p>
                <RemoveMediaForm
                  mediaId={item.id}
                  label={labels.mediaRemove}
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
        <input type="hidden" name="projectId" value={projectId} />

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

        <SelectField
          id="role"
          name="role"
          label={labels.roleLabel ?? ""}
          defaultValue="general"
        >
          <option value="general">{labels["role.general"]}</option>
          <option value="before">{labels["role.before"]}</option>
          <option value="after">{labels["role.after"]}</option>
        </SelectField>

        <input
          type="file"
          name="image"
          accept="image/jpeg,image/png,image/webp,image/avif"
          required
          className="block text-sm text-body file:mr-3 file:rounded-field file:border file:border-border-strong file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium"
        />

        <SubmitButton
          label={labels.mediaUpload}
          pendingLabel={labels.mediaUploading}
        />
      </form>
    </div>
  );
}

/** One image's removal control, with its own action state so errors stay local. */
function RemoveMediaForm({
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
    async (_prev: ProjectMediaState | null, formData: FormData) =>
      removeProjectMediaAction(formData),
    null as ProjectMediaState | null,
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
