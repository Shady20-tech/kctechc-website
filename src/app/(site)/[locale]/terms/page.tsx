import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalDocumentBody } from "@/components/content/LegalDocumentBody";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { legalDocumentFor } from "@/lib/content/legal";
import { isLocale, LOCALES, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd } from "@/lib/seo/structured-data";

/**
 * Terms of Service.
 *
 * A real route in both locales, so the footer link resolves instead of reaching
 * the not-found boundary. Content is served from the bundled legal module rather
 * than from the database: the terms are part of the software release, and a page
 * that rendered "no terms published" during a database outage would be worse than
 * useless for a visitor who needs to read them.
 *
 * The visible breadcrumb is rendered by `LegalDocumentBody` from the same item
 * list that builds the JSON-LD here, so the trail and the structured data cannot
 * disagree.
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
  const document = legalDocumentFor("terms", locale);
  return buildMetadata({
    locale,
    pathWithoutLocale: "/terms",
    title: t("legal.termsMetaTitle"),
    description: t("legal.termsMetaDescription"),
    modifiedTime: document.updatedAtIso,
  });
}

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const resolved: Locale = locale;
  const t = createTranslator(resolved).t;
  const document = legalDocumentFor("terms", resolved);

  const crumbs = [
    { name: t("nav.home"), href: `/${resolved}` },
    { name: t("footer.terms"), href: `/${resolved}/terms` },
  ];

  return (
    <>
      <JsonLdScript
        data={breadcrumbJsonLd([
          { name: t("nav.home"), path: `/${resolved}` },
          { name: t("footer.terms"), path: `/${resolved}/terms` },
        ])}
      />
      <LegalDocumentBody
        document={document}
        contentsLabel={t("legal.contentsHeading")}
        updatedLabel={t("legal.updatedLabel")}
        retentionNoteLabel={t("legal.retentionNoteLabel")}
        breadcrumbAriaLabel={t("a11y.breadcrumb")}
        breadcrumbs={crumbs}
      />
    </>
  );
}
