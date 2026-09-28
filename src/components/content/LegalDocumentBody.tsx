import { RichText } from "@/components/content/RichText";
import { SectionBand } from "@/components/layout/PageShell";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { PageIntro } from "@/components/ui/PageIntro";
import type { LegalDocument } from "@/lib/content/legal";

/**
 * Shared renderer for the Terms of Service and Privacy Policy pages.
 *
 * Both documents have the same shape — an intro, a "last updated" line, an
 * optional caveat, a contents list and numbered sections — so one component
 * renders both. That is what keeps the two pages structurally identical as they
 * are revised, rather than drifting into two different layouts.
 *
 * Bodies go through `RichText`, which escapes raw HTML by construction and only
 * turns http(s) and site-relative targets into anchors. That matters here more
 * than anywhere else: legal clauses contain bracketed link syntax and asterisks,
 * so a rendering bug in a legal page is a correctness bug rather than a cosmetic
 * one.
 *
 * Section anchor ids are stable across locales, so `/en/privacy#retention` and
 * `/fr/privacy#retention` point at the same clause and a language switch can
 * preserve the deep link. The contents list is plain in-page anchors, so it works
 * without JavaScript and every clause link is present in the served HTML.
 */
export function LegalDocumentBody({
  document,
  contentsLabel,
  updatedLabel,
  retentionNoteLabel,
  breadcrumbs,
  breadcrumbAriaLabel,
}: {
  document: LegalDocument;
  contentsLabel: string;
  updatedLabel: string;
  retentionNoteLabel: string;
  /** Built by the page, which already resolves the translated crumb labels. */
  breadcrumbs: readonly BreadcrumbItem[];
  breadcrumbAriaLabel: string;
}) {
  return (
    <>
      <SectionBand tone="accent">
        <Breadcrumbs
          items={breadcrumbs}
          ariaLabel={breadcrumbAriaLabel}
          className="mb-6"
        />
        <PageIntro heading={document.title} intro={document.intro}>
          <p className="mt-4 text-sm text-muted">
            {updatedLabel}{" "}
            <time dateTime={document.updatedAtIso}>{document.updatedAt}</time>
          </p>
        </PageIntro>
      </SectionBand>

      <SectionBand labelledBy="legal-contents-heading">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="order-2 lg:order-1">
            {document.sections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                aria-labelledby={`${section.id}-heading`}
                className="scroll-mt-24 border-b border-border py-8 first:pt-0 last:border-0"
              >
                <h2
                  id={`${section.id}-heading`}
                  className="text-xl font-semibold text-ink-900"
                >
                  {section.heading}
                </h2>
                <div className="mt-3 max-w-3xl text-base text-body">
                  <RichText body={section.body} />
                </div>
              </section>
            ))}
          </div>

          <aside
            aria-labelledby="legal-contents-heading"
            className="order-1 h-fit rounded-card border border-border bg-surface-alt p-6 lg:order-2 lg:sticky lg:top-24"
          >
            <h2
              id="legal-contents-heading"
              className="text-base font-semibold text-ink-900"
            >
              {contentsLabel}
            </h2>
            <ol className="mt-4 space-y-2 text-sm">
              {document.sections.map((section, index) => (
                <li key={section.id} className="flex gap-2">
                  <span aria-hidden="true" className="text-muted">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <a
                    href={`#${section.id}`}
                    className="text-body underline-offset-4 transition-soft hover:text-ink-900 hover:underline"
                  >
                    {section.heading}
                  </a>
                </li>
              ))}
            </ol>

            {document.retentionNote ? (
              <p className="mt-6 border-t border-border pt-4 text-xs text-muted">
                <span className="font-semibold text-ink-900">
                  {retentionNoteLabel}
                </span>{" "}
                {document.retentionNote}
              </p>
            ) : null}
          </aside>
        </div>
      </SectionBand>
    </>
  );
}
