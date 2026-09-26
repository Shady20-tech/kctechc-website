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
  | "accentOnInk"
  | "ghost"
  | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 font-semibold transition-soft disabled:cursor-not-allowed disabled:opacity-60";

const VARIANTS: Record<ButtonVariant, string> = {
  // Corporate ink is the default primary action everywhere.
  primary: "bg-ink-900 text-white hover:bg-ink-700",
  secondary:
    "border border-ink-900 bg-transparent text-ink-900 hover:bg-ink-900 hover:text-white",
  // Contextual: follows the active department accent. Intended for light
  // surfaces, where the accent is dark enough for white text.
  accent: "bg-dept-accent text-white hover:opacity-90",
  // The dark-band counterpart. Inside `.on-ink`, `--dept-accent` resolves to the
  // bright value, where white text would be unreadable (1.7:1), so this pairing
  // uses ink text on the bright fill instead.
  accentOnInk: "bg-dept-accent-bright text-ink-950 hover:opacity-90",
  ghost: "bg-transparent text-ink-900 hover:bg-ink-50",
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
