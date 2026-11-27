import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { Notice } from "@/components/ui/Notice";
import { getAuthState } from "@/lib/auth/session";
import { postSignInPathFor } from "@/lib/auth/redirects";
import { DEFAULT_ROLE, isAppRole } from "@/lib/auth/roles";
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
    pathWithoutLocale: "/sign-up",
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
    // The role decides the landing: a customer who already has a session belongs
    // on the account hub, not on a console that would refuse them.
    const role =
      state.profile && isAppRole(state.profile.role)
        ? state.profile.role
        : DEFAULT_ROLE;
    redirect(postSignInPathFor(role, resolved));
  }

  const configured = isSupabaseConfigured();

  return (
    <AuthShell
      locale={resolved}
      mode="signup"
      eyebrow={t("auth.signUpEyebrow")}
      heading={t("auth.signUpHeading")}
      intro={t("auth.signUpDescription")}
    >
      {!configured ? (
        <Notice tone="warning" title={t("auth.notConfigured")}>
          <p>{t("auth.notConfiguredBody")}</p>
        </Notice>
      ) : null}

      <OAuthButtons locale={resolved} disabled={!configured} mode="signup" />

      <SignUpForm locale={resolved} disabled={!configured} />
    </AuthShell>
  );
}
