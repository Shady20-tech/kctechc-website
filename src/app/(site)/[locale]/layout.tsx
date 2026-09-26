import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SkipLink } from "@/components/layout/Navigation";
import { TolgeeProvider } from "@/components/TolgeeProvider";
import { buildPrimaryNav } from "@/lib/config/navigation";
import { DEPARTMENTS } from "@/lib/config/site";
import { getSiteContent } from "@/lib/config/site-content";
import { LOCALES, LOCALE_SEO_TAGS, isLocale, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE_TEMPLATE } from "@/lib/seo/metadata";

/**
 * Layout for the localized public site.
 *
 * `generateStaticParams` pre-renders both locales, and `lang` reflects the actual
 * locale — a real language signal for assistive technology and crawlers rather
 * than a client-side patch.
 *
 * Header and footer content is loaded once here and passed down, so a page never
 * re-reads settings and the contact details cannot differ between the two.
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
  const resolved: Locale = isLocale(locale) ? locale : "en";
  return {
    title: {
      default: DEFAULT_TITLE_TEMPLATE.replace("%s | ", ""),
      template: DEFAULT_TITLE_TEMPLATE,
    },
    description: DEFAULT_DESCRIPTION,
    other: { "og:locale": LOCALE_SEO_TAGS[resolved] },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const resolved: Locale = locale;
  const t = createTranslator(resolved).t;
  const site = await getSiteContent();

  const departmentLabels = Object.fromEntries(
    DEPARTMENTS.map((department) => [department.slug, t(department.labelKey)]),
  ) as Record<(typeof DEPARTMENTS)[number]["slug"], string>;

  // Nav is built from one shared model so the desktop bar, the mobile drawer and
  // the sitemap cannot drift apart.
  const navEntries = buildPrimaryNav(resolved, t);

  return (
    <>
      <SkipLink>{t("common.skipToContent")}</SkipLink>
      <SiteHeader locale={resolved} t={t} navEntries={navEntries} />
      <main id="main" className="min-h-[60vh]">
        <TolgeeProvider locale={resolved}>{children}</TolgeeProvider>
      </main>
      <SiteFooter
        locale={resolved}
        t={t}
        site={site}
        departmentLabels={departmentLabels}
      />
    </>
  );
}
