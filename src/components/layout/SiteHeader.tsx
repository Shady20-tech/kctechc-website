import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import type { Locale } from "@/lib/i18n/locales";
import type { Translator } from "@/lib/i18n/translator";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Logo } from "./Logo";
import { MobileMenu, type MobileNavItem } from "./MobileMenu";

/**
 * Global site header.
 *
 * Server-rendered: it receives the resolved locale, translated labels and nav
 * items, so the only client JavaScript is the language switcher and the mobile
 * drawer. Nothing here depends on a data fetch that would make every page
 * dynamic.
 *
 * The department switcher was removed in favour of plain department links in the
 * primary nav. A dropdown hid the three departments behind a click and competed
 * with the nav for the same job, while the anchors keep every department
 * crawlable and reachable in one click.
 *
 * The account action is a static link to the sign-in route rather than a
 * session-aware control. Reading the session here would call `cookies()` in the
 * shared layout and force every public page to render dynamically, costing the
 * prerendered HTML that the SEO requirements depend on. The sign-in route
 * already redirects an authenticated visitor onward, so the link stays correct.
 */
export function SiteHeader({
  locale,
  t,
  navItems,
}: {
  locale: Locale;
  t: Translator["t"];
  navItems: readonly MobileNavItem[];
}) {
  const signInHref = "/admin/login";

  return (
    <header className="on-ink sticky top-0 z-40 border-b border-white/10 bg-ink-950/95 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-6 lg:h-18">
        <Logo locale={locale} tone="light" />

        <nav aria-label={t("nav.primary")} className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="rounded-card px-3 py-2 text-sm font-medium text-white/75 transition-soft hover:bg-white/5 hover:text-white"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <LanguageSwitcher
            currentLocale={locale}
            label={t("a11y.languageSwitcher")}
            tone="light"
          />
          <span aria-hidden="true" className="h-6 w-px bg-white/15" />
          <ButtonLink href={signInHref} variant="accentOnInk" size="sm">
            {t("actions.signIn")}
          </ButtonLink>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <LanguageSwitcher
            currentLocale={locale}
            label={t("a11y.languageSwitcher")}
            tone="light"
          />
          <MobileMenu
            locale={locale}
            items={navItems}
            signInHref={signInHref}
            labels={{
              open: t("actions.openMenu"),
              close: t("actions.closeMenu"),
              title: t("nav.mobileMenu"),
              language: t("common.language"),
              signIn: t("actions.signIn"),
            }}
          />
        </div>
      </div>
    </header>
  );
}
