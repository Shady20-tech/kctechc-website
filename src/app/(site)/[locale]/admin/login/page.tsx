import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/SignInForm";
import { SectionBand } from "@/components/layout/PageShell";
import { Notice } from "@/components/ui/Notice";
import { PageIntro } from "@/components/ui/PageIntro";
import { getAuthState } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/config/env";
import { isLocale, type Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { buildMetadata } from "@/lib/seo/metadata";
import { safeRedirectPathSchema } from "@/lib/validation/common";

/**
 * Sign-in page.
 *
 * Customer-facing, so localized and rendered inside the normal site layout: a
 * French-speaking visitor gets the French form and a working language switcher.
 * `noindex` because an account door has no search value and a stale indexed copy
 * could outlive a copy change.
 *
 * An already-authenticated visitor is sent on to their destination rather than
 * being shown a form that would immediately redirect them. `next` is validated
 * against the open-redirect allowlist before it is used.
 *
 * `force-dynamic`: the page reads the session cookie, so it must not be cached
 * and served to a signed-out visitor.
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
    pathWithoutLocale: "/admin/login",
    title: t("auth.signInHeading"),
    description: t("auth.signInDescription"),
    noindex: true,
  });
}

export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const { next, reason } = await searchParams;
  const resolved: Locale = locale;
  const t = createTranslator(resolved).t;

  const state = await getAuthState();
  if (state.status === "authenticated") {
    const parsed = safeRedirectPathSchema.safeParse(next);
    redirect(parsed.success ? parsed.data : "/admin");
  }

  const configured = isSupabaseConfigured();

  return (
    <SectionBand tone="accent">
      <div className="mx-auto max-w-md py-8">
        <PageIntro
          heading={t("auth.signInHeading")}
          intro={t("auth.signInDescription")}
        />

        <div className="mt-6 space-y-4">
          {!configured ? (
            <Notice tone="warning" title={t("auth.notConfigured")}>
              <p>{t("auth.notConfiguredBody")}</p>
            </Notice>
          ) : null}

          <SignInForm
            locale={resolved}
            nextPath={next}
            disabled={!configured}
            initialReason={reason}
          />
        </div>
      </div>
    </SectionBand>
  );
}
