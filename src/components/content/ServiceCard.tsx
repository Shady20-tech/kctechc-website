import { ArrowRight } from "lucide-react";
import Link from "next/link";

/**
 * Service card used by the department home and the services index.
 *
 * The whole card is a single anchor rather than a card containing a link, so the
 * click target matches the visual target and there is one link per service in the
 * accessibility tree. The title is the anchor text, which keeps the link
 * meaningful when a screen reader lists links out of context.
 */
export function ServiceCard({
  href,
  title,
  summary,
  index,
  linkLabel,
}: {
  href: string;
  title: string;
  summary: string;
  /** Display number, e.g. "01". Rendered as decoration only. */
  index?: number;
  linkLabel: string;
}) {
  return (
    <li className="h-full">
      <Link
        href={href}
        className="card-edge hover-lift group flex h-full flex-col rounded-card border border-border bg-surface p-6 shadow-card transition-soft hover:border-border-strong hover:shadow-raised"
      >
        {index !== undefined ? (
          <span
            aria-hidden="true"
            className="font-mono text-xs font-semibold text-muted"
          >
            {String(index + 1).padStart(2, "0")}
          </span>
        ) : null}
        <h3 className="mt-2 text-base font-semibold text-ink-900 transition-soft group-hover:text-dept-accent">
          {title}
        </h3>
        <p className="mt-2 flex-1 text-sm text-body">{summary}</p>
        <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-ink-900 underline underline-offset-4 transition-soft group-hover:text-dept-accent">
          {linkLabel}
          <ArrowRight
            aria-hidden="true"
            className="h-4 w-4 transition-soft group-hover:translate-x-1"
          />
        </span>
      </Link>
    </li>
  );
}
