"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import Image from "next/image";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { TextField } from "@/components/ui/Form";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import type { DashboardKind } from "@/lib/real-estate/dashboard";
import {
  removeDashboardListingImageAction,
  uploadDashboardListingImageAction,
  type DashboardSimpleResult,
} from "@/lib/real-estate/dashboard-actions";
import type { DashboardMedia } from "@/lib/real-estate/dashboard-loaders";
import { propertyMediaPublicUrl } from "@/lib/real-estate/storage";
import { MAX_PROPERTY_IMAGE_BYTES } from "@/lib/uploads/limits";

const EMPTY: DashboardSimpleResult | null = null;

/**
 * A listing's gallery.
 *
 * Uploading and removing are separate actions rather than one form, because a
 * removal names an existing image and an upload does not — combining them would
 * mean a submit that sometimes means "add" and sometimes "delete".
 *
 * The chosen file is checked against the bucket's limit in the browser before the
 * bytes are sent, so a 12 MB phone photograph fails immediately with a message
 * rather than after a long upload. This is a courtesy: the Server Action
 * validates the real bytes again, and the bucket enforces the limit a third time.
 */
export function DashboardMediaPanel({
  kind,
  locale,
  listingId,
  media,
}: {
  kind: DashboardKind;
  locale: Locale;
  listingId: string;
  media: readonly DashboardMedia[];
}) {
  const t = createTranslator(locale).t;
  const base = `account.dashboards.${kind}`;
  const [tooLarge, setTooLarge] = useState(false);

  const [state, formAction] = useActionState(
    async (_previous: DashboardSimpleResult | null, formData: FormData) =>
      uploadDashboardListingImageAction(kind, formData),
    EMPTY,
  );

  return (
    <Card>
      <h2 className="text-lg font-semibold text-ink-900">
        {t(`${base}.imagesHeading`)}
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-body">
        {t(`${base}.imagesIntro`)}
      </p>

      {media.length === 0 ? (
        <p className="mt-4 text-sm text-muted">{t(`${base}.noImagesYet`)}</p>
      ) : (
        <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {media.map((image) => {
            const url = propertyMediaPublicUrl(image.storagePath);
            return (
              <li
                key={image.id}
                className="space-y-3 rounded-card border border-border p-3"
              >
                {url ? (
                  <Image
                    src={url}
                    alt={image.altText}
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
                      {t(`${base}.primaryBadge`)}
                    </span>
                  ) : null}
                  <span className="truncate text-xs text-muted">
                    {image.altText}
                  </span>
                </div>

                <RemoveImageForm
                  kind={kind}
                  locale={locale}
                  listingId={listingId}
                  mediaId={image.id}
                />
              </li>
            );
          })}
        </ul>
      )}

      <form action={formAction} className="mt-6 space-y-4">
        {state && !state.ok ? (
          <Notice tone="warning">{t(`errors.${state.error}`)}</Notice>
        ) : null}
        {state?.ok ? (
          <Notice tone="success">
            {state.message === "image_added_partial"
              ? t(`${base}.imageAddedPartial`)
              : t(`${base}.imageAdded`)}
          </Notice>
        ) : null}
        {tooLarge ? (
          <Notice tone="warning">{t("errors.too_large")}</Notice>
        ) : null}

        <input type="hidden" name="listingId" value={listingId} />

        <TextField
          id="altText"
          name="altText"
          label={t(`${base}.altLabel`)}
          hint={t(`${base}.altHint`)}
          required
        />

        <div className="flex flex-col gap-2">
          <label htmlFor="image" className="text-sm font-medium text-ink-900">
            {t(`${base}.imageUpload`)}
          </label>
          <input
            id="image"
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            multiple
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              setTooLarge(
                files.some((file) => file.size > MAX_PROPERTY_IMAGE_BYTES),
              );
            }}
            className="text-sm text-body file:mr-3 file:rounded-control file:border-0 file:bg-surface-alt file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink-900"
          />
          <p className="text-xs text-muted">
            {t(`${base}.imagesLimitHint`)} {t(`${base}.imageUploadMultipleHint`)}
          </p>
        </div>

        <UploadButton
          label={t(`${base}.imageUpload`)}
          pendingLabel={t(`${base}.imageUploading`)}
          disabled={tooLarge}
        />
      </form>
    </Card>
  );
}

function RemoveImageForm({
  kind,
  locale,
  listingId,
  mediaId,
}: {
  kind: DashboardKind;
  locale: Locale;
  listingId: string;
  mediaId: string;
}) {
  const t = createTranslator(locale).t;
  const base = `account.dashboards.${kind}`;

  const [state, formAction] = useActionState(
    async () =>
      removeDashboardListingImageAction(kind, listingId, mediaId),
    EMPTY,
  );

  return (
    <form action={formAction} className="mt-2">
      {state && !state.ok ? (
        <Notice tone="warning">{t(`errors.${state.error}`)}</Notice>
      ) : null}
      {state?.ok ? (
        <Notice tone="success">{t(`${base}.imageRemoved`)}</Notice>
      ) : null}
      <RemoveButton
        label={t(`${base}.imageRemove`)}
        pendingLabel={t(`${base}.imageRemoving`)}
      />
    </form>
  );
}

function UploadButton({
  label,
  pendingLabel,
  disabled,
}: {
  label: string;
  pendingLabel: string;
  disabled: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="primary"
      disabled={pending || disabled}
      aria-busy={pending}
    >
      {pending ? pendingLabel : label}
    </Button>
  );
}

function RemoveButton({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="secondary"
      size="sm"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? pendingLabel : label}
    </Button>
  );
}
