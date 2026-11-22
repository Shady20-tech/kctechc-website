import { redirect } from "next/navigation";

import { DepartmentOverviewPanel } from "@/components/admin/DepartmentOverviewPanel";
import { getAuthState } from "@/lib/auth/session";
import { canAccessDepartment } from "@/lib/auth/roles";
import { listAdminProjects } from "@/lib/content/project-admin-queries";
import { listProductsForAdmin } from "@/lib/store/admin-queries";

export const dynamic = "force-dynamic";

/**
 * Admin: Digital Marketing console.
 *
 * The department's front door, matching `/admin/real-estate` for the department
 * that already had one. It exists so a digital-marketing staff member lands on
 * their own department's surface instead of the cross-department Operations list,
 * which mixes in other departments' products and projects.
 *
 * The counts are read through the same scoped loaders the individual pages use —
 * `listProductsForAdmin` narrows to the departments the caller may author and
 * `listAdminProjects` narrows by role — so this page cannot show a number for work
 * the viewer could not open. Authorization is checked here and again in every
 * action; the real boundary is the RLS policy.
 */
export default async function AdminDigitalMarketingPage() {
  const state = await getAuthState();

  if (state.status === "unconfigured") {
    redirect("/admin/login?reason=unconfigured");
  }
  if (state.status !== "authenticated") {
    redirect("/admin/login?next=%2Fadmin%2Fdigital-marketing");
  }
  if (
    !state.profile ||
    !canAccessDepartment(state.profile.role, "digital-marketing")
  ) {
    redirect("/admin/unauthorized");
  }

  const [products, projects] = await Promise.all([
    listProductsForAdmin(["digital-marketing"]),
    listAdminProjects(state.profile.role),
  ]);

  const published = products.filter((row) => row.publishState === "published");
  const drafts = products.filter((row) => row.publishState === "draft");

  return (
    <DepartmentOverviewPanel
      slug="digital-marketing"
      role={state.profile.role}
      titleKey="adminDepartments.digitalMarketingHeading"
      introKey="adminDepartments.digitalMarketingIntro"
      counts={[
        { key: "adminDepartments.countProducts", value: products.length },
        { key: "adminDepartments.countPublished", value: published.length },
        { key: "adminDepartments.countDrafts", value: drafts.length },
        { key: "adminDepartments.countProjects", value: projects.length },
      ]}
      actions={[
        { href: "/admin/store", labelKey: "adminNav.store" },
        { href: "/admin/work", labelKey: "adminNav.work" },
        { href: "/admin/content", labelKey: "adminNav.content" },
        { href: "/admin/orders", labelKey: "adminNav.orders" },
      ]}
      hasStore
      hasProjects
    />
  );
}
