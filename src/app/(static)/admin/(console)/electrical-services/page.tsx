import { redirect } from "next/navigation";

import { DepartmentOverviewPanel } from "@/components/admin/DepartmentOverviewPanel";
import { ReportHighlights } from "@/components/admin/reports/ReportVisuals";
import { summarizeInquiries } from "@/lib/admin/report-metrics";
import { loadInquiryReport } from "@/lib/admin/reports";
import { getAuthState } from "@/lib/auth/session";
import { canAccessDepartment } from "@/lib/auth/roles";
import { listAdminProjects } from "@/lib/content/project-admin-queries";
import { createTranslator } from "@/lib/i18n/translator";
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

  const [products, projects, inquiryRows] = await Promise.all([
    listProductsForAdmin(["electrical-services"]),
    listAdminProjects(state.profile.role),
    loadInquiryReport(200, "electrical-services"),
  ]);
  const t = createTranslator("en").t;
  const inquiries = summarizeInquiries(
    inquiryRows.filter((row) => row.departmentSlug === "electrical-services"),
  );

  const published = products.filter((row) => row.publishState === "published");
  const drafts = products.filter((row) => row.publishState === "draft");
  const lowStock = products.filter(
    (row) => row.stock > 0 && row.stock <= 5,
  ).length;
  const outOfStock = products.filter((row) => row.stock <= 0).length;
  const publishedShare =
    products.length > 0
      ? Math.round((published.length / products.length) * 1000) / 10
      : null;

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
      report={
        <ReportHighlights
          heading={t("adminDepartments.reportHeading")}
          intro={t("adminDepartments.reportIntro")}
          metrics={[
            {
              label: t("adminDepartments.publishedShare"),
              value:
                publishedShare === null
                  ? t("adminReports.noValueRecorded")
                  : `${publishedShare}%`,
              hint: t("adminDepartments.publishedShareHint"),
            },
            {
              label: t("adminReports.inventoryLow"),
              value: String(lowStock),
              hint: t("adminReports.kpiLowStockHint", {
                out: outOfStock,
                total: products.length,
              }),
            },
            {
              label: t("adminReports.kpiResponse"),
              value:
                inquiries.responseRate === null
                  ? t("adminReports.noValueRecorded")
                  : `${inquiries.responseRate}%`,
              hint:
                inquiries.total > 0
                  ? t("adminReports.kpiResponseHint", {
                      responded: inquiries.responded,
                      total: inquiries.total,
                    })
                  : t("adminReports.inquiriesEmpty"),
            },
            {
              label: t("adminReports.inquiriesUnanswered"),
              value: String(inquiries.unanswered),
            },
          ]}
          href="/admin/reports"
          linkLabel={t("adminDashboardCards.viewReports")}
        />
      }
    />
  );
}
