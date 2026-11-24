import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { OAuthOnboardingForm } from "@/components/auth/OAuthOnboardingForm";
import { SectionBand } from "@/components/layout/PageShell";
import { PageIntro } from "@/components/ui/PageIntro";
import { getAuthState } from "@/lib/auth/session";
import { isLocale, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { buildMetadata } from "@/lib/seo/metadata";

/**
 * Complete a social sign-up.
 *
 * A social sign-in carries no metadata payload (`signInWithOAuth`), so an
 * account created through Google or Facebook reaches
 * us with no role declaration and no residency answer — `handle_new_user`
 * provisions it as `customer` with `declared_account_type` null. `/auth/callback`
 * sends such an account here; this page collects the two facts the password form
 * asks for, so both routes converge on the same profile.
 *
 * The page is a *completion* step, not a gate on the account: the visitor is
 * already signed in and can leave. It is offered once — a profile that has
 * already declared is redirected to the account hub, so nobody is asked twice and
 * an existing declaration cannot be silently rewritten by revisiting the URL.
 *
 * `noindex` and `force-dynamic`: per-customer, and it reads the session cookie.
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
    pathWithoutLocale: "/account/onboarding",
    title: t("auth.onboardingHeading"),
    description: t("auth.onboardingDescription"),
    noindex: true,
  });
}

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const resolved: Locale = locale;
  const t = createTranslator(resolved).t;
  const returnTo = encodeURIComponent(`/${resolved}/account/onboarding`);

  const state = await getAuthState();
  if (state.status === "unconfigured") {
    redirect(`/${resolved}/login?reason=unconfigured&next=${returnTo}`);
  }
  if (state.status !== "authenticated") {
    redirect(`/${resolved}/login?next=${returnTo}`);
  }

  // Already declared: nothing to complete. Redirecting rather than showing a
  // second form is what stops a revisit from overwriting an earlier answer.
  if (state.profile?.declaredAccountType) {
    redirect(`/${resolved}/account`);
  }

  return (
    <SectionBand tone="accent">
      <div className="mx-auto max-w-md py-8">
        <PageIntro
          eyebrow={t("auth.onboardingEyebrow")}
          heading={t("auth.onboardingHeading")}
          intro={t("auth.onboardingDescription")}
        />

        <div className="mt-6">
          <OAuthOnboardingForm locale={resolved} />
        </div>
      </div>
    </SectionBand>
  );
}
