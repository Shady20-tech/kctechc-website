import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Loading states.
 *
 * `Skeleton` is decorative and hidden from assistive technology; `LoadingRegion`
 * exposes a polite live region so a screen-reader user is told work is in
 * progress rather than being left in silence.
 */

export function Spinner({
  className,
  label,
}: {
  className?: string;
  label?: string;
}) {
  return (
    <>
      <Loader2
        aria-hidden="true"
        className={`h-5 w-5 animate-spin ${className ?? ""}`}
      />
      {label ? <span className="visually-hidden">{label}</span> : null}
    </>
  );
}

export function Skeleton({
  className,
  as: Component = "div",
}: {
  className?: string;
  as?: "div" | "span" | "li";
}) {
  return (
    <Component
      aria-hidden="true"
      className={`animate-pulse rounded-card bg-surface-sunken ${className ?? ""}`}
    />
  );
}

export function LoadingRegion({
  label,
  children,
}: {
  label: string;
  children?: ReactNode;
}) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="visually-hidden">{label}</span>
      {children}
    </div>
  );
}
