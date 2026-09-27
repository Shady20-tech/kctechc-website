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
 * Where a recovery link lands, via `/auth/callback` which exchanges the code for
 * a session first. Rendered inside the site layout so the customer is not dropped
 * into an unstyled form mid-flow.
 *
 * The form does not check for a recovery session before rendering — the Server
 * Action does, and reports a missing session as a reason. Checking here would mean
 * a visitor who opened the page directly saw a redirect instead of an explanation
 * of what to do next.
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
    pathWithoutLocale: "/admin/reset-password",
    title: t("auth.resetPasswordHeading"),
    description: t("auth.resetPasswordDescription"),
    noindex: true,
  });
}

export default async function ResetPasswordPage({
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
          heading={t("auth.resetPasswordHeading")}
          intro={t("auth.resetPasswordDescription")}
        />
        <div className="mt-6">
          <ResetPasswordForm locale={resolved} />
        </div>
      </div>
    </SectionBand>
  );
}
