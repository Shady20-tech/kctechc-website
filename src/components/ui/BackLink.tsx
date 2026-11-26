import { ArrowLeft } from "lucide-react";
import Link from "next/link";

/**
 * A deterministic "back to the parent" link.
 *
 * It takes an explicit destination rather than calling `history.back()`, so a
 * deep link, a search result or an action redirect still lands on the list the
 * page belongs to. The 44px minimum height keeps the target usable on a phone.
 */
export function BackLink({
  href,
  label,
  className,
}: {
  href: string;
  /** Full visible text, e.g. "Back to Store & Products". */
  label: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={[
        "inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-body transition-soft hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dept-accent focus-visible:ring-offset-2",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <ArrowLeft aria-hidden="true" className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  );
}
