import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { renderDashboardOverview } from "@/components/account/DashboardPageBodies";
import { isLocale, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { isDashboardKind } from "@/lib/real-estate/dashboard";
import { buildMetadata } from "@/lib/seo/metadata";

/**
 * A dashboard overview, for either kind.
 *
 * The landlord and agent dashboards are structurally identical apart from the
 * agent's public-profile panel, so this one route serves both rather than
 * duplicating the page per kind. The layout resolves and validates the kind, and
 * the body reads it again from the params.
 *
 * `force-dynamic` because every read is scoped to the session cookie;
 * prerendering it would bake in the signed-out redirect and serve it to everyone.
 * `noindex` because it is a private surface.
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
    title: t(`account.dashboards.${dashboard}.metaTitle`),
    description: t(`account.dashboards.${dashboard}.metaDescription`),
    noindex: true,
  });
}

export default async function DashboardOverviewPage({
  params,
}: {
  params: Promise<{ locale: string; dashboard: string }>;
}) {
  const { locale, dashboard } = await params;
  if (!isLocale(locale) || !isDashboardKind(dashboard)) notFound();

  return renderDashboardOverview(dashboard, locale as Locale);
}
