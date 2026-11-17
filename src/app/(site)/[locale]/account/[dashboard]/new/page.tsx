import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { renderDashboardCreate } from "@/components/account/DashboardPageBodies";
import { isLocale, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { isDashboardKind } from "@/lib/real-estate/dashboard";
import { buildMetadata } from "@/lib/seo/metadata";

/**
 * Create a listing from a dashboard, for either kind.
 *
 * `force-dynamic` because the geography options and the capability check both
 * depend on the session. `noindex` because it is a private surface.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; dashboard: string }>;
}): Promise<Metadata> {
  const { locale, dashboard } = await params;
  if (!isLocale(locale) || !isDashboardKind(dashboard)) return {};
  const t = createTranslator(locale).t;
  return buildMetadata({
    locale,
    pathWithoutLocale: `/account/${dashboard}/new`,
    title: t(`account.dashboards.${dashboard}.createHeading`),
    description: t(`account.dashboards.${dashboard}.metaDescription`),
    noindex: true,
  });
}

export default async function DashboardCreatePage({
  params,
}: {
  params: Promise<{ locale: string; dashboard: string }>;
}) {
  const { locale, dashboard } = await params;
  if (!isLocale(locale) || !isDashboardKind(dashboard)) notFound();

  return renderDashboardCreate(dashboard, locale as Locale);
}
