import Image from "next/image";
import {
  ELECTRICAL_WORK,
  ELECTRICAL_WORK_ALT_KEY,
} from "@/lib/content/electrical-work";
import type { Translator } from "@/lib/i18n/translator";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

/**
 * Electrical Services completed-work showcase.
 *
 * Same two motion treatments as `ProductShowcase`, applied to the photographs
 * the client supplied of work the department has carried out:
 *
 *   - `marquee` — the continuous drift, used on the homepage.
 *   - `grid` — the staggered, scroll-triggered rise, used on the department page.
 *
 * Both sit on server-rendered markup, so the photographs and their descriptions
 * are in the HTML before any JavaScript runs, and the reduced-motion block turns
 * the marquee into a plain horizontal scroll rather than freezing it.
 *
 * The photographs are portrait (3:4), unlike the square product tiles, so this
 * uses its own media box rather than `product-tile-media`: a 1:1 crop of a
 * portrait photograph cuts the top and bottom off the work being shown.
 *
 * Every image shares one generic description because the client supplied no
 * captions — see `electrical-work.ts`. There is deliberately no caption line: an
 * invented site name or capacity would be a fabricated project record.
 */
export function WorkShowcase({
  t,
  variant,
  eyebrow,
  heading,
  intro,
  note,
  headingId,
}: {
  t: Translator["t"];
  variant: "marquee" | "grid";
  eyebrow: string;
  heading: string;
  intro: string;
  note: string;
  /** id for the section heading, so the region can be labelled by it. */
  headingId: string;
}) {
  const work = ELECTRICAL_WORK;
  const alt = t(ELECTRICAL_WORK_ALT_KEY);

  const header = (
    <div className="max-w-2xl">
      <p className="mono-label text-dept-accent">{eyebrow}</p>
      <h2
        id={headingId}
        className="display-tight mt-3 font-display text-3xl font-bold text-ink-900 sm:text-4xl"
      >
        {heading}
      </h2>
      <span aria-hidden="true" className="heading-rule" />
      <p className="mt-4 text-base text-body">{intro}</p>
    </div>
  );

  /**
   * `sizes` must describe the real box, per variant.
   *
   * These are measured, not guessed: the grid runs 1 column below 640px, 2 up to
   * 1023px and 4 above (a ~1248px container less 1.5rem gaps gives ~284px tiles),
   * while the marquee tile is a flat 17rem capped at 72vw. One shared value
   * understated the grid and made `next/image` serve a 256px file into a 351px
   * box — an upscale, which looks soft and is invisible in the markup.
   */
  const sizes =
    variant === "marquee"
      ? "(min-width: 640px) 17rem, 72vw"
      : "(min-width: 1024px) 18rem, (min-width: 640px) 23rem, 92vw";

  const figure = (item: (typeof work)[number], decorative: boolean) => (
    <figure className="work-tile">
      <div className="work-tile-media">
        <Image
          src={item.image}
          alt={decorative ? "" : alt}
          fill
          sizes={sizes}
          className="object-cover"
        />
      </div>
    </figure>
  );

  return (
    <section
      aria-labelledby={headingId}
      className="border-b border-border bg-canvas"
    >
      <div className="container-page section">
        {header}
        <p className="mt-4 max-w-2xl text-sm text-muted">{note}</p>
      </div>

      {variant === "marquee" ? (
        <div className="work-marquee pb-14" role="group" aria-label={heading}>
          <div className="work-marquee-track">
            <ul className="work-set">
              {work.map((item) => (
                <li key={item.id}>{figure(item, false)}</li>
              ))}
            </ul>
            <ul className="work-set" aria-hidden="true">
              {work.map((item) => (
                <li key={`${item.id}-repeat`}>{figure(item, true)}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <ul className="work-grid container-page grid gap-6 pb-16 sm:grid-cols-2 lg:grid-cols-4">
          {work.map((item, index) => (
            <ScrollReveal
              as="li"
              key={item.id}
              stagger={{ index, columns: [1, 2, 4] }}
            >
              {figure(item, false)}
            </ScrollReveal>
          ))}
        </ul>
      )}
    </section>
  );
}
