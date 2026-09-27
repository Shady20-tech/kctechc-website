import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { SectionBand } from "@/components/layout/PageShell";
import { Notice } from "@/components/ui/Notice";
import { PageIntro } from "@/components/ui/PageIntro";
import { getAuthState } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/config/env";
import { isLocale, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { buildMetadata } from "@/lib/seo/metadata";

/**
 * Sign-up page.
 *
 * Customer-facing and localized, like sign-in. This is the only place an account
 * is created; sign-in never does so, which is how "sign up before you can sign
 * in" is enforced.
 *
 * An already-authenticated visitor is redirected: there is nothing to do here
 * with a live session.
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
    pathWithoutLocale: "/admin/sign-up",
    title: t("auth.signUpHeading"),
    description: t("auth.signUpDescription"),
    noindex: true,
  });
}

export default async function SignUpPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const resolved: Locale = locale;
  const t = createTranslator(resolved).t;

  const state = await getAuthState();
  if (state.status === "authenticated") {
    redirect("/admin");
  }

  const configured = isSupabaseConfigured();

  return (
    <SectionBand tone="accent">
      <div className="mx-auto max-w-md py-8">
        <PageIntro
          heading={t("auth.signUpHeading")}
          intro={t("auth.signUpDescription")}
        />

        <div className="mt-6 space-y-4">
          {!configured ? (
            <Notice tone="warning" title={t("auth.notConfigured")}>
              <p>{t("auth.notConfiguredBody")}</p>
            </Notice>
          ) : null}

          <SignUpForm locale={resolved} disabled={!configured} />
        </div>
      </div>
    </SectionBand>
  );
}
