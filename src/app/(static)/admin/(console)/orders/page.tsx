import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { PageIntro } from "@/components/ui/PageIntro";
import { getAuthState } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/auth/roles";
import { createTranslator } from "@/lib/i18n/translator";
import { listOrdersForAdmin, getOrderStatusCounts } from "@/lib/orders/queries";
import {
  ORDER_STATUSES,
  isOrderStatus,
  type OrderStatus,
} from "@/lib/orders/types";
import { formatPrice } from "@/lib/store/types";

export const dynamic = "force-dynamic";

/** Admin: the order queue. */
export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const t = createTranslator("en").t;
  const state = await getAuthState();

  if (state.status === "unconfigured") {
    redirect("/admin/login?reason=unconfigured");
  }
  if (state.status !== "authenticated") {
    redirect("/admin/login?next=%2Fadmin%2Forders");
  }
  if (!state.profile || !isAdminRole(state.profile.role)) {
    redirect("/admin/unauthorized");
  }

  const { status } = await searchParams;
  const filter: OrderStatus | undefined =
    status && isOrderStatus(status) ? status : undefined;

  const [orders, counts] = await Promise.all([
    listOrdersForAdmin({ status: filter, limit: 200 }),
    getOrderStatusCounts(),
  ]);

  return (
    <>
      <PageIntro
        eyebrow={t("adminOrder.eyebrow")}
        heading={t("adminOrder.heading")}
        intro={t("adminOrder.intro")}
      />

      <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {counts.map((entry) => (
          <div
            key={entry.status}
            className="rounded-card border border-border-strong p-4"
          >
            <dt className="text-sm text-muted">
              {t(`orderStatus.${entry.status}`)}
            </dt>
            <dd className="mt-1 font-display text-2xl font-bold text-ink-900">
              {entry.count}
            </dd>
          </div>
        ))}
      </dl>

      <nav aria-label={t("adminOrder.filterLabel")} className="mt-8 flex flex-wrap gap-2">
        <Link
          href="/admin/orders"
          className="rounded-pill border border-border-strong px-3 py-1 text-sm"
          aria-current={filter === undefined ? "page" : undefined}
        >
          {t("adminOrder.filterAll")}
        </Link>
        {ORDER_STATUSES.map((entry) => (
          <Link
            key={entry}
            href={`/admin/orders?status=${entry}`}
            className={`rounded-pill border px-3 py-1 text-sm ${
              filter === entry
                ? "border-dept-accent text-dept-accent"
                : "border-border-strong text-body"
            }`}
            aria-current={filter === entry ? "page" : undefined}
          >
            {t(`orderStatus.${entry}`)}
          </Link>
        ))}
      </nav>

      <div className="mt-8">
        <DataTable<(typeof orders)[number]>
          caption={t("adminOrder.heading")}
          scrollLabel={t("adminOrder.tableScrollLabel")}
          getRowKey={(order) => order.id}
          rowHeaderKey="reference"
          columns={[
            {
              key: "reference",
              header: t("adminOrder.colReference"),
              render: (order) => (
                <a
                  href={`/admin/orders/${order.id}`}
                  className="font-mono text-sm text-dept-accent underline"
                >
                  {order.reference}
                </a>
              ),
            },
            {
              key: "customer",
              header: t("adminOrder.colCustomer"),
              render: (order) => order.fullName,
            },
            {
              key: "placed",
              header: t("adminOrder.colPlaced"),
              render: (order) => formatDate(order.placedAt),
            },
            {
              key: "status",
              header: t("adminOrder.colStatus"),
              render: (order) => (
                <Badge tone={statusTone(order.status)}>
                  {t(`orderStatus.${order.status}`)}
                </Badge>
              ),
            },
            {
              key: "items",
              header: t("adminOrder.colItems"),
              align: "end",
              render: (order) => order.itemCount,
            },
            {
              key: "total",
              header: t("adminOrder.colTotal"),
              align: "end",
              render: (order) =>
                formatPrice(order.totalMinor, order.currency, "en"),
            },
          ]}
          rows={orders}
          emptyMessage={t("adminOrder.empty")}
        />
      </div>
    </>
  );
}

function statusTone(status: OrderStatus): "success" | "info" | "warning" | "danger" {
  switch (status) {
    case "paid":
    case "processing":
    case "fulfilled":
      return "success";
    case "pending_payment":
      return "warning";
    case "cancelled":
    case "refunded":
      return "danger";
    default:
      return "info";
  }
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}
