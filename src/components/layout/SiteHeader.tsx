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
      {/* A three-column grid, not `justify-between`. With `justify-between` the
          nav sits midway between the logo and the account action, so it drifts
          off the page centre by half the difference between those two widths.
          Equal `1fr` side columns put the nav on the true centre at every width,
          and pin the logo and the action to the same content edges the rest of
          the page uses.

          The row gap and the nav padding below are sized so the bar fits inside
          `container-page` in both locales. Measured natural widths: the English
          row needs 1201px and the French row 1258px at the previous spacing,
          against a fixed 1168px of content, so French overflowed at every
          viewport. These values bring French down to ~1118px. */}
      <div className="container-page grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-4 lg:h-18">
        <div className="col-start-1 min-w-0 justify-self-start">
          <Logo locale={locale} tone="light" />
        </div>

        <nav
          aria-label={t("nav.primary")}
          className="col-start-2 hidden shrink-0 justify-self-center xl:block"
        >
          <ul className="flex items-center gap-0.5">
            {navEntries.map((entry) =>
              entry.kind === "link" ? (
                <li key={entry.href}>
                  <Link
                    href={entry.href}
                    // `inline-flex` + `whitespace-nowrap` are load-bearing. As a
                    // flex item a link will otherwise shrink below its text width
                    // and wrap, and an `inline` box reports a shorter rect than the
                    // `inline-flex` dropdown trigger beside it, so the two end up
                    // on different baselines. Matching the trigger's box model
                    // keeps every item the same height and baseline.
                    className="inline-flex items-center whitespace-nowrap rounded-card px-1.5 py-2 text-sm font-medium text-white/75 transition-soft hover:bg-white/5 hover:text-white"
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

        <div className="col-start-3 hidden shrink-0 items-center gap-2.5 justify-self-end xl:flex">
          <LanguageSwitcher
            currentLocale={locale}
            label={t("a11y.languageSwitcher")}
            tone="light"
            compact
          />
          <span aria-hidden="true" className="h-6 w-px bg-white/15" />
          <ButtonLink href={signInHref} variant="accentOnInk" size="sm">
            {t("actions.signIn")}
          </ButtonLink>
        </div>

        <div className="col-start-3 flex shrink-0 items-center gap-2 justify-self-end xl:hidden">
          <LanguageSwitcher
            currentLocale={locale}
            label={t("a11y.languageSwitcher")}
            tone="light"
            compact
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
