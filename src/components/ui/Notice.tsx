import type { ReactNode } from "react";

export type NoticeTone = "info" | "warning" | "error" | "success";

const TONE_CLASSES: Record<NoticeTone, string> = {
  info: "border-navy-200 bg-navy-50 text-navy-900",
  warning: "border-gold-300 bg-gold-100 text-gold-700",
  error: "border-red-300 bg-red-50 text-red-800",
  success: "border-green-300 bg-green-50 text-green-800",
};

/**
 * Inline notice. `role="alert"` is applied to error and warning tones only, so
 * routine information does not interrupt a screen-reader user mid-task.
 */
export function Notice({
  tone = "info",
  title,
  children,
}: {
  tone?: NoticeTone;
  title?: string;
  children: ReactNode;
}) {
  const isUrgent = tone === "error" || tone === "warning";
  return (
    <div
      role={isUrgent ? "alert" : "status"}
      className={`rounded-card border px-4 py-3 text-sm ${TONE_CLASSES[tone]}`}
    >
      {title ? <p className="font-semibold">{title}</p> : null}
      <div className={title ? "mt-1" : undefined}>{children}</div>
    </div>
  );
}
