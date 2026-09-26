import { Mail, MapPin, Phone } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContactForm } from "@/components/inquiries/ContactForm";
import { SectionBand } from "@/components/layout/PageShell";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { PageIntro } from "@/components/ui/PageIntro";
import { DEPARTMENTS, isDepartmentSlug, type DepartmentSlug } from "@/lib/config/site";
import { getSiteContent } from "@/lib/config/site-content";
import { loadServices } from "@/lib/content/loaders";
import { isLocale, LOCALES, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  breadcrumbJsonLd,
  organizationJsonLd,
} from "@/lib/seo/structured-data";

/**
 * Contact page.
 *
 * The form posts to a server action that validates, rate-limits and stores the
 * inquiry before returning a receipt. Real contact details are always shown
 * alongside it, so the page remains useful even if the inquiry system is
 * unconfigured in a given environment.
 *
 * `?department=` pre-selects the relevant department when a visitor arrives from
 * a department page, so the routing they already chose is not asked for twice.
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
    pathWithoutLocale: "/contact",
    title: t("contact.metaTitle"),
    description: t("contact.metaDescription"),
  });
}

export default async function ContactPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ department?: string; service?: string }>;
}) {
  const { locale } = await params;
  const { department, service } = await searchParams;
  if (!isLocale(locale)) notFound();

  const resolved: Locale = locale;
  const t = createTranslator(resolved).t;
  const site = await getSiteContent();

  const defaultDepartment: DepartmentSlug | undefined =
    department && isDepartmentSlug(department) ? department : undefined;

  // Service options come from the published catalogue of the selected department.
  // Only a service that is actually published can be pre-selected, so a stale
  // `?service=` link cannot put a value in the form that the server would reject.
  const serviceOptions = defaultDepartment
    ? (await loadServices(defaultDepartment, resolved)).map((entry) => ({
        slug: entry.slug,
        label: entry.title,
      }))
    : [];

  const defaultService =
    service && serviceOptions.some((option) => option.slug === service)
      ? service
      : undefined;

  const departmentLabels = Object.fromEntries(
    DEPARTMENTS.map((entry) => [entry.slug, t(entry.labelKey)]),
  ) as Record<DepartmentSlug, string>;

  const breadcrumbs: BreadcrumbItem[] = [
    { name: t("nav.home"), href: `/${resolved}` },
    { name: t("nav.contact"), href: `/${resolved}/contact` },
  ];

  const validationMessages: Record<string, string> = {
    required: t("validation.required"),
    invalidEmail: t("validation.invalidEmail"),
    tooShort: t("validation.tooShort"),
    tooLong: t("validation.tooLong"),
    invalidPhone: t("validation.invalidPhone"),
    invalidDepartment: t("validation.invalidDepartment"),
    invalidService: t("validation.invalidService"),
    consentRequired: t("validation.consentRequired"),
    spamDetected: t("validation.spamDetected"),
  };

  return (
    <>
      <JsonLdScript data={organizationJsonLd(resolved)} />
      <JsonLdScript
        data={breadcrumbJsonLd([
          { name: t("nav.home"), path: `/${resolved}` },
          { name: t("nav.contact"), path: `/${resolved}/contact` },
        ])}
      />

      <SectionBand tone="accent">
        <Breadcrumbs
          items={breadcrumbs}
          ariaLabel={t("a11y.breadcrumb")}
          className="mb-6"
        />
        <PageIntro
          eyebrow={t("contact.eyebrow")}
          heading={t("contact.heading")}
          intro={t("contact.intro")}
        />
      </SectionBand>

      <SectionBand labelledBy="contact-form-heading">
        <div className="grid gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ContactForm
              locale={resolved}
              defaultDepartment={defaultDepartment}
              defaultService={defaultService}
              serviceOptions={serviceOptions}
              departmentLabels={departmentLabels}
              validationMessages={validationMessages}
              labels={{
                heading: t("contact.formHeading"),
                intro: t("contact.formIntro"),
                nameLabel: t("contact.nameLabel"),
                namePlaceholder: t("contact.namePlaceholder"),
                emailLabel: t("contact.emailLabel"),
                emailPlaceholder: t("contact.emailPlaceholder"),
                phoneLabel: t("contact.phoneLabel"),
                phoneHint: t("contact.phoneHint"),
                phonePlaceholder: t("contact.phonePlaceholder"),
                departmentLabel: t("contact.departmentLabel"),
                departmentHint: t("contact.departmentHint"),
                departmentGeneral: t("contact.departmentGeneral"),
                serviceLabel: t("contact.serviceLabel"),
                serviceHint: t("contact.serviceHint"),
                serviceGeneral: t("contact.serviceGeneral"),
                subjectLabel: t("contact.subjectLabel"),
                subjectPlaceholder: t("contact.subjectPlaceholder"),
                messageLabel: t("contact.messageLabel"),
                messagePlaceholder: t("contact.messagePlaceholder"),
                consentLabel: t("contact.consentLabel"),
                submit: t("contact.submit"),
                submitting: t("contact.submitting"),
                successTitle: t("contact.successTitle"),
                successBody: t("contact.successBody"),
                errorTitle: t("contact.errorTitle"),
                errorBody: t("contact.errorBody"),
                rateLimitedTitle: t("contact.rateLimitedTitle"),
                rateLimitedBody: t("contact.rateLimitedBody"),
                unavailableTitle: t("contact.unavailableTitle"),
                unavailableBody: t("contact.unavailableBody"),
                errorSummaryHeading: t("contact.errorSummaryHeading"),
                referenceLabel: t("contact.referenceLabel"),
              }}
            />
          </div>

          <div className="space-y-6">
            <section
              aria-labelledby="contact-details-heading"
              className="rounded-card border border-border bg-surface-alt p-6"
            >
              <h2
                id="contact-details-heading"
                className="text-base font-semibold text-ink-900"
              >
                {t("contact.detailsHeading")}
              </h2>
              <dl className="mt-4 space-y-4 text-sm">
                <div className="flex gap-2">
                  <dt className="visually-hidden">{t("footer.phoneLabel")}</dt>
                  <Phone
                    aria-hidden="true"
                    className="mt-0.5 h-4 w-4 shrink-0 text-muted"
                  />
                  <dd className="flex flex-col">
                    {site.contact.phones.map((phone) => (
                      <a
                        key={phone}
                        href={`tel:${phone.replace(/[^+\d]/g, "")}`}
                        className="text-ink-700 underline underline-offset-4"
                      >
                        {phone}
                      </a>
                    ))}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="visually-hidden">{t("footer.emailLabel")}</dt>
                  <Mail
                    aria-hidden="true"
                    className="mt-0.5 h-4 w-4 shrink-0 text-muted"
                  />
                  <dd>
                    <a
                      href={`mailto:${site.contact.email}`}
                      className="text-ink-700 underline underline-offset-4"
                    >
                      {site.contact.email}
                    </a>
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="visually-hidden">{t("footer.addressLabel")}</dt>
                  <MapPin
                    aria-hidden="true"
                    className="mt-0.5 h-4 w-4 shrink-0 text-muted"
                  />
                  <dd className="text-body">
                    <address className="not-italic">
                      {site.contact.address.street}
                      <br />
                      {site.contact.address.city}
                      <br />
                      {site.contact.address.region}
                      <br />
                      {site.contact.address.country}
                    </address>
                  </dd>
                </div>
              </dl>
            </section>

            <section
              aria-labelledby="contact-hours-heading"
              className="rounded-card border border-border bg-surface-alt p-6"
            >
              <h2
                id="contact-hours-heading"
                className="text-base font-semibold text-ink-900"
              >
                {t("contact.officeHoursHeading")}
              </h2>
              <p className="mt-2 text-sm text-body">
                {t("contact.officeHoursBody")}
              </p>
            </section>

            <section
              aria-labelledby="contact-office-heading"
              className="rounded-card border border-border bg-surface-alt p-6"
            >
              <h2
                id="contact-office-heading"
                className="text-base font-semibold text-ink-900"
              >
                {t("contact.mapHeading")}
              </h2>
              <p className="mt-2 text-sm text-body">{t("contact.mapNote")}</p>
            </section>
          </div>
        </div>
      </SectionBand>
    </>
  );
}
