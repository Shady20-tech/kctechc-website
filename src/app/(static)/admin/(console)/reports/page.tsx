import {
  ReportBarChart,
  ReportHighlights,
  ReportInsights,
  ReportKpi,
  ReportNote,
  ReportTrendChart,
  TrendArrow,
  type ReportInsight,
} from "@/components/admin/reports/ReportVisuals";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeading } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageIntro } from "@/components/ui/PageIntro";
import {
  salesMomentum,
  summarizeInquiries,
  summarizeInventory,
  summarizeListingActivity,
  summarizePipeline,
  summarizeSales,
} from "@/lib/admin/report-metrics";
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
 * The page is a report, not a table dump. Each section opens with the figure that
 * answers the operational question, then shows the shape of the data and only
 * then the supporting rows. Every number is derived from a `report_*` view, and
 * every empty state says "nothing recorded" rather than drawing a zero that looks
 * like a measurement.
 *
 * Amounts are never summed across currencies. The report views are per-currency
 * and the cards and charts keep that split, because there is no exchange-rate feed
 * that could make a combined figure honest.
 */
export default async function AdminReportsPage() {
  await requireAdmin("/admin/reports");
  const t = createTranslator("en").t;

  const [salesRows, pipelineRows, inquiryRows, activityRows, inventoryRows] =
    await Promise.all([
      loadSalesReport(),
      loadPipelineReport(),
      loadInquiryReport(),
      loadListingActivityReport(),
      loadInventoryReport(),
    ]);

  const sales = summarizeSales(salesRows);
  const pipeline = summarizePipeline(pipelineRows);
  const inquiries = summarizeInquiries(inquiryRows);
  const activity = summarizeListingActivity(activityRows);
  const inventory = summarizeInventory(inventoryRows);

  const primaryCurrency = sales.currencies[0] ?? null;
  const momentum = primaryCurrency ? salesMomentum(primaryCurrency.days) : null;

  const dayLabel = (iso: string) => {
    const date = new Date(`${iso}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return iso;
    return new Intl.DateTimeFormat("en-CM", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(date);
  };
  const fullDayLabel = (iso: string) => {
    const date = new Date(`${iso}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return iso;
    return new Intl.DateTimeFormat("en-CM", {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(date);
  };
  const currencyList = (
    values: readonly { currency: string; totalMinor: number }[],
  ) =>
    values
      .map((entry) => formatPrice(entry.totalMinor, entry.currency, "en"))
      .join(" · ");

  const insights: ReportInsight[] = [];
  if (momentum && primaryCurrency) {
    insights.push({
      title: t("adminReports.insightMomentumTitle"),
      body: t(
        momentum.changePct === null
          ? "adminReports.insightMomentumNoBaseline"
          : momentum.changePct >= 0
            ? "adminReports.insightMomentumUp"
            : "adminReports.insightMomentumDown",
        {
          recent: formatPrice(
            momentum.recentAverageMinor,
            primaryCurrency.currency,
            "en",
          ),
          change: `${Math.abs(momentum.changePct ?? 0)}%`,
        },
      ),
      tone:
        momentum.changePct === null
          ? "neutral"
          : momentum.changePct >= 0
            ? "positive"
            : "warning",
    });
  }
  if (pipeline.pendingOrders > 0) {
    insights.push({
      title: t("adminReports.insightPendingTitle"),
      body: t("adminReports.insightPendingBody", {
        count: pipeline.pendingOrders,
        value: pipeline.pendingValues.length
          ? currencyList(pipeline.pendingValues)
          : t("adminReports.noValueRecorded"),
      }),
      tone: "warning",
    });
  }
  if (inquiries.total > 0) {
    insights.push({
      title: t("adminReports.insightRepliesTitle"),
      body: t("adminReports.insightRepliesBody", {
        rate: inquiries.responseRate ?? 0,
        responded: inquiries.responded,
        total: inquiries.total,
        unanswered: inquiries.unanswered,
      }),
      tone:
        inquiries.responseRate !== null && inquiries.responseRate >= 80
          ? "positive"
          : "warning",
    });
  }
  if (inventory.lowStock > 0) {
    insights.push({
      title: t("adminReports.insightStockTitle"),
      body: t("adminReports.insightStockBody", {
        count: inventory.lowStock,
        total: inventory.total,
      }),
      tone: "warning",
    });
  }

  const revenueCards =
    sales.currencies.length > 0
      ? sales.currencies.map((entry) => ({
          label: t("adminReports.kpiRevenueCurrency", {
            currency: entry.currency,
          }),
          value: formatPrice(entry.grossMinor, entry.currency, "en"),
          hint: t("adminReports.kpiRevenueHint", {
            orders: entry.paidOrders,
            average:
              entry.averageOrderMinor === null
                ? t("adminReports.noValueRecorded")
                : formatPrice(entry.averageOrderMinor, entry.currency, "en"),
          }),
        }))
      : [
          {
            label: t("adminReports.kpiRevenue"),
            value: t("adminReports.noValueRecorded"),
            hint: t("adminReports.salesEmpty"),
          },
        ];

  return (
    <>
      <PageIntro
        eyebrow={t("adminNav.reports")}
        heading={t("adminReports.heading")}
        intro={t("adminReports.intro")}
      />
      <ReportNote>{t("adminReports.mixedCurrencyNote")}</ReportNote>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {revenueCards.map((metric) => (
          <ReportKpi key={metric.label} metric={metric} />
        ))}
        <ReportKpi
          metric={{
            label: t("adminReports.kpiPaidOrders"),
            value: String(sales.totalPaidOrders),
            hint:
              sales.latestSaleDate === null
                ? t("adminReports.noValueRecorded")
                : t("adminReports.kpiLatestSale", {
                    date: fullDayLabel(sales.latestSaleDate),
                  }),
          }}
        />
        <ReportKpi
          metric={{
            label: t("adminReports.kpiPending"),
            value: String(pipeline.pendingOrders),
            hint:
              pipeline.pendingValues.length > 0
                ? currencyList(pipeline.pendingValues)
                : t("adminReports.noValueRecorded"),
            tone: pipeline.pendingOrders > 0 ? "warning" : "neutral",
          }}
        />
        <ReportKpi
          metric={{
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
            tone:
              inquiries.responseRate !== null && inquiries.responseRate >= 80
                ? "positive"
                : "neutral",
          }}
        />
        <ReportKpi
          metric={{
            label: t("adminReports.kpiLowStock"),
            value:
              inventory.total > 0
                ? String(inventory.lowStock)
                : t("adminReports.noValueRecorded"),
            hint:
              inventory.total > 0
                ? t("adminReports.kpiLowStockHint", {
                    out: inventory.outOfStock,
                    total: inventory.total,
                  })
                : t("adminReports.inventoryEmpty"),
            tone: inventory.lowStock > 0 ? "warning" : "neutral",
          }}
        />
      </section>

      <div className="mt-8">
        <ReportInsights
          heading={t("adminReports.insightsHeading")}
          intro={t("adminReports.insightsIntro")}
          items={insights.slice(0, 4)}
          emptyMessage={t("adminReports.insightsEmpty")}
        />
      </div>

      <section className="mt-8" aria-labelledby="sales-report-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2
              id="sales-report-heading"
              className="text-xl font-semibold text-ink-900"
            >
              {t("adminReports.salesHeading")}
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-body">
              {t("adminReports.salesIntro")}
            </p>
          </div>
          {momentum ? <TrendArrow changePct={momentum.changePct} /> : null}
        </div>

        {sales.currencies.length === 0 ? (
          <div className="mt-4">
            <ReportBarChart
              title={t("adminReports.salesTrendHeading")}
              bars={[]}
              emptyMessage={t("adminReports.salesEmpty")}
            />
          </div>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {sales.currencies.map((entry) => {
              const days = entry.days.slice(-14);
              return (
                <ReportTrendChart
                  key={entry.currency}
                  title={t("adminReports.salesTrendHeadingCurrency", {
                    currency: entry.currency,
                  })}
                  description={t("adminReports.salesTrendIntro")}
                  points={days.map((day) => ({
                    label: dayLabel(day.date),
                    accessibleLabel: fullDayLabel(day.date),
                    value: day.grossMinor,
                  }))}
                  formatValue={(value) =>
                    formatPrice(value, entry.currency, "en")
                  }
                  emptyMessage={t("adminReports.salesEmpty")}
                />
              );
            })}
          </div>
        )}

        {primaryCurrency ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <ReportKpi
              metric={{
                label: t("adminReports.salesAverage"),
                value:
                  primaryCurrency.averageOrderMinor === null
                    ? t("adminReports.noValueRecorded")
                    : formatPrice(
                        primaryCurrency.averageOrderMinor,
                        primaryCurrency.currency,
                        "en",
                      ),
                hint: primaryCurrency.currency,
              }}
            />
            <ReportKpi
              metric={{
                label: t("adminReports.salesBestDay"),
                value:
                  primaryCurrency.bestDay === null
                    ? t("adminReports.noValueRecorded")
                    : formatPrice(
                        primaryCurrency.bestDay.grossMinor,
                        primaryCurrency.currency,
                        "en",
                      ),
                hint:
                  primaryCurrency.bestDay === null
                    ? undefined
                    : fullDayLabel(primaryCurrency.bestDay.date),
              }}
            />
          </div>
        ) : null}
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <ReportBarChart
          title={t("adminReports.pipelineHeading")}
          description={t("adminReports.pipelineIntro")}
          bars={pipeline.statuses.map((status) => ({
            label: t(`orderStatus.${status.status}`),
            value: status.orderCount,
            meta: status.values.length
              ? currencyList(status.values)
              : undefined,
          }))}
          emptyMessage={t("adminReports.pipelineEmpty")}
        />
        <ReportHighlights
          heading={t("adminReports.pipelineHealthHeading")}
          intro={t("adminReports.pipelineHealthIntro")}
          metrics={[
            {
              label: t("adminReports.pipelinePending"),
              value: String(pipeline.pendingOrders),
              hint: t("adminReports.pipelinePendingHint"),
            },
            {
              label: t("adminReports.pipelineActive"),
              value: String(pipeline.activeOrders),
            },
            {
              label: t("adminReports.pipelineCompleted"),
              value: String(pipeline.completedOrders),
            },
            {
              label: t("adminReports.pipelineCancelled"),
              value: String(pipeline.cancelledOrders),
            },
          ]}
        />
      </section>

      <section className="mt-8" aria-labelledby="inquiry-report-heading">
        <div>
          <h2
            id="inquiry-report-heading"
            className="text-xl font-semibold text-ink-900"
          >
            {t("adminReports.inquiriesHeading")}
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-body">
            {t("adminReports.inquiriesIntro")}
          </p>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <ReportTrendChart
            title={t("adminReports.inquiriesTrendHeading")}
            description={t("adminReports.inquiriesTrendIntro")}
            points={inquiries.daily.slice(-14).map((day) => ({
              label: dayLabel(day.date),
              accessibleLabel: fullDayLabel(day.date),
              value: day.count,
            }))}
            formatValue={(value) => String(value)}
            emptyMessage={t("adminReports.inquiriesEmpty")}
          />
          <ReportBarChart
            title={t("adminReports.inquiriesByDepartment")}
            description={t("adminReports.inquiriesByDepartmentIntro")}
            bars={inquiries.byDepartment.map((department) => ({
              label: departmentName(department.departmentSlug, t),
              value: department.count,
              meta:
                department.responseRate === null
                  ? undefined
                  : t("adminReports.replyRate", {
                      rate: department.responseRate,
                    }),
            }))}
            emptyMessage={t("adminReports.inquiriesEmpty")}
          />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <ReportBarChart
            title={t("adminReports.inquiriesByType")}
            bars={inquiries.byType.map((type) => ({
              label: type.type,
              value: type.count,
            }))}
            emptyMessage={t("adminReports.inquiriesEmpty")}
          />
          <ReportHighlights
            heading={t("adminReports.inquiriesHealthHeading")}
            intro={t("adminReports.inquiriesHealthIntro")}
            metrics={[
              {
                label: t("adminReports.kpiResponse"),
                value:
                  inquiries.responseRate === null
                    ? t("adminReports.noValueRecorded")
                    : `${inquiries.responseRate}%`,
              },
              {
                label: t("adminReports.inquiriesUnanswered"),
                value: String(inquiries.unanswered),
              },
              {
                label: t("adminReports.inquiriesBusiestDepartment"),
                value: inquiries.topDepartment
                  ? departmentName(inquiries.topDepartment.departmentSlug, t)
                  : t("adminReports.noValueRecorded"),
              },
              {
                label: t("adminReports.inquiriesBusiestDay"),
                value: inquiries.busiestDay
                  ? fullDayLabel(inquiries.busiestDay.date)
                  : t("adminReports.noValueRecorded"),
              },
            ]}
          />
        </div>
      </section>

      <section className="mt-8" aria-labelledby="listing-report-heading">
        <div>
          <h2
            id="listing-report-heading"
            className="text-xl font-semibold text-ink-900"
          >
            {t("adminReports.listingsHeading")}
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-body">
            {t("adminReports.listingsIntro")}
          </p>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <ReportTrendChart
            title={t("adminReports.listingsTrendHeading")}
            points={activity.daily.slice(-14).map((day) => ({
              label: dayLabel(day.date),
              accessibleLabel: fullDayLabel(day.date),
              value: day.count,
            }))}
            formatValue={(value) => String(value)}
            emptyMessage={t("adminReports.listingsEmpty")}
          />
          <ReportBarChart
            title={t("adminReports.listingsByEvent")}
            bars={activity.byEvent.map((event) => ({
              label: listingEventLabel(event.eventType, t),
              value: event.count,
            }))}
            emptyMessage={t("adminReports.listingsEmpty")}
          />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ReportKpi
            metric={{
              label: t("adminReports.listingsViews"),
              value: String(activity.views),
              hint: t("adminReports.listingsViewsHint"),
            }}
          />
          <ReportKpi
            metric={{
              label: t("adminReports.listingsInquiries"),
              value: String(activity.inquiries),
              hint: t("adminReports.listingsInquiriesHint"),
            }}
          />
          <ReportKpi
            metric={{
              label: t("adminReports.listingsSaves"),
              value: String(activity.saves),
            }}
          />
          <ReportKpi
            metric={{
              label: t("adminReports.listingsContactReveals"),
              value: String(activity.contactReveals),
            }}
          />
        </div>
      </section>

      <section className="mt-8" aria-labelledby="inventory-report-heading">
        <div>
          <h2
            id="inventory-report-heading"
            className="text-xl font-semibold text-ink-900"
          >
            {t("adminReports.inventoryHeading")}
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-body">
            {t("adminReports.inventoryIntro")}
          </p>
        </div>
        <div className="mt-4">
          <ReportHighlights
            heading={t("adminReports.inventoryHealthHeading")}
            intro={t("adminReports.inventoryHealthIntro")}
            metrics={[
              {
                label: t("adminReports.inventoryPublished"),
                value: String(inventory.published),
              },
              {
                label: t("adminReports.inventoryDraft"),
                value: String(inventory.draft),
              },
              {
                label: t("adminReports.inventoryLow"),
                value: String(inventory.lowStock),
                tone: inventory.lowStock > 0 ? "warning" : "neutral",
              },
              {
                label: t("adminReports.inventoryOut"),
                value: String(inventory.outOfStock),
                tone: inventory.outOfStock > 0 ? "warning" : "neutral",
              },
            ]}
          />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <ReportBarChart
            title={t("adminReports.inventoryAvailabilityHeading")}
            bars={inventory.byAvailability.map((entry) => ({
              label: t(`store.availability.${entry.availability}`),
              value: entry.count,
            }))}
            emptyMessage={t("adminReports.inventoryEmpty")}
          />
          <ReportBarChart
            title={t("adminReports.inventoryTopOrdered")}
            bars={inventory.topOrdered.map((item) => ({
              label: item.title,
              value: item.timesOrdered,
              meta: item.sku,
            }))}
            emptyMessage={t("adminReports.inventoryNoOrders")}
          />
        </div>
        {inventory.lowStockItems.length > 0 ? (
          <Card className="mt-4">
            <CardHeading level={3}>
              {t("adminReports.inventoryLowHeading")}
            </CardHeading>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {inventory.lowStockItems.map((item) => (
                <li
                  key={item.sku}
                  className="rounded-control border border-border bg-surface-alt p-3"
                >
                  <p className="text-sm font-semibold text-ink-900">
                    {item.title}
                  </p>
                  <p className="mt-1 font-mono text-xs text-muted">
                    {item.sku}
                  </p>
                  <p className="mt-2 text-sm text-red-700">
                    {t("adminReports.inventoryStockLeft", {
                      count: item.stock,
                    })}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-ink-900">
          {t("adminReports.detailsHeading")}
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-body">
          {t("adminReports.detailsIntro")}
        </p>

        <div className="mt-4 space-y-4">
          <ReportDetails
            summary={t("adminReports.salesHeading")}
            count={salesRows.length}
          >
            <DataTable<(typeof salesRows)[number]>
              caption={t("adminReports.salesHeading")}
              scrollLabel={t("adminReports.salesHeading")}
              getRowKey={(row) => `${row.saleDate}-${row.currency}`}
              rowHeaderKey="date"
              columns={[
                {
                  key: "date",
                  header: t("adminReports.salesDate"),
                  render: (r) => r.saleDate,
                },
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
              rows={salesRows}
              emptyMessage={t("adminReports.salesEmpty")}
            />
          </ReportDetails>

          <ReportDetails
            summary={t("adminReports.pipelineHeading")}
            count={pipelineRows.length}
          >
            <DataTable<(typeof pipelineRows)[number]>
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
              rows={pipelineRows}
              emptyMessage={t("adminReports.pipelineEmpty")}
            />
          </ReportDetails>

          <ReportDetails
            summary={t("adminReports.inquiriesHeading")}
            count={inquiryRows.length}
          >
            <DataTable<(typeof inquiryRows)[number]>
              caption={t("adminReports.inquiriesHeading")}
              scrollLabel={t("adminReports.inquiriesHeading")}
              getRowKey={(row) =>
                `${row.inquiryDate}-${row.departmentSlug}-${row.inquiryType}-${row.source}`
              }
              rowHeaderKey="date"
              columns={[
                {
                  key: "date",
                  header: t("adminReports.inquiriesDate"),
                  render: (r) => r.inquiryDate,
                },
                {
                  key: "department",
                  header: t("adminReports.inquiriesDepartment"),
                  render: (r) => departmentName(r.departmentSlug, t),
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
              rows={inquiryRows}
              emptyMessage={t("adminReports.inquiriesEmpty")}
            />
          </ReportDetails>

          <ReportDetails
            summary={t("adminReports.listingsHeading")}
            count={activityRows.length}
          >
            <DataTable<(typeof activityRows)[number]>
              caption={t("adminReports.listingsHeading")}
              scrollLabel={t("adminReports.listingsHeading")}
              getRowKey={(row) =>
                `${row.activityDate}-${row.eventType}-${row.listingStatus}`
              }
              rowHeaderKey="date"
              columns={[
                {
                  key: "date",
                  header: t("adminReports.listingsDate"),
                  render: (r) => r.activityDate,
                },
                {
                  key: "event",
                  header: t("adminReports.listingsEvent"),
                  render: (r) => (
                    <Badge tone="info">
                      {listingEventLabel(r.eventType, t)}
                    </Badge>
                  ),
                },
                {
                  key: "status",
                  header: t("adminReports.listingsStatus"),
                  render: (r) => t(`realEstate.statuses.${r.listingStatus}`),
                },
                {
                  key: "count",
                  header: t("adminReports.listingsCount"),
                  align: "end",
                  render: (r) => r.count,
                },
              ]}
              rows={activityRows}
              emptyMessage={t("adminReports.listingsEmpty")}
            />
          </ReportDetails>

          <ReportDetails
            summary={t("adminReports.inventoryHeading")}
            count={inventoryRows.length}
          >
            <DataTable<(typeof inventoryRows)[number]>
              caption={t("adminReports.inventoryHeading")}
              scrollLabel={t("adminReports.inventoryHeading")}
              getRowKey={(row) => row.productId}
              rowHeaderKey="product"
              columns={[
                {
                  key: "product",
                  header: t("adminReports.inventoryProduct"),
                  render: (r) => r.title,
                },
                {
                  key: "sku",
                  header: t("adminReports.inventorySku"),
                  render: (r) => (
                    <span className="font-mono text-xs">{r.sku}</span>
                  ),
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
                      <Badge tone="warning">
                        {t("adminReports.inventoryLow")}
                      </Badge>
                    ) : (
                      <span className="text-muted">—</span>
                    ),
                },
              ]}
              rows={inventoryRows}
              emptyMessage={t("adminReports.inventoryEmpty")}
            />
          </ReportDetails>
        </div>
      </section>
    </>
  );
}

function departmentName(
  slug: string | null,
  t: ReturnType<typeof createTranslator>["t"],
): string {
  if (!slug) return t("adminReports.unassignedDepartment");
  if (slug === "digital-marketing") return t("adminNav.digitalMarketing");
  if (slug === "electrical-services") return t("adminNav.electricalServices");
  if (slug === "real-estate") return t("adminNav.realEstate");
  return slug;
}

function listingEventLabel(
  eventType: string,
  t: ReturnType<typeof createTranslator>["t"],
): string {
  const key = `adminReports.listingEvents.${eventType}`;
  const label = t(key);
  return label === key ? eventType : label;
}

function ReportDetails({
  summary,
  count,
  children,
}: {
  summary: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <details className="rounded-card border border-border bg-surface p-4">
      <summary className="cursor-pointer text-sm font-semibold text-ink-900">
        {summary} ({count})
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}
