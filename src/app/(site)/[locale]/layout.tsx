import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SkipLink } from "@/components/layout/Navigation";
import { TolgeeProvider } from "@/components/TolgeeProvider";
import { DEPARTMENTS } from "@/lib/config/site";
import { LOCALES, LOCALE_SEO_TAGS, isLocale, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE_TEMPLATE } from "@/lib/seo/metadata";
import "../../globals.css";

/**
 * Root layout for the localized public site.
 *
 * `generateStaticParams` pre-renders both locales, and `lang` reflects the
 * actual locale — a real language signal for assistive technology and crawlers
 * rather than a client-side patch.
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

  const t = createTranslator(locale).t;

  const navItems = [
    { href: `/${locale}`, label: t("nav.home") },
    ...DEPARTMENTS.map((department) => ({
      href: `/${locale}/${department.slug}`,
      label: t(department.labelKey),
    })),
    { href: `/${locale}/contact`, label: t("nav.contact") },
  ];

  return (
    <html lang={locale}>
      <body>
        <SkipLink>{t("common.skipToContent")}</SkipLink>
        <SiteHeader locale={locale} t={t} navItems={navItems} />
        <main id="main" className="container-page py-12">
          <TolgeeProvider locale={locale}>{children}</TolgeeProvider>
        </main>
        <SiteFooter locale={locale} t={t} />
      </body>
    </html>
  );
}
