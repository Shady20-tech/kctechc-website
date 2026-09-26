import type { ComponentProps, ReactNode } from "react";

/**
 * Form primitives.
 *
 * Every control is wrapped in a `<label>` and wires `aria-describedby` to its
 * hint and error text, so a screen-reader user hears the label, the guidance and
 * the failure reason without needing the visual layout. Errors also set
 * `aria-invalid` so the field is announced as invalid rather than merely red.
 */

const CONTROL_BASE =
  "w-full rounded-card border bg-surface px-3 py-2.5 text-sm text-ink-900 transition-soft placeholder:text-muted focus:outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:bg-surface-sunken";

const CONTROL_VALID = "border-border-strong hover:border-ink-500";
const CONTROL_INVALID = "border-red-600 bg-red-50";

type FieldShellProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  requiredLabel?: string;
  children: (props: {
    id: string;
    "aria-describedby": string | undefined;
    "aria-invalid": boolean | undefined;
  }) => ReactNode;
};

function FieldShell({
  id,
  label,
  hint,
  error,
  required,
  requiredLabel,
  children,
}: FieldShellProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink-900">
        {label}
        {required ? (
          <span className="ml-1 text-red-700" aria-hidden="true">
            *
          </span>
        ) : null}
        {required && requiredLabel ? (
          <span className="visually-hidden"> ({requiredLabel})</span>
        ) : null}
      </label>
      {hint ? (
        <p id={hintId} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      ) : null}
      <div className="mt-1.5">
        {children({
          id,
          "aria-describedby": describedBy,
          "aria-invalid": error ? true : undefined,
        })}
      </div>
      {error ? (
        <p id={errorId} className="mt-1 text-xs font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  id,
  label,
  hint,
  error,
  required,
  requiredLabel,
  ...rest
}: ComponentProps<"input"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  requiredLabel?: string;
}) {
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
      requiredLabel={requiredLabel}
    >
      {(a11y) => (
        <input
          {...rest}
          {...a11y}
          required={required}
          className={`${CONTROL_BASE} ${error ? CONTROL_INVALID : CONTROL_VALID}`}
        />
      )}
    </FieldShell>
  );
}

export function TextAreaField({
  id,
  label,
  hint,
  error,
  required,
  requiredLabel,
  rows = 5,
  ...rest
}: ComponentProps<"textarea"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  requiredLabel?: string;
}) {
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
      requiredLabel={requiredLabel}
    >
      {(a11y) => (
        <textarea
          {...rest}
          {...a11y}
          rows={rows}
          required={required}
          className={`${CONTROL_BASE} ${error ? CONTROL_INVALID : CONTROL_VALID}`}
        />
      )}
    </FieldShell>
  );
}

export function SelectField({
  id,
  label,
  hint,
  error,
  required,
  requiredLabel,
  children,
  ...rest
}: ComponentProps<"select"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  requiredLabel?: string;
}) {
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
      requiredLabel={requiredLabel}
    >
      {(a11y) => (
        <select
          {...rest}
          {...a11y}
          required={required}
          className={`${CONTROL_BASE} ${error ? CONTROL_INVALID : CONTROL_VALID}`}
        >
          {children}
        </select>
      )}
    </FieldShell>
  );
}

/**
 * Honeypot field for spam deterrence.
 *
 * Hidden from sighted users and from assistive technology, and never focusable,
 * so only an automated submission fills it in.
 */
export function HoneypotField({ name }: { name: string }) {
  return (
    <div aria-hidden="true" className="absolute h-0 w-0 overflow-hidden">
      <label htmlFor={name}>Leave this field empty</label>
      <input id={name} name={name} type="text" tabIndex={-1} autoComplete="off" />
    </div>
  );
}
