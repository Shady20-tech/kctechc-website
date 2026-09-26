import Link from "next/link";
import { SITE } from "@/lib/config/site";

/**
 * Corporate lockup.
 *
 * Uses the supplied KC monogram, which is black ink with a teal accent, so the
 * mark and the palette finally agree. Two pre-rendered files are used rather
 * than a CSS filter: the source artwork is a flattened JPEG on white, and an
 * inverse pair gives a crisp result on the dark ink bands where a filter would
 * muddy the teal.
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
  const titleClass = tone === "light" ? "text-white" : "text-ink-900";
  const mottoClass = tone === "light" ? "text-white/70" : "text-muted";
  const src =
    tone === "light"
      ? "/brand/kc-monogram-inverse.png"
      : "/brand/kc-monogram.png";

  return (
    <Link
      href="/"
      className="group flex min-w-0 items-center gap-3 rounded-card"
      aria-label={`${SITE.legalName} — ${SITE.shortName}`}
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-ink-950 transition-soft group-hover:bg-ink-800"
        aria-hidden="true"
      >
        {/* Plain <img> is deliberate: this is a fixed-size mark with no art
            direction, and next/image would add a client component for no gain. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          width={44}
          height={26}
          className="h-6 w-auto"
          decoding="async"
        />
      </span>
      {/* `min-w-0` + `truncate` keep the lockup on one line at every width. The
          legal name wraps to three lines at 320px, which overflows the 64px bar
          and pushes the header taller than its own rule. */}
      <span className="flex min-w-0 flex-col">
        <span
          className={`truncate font-display text-[0.95rem] font-bold leading-tight tracking-tight ${titleClass}`}
        >
          <span className="sm:hidden">{SITE.shortName}</span>
          <span className="hidden sm:inline">{SITE.legalName}</span>
        </span>
        {showMotto ? (
          <span
            className={`mono-label hidden truncate leading-tight sm:block ${mottoClass}`}
          >
            {SITE.shortName}
            {locale ? ` · ${locale.toUpperCase()}` : ""}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
