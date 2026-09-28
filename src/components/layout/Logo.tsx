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
 *
 * The accessible name is derived from the link's own content rather than an
 * `aria-label`, which is what `label-content-name-mismatch` requires: visible text
 * must be contained in the accessible name, because a speech-input user can only
 * refer to the control by what they see. An explicit label cannot satisfy that
 * here — the title has two variants, `shortName` below `sm` and `legalName` at `sm`
 * and up, so the label would omit the other breakpoint's visible text, and the
 * audit reads the DOM rather than the painted layout. The subtitle sits inside the
 * link for the same reason; `aria-hidden` would not help, since the text stays
 * visible. Both variants are `truncate`, so a long legal name is clipped visually
 * without changing what the name is.
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

  const subtitle = showMotto
    ? `${SITE.shortName}${locale ? ` · ${locale.toUpperCase()}` : ""}`
    : null;

  // No `aria-label`. The accessible name is taken from the link's own content,
  // which is the only formulation that satisfies `label-content-name-mismatch`
  // here. The title has two variants — `shortName` below `sm`, `legalName` at `sm`
  // and up — so whichever string an `aria-label` hard-coded, the *other*
  // breakpoint's visible text would not be a substring of it, and the audit reads
  // the DOM rather than the painted layout. Letting the name come from the content
  // means it always contains the visible text, at every width. The subtitle is
  // inside the link for the same reason: hiding it with `aria-hidden` does not
  // help, because the text stays visible.
  return (
    <Link
      href="/"
      className="group flex min-w-0 items-center gap-3 rounded-card"
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
        {subtitle ? (
          <span
            className={`mono-label hidden truncate leading-tight sm:block ${mottoClass}`}
          >
            {subtitle}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
