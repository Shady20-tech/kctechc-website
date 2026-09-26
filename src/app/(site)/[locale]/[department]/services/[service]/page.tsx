import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FaqList } from "@/components/content/FaqList";
import { RichText } from "@/components/content/RichText";
import { ServiceCard } from "@/components/content/ServiceCard";
import { SectionBand } from "@/components/layout/PageShell";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { ButtonLink } from "@/components/ui/Button";
import { CtaBand } from "@/components/ui/Cta";
import { DEPARTMENTS } from "@/lib/config/site";
import { departmentHasServices, serviceRecordsFor } from "@/lib/content/defaults";
import { loadService, loadServices } from "@/lib/content/loaders";
import { isLocale, LOCALES, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  breadcrumbJsonLd,
  faqJsonLd,
  serviceJsonLd,
} from "@/lib/seo/structured-data";
import { departmentScopeProps } from "@/lib/theme/department-scope";

/**
 * Service detail page.
 *
 * The localized title, summary, description, features and FAQs are rendered from
 * the content layer, which prefers Supabase and falls back to bundled content.
 * Everything on the page comes from the resolved service record, and the
 * structured data is built from those same values, so markup and page cannot
 * disagree.
 *
 * SEO overrides: `entity_seo` can supply a per-locale title, description,
 * canonical and `noindex`. Where an override is absent the generated default is
 * used, which is what keeps a service page correct without anyone maintaining SEO
 * fields for it.
 */
export function generateStaticParams() {
  return LOCALES.flatMap((locale) =>
    DEPARTMENTS.filter((department) =>
      departmentHasServices(department.slug),
    ).flatMap((department) =>
      serviceRecordsFor(department.slug).map((service) => ({
        locale,
        department: department.slug,
        service: service.slug,
      })),
    ),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; department: string; service: string }>;
}): Promise<Metadata> {
  const { locale, department, service } = await params;
  if (!isLocale(locale)) return {};

  const definition = DEPARTMENTS.find((entry) => entry.slug === department);
  if (!definition || !departmentHasServices(definition.slug)) return {};

  const resolved = await loadService(definition.slug, service, locale);
  if (!resolved) return {};

  const path = `/${department}/services/${service}`;
  const title = resolved.seo.title ?? resolved.title;
  const description = resolved.seo.description ?? resolved.summary;

  const metadata = buildMetadata({
    locale,
    pathWithoutLocale: path,
    title,
    description,
    noindex: resolved.seo.noindex ?? false,
  });

  if (resolved.seo.canonicalOverride) {
    return {
      ...metadata,
      alternates: {
        ...metadata.alternates,
        canonical: resolved.seo.canonicalOverride,
      },
    };
  }

  return metadata;
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ locale: string; department: string; service: string }>;
}) {
  const { locale, department, service } = await params;
  if (!isLocale(locale)) notFound();

  const definition = DEPARTMENTS.find((entry) => entry.slug === department);
  if (!definition || !departmentHasServices(definition.slug)) notFound();

  const resolved: Locale = locale;
  const t = createTranslator(resolved).t;

  const current = await loadService(definition.slug, service, resolved);
  if (!current) notFound();

  const departmentLabel = t(definition.labelKey);
  const servicePath = `/${resolved}/${definition.slug}/services/${current.slug}`;

  const siblings = (await loadServices(definition.slug, resolved)).filter(
    (entry) => entry.slug !== current.slug,
  );

  const breadcrumbs: BreadcrumbItem[] = [
    { name: t("nav.home"), href: `/${resolved}` },
    { name: departmentLabel, href: `/${resolved}/${definition.slug}` },
    {
      name: t("nav.services"),
      href: `/${resolved}/${definition.slug}/services`,
    },
    { name: current.title, href: servicePath },
  ];

  const faqData = faqJsonLd(current.faqs);

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
          { name: current.title, path: servicePath },
        ])}
      />
      <JsonLdScript
        data={serviceJsonLd({
          name: current.title,
          description: current.summary,
          path: servicePath,
          locale: resolved,
          serviceType: current.title,
          // Verified fact from the brief: the department serves clients across
          // Cameroon. Not an invented coverage claim.
          areaServed: "Cameroon",
        })}
      />
      {faqData ? <JsonLdScript data={faqData} /> : null}

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
          <div className="max-w-3xl">
            <p className="mono-label text-dept-accent">
              {t("service.partOfDepartment", { department: departmentLabel })}
            </p>
            <h1 className="display-tight mt-4 font-display text-4xl font-bold text-white sm:text-5xl">
              {current.title}
            </h1>
            <p className="mt-5 text-base leading-relaxed text-ink-200 sm:text-lg">
              {current.summary}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink
                href={`/${resolved}/contact?department=${definition.slug}&service=${current.slug}`}
                variant="accent"
                size="lg"
              >
                {t("service.requestHeading")}
              </ButtonLink>
              <Link
                href={`/${resolved}/${definition.slug}/services`}
                className="inline-flex items-center rounded-pill border border-white/20 px-5 py-3 text-sm font-semibold text-white transition-soft hover:border-white/40"
              >
                {t("service.backToServices")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <SectionBand labelledBy="service-overview-heading">
        <div className="grid gap-12 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2
              id="service-overview-heading"
              className="text-xl font-semibold text-ink-900"
            >
              {t("service.overviewHeading")}
            </h2>
            <div className="mt-5">
              <RichText body={current.description} />
            </div>

            {current.deliveryNotes ? (
              <div className="mt-10">
                <h2
                  id="service-delivery-heading"
                  className="text-xl font-semibold text-ink-900"
                >
                  {t("service.deliveryHeading")}
                </h2>
                <p className="mt-4 text-base leading-relaxed text-body">
                  {current.deliveryNotes}
                </p>
              </div>
            ) : null}
          </div>

          <aside className="space-y-6">
            <section
              aria-labelledby="service-includes-heading"
              className="rounded-card border border-border bg-surface-alt p-6"
            >
              <h2
                id="service-includes-heading"
                className="text-base font-semibold text-ink-900"
              >
                {t("service.includesHeading")}
              </h2>
              <ul
                aria-label={t("a11y.serviceFeatures")}
                className="mt-4 space-y-3"
              >
                {current.features.map((feature) => (
                  <li key={feature} className="flex gap-3 text-sm text-body">
                    <Check
                      aria-hidden="true"
                      className="mt-0.5 h-4 w-4 shrink-0 text-dept-accent"
                    />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </section>

            {current.hasFallback && resolved !== "en" ? (
              <p className="rounded-card border border-border bg-surface p-4 text-xs text-muted">
                {t("service.translationNotice")}
              </p>
            ) : null}
          </aside>
        </div>
      </SectionBand>

      {current.faqs.length > 0 ? (
        <SectionBand tone="alt">
          <FaqList
            items={current.faqs}
            heading={t("service.faqHeading")}
            headingId="service-faq-heading"
            ariaLabel={t("a11y.faqList")}
          />
        </SectionBand>
      ) : null}

      {siblings.length > 0 ? (
        <SectionBand labelledBy="service-other-heading">
          <h2
            id="service-other-heading"
            className="text-xl font-semibold text-ink-900"
          >
            {t("service.otherHeading")}
          </h2>
          <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {siblings.slice(0, 3).map((sibling) => (
              <ServiceCard
                key={sibling.slug}
                href={`/${resolved}/${definition.slug}/services/${sibling.slug}`}
                title={sibling.title}
                summary={sibling.summary}
                linkLabel={t("actions.learnMore")}
              />
            ))}
          </ul>
        </SectionBand>
      ) : null}

      <div className="container-page section">
        <CtaBand
          locale={resolved}
          t={t}
          heading={t("service.requestHeading")}
          body={t("service.requestBody")}
          accent
        />
      </div>
    </div>
  );
}
