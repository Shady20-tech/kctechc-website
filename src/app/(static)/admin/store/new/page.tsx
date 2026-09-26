import { redirect } from "next/navigation";
import { ProductForm } from "@/components/admin/ProductForm";
import { Notice } from "@/components/ui/Notice";
import { PageIntro } from "@/components/ui/PageIntro";
import { getAuthState } from "@/lib/auth/session";
import { isElevatedRole } from "@/lib/auth/roles";
import { createTranslator } from "@/lib/i18n/translator";
import { loadCategoryOptions } from "@/lib/store/loaders";

/**
 * Admin: add a product.
 *
 * The authorization check here mirrors the one in the action. Both are needed and
 * neither is redundant: this one stops the page rendering, and the action's stops
 * the mutation. A Server Action is a public HTTP endpoint, so a check that lived
 * only in the page would protect the form and not the write.
 */
export const dynamic = "force-dynamic";

export default async function AdminNewProductPage() {
  const t = createTranslator("en").t;
  const state = await getAuthState();

  if (state.status === "unconfigured") {
    redirect("/admin/login?reason=unconfigured");
  }
  if (state.status !== "authenticated") {
    redirect("/admin/login?next=%2Fadmin%2Fstore%2Fnew");
  }
  if (!state.profile || !isElevatedRole(state.profile.role)) {
    redirect("/admin/unauthorized");
  }

  const categories = await loadCategoryOptions();

  return (
    <>
      <PageIntro
        eyebrow={t("admin.metaTitle")}
        heading={t("admin.store.heading")}
        intro={t("admin.store.intro")}
      />

      <div className="mt-8">
        {categories.length === 0 ? (
          // Without a category there is nothing to attach a product to. Saying so
          // is better than rendering a select with no options.
          <Notice tone="warning" title={t("admin.store.errorHeading")}>
            <p>{t("admin.store.errors.unconfigured")}</p>
          </Notice>
        ) : (
          <ProductForm categories={categories} t={t} />
        )}
      </div>
    </>
  );
}
