import { ArrowLeft, LogIn, UserPlus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "@/components/layout/Logo";
import { SITE } from "@/lib/config/site";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";

export type AuthMode = "signin" | "signup" | "recovery";

/**
 * The shared shell for every account-access page.
 *
 * The sign-in and sign-up pages are one surface with two sections, so the
 * section switcher sits above the heading and both destinations are always
 * visible. The recovery pages reuse the same card without the two-way switcher,
 * because password recovery is a detour from sign-in rather than a third
 * account mode.
 *
 * The brand panel is decorative and hidden below `lg`: on a phone the form is the
 * whole page, and a 300px marketing block above it would push the first field
 * below the fold.
 */
export function AuthShell({
  locale,
  mode,
  eyebrow,
  heading,
  intro,
  children,
}: {
  locale: Locale;
  mode: AuthMode;
  eyebrow: string;
  heading: string;
  intro: string;
  children: ReactNode;
}) {
  const t = createTranslator(locale).t;

  return (
    <section className="border-b border-border accent-wash">
      <div className="container-page py-8 sm:py-12 lg:py-16">
        <div className="mx-auto grid max-w-5xl overflow-hidden rounded-panel border border-border bg-surface shadow-lifted lg:grid-cols-[0.92fr_1.08fr]">
          <aside className="relative hidden overflow-hidden bg-ink-950 p-10 lg:flex lg:flex-col lg:justify-between">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  "linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)",
                backgroundSize: "48px 48px",
              }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-24 top-8 h-72 w-72 rounded-full bg-teal-300/15 blur-3xl"
            />

            <div className="relative">
              <Logo tone="light" showMotto={false} />
            </div>

            <div className="relative mt-16">
              <p className="mono-label text-teal-300">
                {t("auth.asideEyebrow")}
              </p>
              <p className="mt-4 max-w-sm font-display text-3xl font-bold leading-tight text-white">
                {t("auth.asideHeading")}
              </p>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-200">
                {SITE.motto}
              </p>
            </div>

            <ul className="relative mt-10 space-y-3 text-sm text-ink-200">
              {[
                t("auth.asidePointShop"),
                t("auth.asidePointSave"),
                t("auth.asidePointManage"),
              ].map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-300"
                  />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </aside>

          <div className="p-6 sm:p-9 lg:p-10">
            {mode === "recovery" ? (
              <Link
                href={`/${locale}/login`}
                className="inline-flex min-h-11 items-center gap-2 rounded-control border border-border bg-surface-alt px-4 text-sm font-semibold text-ink-900 transition-soft hover:border-border-strong hover:bg-surface"
              >
                <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                {t("auth.backToSignIn")}
              </Link>
            ) : (
              <AuthModeSwitcher locale={locale} mode={mode} />
            )}

            <div className="mt-8">
              <p className="mono-label text-dept-accent">{eyebrow}</p>
              <h1 className="mt-2 font-display text-3xl font-bold leading-tight text-ink-900 sm:text-4xl">
                {heading}
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-body sm:text-base">
                {intro}
              </p>
            </div>

            <div className="mt-7 space-y-4">{children}</div>

            <div className="mt-8 border-t border-border pt-4">
              <Link
                href={`/${locale}`}
                className="inline-flex items-center gap-2 text-sm font-medium text-muted underline underline-offset-4 transition-soft hover:text-ink-900"
              >
                <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                {t("common.backToHome")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * The two-way account switcher.
 *
 * These are links, not JavaScript buttons: the destination is a real URL, works
 * without JavaScript, and a crawler sees the relationship. The active section is
 * marked with `aria-current="page"` as well as the visual treatment.
 */
function AuthModeSwitcher({
  locale,
  mode,
}: {
  locale: Locale;
  mode: "signin" | "signup";
}) {
  const t = createTranslator(locale).t;
  const base =
    "flex min-h-11 items-center justify-center gap-2 rounded-control px-3 text-sm font-semibold transition-soft";
  const active = "bg-surface text-ink-900 shadow-card";
  const inactive = "text-body hover:bg-surface/70 hover:text-ink-900";

  return (
    <nav
      aria-label={t("auth.switcherLabel")}
      className="grid grid-cols-2 gap-1 rounded-control border border-border bg-surface-alt p-1"
    >
      <Link
        href={`/${locale}/login`}
        aria-current={mode === "signin" ? "page" : undefined}
        className={`${base} ${mode === "signin" ? active : inactive}`}
      >
        <LogIn aria-hidden="true" className="h-4 w-4" />
        {t("auth.signInTab")}
      </Link>
      <Link
        href={`/${locale}/sign-up`}
        aria-current={mode === "signup" ? "page" : undefined}
        className={`${base} ${mode === "signup" ? active : inactive}`}
      >
        <UserPlus aria-hidden="true" className="h-4 w-4" />
        {t("auth.registerTab")}
      </Link>
    </nav>
  );
}
