import Link from "next/link";
import { SITE } from "@/lib/config/site";
import { LOCALE_LABELS, type Locale } from "@/lib/i18n/locales";
import type { Translator } from "@/lib/i18n/translator";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { SiteHeaderNav, type NavItem } from "./Navigation";

/**
 * Site header. Server-rendered so the language switcher receives the resolved
 * locale rather than detecting it again in the browser.
 */
export function SiteHeader({
  locale,
  t,
  navItems,
}: {
  locale: Locale;
  t: Translator["t"];
  navItems: readonly NavItem[];
}) {
  return (
    <header className="border-b border-border bg-surface">
      <div className="container-page flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <Link
            href={`/${locale}`}
            className="text-lg font-semibold text-navy-900"
          >
            {SITE.legalName}
          </Link>
          <p className="text-xs text-muted">{SITE.motto}</p>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
          <SiteHeaderNav
            items={navItems}
            ariaLabel={t("nav.primary")}
            currentLabel={t("a11y.currentPage")}
          />
          <LanguageSwitcher
            currentLocale={locale}
            label={t("a11y.languageSwitcher")}
          />
        </div>
      </div>
      <span className="visually-hidden">{LOCALE_LABELS[locale]}</span>
    </header>
  );
}
