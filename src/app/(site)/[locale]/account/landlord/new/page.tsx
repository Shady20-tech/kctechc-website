import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { renderDashboardCreate } from "@/components/account/DashboardPageBodies";
import { isLocale, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { buildMetadata } from "@/lib/seo/metadata";

/**
 * Create a listing from the landlord dashboard.
 *
 * `force-dynamic` for the same reason as the dashboard itself: the geography
 * options and the capability check both depend on the session.
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
    pathWithoutLocale: "/account/landlord/new",
    title: t("account.dashboards.landlord.createHeading"),
    description: t("account.dashboards.landlord.metaDescription"),
    noindex: true,
  });
}

export default async function LandlordNewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return renderDashboardCreate("landlord", locale as Locale);
}
