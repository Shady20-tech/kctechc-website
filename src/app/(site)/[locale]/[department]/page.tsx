import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ServiceCard } from "@/components/content/ServiceCard";
import { RememberDepartment } from "@/components/layout/LastDepartment";
import { SectionBand } from "@/components/layout/PageShell";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { ContactPrompt, CtaBand } from "@/components/ui/Cta";
import { DepartmentIcon } from "@/components/ui/DepartmentIcon";
import { DEPARTMENTS } from "@/lib/config/site";
import { departmentHasServices } from "@/lib/content/defaults";
import { loadServices } from "@/lib/content/loaders";
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
 * Where the department has published services, this page also acts as the
 * department home: the service catalogue, the process, the commitments and the
 * FAQ render here, so `/[locale]/digital-marketing` is a complete destination
 * rather than a signpost to one. Departments whose content is a later phase keep
 * the original entry experience unchanged.
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

  // A department with real content advertises its own title and description
  // rather than the one-line department blurb.
  const hasContent = departmentHasServices(definition.slug);

  return buildMetadata({
    locale,
    pathWithoutLocale: `/${department}`,
    title: hasContent ? t("dm.metaTitle") : t(definition.labelKey),
    description: hasContent
      ? t("dm.metaDescription")
      : t(definition.descriptionKey),
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
  const hasContent = departmentHasServices(definition.slug);

  const breadcrumbs: BreadcrumbItem[] = [
    { name: t("nav.home"), href: `/${resolved}` },
    { name: label, href: `/${resolved}/${definition.slug}` },
  ];

  const siblings = DEPARTMENTS.filter(
    (entry) => entry.slug !== definition.slug,
  );

  const services = hasContent
    ? await loadServices(definition.slug, resolved)
    : [];

  const processSteps = [
    { title: t("dm.processStep1Title"), body: t("dm.processStep1Body") },
    { title: t("dm.processStep2Title"), body: t("dm.processStep2Body") },
    { title: t("dm.processStep3Title"), body: t("dm.processStep3Body") },
    { title: t("dm.processStep4Title"), body: t("dm.processStep4Body") },
  ];

  const commitments = [
    { title: t("dm.why1Title"), body: t("dm.why1Body") },
    { title: t("dm.why2Title"), body: t("dm.why2Body") },
    { title: t("dm.why3Title"), body: t("dm.why3Body") },
    { title: t("dm.why4Title"), body: t("dm.why4Body") },
  ];

  const faqs = [
    { question: t("dm.faq1Question"), answer: t("dm.faq1Answer") },
    { question: t("dm.faq2Question"), answer: t("dm.faq2Answer") },
    { question: t("dm.faq3Question"), answer: t("dm.faq3Answer") },
    { question: t("dm.faq4Question"), answer: t("dm.faq4Answer") },
  ];

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
                {hasContent ? t("dm.heroHeading") : label}
              </h1>
              <p className="mt-5 text-base leading-relaxed text-ink-200 sm:text-lg">
                {hasContent ? t("dm.heroIntro") : t(definition.descriptionKey)}
              </p>
              {hasContent ? (
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    href={`/${resolved}/${definition.slug}/services`}
                    className="inline-flex items-center gap-2 rounded-pill bg-dept-accent px-5 py-3 text-sm font-semibold text-white transition-soft hover:opacity-90"
                  >
                    {t("dm.heroPrimaryCta")}
                    <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </Link>
                  <Link
                    href={`/${resolved}/contact?department=${definition.slug}`}
                    className="inline-flex items-center rounded-pill border border-white/20 px-5 py-3 text-sm font-semibold text-white transition-soft hover:border-white/40"
                  >
                    {t("dm.heroSecondaryCta")}
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {hasContent ? (
        <>
          <SectionBand labelledBy="department-services-heading">
            <p className="mono-label text-dept-accent">
              01 — {t("dm.servicesHeading")}
            </p>
            <h2
              id="department-services-heading"
              className="display-tight mt-3 font-display text-3xl font-bold text-ink-900"
            >
              {t("dm.servicesHeading")}
            </h2>
            <p className="mt-4 max-w-2xl text-base text-body">
              {t("dm.servicesIntro")}
            </p>
            <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((service, index) => (
                <ServiceCard
                  key={service.slug}
                  href={`/${resolved}/${definition.slug}/services/${service.slug}`}
                  title={service.title}
                  summary={service.summary}
                  index={index}
                  linkLabel={t("actions.learnMore")}
                />
              ))}
            </ul>
            <p className="mt-6 text-sm text-muted">{t("dm.servicesNote")}</p>
          </SectionBand>

          <SectionBand tone="alt" labelledBy="department-process-heading">
            <p className="mono-label text-dept-accent">
              02 — {t("dm.processHeading")}
            </p>
            <h2
              id="department-process-heading"
              className="display-tight mt-3 font-display text-3xl font-bold text-ink-900"
            >
              {t("dm.processHeading")}
            </h2>
            <p className="mt-4 max-w-2xl text-base text-body">
              {t("dm.processIntro")}
            </p>
            <ol
              aria-label={t("a11y.processList")}
              className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
            >
              {processSteps.map((step, index) => (
                <li
                  key={step.title}
                  className="rounded-card border border-border bg-surface p-6"
                >
                  <span
                    aria-hidden="true"
                    className="font-mono text-xs font-semibold text-dept-accent"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-2 text-base font-semibold text-ink-900">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm text-body">{step.body}</p>
                </li>
              ))}
            </ol>
          </SectionBand>

          <SectionBand labelledBy="department-why-heading">
            <div className="grid gap-12 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <p className="mono-label text-dept-accent">
                  03 — {t("dm.whyHeading")}
                </p>
                <h2
                  id="department-why-heading"
                  className="display-tight mt-3 font-display text-3xl font-bold text-ink-900"
                >
                  {t("dm.whyHeading")}
                </h2>
                <p className="mt-4 max-w-2xl text-base text-body">
                  {t("dm.whyIntro")}
                </p>
                <ul className="mt-8 grid gap-6 sm:grid-cols-2">
                  {commitments.map((item) => (
                    <li
                      key={item.title}
                      className="rounded-card border border-border bg-surface-alt p-6"
                    >
                      <h3 className="text-base font-semibold text-ink-900">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-sm text-body">{item.body}</p>
                    </li>
                  ))}
                </ul>
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

          <SectionBand tone="alt" labelledBy="department-faq-heading">
            <h2
              id="department-faq-heading"
              className="text-xl font-semibold text-ink-900"
            >
              {t("dm.faqHeading")}
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-muted">
              {t("dm.faqIntro")}
            </p>
            <dl aria-label={t("a11y.faqList")} className="mt-6 space-y-6">
              {faqs.map((faq) => (
                <div
                  key={faq.question}
                  className="rounded-card border border-border bg-surface p-5"
                >
                  <dt className="text-base font-semibold text-ink-900">
                    {faq.question}
                  </dt>
                  <dd className="mt-2 text-sm leading-relaxed text-body">
                    {faq.answer}
                  </dd>
                </div>
              ))}
            </dl>
          </SectionBand>

          <div className="container-page section">
            <CtaBand
              locale={resolved}
              t={t}
              heading={t("dm.ctaHeading")}
              body={t("dm.ctaBody")}
              accent
            />
          </div>
        </>
      ) : (
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
      )}
    </div>
  );
}
