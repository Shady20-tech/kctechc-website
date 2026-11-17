import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { renderDashboardDetail } from "@/components/account/DashboardPageBodies";
import { isLocale, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { buildMetadata } from "@/lib/seo/metadata";

/**
 * Edit one listing from the agent dashboard.
 *
 * The listing is resolved inside the page body through the session client, whose
 * policies scope it to the owner or manager, so an id belonging to another account
 * 404s. `force-dynamic` because the read is session-scoped.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = createTranslator(locale).t;
  return buildMetadata({
    locale,
    pathWithoutLocale: "/account/agent",
    title: t("account.dashboards.agent.editHeading"),
    description: t("account.dashboards.agent.metaDescription"),
    noindex: true,
  });
}

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();

  return renderDashboardDetail("agent", locale as Locale, id);
}
