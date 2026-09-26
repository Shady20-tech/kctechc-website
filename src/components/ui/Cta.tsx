import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import type { Locale } from "@/lib/i18n/locales";
import type { Translator } from "@/lib/i18n/translator";

/**
 * Reusable call-to-action band.
 *
 * Used at the foot of content pages to funnel every route into the same
 * contact/quote pipeline, so there is one conversion path rather than a
 * different one per page. `accent` renders in the surrounding department colour
 * when placed inside a department subtree.
 */
export function CtaBand({
  locale,
  t,
  heading,
  body,
  accent = false,
}: {
  locale: Locale;
  t: Translator["t"];
  heading: string;
  body: string;
  accent?: boolean;
}) {
  return (
    <section
      aria-labelledby="cta-heading"
      className={`rounded-card border border-border p-6 sm:p-8 ${
        accent ? "accent-wash" : "bg-surface-alt"
      }`}
    >
      <h2 id="cta-heading" className="text-xl font-semibold text-ink-900">
        {heading}
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-body">{body}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <ButtonLink
          href={`/${locale}/contact`}
          variant={accent ? "accent" : "primary"}
        >
          {t("actions.getQuote")}
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </ButtonLink>
        <ButtonLink href={`/${locale}/contact`} variant="secondary">
          {t("actions.contact")}
        </ButtonLink>
      </div>
    </section>
  );
}

/**
 * Compact contact prompt for sidebars and inline placements.
 */
export function ContactPrompt({
  locale,
  t,
  heading,
  body,
}: {
  locale: Locale;
  t: Translator["t"];
  heading: string;
  body: string;
}) {
  return (
    <aside
      aria-labelledby="contact-prompt-heading"
      className="rounded-card border border-border bg-surface p-6 shadow-card"
    >
      <h2
        id="contact-prompt-heading"
        className="text-base font-semibold text-ink-900"
      >
        {heading}
      </h2>
      <p className="mt-2 text-sm text-body">{body}</p>
      <ButtonLink
        href={`/${locale}/contact`}
        variant="accent"
        size="sm"
        className="mt-4"
      >
        {t("actions.getQuote")}
      </ButtonLink>
    </aside>
  );
}
