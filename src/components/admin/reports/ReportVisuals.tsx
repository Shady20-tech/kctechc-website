import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Info,
  TriangleAlert,
} from "lucide-react";

import { Card, CardHeading } from "@/components/ui/Card";

/**
 * Report presentation primitives.
 *
 * Charts are server-rendered from the same rows the tables below them show, so a
 * number in a bar and a number in a table cannot disagree. Every chart carries an
 * accessible text summary and a visible value per row; colour is reinforcement,
 * never the only carrier of meaning. No chart library is loaded for this.
 */

export type ReportMetric = {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "positive" | "warning";
};

export type ReportBar = {
  label: string;
  value: number;
  meta?: string;
};

export type ReportInsight = {
  title: string;
  body: string;
  tone: "positive" | "warning" | "neutral";
};

const TONE_BAR = {
  accent: "bg-dept-accent",
  neutral: "bg-ink-400",
  warning: "bg-red-600",
  positive: "bg-teal-700",
} as const;

export function ReportKpi({ metric }: { metric: ReportMetric }) {
  return (
    <Card accent className="h-full">
      <p className="font-mono text-[11px] uppercase tracking-widest text-muted">
        {metric.label}
      </p>
      <p className="mt-3 font-display text-3xl font-bold tracking-tight text-ink-900">
        {metric.value}
      </p>
      {metric.hint ? (
        <p
          className={[
            "mt-2 text-sm",
            metric.tone === "positive"
              ? "text-teal-700"
              : metric.tone === "warning"
                ? "text-red-700"
                : "text-body",
          ].join(" ")}
        >
          {metric.hint}
        </p>
      ) : null}
    </Card>
  );
}

/**
 * A horizontal bar chart.
 *
 * The bar is decorative (`aria-hidden`) and the row label/value beside it is the
 * real content, so a screen reader reads a list of figures rather than an empty
 * graphic. Bars are proportional to the largest value in the set.
 */
export function ReportBarChart({
  title,
  description,
  bars,
  formatValue,
  emptyMessage,
  maxBars = 8,
  tone = "accent",
}: {
  title: string;
  description?: string;
  bars: readonly ReportBar[];
  formatValue?: (value: number) => string;
  emptyMessage: string;
  maxBars?: number;
  tone?: keyof typeof TONE_BAR;
}) {
  const visible = bars.slice(0, maxBars);
  const max = Math.max(1, ...visible.map((bar) => bar.value));
  const format = formatValue ?? ((value: number) => String(value));

  return (
    <Card as="section">
      <CardHeading level={3}>{title}</CardHeading>
      {description ? (
        <p className="mt-1 text-sm text-body">{description}</p>
      ) : null}
      {visible.length === 0 ? (
        <p className="mt-4 text-sm text-muted">{emptyMessage}</p>
      ) : (
        <ol className="mt-5 space-y-4">
          {visible.map((bar) => (
            <li key={bar.label}>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm font-medium text-ink-900">
                  {bar.label}
                </span>
                <span className="font-mono text-xs text-body">
                  {format(bar.value)}
                  {bar.meta ? (
                    <span className="ml-2 text-muted">{bar.meta}</span>
                  ) : null}
                </span>
              </div>
              <div
                aria-hidden="true"
                className="mt-1.5 h-2 overflow-hidden rounded-pill bg-surface-sunken"
              >
                <div
                  className={`h-full rounded-pill ${TONE_BAR[tone]}`}
                  style={{ width: `${Math.max(2, (bar.value / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/**
 * A daily column chart.
 *
 * The visible date labels are abbreviated; the accessible list under the chart
 * states the full date and value, so the chart is not the only way to read it.
 */
export function ReportTrendChart({
  title,
  description,
  points,
  formatValue,
  emptyMessage,
  tone = "accent",
}: {
  title: string;
  description?: string;
  points: readonly { label: string; accessibleLabel: string; value: number }[];
  formatValue: (value: number) => string;
  emptyMessage: string;
  tone?: keyof typeof TONE_BAR;
}) {
  const max = Math.max(1, ...points.map((point) => point.value));

  return (
    <Card as="section">
      <CardHeading level={3}>{title}</CardHeading>
      {description ? (
        <p className="mt-1 text-sm text-body">{description}</p>
      ) : null}
      {points.length === 0 ? (
        <p className="mt-4 text-sm text-muted">{emptyMessage}</p>
      ) : (
        <>
          <div className="mt-5 overflow-x-auto">
            <div
              role="img"
              aria-label={`${title}: ${points
                .map(
                  (point) =>
                    `${point.accessibleLabel} ${formatValue(point.value)}`,
                )
                .join(", ")}`}
              className="flex h-40 min-w-full items-end gap-1.5 border-b border-border pb-2"
            >
              {points.map((point) => (
                <div
                  key={point.accessibleLabel}
                  className="flex h-full min-w-3 flex-1 items-end"
                >
                  <div
                    className={`w-full rounded-t-sm ${TONE_BAR[tone]}`}
                    style={{
                      height: `${Math.max(2, (point.value / max) * 100)}%`,
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
          <ol className="mt-2 flex justify-between gap-1 font-mono text-[10px] text-muted">
            {points.map((point, index) => (
              <li key={point.accessibleLabel} className="truncate">
                {index === 0 || index === points.length - 1 || index % 4 === 0
                  ? point.label
                  : "\u00a0"}
              </li>
            ))}
          </ol>
          <ul className="visually-hidden">
            {points.map((point) => (
              <li key={point.accessibleLabel}>
                {point.accessibleLabel}: {formatValue(point.value)}
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

/** Short, evidence-based observations derived from the same report rows. */
export function ReportInsights({
  heading,
  intro,
  items,
  emptyMessage,
}: {
  heading: string;
  intro: string;
  items: readonly ReportInsight[];
  emptyMessage: string;
}) {
  return (
    <Card as="section">
      <CardHeading level={3}>{heading}</CardHeading>
      <p className="mt-1 text-sm text-body">{intro}</p>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted">{emptyMessage}</p>
      ) : (
        <ul className="mt-5 grid gap-3 lg:grid-cols-3">
          {items.map((item) => {
            const Icon =
              item.tone === "positive"
                ? ArrowUpRight
                : item.tone === "warning"
                  ? TriangleAlert
                  : CheckCircle2;
            return (
              <li
                key={item.title}
                className="rounded-control border border-border bg-surface-alt p-4"
              >
                <div className="flex items-center gap-2">
                  <Icon
                    aria-hidden="true"
                    className={[
                      "h-4 w-4",
                      item.tone === "positive"
                        ? "text-teal-700"
                        : item.tone === "warning"
                          ? "text-red-700"
                          : "text-ink-500",
                    ].join(" ")}
                  />
                  <p className="text-sm font-semibold text-ink-900">
                    {item.title}
                  </p>
                </div>
                <p className="mt-2 text-sm text-body">{item.body}</p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/** A compact report block for a dashboard overview. */
export function ReportHighlights({
  heading,
  intro,
  metrics,
  href,
  linkLabel,
}: {
  heading: string;
  intro: string;
  metrics: readonly ReportMetric[];
  href?: string;
  linkLabel?: string;
}) {
  return (
    <Card as="section">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <CardHeading level={3}>{heading}</CardHeading>
          <p className="mt-1 max-w-2xl text-sm text-body">{intro}</p>
        </div>
        {href && linkLabel ? (
          <Link
            href={href}
            className="text-sm font-semibold text-dept-accent transition-soft hover:underline"
          >
            {linkLabel} →
          </Link>
        ) : null}
      </div>
      <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-control border border-border bg-surface-alt p-3"
          >
            <dt className="font-mono text-[10px] uppercase tracking-widest text-muted">
              {metric.label}
            </dt>
            <dd className="mt-1 font-display text-xl font-semibold text-ink-900">
              {metric.value}
            </dd>
            {metric.hint ? (
              <dd className="mt-1 text-xs text-muted">{metric.hint}</dd>
            ) : null}
          </div>
        ))}
      </dl>
    </Card>
  );
}

/** Explanation of what the report counts, kept beside the figures. */
export function ReportNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 flex items-start gap-3 rounded-control border border-border bg-surface-alt p-4 text-sm text-body">
      <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
      <p>{children}</p>
    </div>
  );
}

export function TrendArrow({ changePct }: { changePct: number | null }) {
  if (changePct === null) return null;
  const Icon = changePct >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={[
        "inline-flex items-center gap-1 text-xs font-medium",
        changePct >= 0 ? "text-teal-700" : "text-red-700",
      ].join(" ")}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {changePct >= 0 ? "+" : ""}
      {changePct}%
    </span>
  );
}
