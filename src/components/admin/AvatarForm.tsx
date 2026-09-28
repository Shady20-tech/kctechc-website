"use client";

import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";

import { Avatar } from "@/components/admin/Avatar";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import {
  removeAvatarAction,
  uploadAvatarAction,
  type ProfileUpdateState,
} from "@/lib/admin/profile-actions";
import { MAX_AVATAR_BYTES } from "@/lib/uploads/validation";

/**
 * Profile picture controls.
 *
 * A Client Component so the upload can report its own progress and result inline,
 * and so "remove" can be a plain button when no picture exists. The chosen file is
 * sent as-is; the size and type are checked on the server, and the message the
 * user sees on rejection comes from the action's verdict, not from anything the
 * browser decided.
 */
export function AvatarForm({
  currentUrl,
  name,
  labels,
}: {
  currentUrl: string | null;
  name: string;
  labels: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(
    uploadAvatarAction,
    null as ProfileUpdateState | null,
  );
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <section aria-labelledby="avatar-heading" className="space-y-4">
      <div>
        <h2 id="avatar-heading" className="text-lg font-semibold text-ink-900">
          {labels.avatarHeading ?? ""}
        </h2>
        <p className="mt-1 text-sm text-body">{labels.avatarIntro ?? ""}</p>
      </div>

      {state && !state.ok ? (
        <Notice tone="error">
          {labels[`errors.${state.error}`] ??
            labels["errors.update_failed"] ??
            ""}
        </Notice>
      ) : null}
      {state?.ok ? (
        <Notice tone="success">{labels.avatarUpdated ?? ""}</Notice>
      ) : null}

      <div className="flex items-center gap-4">
        <Avatar src={currentUrl} name={name} size="lg" />

        <div className="space-y-2">
          <form action={formAction} className="space-y-2">
            <input
              ref={inputRef}
              type="file"
              name="avatar"
              accept="image/jpeg,image/png,image/webp"
              required
              className="block text-sm text-body file:mr-3 file:rounded-field file:border file:border-border-strong file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium"
              aria-describedby="avatar-limits"
            />
            <p id="avatar-limits" className="text-xs text-muted">
              {labels.avatarChoose ?? ""} ·{" "}
              {Math.round(MAX_AVATAR_BYTES / (1024 * 1024))} MB
            </p>
            <UploadButton
              label={labels.avatarUpload}
              pendingLabel={labels.avatarUploading}
            />
          </form>

          {currentUrl ? (
            <form action={removeAvatarAction}>
              <Button type="submit" variant="ghost" size="sm">
                {labels.avatarRemove ?? ""}
              </Button>
            </form>
          ) : null}
        </div>
      </div>
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
      {pending ? pendingLabel : label}
    </Button>
  );
}
