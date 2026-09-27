import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { SectionBand } from "@/components/layout/PageShell";
import { PageIntro } from "@/components/ui/PageIntro";
import { isLocale, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { buildMetadata } from "@/lib/seo/metadata";

/**
 * Forgot-password page.
 *
 * Customer-facing and localized. Collects an email and sends a recovery link.
 * Stayed reachable while signed out, which is the whole point.
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
    pathWithoutLocale: "/admin/forgot-password",
    title: t("auth.forgotPasswordHeading"),
    description: t("auth.forgotPasswordDescription"),
    noindex: true,
  });
}

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const resolved: Locale = locale;
  const t = createTranslator(resolved).t;

  return (
    <SectionBand tone="accent">
      <div className="mx-auto max-w-md py-8">
        <PageIntro
          heading={t("auth.forgotPasswordHeading")}
          intro={t("auth.forgotPasswordDescription")}
        />
        <div className="mt-6">
          <ForgotPasswordForm locale={resolved} />
        </div>
      </div>
    </SectionBand>
  );
}
