import { redirect } from "next/navigation";
import { ProductForm } from "@/components/admin/ProductForm";
import { Notice } from "@/components/ui/Notice";
import { PageIntro } from "@/components/ui/PageIntro";
import { getAuthState } from "@/lib/auth/session";
import { isDepartmentEditorRole } from "@/lib/auth/roles";
import { createTranslator } from "@/lib/i18n/translator";
import { loadEditableDepartments } from "@/lib/content/project-admin-queries";
import { loadCategoryOptions } from "@/lib/store/loaders";

/**
 * Admin: add a product.
 *
 * The authorization check here mirrors the one in the action. Both are needed and
 * neither is redundant: this one stops the page rendering, and the action's stops
 * the mutation. A Server Action is a public HTTP endpoint, so a check that lived
 * only in the page would protect the form and not the write.
 *
 * The department picker is what makes a product's department explicit. The
 * categories offered are only those of the departments the caller may edit, so a
 * department editor sees their own and a super admin sees all — which is the
 * feature: place a product in any department, and that department's staff can then
 * manage it.
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
  if (!state.profile || !isDepartmentEditorRole(state.profile.role)) {
    redirect("/admin/unauthorized");
  }

  const [categories, departments] = await Promise.all([
    loadCategoryOptions(),
    loadEditableDepartments(state.profile.role).then((rows) =>
      rows.map((row) => ({ slug: row.slug, name: row.name })),
    ),
  ]);

  const allowed = new Set<string>(
    departments.map((department) => department.slug),
  );
  const offered = categories.filter((category) =>
    allowed.has(category.departmentSlug),
  );

  return (
    <>
      <PageIntro
        eyebrow={t("admin.metaTitle")}
        heading={t("admin.store.heading")}
        intro={t("admin.store.intro")}
      />

      <div className="mt-8">
        {offered.length === 0 ? (
          // Without a category there is nothing to attach a product to. Saying so
          // is better than rendering a select with no options.
          <Notice tone="warning" title={t("admin.store.errorHeading")}>
            <p>{t("admin.store.errors.unconfigured")}</p>
          </Notice>
        ) : (
          <ProductForm
            categories={offered}
            departments={departments}
            locale="en"
          />
        )}
      </div>
    </>
  );
}
