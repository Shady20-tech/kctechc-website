import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { RememberDepartment } from "@/components/layout/LastDepartment";
import { SectionBand } from "@/components/layout/PageShell";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { ContactPrompt, CtaBand } from "@/components/ui/Cta";
import { DepartmentIcon } from "@/components/ui/DepartmentIcon";
import { DEPARTMENTS } from "@/lib/config/site";
import { isLocale, LOCALES, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd } from "@/lib/seo/structured-data";
import { departmentScopeProps } from "@/lib/theme/department-scope";

/**
 * Department entry page.
 *
 * Sets `data-department` on its wrapper, which switches `--dept-accent` for the
 * whole subtree — so the hero, breadcrumb, CTA buttons and contact prompt below
 * all adopt the department's colour without any of them knowing which
 * department they are in.
 *
 * The hero uses the department accent on a dark ink band, which is what makes
 * each department feel like its own destination while staying visibly part of
 * one corporate family.
 *
 * Deep department content (services, catalogue, listings) arrives in later
 * phases; this page establishes the entry experience and the routing contract.
 */
export function generateStaticParams() {
  return LOCALES.flatMap((locale) =>
    DEPARTMENTS.map((department) => ({
      locale,
      department: department.slug,
    })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; department: string }>;
}): Promise<Metadata> {
  const { locale, department } = await params;
  if (!isLocale(locale)) return {};
  const definition = DEPARTMENTS.find((entry) => entry.slug === department);
  if (!definition) return {};
  const t = createTranslator(locale).t;
  return buildMetadata({
    locale,
    pathWithoutLocale: `/${department}`,
    title: t(definition.labelKey),
    description: t(definition.descriptionKey),
  });
}

export default async function DepartmentPage({
  params,
}: {
  params: Promise<{ locale: string; department: string }>;
}) {
  const { locale, department } = await params;
  if (!isLocale(locale)) notFound();

  const definition = DEPARTMENTS.find((entry) => entry.slug === department);
  if (!definition) notFound();

  const resolved: Locale = locale;
  const t = createTranslator(resolved).t;
  const label = t(definition.labelKey);

  const breadcrumbs: BreadcrumbItem[] = [
    { name: t("nav.home"), href: `/${resolved}` },
    { name: label, href: `/${resolved}/${definition.slug}` },
  ];

  const siblings = DEPARTMENTS.filter((entry) => entry.slug !== definition.slug);

  return (
    <div {...departmentScopeProps(definition.slug)}>
      <RememberDepartment slug={definition.slug} />

      <JsonLdScript
        data={breadcrumbJsonLd([
          { name: t("nav.home"), path: `/${resolved}` },
          { name: label, path: `/${resolved}/${definition.slug}` },
        ])}
      />

      <section className="on-ink relative overflow-hidden bg-ink-950">
        <div aria-hidden="true" className="absolute inset-0 bg-grid" />
        <div aria-hidden="true" className="absolute inset-0 bg-glow" />
        <div className="relative container-page py-16 sm:py-20">
          <Breadcrumbs
            items={breadcrumbs}
            ariaLabel={t("a11y.breadcrumb")}
            tone="light"
            className="mb-8"
          />
          <div className="flex items-start gap-5">
            <span
              aria-hidden="true"
              className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-card bg-white/5 text-dept-accent sm:flex"
            >
              <DepartmentIcon slug={definition.icon} className="h-8 w-8" />
            </span>
            <div className="max-w-3xl">
              <p className="mono-label text-dept-accent">
                {t("nav.departments")}
              </p>
              <h1 className="display-tight mt-4 font-display text-4xl font-bold text-white sm:text-5xl">
                {label}
              </h1>
              <p className="mt-5 text-base leading-relaxed text-ink-200 sm:text-lg">
                {t(definition.descriptionKey)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <SectionBand labelledBy="department-summary-heading">
        <div className="grid gap-12 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <p className="mono-label text-dept-accent">
              01 — {t("home.statementHeading")}
            </p>
            <h2
              id="department-summary-heading"
              className="display-tight mt-3 font-display text-3xl font-bold text-ink-900"
            >
              {t("home.statementHeading")}
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-body">
              {t(definition.summaryKey)}
            </p>

            <div className="mt-10">
              <CtaBand
                locale={resolved}
                t={t}
                heading={t("about.ctaHeading")}
                body={t("about.ctaBody")}
                accent
              />
            </div>
          </div>

          <div className="space-y-6">
            <ContactPrompt
              locale={resolved}
              t={t}
              heading={t("contact.heading")}
              body={t("contact.intro")}
            />

            <nav
              aria-labelledby="other-departments-heading"
              className="rounded-card border border-border bg-surface-alt p-6"
            >
              <h2
                id="other-departments-heading"
                className="mono-label text-muted"
              >
                {t("nav.departments")}
              </h2>
              <ul className="mt-4 space-y-3">
                {siblings.map((sibling) => (
                  <li key={sibling.slug}>
                    <Link
                      href={`/${resolved}/${sibling.slug}`}
                      className="group inline-flex items-center gap-3 text-sm font-medium text-ink-900 transition-soft hover:text-dept-accent"
                    >
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: sibling.accent }}
                      />
                      {t(sibling.labelKey)}
                      <ArrowRight
                        aria-hidden="true"
                        className="h-3.5 w-3.5 opacity-0 transition-soft group-hover:translate-x-1 group-hover:opacity-100"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </SectionBand>
    </div>
  );
}
