import { Quote } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { SectionBand } from "@/components/layout/PageShell";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";

/**
 * Founder's message.
 *
 * The portrait sits on the left and the address on the right at `lg` and up; on
 * narrower viewports the two stack, portrait first, because the photograph is the
 * attribution for everything that follows and reading the letter before knowing
 * who wrote it is the wrong order. The stack is the default and the two-column
 * grid is the enhancement, which is what keeps the mobile layout from being an
 * afterthought.
 *
 * The message body is a single message key containing blank-line-separated
 * paragraphs. It is split here and rendered as real `<p>` elements, so the letter
 * stays one editable string while the page gets correct paragraph spacing and
 * semantics — never a `<br>` chain or a `dangerouslySetInnerHTML` blob.
 *
 * `variant="summary"` is the homepage placement: it keeps the first paragraph and
 * the sign-off and links to the full letter on `/about`, so the homepage carries
 * the vision without repeating the entire address.
 */

export type ChairmanMessageVariant = "full" | "summary";

const PORTRAIT_SRC = "/brand/chairman-portrait.jpg";

export function ChairmanMessage({
  locale,
  variant = "full",
  tone = "alt",
  id = "chairman-message",
  showPortrait = true,
  eyebrow,
  heading,
  intro,
  ctaHref,
  ctaLabel,
}: {
  locale: Locale;
  variant?: ChairmanMessageVariant;
  tone?: "default" | "alt" | "accent";
  /**
   * Section id and heading id. Must be unique on the page — the bilingual
   * corporate gateway renders the message once per language, so the two
   * instances need distinct ids or the document would carry duplicate anchors.
   */
  id?: string;
  /** False for a second-language rendering that should not repeat the portrait. */
  showPortrait?: boolean;
  eyebrow: string;
  heading: string;
  /** Optional lede shown under the heading in the full variant. */
  intro?: string;
  /** Present only for the summary variant, which funnels to the full letter. */
  ctaHref?: string;
  ctaLabel?: string;
}) {
  const t = createTranslator(locale).t;

  const paragraphs = t("about.leaderBody")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);

  const visible = variant === "summary" ? paragraphs.slice(0, 1) : paragraphs;

  const pillars = [
    {
      title: t("about.chairmanPillar1Title"),
      body: t("about.chairmanPillar1Body"),
    },
    {
      title: t("about.chairmanPillar2Title"),
      body: t("about.chairmanPillar2Body"),
    },
    {
      title: t("about.chairmanPillar3Title"),
      body: t("about.chairmanPillar3Body"),
    },
  ];

  return (
    <SectionBand tone={tone} labelledBy={`${id}-heading`}>
      <div
        className={`grid gap-10 ${
          showPortrait
            ? "lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-14 lg:items-start"
            : ""
        }`}
      >
        {/* Portrait. On mobile it leads; the attribution beneath it is what makes
            the letter a person speaking rather than anonymous corporate copy. */}
        {showPortrait ? (
          <figure className="mx-auto w-full max-w-sm lg:mx-0">
            <div className="relative aspect-[4/5] overflow-hidden rounded-card border border-border bg-ink-950 shadow-card">
              <Image
                src={PORTRAIT_SRC}
                alt={t("about.chairmanPortraitAlt")}
                fill
                sizes="(min-width: 1024px) 20rem, (min-width: 640px) 24rem, 100vw"
                className="object-cover"
              />
              {/* A thin accent rail is the only ornament: it ties the portrait to
                  the department accent without tinting the photograph itself. */}
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 w-1 bg-dept-accent"
              />
            </div>
            <figcaption className="mt-4 border-l-2 border-dept-accent pl-4">
              <p className="text-base font-semibold text-ink-900">
                {t("about.leaderName")}
              </p>
              <p className="mono-label mt-1 text-muted">
                {t("about.leaderRole")}
              </p>
            </figcaption>
          </figure>
        ) : null}

        <div>
          <p className="mono-label text-dept-accent">{eyebrow}</p>
          <h2
            id={`${id}-heading`}
            className="display-tight mt-3 font-display text-2xl font-bold text-ink-900 sm:text-3xl"
          >
            {heading}
          </h2>
          {intro ? (
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-body">
              {intro}
            </p>
          ) : null}

          <Quote aria-hidden="true" className="mt-6 h-6 w-6 text-dept-accent" />

          <div className="mt-4 max-w-2xl space-y-4">
            {visible.map((paragraph) => (
              <p
                key={paragraph.slice(0, 48)}
                className="text-base leading-relaxed text-body"
              >
                {paragraph}
              </p>
            ))}
          </div>

          {variant === "full" ? (
            <>
              <h3 className="mt-9 font-display text-lg font-bold text-ink-900">
                {t("about.chairmanPillarsHeading")}
              </h3>
              <ul className="mt-4 grid gap-4 sm:grid-cols-3">
                {pillars.map((pillar) => (
                  <li
                    key={pillar.title}
                    className="rounded-card border border-border bg-surface p-5 shadow-card"
                  >
                    <h4 className="text-sm font-semibold text-ink-900">
                      {pillar.title}
                    </h4>
                    <p className="mt-2 text-sm text-body">{pillar.body}</p>
                  </li>
                ))}
              </ul>

              <h3 className="mt-9 font-display text-lg font-bold text-ink-900">
                {t("about.chairmanValuesHeading")}
              </h3>
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-body">
                {t("about.chairmanValues")}
              </p>
            </>
          ) : null}

          {/* Sign-off. Every letter ends with the writer's name, whether or not the
              full body was shown. */}
          <div className="mt-8 border-t border-border pt-5">
            <p className="font-display text-base font-bold text-ink-900">
              {t("about.leaderName")}
            </p>
            <p className="mono-label mt-1 text-muted">
              {t("about.leaderRole")}
            </p>
            {variant === "summary" && ctaHref && ctaLabel ? (
              <Link
                href={ctaHref}
                className="group mt-4 inline-flex items-center gap-2 text-sm font-semibold text-ink-900 transition-soft hover:text-dept-accent"
              >
                {ctaLabel}
                <span
                  aria-hidden="true"
                  className="transition-soft group-hover:translate-x-1"
                >
                  &rarr;
                </span>
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </SectionBand>
  );
}
