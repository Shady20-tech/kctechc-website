import { Mail, MapPin, Phone } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QuoteForm, type QuoteFormLabels } from "@/components/inquiries/QuoteForm";
import { SectionBand } from "@/components/layout/PageShell";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { CtaBand } from "@/components/ui/Cta";
import { PageIntro } from "@/components/ui/PageIntro";
import { DEPARTMENTS } from "@/lib/config/site";
import { getSiteContent } from "@/lib/config/site-content";
import { departmentCopyPrefix } from "@/lib/content/department-copy";
import { departmentHasServices } from "@/lib/content/defaults";
import { loadServices } from "@/lib/content/loaders";
import { regionsHomeFirst } from "@/lib/content/regions";
import { localizeRegion } from "@/lib/content/types";
import { attachmentLimits } from "@/lib/inquiries/quote-actions";
import { isLocale, LOCALES, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  breadcrumbJsonLd,
  organizationJsonLd,
} from "@/lib/seo/structured-data";
import { departmentScopeProps } from "@/lib/theme/department-scope";

/**
 * Quote / site-visit request page.
 *
 * The form posts to a server action that validates, verifies, rate-limits and
 * stores the lead in the central inquiry inbox before returning a receipt. Real
 * contact details are always shown alongside it, so the page remains useful even
 * if the inquiry system is unconfigured in a given environment — the brief is
 * explicit that a missing external service must never be simulated as success.
 *
 * `?service=` pre-selects the relevant service when a visitor arrives from a
 * service page, so the routing they already chose is not asked for twice.
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
    pathWithoutLocale: `/${department}/quote`,
    title: t("quote.metaTitle"),
    description: t("quote.metaDescription"),
  });
}

export default async function QuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; department: string }>;
  searchParams: Promise<{ service?: string }>;
}) {
  const { locale, department } = await params;
  const { service } = await searchParams;
  if (!isLocale(locale)) notFound();

  const definition = DEPARTMENTS.find((entry) => entry.slug === department);
  if (!definition || !departmentHasServices(definition.slug)) notFound();

  const resolved: Locale = locale;
  const t = createTranslator(resolved).t;
  const copy = departmentCopyPrefix(definition.slug) ?? "dm";
  const departmentLabel = t(definition.labelKey);
  const site = await getSiteContent();

  const services = await loadServices(definition.slug, resolved);
  const serviceOptions = services.map((entry) => ({
    slug: entry.slug,
    label: entry.title,
  }));

  // Only a published service can be pre-selected, so a stale `?service=` link
  // cannot put a value in the form that the server would reject.
  const defaultService =
    service && serviceOptions.some((option) => option.slug === service)
      ? service
      : undefined;

  const regionOptions = regionsHomeFirst().map((entry) => ({
    slug: entry.slug,
    label: localizeRegion(entry, resolved).name,
  }));

  const { maxFiles, maxSize } = await attachmentLimits();

  const validationMessages: Record<string, string> = {
    required: t("validation.required"),
    invalidEmail: t("validation.invalidEmail"),
    tooShort: t("validation.tooShort"),
    tooLong: t("validation.tooLong"),
    invalidPhone: t("validation.invalidPhone"),
    invalidService: t("validation.invalidService"),
    invalidRegion: t("validation.invalidRegion"),
    invalidPropertyType: t("validation.invalidPropertyType"),
    invalidContactMethod: t("validation.invalidContactMethod"),
    invalidAppointmentWindow: t("validation.invalidAppointmentWindow"),
    invalidDate: t("validation.invalidDate"),
    dateInPast: t("validation.dateInPast"),
    invalidLocation: t("validation.invalidLocation"),
    fileTooLarge: t("validation.fileTooLarge"),
    fileTypeNotAllowed: t("validation.fileTypeNotAllowed"),
    tooManyFiles: t("validation.tooManyFiles"),
    fileEmpty: t("validation.fileEmpty"),
    consentRequired: t("validation.consentRequired"),
    spamDetected: t("validation.spamDetected"),
  };

  const labels: QuoteFormLabels = {
    formHeading: t("quote.formHeading"),
    formIntro: t("quote.formIntro"),
    nameLabel: t("quote.nameLabel"),
    namePlaceholder: t("quote.namePlaceholder"),
    emailLabel: t("quote.emailLabel"),
    emailPlaceholder: t("quote.emailPlaceholder"),
    phoneLabel: t("quote.phoneLabel"),
    phoneHint: t("quote.phoneHint"),
    phonePlaceholder: t("quote.phonePlaceholder"),
    locationLabel: t("quote.locationLabel"),
    locationPlaceholder: t("quote.locationPlaceholder"),
    locationHint: t("quote.locationHint"),
    regionLabel: t("quote.regionLabel"),
    regionHint: t("quote.regionHint"),
    regionPlaceholder: t("quote.regionPlaceholder"),
    serviceLabel: t("quote.serviceLabel"),
    serviceHint: t("quote.serviceHint"),
    servicePlaceholder: t("quote.servicePlaceholder"),
    serviceGeneral: t("quote.serviceGeneral"),
    propertyTypeLabel: t("quote.propertyTypeLabel"),
    propertyTypeHint: t("quote.propertyTypeHint"),
    propertyTypePlaceholder: t("quote.propertyTypePlaceholder"),
    propertyTypeResidential: t("projects.propertyTypeResidential"),
    propertyTypeCommercial: t("projects.propertyTypeCommercial"),
    propertyTypeIndustrial: t("projects.propertyTypeIndustrial"),
    contactMethodLabel: t("quote.contactMethodLabel"),
    contactMethodHint: t("quote.contactMethodHint"),
    contactMethodEmail: t("quote.contactMethodEmail"),
    contactMethodPhone: t("quote.contactMethodPhone"),
    contactMethodWhatsapp: t("quote.contactMethodWhatsapp"),
    contactDetailsLabel: t("quote.contactDetailsLabel"),
    contactDetailsHint: t("quote.contactDetailsHint"),
    contactDetailsPlaceholder: t("quote.contactDetailsPlaceholder"),
    descriptionLabel: t("quote.descriptionLabel"),
    descriptionPlaceholder: t("quote.descriptionPlaceholder"),
    appointmentHeading: t("quote.appointmentHeading"),
    appointmentIntro: t("quote.appointmentIntro"),
    appointmentRequestLabel: t("quote.appointmentRequestLabel"),
    appointmentDateLabel: t("quote.appointmentDateLabel"),
    appointmentDateHint: t("quote.appointmentDateHint"),
    appointmentWindowLabel: t("quote.appointmentWindowLabel"),
    appointmentWindowMorning: t("quote.appointmentWindowMorning"),
    appointmentWindowAfternoon: t("quote.appointmentWindowAfternoon"),
    appointmentWindowAnytime: t("quote.appointmentWindowAnytime"),
    appointmentNotesLabel: t("quote.appointmentNotesLabel"),
    appointmentNotesPlaceholder: t("quote.appointmentNotesPlaceholder"),
    filesLabel: t("quote.filesLabel"),
    filesHint: t("quote.filesHint"),
    consentLabel: t("quote.consentLabel"),
    submit: t("quote.submit"),
    submitting: t("quote.submitting"),
    successTitle: t("quote.successTitle"),
    successBody: t("quote.successBody"),
    successAppointmentBody: t("quote.successAppointmentBody"),
    errorTitle: t("quote.errorTitle"),
    errorBody: t("quote.errorBody"),
    rateLimitedTitle: t("quote.rateLimitedTitle"),
    rateLimitedBody: t("quote.rateLimitedBody"),
    unavailableTitle: t("quote.unavailableTitle"),
    unavailableBody: t("quote.unavailableBody"),
    errorSummaryHeading: t("quote.errorSummaryHeading"),
    referenceLabel: t("quote.referenceLabel"),
  };

  const breadcrumbs: BreadcrumbItem[] = [
    { name: t("nav.home"), href: `/${resolved}` },
    { name: departmentLabel, href: `/${resolved}/${definition.slug}` },
    { name: t("quote.metaTitle"), href: `/${resolved}/${definition.slug}/quote` },
  ];

  return (
    <div {...departmentScopeProps(definition.slug)}>
      <JsonLdScript data={organizationJsonLd(resolved)} />
      <JsonLdScript
        data={breadcrumbJsonLd([
          { name: t("nav.home"), path: `/${resolved}` },
          { name: departmentLabel, path: `/${resolved}/${definition.slug}` },
          {
            name: t("quote.metaTitle"),
            path: `/${resolved}/${definition.slug}/quote`,
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
          eyebrow={t("quote.eyebrow")}
          heading={t("quote.heading")}
          intro={t("quote.intro")}
        />
      </SectionBand>

      <SectionBand labelledBy="quote-form-heading">
        <div className="grid gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <QuoteForm
              locale={resolved}
              labels={labels}
              regionOptions={regionOptions}
              serviceOptions={serviceOptions}
              validationMessages={validationMessages}
              defaultService={defaultService}
              maxFiles={maxFiles}
              maxSize={maxSize}
            />
          </div>

          <div className="space-y-6">
            <section
              aria-labelledby="quote-aside-heading"
              className="rounded-card border border-border bg-surface-alt p-6"
            >
              <h2
                id="quote-aside-heading"
                className="text-base font-semibold text-ink-900"
              >
                {t("quote.asideHeading")}
              </h2>
              <p className="mt-2 text-sm text-body">{t("quote.asideBody")}</p>
            </section>

            <section
              aria-labelledby="quote-contact-heading"
              className="rounded-card border border-border bg-surface-alt p-6"
            >
              <h2
                id="quote-contact-heading"
                className="text-base font-semibold text-ink-900"
              >
                {t("quote.directContactHeading")}
              </h2>
              <p className="mt-2 text-sm text-body">
                {t("quote.directContactBody")}
              </p>
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
              <p className="mt-4 text-xs text-muted">{t("quote.privacyNote")}</p>
            </section>
          </div>
        </div>
      </SectionBand>

      <div className="container-page section">
        <CtaBand
          locale={resolved}
          t={t}
          heading={t(`${copy}.ctaHeading`)}
          body={t(`${copy}.ctaBody`)}
          accent
        />
      </div>
    </div>
  );
}
