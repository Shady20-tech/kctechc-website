import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageIntro } from "@/components/ui/PageIntro";
import {
  loadInquiryReport,
  loadInventoryReport,
  loadListingActivityReport,
  loadPipelineReport,
  loadSalesReport,
} from "@/lib/admin/reports";
import { requireAdmin } from "@/lib/auth/guards";
import { createTranslator } from "@/lib/i18n/translator";
import { formatPrice } from "@/lib/store/types";

export const dynamic = "force-dynamic";

/**
 * Admin: operational reports.
 *
 * Every section renders from a `report_*` view and says plainly when nothing has
 * been recorded, rather than showing a zero that reads like a measurement. That is
 * the same reason each section carries its own short intro: a report is only
 * honest if it states what it counts.
 */
export default async function AdminReportsPage() {
  await requireAdmin("/admin/reports");
  const t = createTranslator("en").t;

  const [sales, pipeline, inquiries, activity, inventory] = await Promise.all([
    loadSalesReport(),
    loadPipelineReport(),
    loadInquiryReport(),
    loadListingActivityReport(),
    loadInventoryReport(),
  ]);

  return (
    <>
      <PageIntro
        eyebrow={t("adminNav.reports")}
        heading={t("adminReports.heading")}
        intro={t("adminReports.intro")}
      />

      <div className="mt-8 space-y-8">
        <ReportSection
          heading={t("adminReports.salesHeading")}
          intro={t("adminReports.salesIntro")}
          empty={sales.length === 0}
          emptyMessage={t("adminReports.salesEmpty")}
        >
          <DataTable<(typeof sales)[number]>
            caption={t("adminReports.salesHeading")}
            scrollLabel={t("adminReports.salesHeading")}
            getRowKey={(row) => `${row.saleDate}-${row.currency}`}
            rowHeaderKey="date"
            columns={[
              { key: "date", header: t("adminReports.salesDate"), render: (r) => r.saleDate },
              {
                key: "orders",
                header: t("adminReports.salesOrders"),
                align: "end",
                render: (r) => r.paidOrderCount,
              },
              {
                key: "gross",
                header: t("adminReports.salesGross"),
                align: "end",
                render: (r) => formatPrice(r.grossMinor, r.currency, "en"),
              },
              {
                key: "ordered",
                header: t("adminReports.salesOrdered"),
                align: "end",
                render: (r) => formatPrice(r.orderedMinor, r.currency, "en"),
              },
            ]}
            rows={sales}
            emptyMessage={t("adminReports.salesEmpty")}
          />
        </ReportSection>

        <ReportSection
          heading={t("adminReports.pipelineHeading")}
          intro={t("adminReports.pipelineIntro")}
          empty={pipeline.length === 0}
          emptyMessage={t("adminReports.pipelineEmpty")}
        >
          <DataTable<(typeof pipeline)[number]>
            caption={t("adminReports.pipelineHeading")}
            scrollLabel={t("adminReports.pipelineHeading")}
            getRowKey={(row) => `${row.status}-${row.currency}`}
            rowHeaderKey="status"
            columns={[
              {
                key: "status",
                header: t("adminReports.pipelineStatus"),
                render: (r) => t(`orderStatus.${r.status}`),
              },
              {
                key: "count",
                header: t("adminReports.pipelineCount"),
                align: "end",
                render: (r) => r.orderCount,
              },
              {
                key: "value",
                header: t("adminReports.pipelineValue"),
                align: "end",
                render: (r) => formatPrice(r.totalMinor, r.currency, "en"),
              },
            ]}
            rows={pipeline}
            emptyMessage={t("adminReports.pipelineEmpty")}
          />
        </ReportSection>

        <ReportSection
          heading={t("adminReports.inquiriesHeading")}
          intro={t("adminReports.inquiriesIntro")}
          empty={inquiries.length === 0}
          emptyMessage={t("adminReports.inquiriesEmpty")}
        >
          <DataTable<(typeof inquiries)[number]>
            caption={t("adminReports.inquiriesHeading")}
            scrollLabel={t("adminReports.inquiriesHeading")}
            getRowKey={(row) =>
              `${row.inquiryDate}-${row.departmentSlug}-${row.inquiryType}-${row.source}`
            }
            rowHeaderKey="date"
            columns={[
              { key: "date", header: t("adminReports.inquiriesDate"), render: (r) => r.inquiryDate },
              {
                key: "department",
                header: t("adminReports.inquiriesDepartment"),
                render: (r) => r.departmentSlug ?? "—",
              },
              {
                key: "type",
                header: t("adminReports.inquiriesType"),
                render: (r) => <Badge tone="neutral">{r.inquiryType}</Badge>,
              },
              {
                key: "count",
                header: t("adminReports.inquiriesCount"),
                align: "end",
                render: (r) => r.count,
              },
              {
                key: "responded",
                header: t("adminReports.inquiriesResponded"),
                align: "end",
                render: (r) => r.responded,
              },
            ]}
            rows={inquiries}
            emptyMessage={t("adminReports.inquiriesEmpty")}
          />
        </ReportSection>

        <ReportSection
          heading={t("adminReports.listingsHeading")}
          intro={t("adminReports.listingsIntro")}
          empty={activity.length === 0}
          emptyMessage={t("adminReports.listingsEmpty")}
        >
          <DataTable<(typeof activity)[number]>
            caption={t("adminReports.listingsHeading")}
            scrollLabel={t("adminReports.listingsHeading")}
            getRowKey={(row) =>
              `${row.activityDate}-${row.eventType}-${row.listingStatus}`
            }
            rowHeaderKey="date"
            columns={[
              { key: "date", header: t("adminReports.listingsDate"), render: (r) => r.activityDate },
              {
                key: "event",
                header: t("adminReports.listingsEvent"),
                render: (r) => <Badge tone="info">{r.eventType}</Badge>,
              },
              {
                key: "status",
                header: t("adminReports.listingsStatus"),
                render: (r) => r.listingStatus,
              },
              {
                key: "count",
                header: t("adminReports.listingsCount"),
                align: "end",
                render: (r) => r.count,
              },
            ]}
            rows={activity}
            emptyMessage={t("adminReports.listingsEmpty")}
          />
        </ReportSection>

        <ReportSection
          heading={t("adminReports.inventoryHeading")}
          intro={t("adminReports.inventoryIntro")}
          empty={inventory.length === 0}
          emptyMessage={t("adminReports.inventoryEmpty")}
        >
          <DataTable<(typeof inventory)[number]>
            caption={t("adminReports.inventoryHeading")}
            scrollLabel={t("adminReports.inventoryHeading")}
            getRowKey={(row) => row.productId}
            rowHeaderKey="product"
            columns={[
              { key: "product", header: t("adminReports.inventoryProduct"), render: (r) => r.title },
              {
                key: "sku",
                header: t("adminReports.inventorySku"),
                render: (r) => <span className="font-mono text-xs">{r.sku}</span>,
              },
              {
                key: "stock",
                header: t("adminReports.inventoryStock"),
                align: "end",
                render: (r) => r.stock,
              },
              {
                key: "ordered",
                header: t("adminReports.inventoryOrdered"),
                align: "end",
                render: (r) => r.timesOrdered,
              },
              {
                key: "low",
                header: t("adminReports.inventoryLow"),
                render: (r) =>
                  r.lowStock ? (
                    <Badge tone="warning">{t("adminReports.inventoryLow")}</Badge>
                  ) : (
                    <span className="text-muted">—</span>
                  ),
              },
            ]}
            rows={inventory}
            emptyMessage={t("adminReports.inventoryEmpty")}
          />
        </ReportSection>
      </div>
    </>
  );
}

function ReportSection({
  heading,
  intro,
  empty,
  emptyMessage,
  children,
}: {
  heading: string;
  intro: string;
  empty: boolean;
  emptyMessage: string;
  children: React.ReactNode;
}) {
  return (
    <Card as="section">
      <h2 className="text-lg font-semibold text-ink-900">{heading}</h2>
      <p className="mt-1 text-sm text-body">{intro}</p>
      {empty ? (
        <p className="mt-4 text-sm text-muted">{emptyMessage}</p>
      ) : (
        <div className="mt-4">{children}</div>
      )}
    </Card>
  );
}
