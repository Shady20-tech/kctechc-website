import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import type { DepartmentSlug } from "@/lib/config/site";
import type { Locale } from "@/lib/i18n/locales";
import type { Translator } from "@/lib/i18n/translator";
import { DepartmentSwitcher } from "./DepartmentSwitcher";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Logo } from "./Logo";
import { MobileMenu, type MobileNavItem } from "./MobileMenu";

/**
 * Global site header.
 *
 * Server-rendered: it receives the resolved locale, translated labels and site
 * content, so the only client JavaScript is the interactive switchers. Nothing
 * here depends on a data fetch that would make every page dynamic.
 *
 * The primary nav is a row of plain links and the department switcher is an
 * additional affordance for jumping sideways between departments, not a
 * replacement for it — so department routes stay crawlable as real anchors.
 */
export function SiteHeader({
  locale,
  t,
  navItems,
  departmentLabels,
  currentDepartment,
}: {
  locale: Locale;
  t: Translator["t"];
  navItems: readonly MobileNavItem[];
  departmentLabels: Record<DepartmentSlug, string>;
  currentDepartment?: DepartmentSlug;
}) {
  const quoteHref = `/${locale}/contact`;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
      <div className="container-page flex items-center justify-between gap-4 py-3">
        <Logo locale={locale} />

        <div className="hidden items-center gap-5 lg:flex">
          <nav aria-label={t("nav.primary")}>
            <ul className="flex items-center gap-5">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm font-medium text-navy-900 transition-soft hover:text-dept-accent"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <DepartmentSwitcher
            locale={locale}
            labels={departmentLabels}
            current={currentDepartment}
            label={t("nav.departmentSwitcher")}
            currentLabel={t("nav.currentDepartment")}
          />

          <LanguageSwitcher
            currentLocale={locale}
            label={t("a11y.languageSwitcher")}
          />

          <ButtonLink href={quoteHref} variant="primary" size="sm">
            {t("actions.getQuote")}
          </ButtonLink>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <LanguageSwitcher
            currentLocale={locale}
            label={t("a11y.languageSwitcher")}
          />
          <MobileMenu
            locale={locale}
            items={navItems}
            departmentLabels={departmentLabels}
            quoteHref={quoteHref}
            labels={{
              open: t("actions.openMenu"),
              close: t("actions.closeMenu"),
              title: t("nav.mobileMenu"),
              departments: t("nav.departments"),
              language: t("common.language"),
              getQuote: t("actions.getQuote"),
            }}
          />
        </div>
      </div>
    </header>
  );
}
