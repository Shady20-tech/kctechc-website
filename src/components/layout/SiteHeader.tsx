import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import type { NavEntry } from "@/lib/config/navigation";
import type { Locale } from "@/lib/i18n/locales";
import type { Translator } from "@/lib/i18n/translator";
import { DepartmentsMenu } from "./DepartmentsMenu";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Logo } from "./Logo";
import { MobileMenu } from "./MobileMenu";

/**
 * Global site header.
 *
 * Server-rendered: it receives the resolved locale, translated labels and the nav
 * model, so the only client JavaScript is the language switcher, the departments
 * dropdown and the mobile drawer. Nothing here depends on a data fetch that would
 * make every page dynamic.
 *
 * The department links live in a dropdown on desktop but remain real anchors
 * inside it, so all three departments stay crawlable and reachable in one click.
 * On mobile the drawer lists them under a labelled heading instead, because a
 * nested dropdown inside a drawer is a poor touch target.
 *
 * The desktop bar only appears from `xl`: seven entries plus the language
 * switcher and the account action do not fit at `lg` without crowding, and a
 * cramped bar reads worse than the drawer.
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
  navEntries,
}: {
  locale: Locale;
  t: Translator["t"];
  navEntries: readonly NavEntry[];
}) {
  const signInHref = "/admin/login";

  return (
    <header className="on-ink sticky top-0 z-40 border-b border-white/10 bg-ink-950/95 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-6 lg:h-18">
        <Logo locale={locale} tone="light" />

        <nav aria-label={t("nav.primary")} className="hidden xl:block">
          <ul className="flex items-center gap-1">
            {navEntries.map((entry) =>
              entry.kind === "link" ? (
                <li key={entry.href}>
                  <Link
                    href={entry.href}
                    className="rounded-card px-3 py-2 text-sm font-medium text-white/75 transition-soft hover:bg-white/5 hover:text-white"
                  >
                    {entry.label}
                  </Link>
                </li>
              ) : (
                <li key={entry.label}>
                  <DepartmentsMenu
                    label={entry.label}
                    ariaLabel={entry.ariaLabel}
                    items={entry.items}
                  />
                </li>
              ),
            )}
          </ul>
        </nav>

        <div className="hidden items-center gap-3 xl:flex">
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

        <div className="flex items-center gap-2 xl:hidden">
          <LanguageSwitcher
            currentLocale={locale}
            label={t("a11y.languageSwitcher")}
            tone="light"
          />
          <MobileMenu
            locale={locale}
            entries={navEntries}
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
