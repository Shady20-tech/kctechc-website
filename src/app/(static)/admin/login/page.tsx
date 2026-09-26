import { redirect } from "next/navigation";
import { Notice } from "@/components/ui/Notice";
import { PageIntro } from "@/components/ui/PageIntro";
import { SignInForm } from "@/components/admin/SignInForm";
import { getAuthState } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/config/env";
import { createTranslator } from "@/lib/i18n/translator";
import { safeRedirectPathSchema } from "@/lib/validation/common";

/**
 * Admin sign-in page.
 *
 * Already-authenticated users are bounced to their destination. The `next`
 * parameter is validated against an open-redirect allowlist before use.
 */
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const { next, reason } = await searchParams;
  const t = createTranslator("en").t;

  const state = await getAuthState();
  if (state.status === "authenticated") {
    const parsed = safeRedirectPathSchema.safeParse(next);
    redirect(parsed.success ? parsed.data : "/admin");
  }

  const configured = isSupabaseConfigured();

  return (
    <div className="mx-auto max-w-md">
      <PageIntro
        heading={t("auth.signInHeading")}
        intro={t("auth.signInDescription")}
      />

      <div className="mt-6 space-y-4">
        {!configured || reason === "unconfigured" ? (
          <Notice tone="warning" title={t("auth.notConfigured")}>
            <p>
              Set NEXT_PUBLIC_SUPABASE_URL and
              NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to enable sign-in.
            </p>
          </Notice>
        ) : null}

        <SignInForm
          labels={{
            email: t("auth.emailLabel"),
            password: t("auth.passwordLabel"),
            submit: t("auth.signInSubmit"),
            submitting: t("auth.signingIn"),
            invalid: t("auth.invalidCredentials"),
          }}
          nextPath={next}
          disabled={!configured}
        />
      </div>
    </div>
  );
}
