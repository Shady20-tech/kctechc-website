import type { ReactNode } from "react";

import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { HeroMedia } from "@/components/ui/HeroMedia";

/**
 * Shared corporate page hero.
 *
 * The department pages each open with an on-ink hero; the corporate pages —
 * About, Services, Gallery, Contact — opened with a plain `accent-wash` band and
 * a `PageIntro`, which read as a heading on a tinted strip. This gives them the
 * same engineered opening without a department's identity: the corporate hero
 * carries the brand teal accent (`--dept-accent` is teal-300 on ink by default),
 * so it is visibly the same family as the department heroes and visibly not one
 * of them.
 *
 * The backdrop is optional. Pages that have a photograph pass one through
 * `image`; the rest get the ink band, the technical grid and the glow, which is a
 * deliberate composition rather than a missing image.
 *
 * Copy sits over the photograph, so every layer under it is `aria-hidden` and the
 * scrim from `HeroMedia` is what keeps the text legible — the same contract the
 * department heroes use. Nothing here is the page's only copy: `children` below
 * the lede is where a page adds its own specifics.
 */
export function PageHero({
  eyebrow,
  heading,
  intro,
  breadcrumbs,
  breadcrumbLabel,
  image,
  credit,
  children,
  meta,
}: {
  eyebrow: string;
  heading: string;
  intro?: string;
  breadcrumbs?: readonly BreadcrumbItem[];
  /** Accessible name for the breadcrumb nav; required when `breadcrumbs` is set. */
  breadcrumbLabel?: string;
  /** Decorative backdrop photo. Omit for a composition-only hero. */
  image?: string;
  /**
   * Attribution for the backdrop, required by the CC BY licences. Rendered
   * inside the copy column so it sits over the protected part of the photo,
   * and only when the image's licence actually demands it.
   */
  credit?: { label: string; href: string };
  /** Page-specific content rendered under the lede (CTAs, search, facts). */
  children?: ReactNode;
  /**
   * Small factual annotations pinned to the hero foot — the address, the motto.
   * Rendered as a definition list so each value keeps its label for a
   * screen-reader user rather than reading as a loose string of phrases.
   */
  meta?: readonly { term: string; detail: string }[];
}) {
  return (
    <section className="on-ink relative overflow-hidden bg-ink-950">
      {image ? <HeroMedia src={image} /> : null}
      <div aria-hidden="true" className="absolute inset-0 bg-grid" />
      <div aria-hidden="true" className="absolute inset-0 bg-glow" />
      <div aria-hidden="true" className="absolute inset-0 bg-glow-warm" />

      <div className="relative container-page py-16 sm:py-20 lg:py-24">
        {breadcrumbs && breadcrumbLabel ? (
          <Breadcrumbs
            items={breadcrumbs}
            ariaLabel={breadcrumbLabel}
            tone="light"
            className="reveal mb-8"
          />
        ) : null}

        <p className="reveal mono-label text-dept-accent">{eyebrow}</p>

        <h1
          className="reveal display-tight mt-5 max-w-4xl font-display text-4xl font-bold text-electric-300 sm:text-5xl"
          style={{ "--reveal-delay": "80ms" } as React.CSSProperties}
        >
          {heading}
        </h1>

        <span aria-hidden="true" className="heading-rule" />

        {intro ? (
          <p
            className="reveal mt-6 max-w-3xl text-base leading-relaxed text-ink-200 sm:text-lg"
            style={{ "--reveal-delay": "160ms" } as React.CSSProperties}
          >
            {intro}
          </p>
        ) : null}

        {children ? <div className="mt-8">{children}</div> : null}

        {meta && meta.length > 0 ? (
          // Constrained to the copy column, not the full container. The scrim is
          // weighted to the inline-start edge, so a three-column strip spanning
          // the whole width puts its last column over the lightly-scrimmed photo
          // — measured at 1.4:1 for the label over the bright corporate backdrop.
          // Inside `max-w-3xl` every column stays in the protected zone.
          <dl className="mt-12 grid max-w-3xl gap-x-8 gap-y-5 border-t border-white/10 pt-7 sm:grid-cols-3">
            {meta.map((entry) => (
              <div key={entry.term}>
                <dt className="mono-label text-ink-300">{entry.term}</dt>
                <dd className="mt-2 text-sm text-ink-100">{entry.detail}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {credit ? (
          <p className="mt-6 max-w-3xl text-xs text-ink-300">
            <a
              href={credit.href}
              rel="noopener noreferrer nofollow"
              target="_blank"
              className="underline decoration-white/30 underline-offset-2 transition-soft hover:text-ink-100"
            >
              {credit.label}
            </a>
          </p>
        ) : null}
      </div>
    </section>
  );
}
