"use client";

import { X } from "lucide-react";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";

import { exceedsSizeLimit } from "@/lib/uploads/limits";

type Preview = { key: string; name: string; url: string; file: File };

/**
 * A file input for images chosen during a create form.
 *
 * The selected files are previewed before submit, so an editor can see the
 * photographs that will be attached without saving the record first. Each
 * preview carries a remove control, and the input's own `FileList` is rewritten
 * when one is removed so a discarded image is not posted. The previews are local
 * object URLs and are revoked when they leave the selection or the form unmounts.
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
  removeLabel = "Remove",
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
  removeLabel?: string;
  accept?: string;
  multiple?: boolean;
  required?: boolean;
  disabled?: boolean;
}) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const inputRef = useRef<HTMLInputElement>(null);
  const previewsRef = useRef<Preview[]>([]);
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [tooLarge, setTooLarge] = useState(false);
  const canPreview =
    typeof URL !== "undefined" && typeof URL.createObjectURL === "function";
  const canRemove = canPreview && typeof DataTransfer !== "undefined";

  useEffect(
    () => () => {
      if (typeof URL.revokeObjectURL !== "function") return;
      for (const preview of previewsRef.current) {
        URL.revokeObjectURL(preview.url);
      }
    },
    [],
  );

  function setSelection(files: File[]) {
    if (typeof URL.revokeObjectURL === "function") {
      for (const preview of previewsRef.current) {
        URL.revokeObjectURL(preview.url);
      }
    }
    const next = canPreview
      ? files.map((file, index) => ({
          key: `${file.name}-${file.size}-${index}`,
          name: file.name,
          url: URL.createObjectURL(file),
          file,
        }))
      : [];
    previewsRef.current = next;
    setPreviews(next);
    setTooLarge(
      maxBytes !== undefined &&
        files.some((file) => exceedsSizeLimit(file, maxBytes)),
    );
  }

  function removeAt(index: number) {
    const removed = previewsRef.current[index];
    if (!removed) return;

    if (typeof URL.revokeObjectURL === "function") {
      URL.revokeObjectURL(removed.url);
    }
    const next = previewsRef.current.filter((_, at) => at !== index);
    previewsRef.current = next;
    setPreviews(next);
    setTooLarge(
      maxBytes !== undefined &&
        next.some((preview) => exceedsSizeLimit(preview.file, maxBytes)),
    );

    const input = inputRef.current;
    if (!input || typeof DataTransfer === "undefined") return;
    const transfer = new DataTransfer();
    for (const preview of next) transfer.items.add(preview.file);
    input.files = transfer.files;
  }

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
        ref={inputRef}
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
          setSelection(Array.from(event.target.files ?? []));
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
          {previews.map((preview, index) => (
            <li key={preview.key} className="relative w-24">
              <Image
                src={preview.url}
                alt=""
                width={96}
                height={96}
                unoptimized
                className="h-24 w-24 rounded-field border border-border object-cover"
              />
              {canRemove ? (
                <button
                  type="button"
                  onClick={() => removeAt(index)}
                  aria-label={`${removeLabel}: ${preview.name}`}
                  title={removeLabel}
                  className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-ink-950/85 text-white shadow-sm transition-colors hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ) : null}
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
