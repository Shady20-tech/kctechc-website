import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

export type AlertTone = "info" | "success" | "warning" | "error";

const TONE_STYLES: Record<
  AlertTone,
  { wrapper: string; icon: typeof Info }
> = {
  info: { wrapper: "border-ink-200 bg-ink-50 text-ink-900", icon: Info },
  success: {
    wrapper: "border-green-300 bg-green-50 text-green-900",
    icon: CheckCircle2,
  },
  warning: {
    wrapper: "border-teal-300 bg-teal-100 text-teal-700",
    icon: TriangleAlert,
  },
  error: { wrapper: "border-red-300 bg-red-50 text-red-900", icon: AlertCircle },
};

/**
 * Alert.
 *
 * `role="alert"` is applied to error and warning tones only, so routine
 * information does not interrupt a screen-reader user mid-task. The icon is
 * decorative and the heading carries the meaning, so tone is never conveyed by
 * colour alone.
 */
export function Alert({
  tone = "info",
  title,
  children,
  id,
}: {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  id?: string;
}) {
  const { wrapper, icon: Icon } = TONE_STYLES[tone];
  const isUrgent = tone === "error" || tone === "warning";

  return (
    <div
      id={id}
      role={isUrgent ? "alert" : "status"}
      className={`flex gap-3 rounded-card border px-4 py-3 text-sm ${wrapper}`}
    >
      <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={title ? "mt-1" : undefined}>{children}</div> : null}
      </div>
    </div>
  );
}
