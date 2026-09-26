import type { ReactNode } from "react";

/**
 * Card primitives.
 *
 * `Card` is the plain surface; `LinkCard` is the interactive variant used by
 * department entries. Keeping them separate means a non-interactive card never
 * picks up hover affordances it cannot honour.
 */

export function Card({
  children,
  className,
  /** Renders the contextual department accent as a top rule. */
  accent = false,
  as: Component = "div",
}: {
  children: ReactNode;
  className?: string;
  accent?: boolean;
  as?: "div" | "section" | "article" | "li";
}) {
  return (
    <Component
      className={[
        "rounded-card border border-border bg-surface p-6 shadow-card",
        accent ? "accent-rule" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </Component>
  );
}

export function CardHeading({
  children,
  level = 3,
  id,
}: {
  children: ReactNode;
  level?: 2 | 3 | 4;
  id?: string;
}) {
  const Tag = `h${level}` as const;
  const size =
    level === 2
      ? "text-xl sm:text-2xl"
      : level === 3
        ? "text-lg"
        : "text-base";
  return (
    <Tag id={id} className={`${size} font-semibold text-navy-900`}>
      {children}
    </Tag>
  );
}
