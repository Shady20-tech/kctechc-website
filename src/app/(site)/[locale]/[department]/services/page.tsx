import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ServiceCard } from "@/components/content/ServiceCard";
import { SectionBand } from "@/components/layout/PageShell";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { CtaBand } from "@/components/ui/Cta";
import { PageIntro } from "@/components/ui/PageIntro";
import { DEPARTMENTS } from "@/lib/config/site";
import { departmentHasServices } from "@/lib/content/defaults";
import { loadServices } from "@/lib/content/loaders";
import { isLocale, LOCALES, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd } from "@/lib/seo/structured-data";
import { departmentScopeProps } from "@/lib/theme/department-scope";

/**
 * Department services index.
 *
 * Nested under the existing `[department]` segment rather than given its own
 * static route, so the URL is exactly `/[locale]/digital-marketing/services` and
 * the department page remains the single entry point for that department. A
 * parallel static directory would shadow the dynamic segment and split the
 * department across two page components.
 *
 * Only departments whose content is published have this surface; the rest 404
 * until their phase supplies the services, without any change to the URL scheme.
 */
export function generateStaticParams() {
  return LOCALES.flatMap((locale) =>
    DEPARTMENTS.filter((department) =>
      departmentHasServices(department.slug),
    ).map((department) => ({ locale, department: department.slug })),
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
  if (!definition || !departmentHasServices(definition.slug)) return {};

  const t = createTranslator(locale).t;
  return buildMetadata({
    locale,
    pathWithoutLocale: `/${department}/services`,
    title: t("dm.servicesMetaTitle"),
    description: t("dm.servicesMetaDescription"),
  });
}

export default async function DepartmentServicesPage({
  params,
}: {
  params: Promise<{ locale: string; department: string }>;
}) {
  const { locale, department } = await params;
  if (!isLocale(locale)) notFound();

  const definition = DEPARTMENTS.find((entry) => entry.slug === department);
  if (!definition || !departmentHasServices(definition.slug)) notFound();

  const resolved: Locale = locale;
  const t = createTranslator(resolved).t;
  const departmentLabel = t(definition.labelKey);
  const services = await loadServices(definition.slug, resolved);

  const breadcrumbs: BreadcrumbItem[] = [
    { name: t("nav.home"), href: `/${resolved}` },
    { name: departmentLabel, href: `/${resolved}/${definition.slug}` },
    {
      name: t("nav.services"),
      href: `/${resolved}/${definition.slug}/services`,
    },
  ];

  return (
    <div {...departmentScopeProps(definition.slug)}>
      <JsonLdScript
        data={breadcrumbJsonLd([
          { name: t("nav.home"), path: `/${resolved}` },
          { name: departmentLabel, path: `/${resolved}/${definition.slug}` },
          {
            name: t("nav.services"),
            path: `/${resolved}/${definition.slug}/services`,
          },
        ])}
      />

      <SectionBand tone="accent">
        <Breadcrumbs
          items={breadcrumbs}
          ariaLabel={t("a11y.breadcrumb")}
          className="mb-6"
        />
        <PageIntro
          eyebrow={t("dm.servicesEyebrow")}
          heading={t("dm.servicesHeadingFull")}
          intro={t("dm.servicesIntroFull")}
        />
      </SectionBand>

      <SectionBand labelledBy="department-services-heading">
        <h2 id="department-services-heading" className="visually-hidden">
          {t("a11y.serviceList")}
        </h2>
        <ul
          aria-label={t("a11y.serviceList")}
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
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
    </div>
  );
}
