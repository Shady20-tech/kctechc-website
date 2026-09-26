import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionBand } from "@/components/layout/PageShell";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { PageIntro } from "@/components/ui/PageIntro";
import { DEPARTMENTS } from "@/lib/config/site";
import { isLocale, LOCALES, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd } from "@/lib/seo/structured-data";
import { departmentScopeProps } from "@/lib/theme/department-scope";

/**
 * Blog / articles index.
 *
 * An explicit empty state rather than fabricated posts. The brief reserves
 * insights for the Digital Marketing department and no authored content exists
 * yet, so inventing articles — or publishing lorem-ipsum placeholders under the
 * company name — would be worse than admitting the page is empty.
 *
 * Note for later: `BlogPosting` structured data and author/`datePublished` fields
 * must accompany real posts when this page gains content. Emitting them now, with
 * nothing behind them, would be structured-data spam.
 */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = createTranslator(locale).t;
  return buildMetadata({
    locale,
    pathWithoutLocale: "/blog",
    title: t("blog.metaTitle"),
    description: t("blog.metaDescription"),
  });
}

export default async function BlogPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const resolved: Locale = locale;
  const t = createTranslator(resolved).t;

  const breadcrumbs: BreadcrumbItem[] = [
    { name: t("nav.home"), href: `/${resolved}` },
    { name: t("nav.blog"), href: `/${resolved}/blog` },
  ];

  return (
    <>
      <JsonLdScript
        data={breadcrumbJsonLd([
          { name: t("nav.home"), path: `/${resolved}` },
          { name: t("nav.blog"), path: `/${resolved}/blog` },
        ])}
      />

      <SectionBand tone="accent">
        <Breadcrumbs
          items={breadcrumbs}
          ariaLabel={t("a11y.breadcrumb")}
          className="mb-6"
        />
        <PageIntro
          eyebrow={t("blog.eyebrow")}
          heading={t("blog.heading")}
          intro={t("blog.intro")}
        />
      </SectionBand>

      <SectionBand labelledBy="blog-empty-heading">
        <div className="max-w-2xl rounded-card border border-border bg-surface-alt p-8">
          <h2
            id="blog-empty-heading"
            className="text-lg font-semibold text-ink-900"
          >
            {t("blog.emptyHeading")}
          </h2>
          <p className="mt-3 text-base text-body">{t("blog.emptyBody")}</p>
        </div>

        <h3 className="mono-label mt-10 text-muted">
          {t("blog.browseDepartments")}
        </h3>
        <ul className="mt-4 grid gap-4 sm:grid-cols-3">
          {DEPARTMENTS.map((department) => (
            <li key={department.slug} {...departmentScopeProps(department.slug)}>
              <Link
                href={`/${resolved}/${department.slug}`}
                className="card-edge block rounded-card border border-border bg-surface p-5 shadow-card transition-soft hover:border-border-strong hover:shadow-raised"
              >
                <span className="block text-sm font-semibold text-ink-900">
                  {t(department.labelKey)}
                </span>
                <span className="mt-1 block text-sm text-body">
                  {t(department.descriptionKey)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </SectionBand>
    </>
  );
}
