import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { SectionBand } from "@/components/layout/PageShell";
import { PageIntro } from "@/components/ui/PageIntro";
import { isLocale, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { buildMetadata } from "@/lib/seo/metadata";

/**
 * Reset-password page.
 *
 * Public by design: the customer arrives from `/forgot-password` with the email
 * in the query string and a 6-digit code in their inbox. No session or
 * `/auth/callback` exchange is required — the Server Action verifies the code with
 * Supabase and sets the new password in one request.
 *
 * The form does not check for a session before rendering, and neither does the
 * page: an unauthenticated visitor must be able to enter the code.
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
    pathWithoutLocale: "/reset-password",
    title: t("auth.resetPasswordHeading"),
    description: t("auth.resetPasswordDescription"),
    noindex: true,
  });
}

export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ email?: string | string[] }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const { email } = await searchParams;
  const initialEmail = Array.isArray(email) ? (email[0] ?? "") : (email ?? "");

  const resolved: Locale = locale;
  const t = createTranslator(resolved).t;

  return (
    <SectionBand tone="accent">
      <div className="mx-auto max-w-md py-8">
        <PageIntro
          heading={t("auth.resetPasswordHeading")}
          intro={t("auth.resetPasswordDescription")}
          back={{ href: `/${resolved}`, label: t("common.backToHome") }}
        />
        <div className="mt-6">
          <ResetPasswordForm locale={resolved} initialEmail={initialEmail} />
        </div>
      </div>
    </SectionBand>
  );
}
