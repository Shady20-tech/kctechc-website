"use client";

import Image from "next/image";
import { useEffect, useId, useState } from "react";

import { exceedsSizeLimit } from "@/lib/uploads/limits";

type Preview = { key: string; name: string; url: string };

/**
 * A file input for images chosen during a create form.
 *
 * The selected files are previewed before submit, so an editor can see the
 * photographs that will be attached without saving the record first. The input
 * itself is what posts the bytes; the previews are local object URLs and are
 * revoked when the selection changes or the form unmounts.
 *
 * The size check is a courtesy that reports an obviously oversized file before
 * the request leaves the browser. The Server Action still validates the real
 * bytes, so a bypassed `onChange` grants nothing.
 */
export function ImageUploadField({
  name = "image",
  label,
  hint,
  tooLargeMessage,
  maxBytes,
  accept = "image/jpeg,image/png,image/webp,image/avif",
  multiple = true,
  required = false,
  disabled = false,
}: {
  name?: string;
  label: string;
  hint?: string;
  tooLargeMessage?: string;
  maxBytes?: number;
  accept?: string;
  multiple?: boolean;
  required?: boolean;
  disabled?: boolean;
}) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [tooLarge, setTooLarge] = useState(false);
  const canPreview =
    typeof URL !== "undefined" && typeof URL.createObjectURL === "function";

  useEffect(
    () => () => {
      if (typeof URL.revokeObjectURL !== "function") return;
      for (const preview of previews) URL.revokeObjectURL(preview.url);
    },
    [previews],
  );

  return (
    <div>
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-ink-900"
      >
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </label>
      <input
        id={inputId}
        type="file"
        name={name}
        accept={accept}
        multiple={multiple}
        required={required}
        disabled={disabled}
        aria-describedby={[
          hint ? hintId : null,
          tooLarge && tooLargeMessage ? errorId : null,
        ]
          .filter(Boolean)
          .join(" ")}
        aria-invalid={tooLarge ? true : undefined}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          setPreviews(
            canPreview
              ? files.map((file, index) => ({
                  key: `${file.name}-${file.size}-${index}`,
                  name: file.name,
                  url: URL.createObjectURL(file),
                }))
              : [],
          );
          setTooLarge(
            maxBytes !== undefined &&
              files.some((file) => exceedsSizeLimit(file, maxBytes)),
          );
        }}
        className="mt-1 block w-full text-sm text-body file:mr-3 file:rounded-field file:border file:border-border-strong file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium"
      />
      {hint ? (
        <p id={hintId} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {tooLarge && tooLargeMessage ? (
        <p id={errorId} className="mt-1 text-xs font-medium text-danger">
          {tooLargeMessage}
        </p>
      ) : null}
      {previews.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-3" aria-label={label}>
          {previews.map((preview) => (
            <li key={preview.key} className="w-24">
              <Image
                src={preview.url}
                alt=""
                width={96}
                height={96}
                unoptimized
                className="h-24 w-24 rounded-field border border-border object-cover"
              />
              <p
                className="mt-1 truncate text-xs text-muted"
                title={preview.name}
              >
                {preview.name}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
