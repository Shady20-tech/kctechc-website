import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SkipLink } from "@/components/layout/Navigation";
import { isLocale, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";

/**
 * Layout for the signed-in dashboard area (landlord and agent).
 *
 * This route group exists for one reason: the dashboards must render the
 * console-style shell *without* the public marketing chrome. They used to live
 * under `(site)/[locale]/`, which meant the sticky public header and the full
 * site footer wrapped the sidebar on every page, so the dashboard read as a
 * marketing page with a menu bolted on rather than as an application. The admin
 * console has always been chrome-free because it lives in its own `(static)`
 * group; this gives the customer dashboards the same treatment.
 *
 * A route group is not part of the URL, so every dashboard address is unchanged:
 * `/{locale}/account/{kind}` still resolves here, and the `(site)` tree keeps
 * serving `/{locale}/account` and `/{locale}/account/kyc`, which are public-chrome
 * pages. Next.js allows the two groups to declare the same `[locale]` segment
 * because no two pages resolve to the same path.
 *
 * It deliberately does NOT render the Tolgee provider. The dashboards resolve
 * their copy through `createTranslator` on the server and through `createTranslator`
 * inside their own Client Components — nothing under this tree calls
 * `useTranslate`, so a provider here would be an unused client bundle.
 *
 * `force-dynamic` because the shell below reads the session cookie.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  // The dashboards are private and `noindex` at the page level; this is the
  // belt-and-braces guard for any future child route that forgets to set it.
  robots: { index: false, follow: false, nocache: true },
};

export default async function DashboardLocaleLayout({
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

  return (
    <>
      <SkipLink>{t("common.skipToContent")}</SkipLink>
      {children}
    </>
  );
}
