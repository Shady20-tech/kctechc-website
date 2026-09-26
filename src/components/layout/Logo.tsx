import Link from "next/link";
import { SITE } from "@/lib/config/site";

/**
 * Corporate wordmark.
 *
 * No logo artwork has been supplied by the business, so this is a typographic
 * mark built from the company initials rather than an invented or placeholder
 * image. When a real logo asset arrives it replaces the monogram here and every
 * usage updates at once.
 *
 * The mark always links to `/`, the language-neutral corporate gateway, so the
 * "go home" affordance never silently switches a visitor's language.
 */
export function Logo({
  locale,
  showMotto = true,
  tone = "dark",
}: {
  locale?: string;
  showMotto?: boolean;
  tone?: "dark" | "light";
}) {
  const href = "/";
  const titleClass = tone === "light" ? "text-white" : "text-navy-900";
  const mottoClass = tone === "light" ? "text-white/80" : "text-muted";

  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-card"
      aria-label={`${SITE.legalName} — ${SITE.shortName}`}
    >
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-navy-900 font-display text-sm font-bold text-gold-500 transition-soft group-hover:bg-navy-700"
      >
        KC
      </span>
      <span className="flex flex-col">
        <span className={`font-display text-base font-bold leading-tight ${titleClass}`}>
          {SITE.legalName}
        </span>
        {showMotto ? (
          <span className={`text-[0.7rem] leading-tight ${mottoClass}`}>
            {SITE.shortName}
            {locale ? ` · ${locale.toUpperCase()}` : ""}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
