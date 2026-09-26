import type { ReactNode } from "react";

/**
 * Standard content container.
 *
 * The `main` landmark is owned by the locale layout, so pages supply their own
 * container rather than each inventing one. This keeps the horizontal rhythm
 * identical across every route and leaves room for full-bleed sections where a
 * page needs one.
 */
export function PageShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`container-page section ${className ?? ""}`}>
      {children}
    </div>
  );
}

/**
 * Full-bleed band with an inner container, for alternating section backgrounds
 * (the gateway and department pages use these to separate blocks of content).
 */
export function SectionBand({
  children,
  tone = "default",
  labelledBy,
  id,
}: {
  children: ReactNode;
  tone?: "default" | "alt" | "accent";
  labelledBy?: string;
  id?: string;
}) {
  const toneClass =
    tone === "alt"
      ? "bg-surface-alt"
      : tone === "accent"
        ? "accent-wash"
        : "bg-surface";

  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={`border-b border-border ${toneClass}`}
    >
      <div className="container-page section">{children}</div>
    </section>
  );
}
