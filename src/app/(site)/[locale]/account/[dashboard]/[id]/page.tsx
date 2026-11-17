import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { renderDashboardDetail } from "@/components/account/DashboardPageBodies";
import { isLocale, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { isDashboardKind } from "@/lib/real-estate/dashboard";
import { buildMetadata } from "@/lib/seo/metadata";

/**
 * Edit one listing from a dashboard, for either kind.
 *
 * The listing is resolved inside the page body through the session client, whose
 * policies scope it to the owner or manager, so an id belonging to another account
 * 404s. `force-dynamic` because the read is session-scoped; `noindex` because it
 * is a private surface.
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
    pathWithoutLocale: `/account/${dashboard}`,
    title: t(`account.dashboards.${dashboard}.editHeading`),
    description: t(`account.dashboards.${dashboard}.metaDescription`),
    noindex: true,
  });
}

export default async function DashboardDetailPage({
  params,
}: {
  params: Promise<{ locale: string; dashboard: string; id: string }>;
}) {
  const { locale, dashboard, id } = await params;
  if (!isLocale(locale) || !isDashboardKind(dashboard)) notFound();

  return renderDashboardDetail(dashboard, locale as Locale, id);
}
