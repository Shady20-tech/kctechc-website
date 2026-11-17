import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { renderDashboardOverview } from "@/components/account/DashboardPageBodies";
import { isLocale, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { buildMetadata } from "@/lib/seo/metadata";

/**
 * The landlord dashboard.
 *
 * `force-dynamic` because every read is scoped to the session cookie;
 * prerendering it would bake in the signed-out redirect and serve it to everyone.
 * `noindex` because it is a private surface.
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
    pathWithoutLocale: "/account/landlord",
    title: t("account.dashboards.landlord.metaTitle"),
    description: t("account.dashboards.landlord.metaDescription"),
    noindex: true,
  });
}

export default async function LandlordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return renderDashboardOverview("landlord", locale as Locale);
}
