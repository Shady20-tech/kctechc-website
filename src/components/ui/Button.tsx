import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/**
 * Button system.
 *
 * `Button` renders a real `<button>`; `ButtonLink` renders a `next/link`. They
 * share one class builder so a link and a button can never drift apart visually
 * — a common source of inconsistency when both are styled separately.
 *
 * The accent variants read `--dept-accent`, so the same component picks up a
 * department's colour inside a department subtree without a new variant.
 */

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "accent"
  | "ghost"
  | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 font-semibold transition-soft disabled:cursor-not-allowed disabled:opacity-60";

const VARIANTS: Record<ButtonVariant, string> = {
  // Corporate navy is the default primary action everywhere.
  primary: "bg-navy-900 text-white hover:bg-navy-700",
  secondary:
    "border border-navy-900 bg-transparent text-navy-900 hover:bg-navy-900 hover:text-white",
  // Contextual: follows the active department accent.
  accent: "bg-dept-accent text-white hover:opacity-90",
  ghost: "bg-transparent text-navy-900 hover:bg-navy-50",
  danger: "bg-red-700 text-white hover:bg-red-800",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "rounded-card px-3 py-1.5 text-sm",
  md: "rounded-card px-4 py-2.5 text-sm",
  lg: "rounded-card px-6 py-3 text-base",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  return [BASE, VARIANTS[variant], SIZES[size], className]
    .filter(Boolean)
    .join(" ");
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  variant,
  size,
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, className })}
      {...rest}
    />
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
};

export function ButtonLink({
  variant,
  size,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={buttonClasses({ variant, size, className })} {...rest}>
      {children}
    </Link>
  );
}
