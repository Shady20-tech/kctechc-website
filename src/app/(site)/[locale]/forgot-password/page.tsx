import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { isLocale, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { buildMetadata } from "@/lib/seo/metadata";

/**
 * Forgot-password page.
 *
 * Customer-facing and localized. Collects an email and sends a 6-digit recovery
 * code; the Server Action then redirects to the locale-scoped reset page. Stayed
 * reachable while signed out, which is the whole point.
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
    pathWithoutLocale: "/forgot-password",
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
    <AuthShell
      locale={resolved}
      mode="recovery"
      eyebrow={t("auth.recoveryEyebrow")}
      heading={t("auth.forgotPasswordHeading")}
      intro={t("auth.forgotPasswordDescription")}
    >
      <ForgotPasswordForm locale={resolved} />
    </AuthShell>
  );
}
