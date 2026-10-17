import { ELECTRICAL_BRANDS } from "@/lib/content/electrical-brands";
import type { Translator } from "@/lib/i18n/translator";

/**
 * Electrical Services brand strip.
 *
 * Names the manufacturers the department supplies. Server-rendered and static:
 * the brands, their categories and the heading are all in the HTML before any
 * JavaScript runs, so a crawler and a no-JavaScript visitor get the full content.
 *
 * The brand name is a proper noun and is rendered as given; only the category,
 * the heading and the eyebrow are localized.
 */
export function BrandStrip({
  t,
  eyebrow,
  heading,
  intro,
  headingId,
}: {
  t: Translator["t"];
  eyebrow: string;
  heading: string;
  intro?: string;
  /** id for the heading, so the wrapping section can be labelled by it. */
  headingId: string;
}) {
  return (
    <div>
      <p className="mono-label text-dept-accent">{eyebrow}</p>
      <h2
        id={headingId}
        className="display-tight mt-3 font-display text-3xl font-bold text-ink-900 sm:text-4xl"
      >
        {heading}
      </h2>
      <span aria-hidden="true" className="heading-rule" />
      {intro ? (
        <p className="mt-4 max-w-2xl text-base text-body">{intro}</p>
      ) : null}
      <ul className="mt-8 grid gap-6 sm:grid-cols-2">
        {ELECTRICAL_BRANDS.map((brand) => (
          <li
            key={brand.id}
            className="rounded-card border border-border bg-surface p-6"
          >
            <p className="font-display text-2xl font-bold tracking-tight text-ink-900">
              {brand.name}
            </p>
            <p className="mt-1 text-sm font-medium text-dept-accent">
              {t(brand.categoryKey)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
