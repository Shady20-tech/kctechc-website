import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { PageIntro } from "@/components/ui/PageIntro";
import { Notice } from "@/components/ui/Notice";
import { DEPARTMENTS } from "@/lib/config/site";
import { isLocale, LOCALES, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd } from "@/lib/seo/structured-data";

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

  return (
    <>
      <JsonLdScript
        data={breadcrumbJsonLd([
          { name: t("nav.home"), path: `/${resolved}` },
          { name: label, path: `/${resolved}/${definition.slug}` },
        ])}
      />

      <PageIntro
        eyebrow={t("nav.departments")}
        heading={label}
        intro={t(definition.descriptionKey)}
      />

      <div className="mt-10 max-w-2xl">
        <Notice tone="info" title={t("admin.phaseNotice")}>
          <p>
            {t("common.brandShort")} — {t("common.motto")}
          </p>
        </Notice>
      </div>
    </>
  );
}
