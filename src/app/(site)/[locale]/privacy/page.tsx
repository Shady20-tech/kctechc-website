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
 * Privacy Policy.
 *
 * The canonical destination for every privacy link on the site: the footer, the
 * sign-up acknowledgement and the cookie notice all point here, so there is one
 * page to keep current rather than a note buried on the contact page. Clause
 * anchors such as `#retention` are stable across locales.
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
  const document = legalDocumentFor("privacy", locale);
  return buildMetadata({
    locale,
    pathWithoutLocale: "/privacy",
    title: t("legal.privacyMetaTitle"),
    description: t("legal.privacyMetaDescription"),
    modifiedTime: document.updatedAtIso,
  });
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const resolved: Locale = locale;
  const t = createTranslator(resolved).t;
  const document = legalDocumentFor("privacy", resolved);

  const crumbs = [
    { name: t("nav.home"), href: `/${resolved}` },
    { name: t("footer.privacy"), href: `/${resolved}/privacy` },
  ];

  return (
    <>
      <JsonLdScript
        data={breadcrumbJsonLd([
          { name: t("nav.home"), path: `/${resolved}` },
          { name: t("footer.privacy"), path: `/${resolved}/privacy` },
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
