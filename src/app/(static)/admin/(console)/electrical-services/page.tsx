import { redirect } from "next/navigation";

import { DepartmentOverviewPanel } from "@/components/admin/DepartmentOverviewPanel";
import { getAuthState } from "@/lib/auth/session";
import { canAccessDepartment } from "@/lib/auth/roles";
import { listAdminProjects } from "@/lib/content/project-admin-queries";
import { listProductsForAdmin } from "@/lib/store/admin-queries";

export const dynamic = "force-dynamic";

/**
 * Admin: Electrical Services console.
 *
 * Electrical Services is the department with the most to manage — the SAKO solar
 * catalogue, the installed-work portfolio and the brand partners — so its staff
 * get a front door of their own rather than the mixed Operations list.
 *
 * Counts come from the same scoped loaders the detail pages use, so a staff member
 * sees their own department's totals and a super admin sees the same numbers the
 * cross-department pages would show them.
 */
export default async function AdminElectricalServicesPage() {
  const state = await getAuthState();

  if (state.status === "unconfigured") {
    redirect("/login?reason=unconfigured");
  }
  if (state.status !== "authenticated") {
    redirect("/login?next=%2Fadmin%2Felectrical-services");
  }
  if (
    !state.profile ||
    !canAccessDepartment(state.profile.role, "electrical-services")
  ) {
    redirect("/admin/unauthorized");
  }

  const [products, projects] = await Promise.all([
    listProductsForAdmin(["electrical-services"]),
    listAdminProjects(state.profile.role),
  ]);

  const published = products.filter((row) => row.publishState === "published");
  const drafts = products.filter((row) => row.publishState === "draft");

  return (
    <DepartmentOverviewPanel
      slug="electrical-services"
      role={state.profile.role}
      titleKey="adminDepartments.electricalServicesHeading"
      introKey="adminDepartments.electricalServicesIntro"
      counts={[
        { key: "adminDepartments.countProducts", value: products.length },
        { key: "adminDepartments.countPublished", value: published.length },
        { key: "adminDepartments.countDrafts", value: drafts.length },
        { key: "adminDepartments.countProjects", value: projects.length },
      ]}
      actions={[
        { href: "/admin/store", labelKey: "adminNav.store" },
        { href: "/admin/work", labelKey: "adminNav.work" },
        { href: "/admin/orders", labelKey: "adminNav.orders" },
      ]}
      hasStore
      hasProjects
    />
  );
}
