import Link from "next/link";
import { Notice } from "@/components/ui/Notice";
import { PageIntro } from "@/components/ui/PageIntro";
import { createTranslator } from "@/lib/i18n/translator";

/** Rendered when an authenticated user lacks the role a route requires. */
export default function UnauthorizedPage() {
  const t = createTranslator("en").t;

  return (
    <>
      <PageIntro heading={t("auth.unauthorizedHeading")} />
      <div className="mt-6 max-w-2xl space-y-4">
        <Notice tone="error">
          <p>{t("auth.unauthorizedDescription")}</p>
        </Notice>
        <Link
          href="/admin/login"
          className="text-sm text-ink-700 underline underline-offset-4"
        >
          {t("actions.signIn")}
        </Link>
      </div>
    </>
  );
}
