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
    redirect("/login?reason=unconfigured");
  }
  if (state.status !== "authenticated") {
    redirect("/login?next=%2Fadmin%2Fdigital-marketing");
  }
  if (
    !state.profile ||
    !canAccessDepartment(state.profile.role, "digital-marketing")
  ) {
    redirect("/admin/unauthorized");
  }

  const [products, projects, inquiryRows] = await Promise.all([
    listProductsForAdmin(["digital-marketing"]),
    listAdminProjects(state.profile.role),
    loadInquiryReport(200, "digital-marketing"),
  ]);
  const t = createTranslator("en").t;
  const inquiries = summarizeInquiries(
    inquiryRows.filter((row) => row.departmentSlug === "digital-marketing"),
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
