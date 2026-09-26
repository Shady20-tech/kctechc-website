import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RememberDepartment } from "@/components/layout/LastDepartment";
import { SectionBand } from "@/components/layout/PageShell";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { ContactPrompt, CtaBand } from "@/components/ui/Cta";
import { DepartmentIcon } from "@/components/ui/DepartmentIcon";
import { PageIntro } from "@/components/ui/PageIntro";
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
 * whole subtree — so the breadcrumb, CTA buttons and contact prompt below all
 * adopt the department's colour without any of them knowing which department
 * they are in.
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

      <SectionBand tone="accent">
        <Breadcrumbs
          items={breadcrumbs}
          ariaLabel={t("a11y.breadcrumb")}
          className="mb-6"
        />
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-card bg-surface text-dept-accent shadow-card sm:flex"
          >
            <DepartmentIcon slug={definition.icon} className="h-7 w-7" />
          </span>
          <PageIntro
            eyebrow={t("nav.departments")}
            heading={label}
            intro={t(definition.descriptionKey)}
          />
        </div>
      </SectionBand>

      <SectionBand labelledBy="department-summary-heading">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2
              id="department-summary-heading"
              className="text-xl font-semibold text-navy-900"
            >
              {t("home.statementHeading")}
            </h2>
            <p className="mt-3 max-w-2xl text-base text-body">
              {t(definition.summaryKey)}
            </p>

            <div className="mt-8">
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
                className="text-base font-semibold text-navy-900"
              >
                {t("nav.departments")}
              </h2>
              <ul className="mt-3 space-y-2">
                {siblings.map((sibling) => (
                  <li key={sibling.slug}>
                    <Link
                      href={`/${resolved}/${sibling.slug}`}
                      className="inline-flex items-center gap-2 text-sm text-navy-900 transition-soft hover:underline"
                    >
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: sibling.accent }}
                      />
                      {t(sibling.labelKey)}
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
