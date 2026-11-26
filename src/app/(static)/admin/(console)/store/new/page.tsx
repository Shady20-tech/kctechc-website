import { redirect } from "next/navigation";
import { ProductForm } from "@/components/admin/ProductForm";
import { Notice } from "@/components/ui/Notice";
import { PageIntro } from "@/components/ui/PageIntro";
import { getAuthState } from "@/lib/auth/session";
import { isDepartmentEditorRole } from "@/lib/auth/roles";
import { createTranslator } from "@/lib/i18n/translator";
import { loadEditableDepartmentsResult } from "@/lib/content/project-admin-queries";
import { isSupabaseAdminConfigured } from "@/lib/config/server-env";
import { loadCategoryOptionsResult } from "@/lib/store/loaders";

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
 *
 * The page must not report every empty state as a missing admin key. A failed
 * category read, an unseeded category table, a role with no department and an
 * absent service-role key are four different conditions with four different
 * fixes. The loaders return their failure explicitly so the notice can name the
 * real one.
 */
export const dynamic = "force-dynamic";

export default async function AdminNewProductPage() {
  const t = createTranslator("en").t;
  const state = await getAuthState();

  if (state.status === "unconfigured") {
    redirect("/login?reason=unconfigured");
  }
  if (state.status !== "authenticated") {
    redirect("/login?next=%2Fadmin%2Fstore%2Fnew");
  }
  if (!state.profile || !isDepartmentEditorRole(state.profile.role)) {
    redirect("/admin/unauthorized");
  }

  const [categoryResult, departmentResult] = await Promise.all([
    loadCategoryOptionsResult(),
    loadEditableDepartmentsResult(state.profile.role),
  ]);

  const departments = departmentResult.ok ? departmentResult.departments : [];
  const allowed = new Set<string>(departments.map((entry) => entry.slug));
  const offered = categoryResult.ok
    ? categoryResult.categories.filter((category) =>
        allowed.has(category.departmentSlug),
      )
    : [];

  let problem: { title: string; body: string; detail?: string } | null = null;
  if (!isSupabaseAdminConfigured()) {
    problem = {
      title: t("adminNav.serviceRoleMissingTitle"),
      body: t("adminNav.serviceRoleMissingBody"),
    };
  } else if (!categoryResult.ok) {
    problem = {
      title: t("admin.store.errorHeading"),
      body: t("admin.store.errors.categoryLoadFailed"),
      detail: categoryResult.detail,
    };
  } else if (!departmentResult.ok) {
    problem = {
      title: t("admin.store.errorHeading"),
      body: t("admin.store.errors.departmentLoadFailed"),
      detail: departmentResult.detail,
    };
  } else if (departments.length === 0) {
    problem = {
      title: t("admin.store.errorHeading"),
      body: t("admin.store.errors.noEditableDepartments"),
    };
  } else if (offered.length === 0) {
    problem = {
      title: t("admin.store.errorHeading"),
      body: t("admin.store.errors.noCategories"),
    };
  }

  return (
    <>
      <PageIntro
        eyebrow={t("admin.metaTitle")}
        heading={t("admin.store.heading")}
        intro={t("admin.store.intro")}
        back={{
          href: "/admin/store",
          label: t("common.backTo", { destination: t("adminNav.store") }),
        }}
      />

      <div className="mt-8">
        {problem ? (
          <Notice tone="warning" title={problem.title}>
            <p>{problem.body}</p>
            {problem.detail ? (
              <p className="mt-2 break-words font-mono text-xs">
                {problem.detail}
              </p>
            ) : null}
          </Notice>
        ) : (
          <ProductForm
            categories={offered}
            departments={departments.map((row) => ({
              slug: row.slug,
              name: row.name,
            }))}
            locale="en"
          />
        )}
      </div>
    </>
  );
}
