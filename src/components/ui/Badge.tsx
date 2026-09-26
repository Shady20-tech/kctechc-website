import type { ReactNode } from "react";

export type BadgeTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "accent";

const TONES: Record<BadgeTone, string> = {
  neutral: "border-border bg-surface-alt text-body",
  info: "border-ink-200 bg-ink-50 text-ink-700",
  success: "border-green-300 bg-green-50 text-green-800",
  warning: "border-teal-300 bg-teal-100 text-teal-700",
  danger: "border-red-300 bg-red-50 text-red-800",
  accent: "border-dept-accent bg-surface text-dept-accent",
};

/**
 * Status badge. Text is always present — colour is a reinforcement, never the
 * only carrier of meaning, so it stays legible for colour-blind users and in
 * monochrome print.
 */
export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: BadgeTone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-pill border px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
