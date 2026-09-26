import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { DepartmentCard } from "@/components/ui/DepartmentCard";
import { PageIntro } from "@/components/ui/PageIntro";
import { DEPARTMENTS } from "@/lib/config/site";
import { isLocale, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { buildMetadata } from "@/lib/seo/metadata";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo/structured-data";

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
    pathWithoutLocale: "/",
    title: t("home.metaTitle"),
    description: t("home.metaDescription"),
  });
}

export default async function LocalizedHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const resolved: Locale = locale;
  const t = createTranslator(resolved).t;

  return (
    <>
      <JsonLdScript data={organizationJsonLd(resolved)} />
      <JsonLdScript data={websiteJsonLd(resolved)} />

      <PageIntro
        eyebrow={t("common.brandShort")}
        heading={t("home.gatewayHeading")}
        intro={t("home.gatewayIntro")}
      />

      <section aria-labelledby="departments-heading" className="mt-12">
        <h2
          id="departments-heading"
          className="text-xl font-semibold text-navy-900"
        >
          {t("departments.heading")}
        </h2>
        <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {DEPARTMENTS.map((department) => (
            <DepartmentCard
              key={department.slug}
              department={department}
              locale={resolved}
              label={t(department.labelKey)}
              description={t(department.descriptionKey)}
              actionLabel={t("actions.exploreDepartment")}
            />
          ))}
        </ul>
      </section>
    </>
  );
}
