import type { FaqItem } from "@/lib/content/types";

/**
 * FAQ list.
 *
 * Rendered as real heading-and-answer markup rather than an accordion, so the
 * answers are present in the page for search engines and for a reader using
 * find-in-page. The same array is passed to `faqJsonLd`, which means the
 * structured data can never describe a question the page does not show.
 */
export function FaqList({
  items,
  heading,
  headingId,
  ariaLabel,
}: {
  items: readonly FaqItem[];
  heading: string;
  headingId: string;
  ariaLabel: string;
}) {
  if (items.length === 0) return null;

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="text-xl font-semibold text-ink-900">
        {heading}
      </h2>
      <dl aria-label={ariaLabel} className="mt-6 space-y-6">
        {items.map((item) => (
          <div
            key={item.question}
            className="rounded-card border border-border bg-surface p-5"
          >
            <dt className="text-base font-semibold text-ink-900">
              {item.question}
            </dt>
            <dd className="mt-2 text-sm leading-relaxed text-body">
              {item.answer}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
