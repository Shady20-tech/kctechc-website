import type {
  InquiryRow,
  InventoryRow,
  ListingActivityRow,
  PipelineRow,
  SalesRow,
} from "./reports";

/**
 * Derived report metrics.
 *
 * The report views return rows, not conclusions. These functions turn those rows
 * into the figures the console displays: totals per currency, response rates,
 * stock health and day-over-day momentum. They are deliberately pure and live
 * outside `reports.ts` (which is `server-only`) so the arithmetic can be tested
 * without a database.
 *
 * Two rules matter throughout:
 *
 *   * Amounts are never summed across currencies. A XAF total and a USD total are
 *     different quantities, and there is no exchange-rate feed; the summaries
 *     therefore keep a per-currency breakdown.
 *   * An empty set produces `null`, not `0`, for a rate or an average. "Nothing
 *     recorded" and "measured as zero" are different facts.
 */

export type SalesDay = {
  date: string;
  grossMinor: number;
  paidOrders: number;
};

export type CurrencySales = {
  currency: string;
  paidOrders: number;
  grossMinor: number;
  orderedMinor: number;
  averageOrderMinor: number | null;
  days: SalesDay[];
  bestDay: SalesDay | null;
  latestDate: string | null;
};

export type SalesMomentum = {
  recentAverageMinor: number;
  priorAverageMinor: number;
  changePct: number | null;
};

export type SalesSummary = {
  currencies: CurrencySales[];
  totalPaidOrders: number;
  latestSaleDate: string | null;
};

export type PipelineStatus = {
  status: string;
  orderCount: number;
  values: { currency: string; totalMinor: number }[];
};

export type PipelineSummary = {
  totalOrders: number;
  pendingOrders: number;
  activeOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  paidShare: number | null;
  pendingValues: { currency: string; totalMinor: number }[];
  statuses: PipelineStatus[];
};

export type DepartmentInquiry = {
  departmentSlug: string | null;
  count: number;
  responded: number;
  responseRate: number | null;
};

export type InquiryDay = {
  date: string;
  count: number;
  responded: number;
};

export type InquirySummary = {
  total: number;
  responded: number;
  unanswered: number;
  responseRate: number | null;
  byDepartment: DepartmentInquiry[];
  byType: { type: string; count: number }[];
  daily: InquiryDay[];
  busiestDay: InquiryDay | null;
  topDepartment: DepartmentInquiry | null;
};

export type EventCount = { eventType: string; count: number };
export type StatusCount = { listingStatus: string; count: number };

export type ListingSummary = {
  totalEvents: number;
  views: number;
  inquiries: number;
  saves: number;
  shares: number;
  contactReveals: number;
  byEvent: EventCount[];
  byStatus: StatusCount[];
  daily: { date: string; count: number }[];
  topEvent: EventCount | null;
};

export type StockItem = {
  sku: string;
  title: string;
  stock: number;
  timesOrdered: number;
};

export type InventorySummary = {
  total: number;
  published: number;
  draft: number;
  lowStock: number;
  outOfStock: number;
  inStock: number;
  orderedProducts: number;
  publishedShare: number | null;
  catalogueValue: { currency: string; valueMinor: number }[];
  lowStockItems: StockItem[];
  topOrdered: StockItem[];
  byAvailability: { availability: string; count: number }[];
};

function percent(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

function sortIsoDates(dates: Iterable<string>): string[] {
  return [...dates].sort((a, b) => a.localeCompare(b));
}

/** Sales totals split by currency, with a daily series and the best day. */
export function summarizeSales(rows: readonly SalesRow[]): SalesSummary {
  const currencies = new Map<
    string,
    {
      paidOrders: number;
      grossMinor: number;
      orderedMinor: number;
      days: Map<string, SalesDay>;
    }
  >();

  let totalPaidOrders = 0;
  for (const row of rows) {
    if (!row.saleDate) continue;
    const bucket = currencies.get(row.currency) ?? {
      paidOrders: 0,
      grossMinor: 0,
      orderedMinor: 0,
      days: new Map<string, SalesDay>(),
    };
    bucket.paidOrders += row.paidOrderCount;
    bucket.grossMinor += row.grossMinor;
    bucket.orderedMinor += row.orderedMinor;
    const day = bucket.days.get(row.saleDate) ?? {
      date: row.saleDate,
      grossMinor: 0,
      paidOrders: 0,
    };
    day.grossMinor += row.grossMinor;
    day.paidOrders += row.paidOrderCount;
    bucket.days.set(row.saleDate, day);
    currencies.set(row.currency, bucket);
    totalPaidOrders += row.paidOrderCount;
  }

  const summarized = [...currencies.entries()]
    .map(([currency, bucket]): CurrencySales => {
      const days = sortIsoDates(bucket.days.keys()).map(
        (date) => bucket.days.get(date)!,
      );
      return {
        currency,
        paidOrders: bucket.paidOrders,
        grossMinor: bucket.grossMinor,
        orderedMinor: bucket.orderedMinor,
        averageOrderMinor:
          bucket.paidOrders > 0
            ? Math.round(bucket.grossMinor / bucket.paidOrders)
            : null,
        days,
        bestDay: days.reduce<SalesDay | null>(
          (best, day) =>
            !best || day.grossMinor > best.grossMinor ? day : best,
          null,
        ),
        latestDate: days.length > 0 ? days[days.length - 1]!.date : null,
      };
    })
    .sort((a, b) => b.grossMinor - a.grossMinor);

  return {
    currencies: summarized,
    totalPaidOrders,
    latestSaleDate:
      summarized
        .map((entry) => entry.latestDate)
        .filter((value): value is string => value !== null)
        .sort((a, b) => b.localeCompare(a))[0] ?? null,
  };
}

/**
 * Compare the average of the most recent recorded days with the preceding days.
 *
 * The series is sparse (a day with no sale has no row), so this compares
 * recorded days rather than calendar weeks. It is a direction, not a forecast.
 */
export function salesMomentum(
  days: readonly SalesDay[],
  window = 3,
): SalesMomentum | null {
  if (window < 1 || days.length <= window) return null;
  const recent = days.slice(-window);
  const prior = days.slice(-window * 2, -window);
  if (prior.length === 0) return null;
  const average = (values: readonly SalesDay[]) =>
    values.reduce((sum, day) => sum + day.grossMinor, 0) / values.length;
  const recentAverageMinor = average(recent);
  const priorAverageMinor = average(prior);
  return {
    recentAverageMinor,
    priorAverageMinor,
    changePct:
      priorAverageMinor > 0
        ? Math.round(
            ((recentAverageMinor - priorAverageMinor) / priorAverageMinor) *
              1000,
          ) / 10
        : null,
  };
}

/** Order counts and value by status, keeping currencies separate. */
export function summarizePipeline(
  rows: readonly PipelineRow[],
): PipelineSummary {
  const statusMap = new Map<
    string,
    { orderCount: number; values: Map<string, number> }
  >();
  const pendingValues = new Map<string, number>();
  let totalOrders = 0;
  let pendingOrders = 0;
  let activeOrders = 0;
  let completedOrders = 0;
  let cancelledOrders = 0;

  for (const row of rows) {
    const bucket = statusMap.get(row.status) ?? {
      orderCount: 0,
      values: new Map<string, number>(),
    };
    bucket.orderCount += row.orderCount;
    bucket.values.set(
      row.currency,
      (bucket.values.get(row.currency) ?? 0) + row.totalMinor,
    );
    statusMap.set(row.status, bucket);

    totalOrders += row.orderCount;
    if (row.status === "pending_payment") {
      pendingOrders += row.orderCount;
      pendingValues.set(
        row.currency,
        (pendingValues.get(row.currency) ?? 0) + row.totalMinor,
      );
    } else if (row.status === "paid" || row.status === "processing") {
      activeOrders += row.orderCount;
    } else if (row.status === "fulfilled") {
      completedOrders += row.orderCount;
    } else if (row.status === "cancelled" || row.status === "refunded") {
      cancelledOrders += row.orderCount;
    }
  }

  return {
    totalOrders,
    pendingOrders,
    activeOrders,
    completedOrders,
    cancelledOrders,
    paidShare: percent(activeOrders + completedOrders, totalOrders),
    pendingValues: [...pendingValues.entries()]
      .map(([currency, totalMinor]) => ({ currency, totalMinor }))
      .sort((a, b) => b.totalMinor - a.totalMinor),
    statuses: [...statusMap.entries()]
      .map(([status, bucket]) => ({
        status,
        orderCount: bucket.orderCount,
        values: [...bucket.values.entries()]
          .map(([currency, totalMinor]) => ({ currency, totalMinor }))
          .sort((a, b) => b.totalMinor - a.totalMinor),
      }))
      .sort((a, b) => b.orderCount - a.orderCount),
  };
}

/** Enquiry volume and response performance, by department, type and day. */
export function summarizeInquiries(
  rows: readonly InquiryRow[],
): InquirySummary {
  const departments = new Map<
    string,
    { departmentSlug: string | null; count: number; responded: number }
  >();
  const types = new Map<string, number>();
  const days = new Map<string, InquiryDay>();
  let total = 0;
  let responded = 0;

  for (const row of rows) {
    const key = row.departmentSlug ?? "__unassigned__";
    const department = departments.get(key) ?? {
      departmentSlug: row.departmentSlug,
      count: 0,
      responded: 0,
    };
    department.count += row.count;
    department.responded += row.responded;
    departments.set(key, department);

    types.set(row.inquiryType, (types.get(row.inquiryType) ?? 0) + row.count);

    if (row.inquiryDate) {
      const day = days.get(row.inquiryDate) ?? {
        date: row.inquiryDate,
        count: 0,
        responded: 0,
      };
      day.count += row.count;
      day.responded += row.responded;
      days.set(row.inquiryDate, day);
    }

    total += row.count;
    responded += row.responded;
  }

  const byDepartment = [...departments.values()]
    .map((entry) => ({
      ...entry,
      responseRate: percent(entry.responded, entry.count),
    }))
    .sort((a, b) => b.count - a.count);
  const daily = sortIsoDates(days.keys()).map((date) => days.get(date)!);

  return {
    total,
    responded,
    unanswered: total - responded,
    responseRate: percent(responded, total),
    byDepartment,
    byType: [...types.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
    daily,
    busiestDay: daily.reduce<InquiryDay | null>(
      (best, day) => (!best || day.count > best.count ? day : best),
      null,
    ),
    topDepartment: byDepartment[0] ?? null,
  };
}

/** Real estate listing activity: events by type, status and day. */
export function summarizeListingActivity(
  rows: readonly ListingActivityRow[],
): ListingSummary {
  const events = new Map<string, number>();
  const statuses = new Map<string, number>();
  const days = new Map<string, number>();
  let totalEvents = 0;

  for (const row of rows) {
    events.set(row.eventType, (events.get(row.eventType) ?? 0) + row.count);
    statuses.set(
      row.listingStatus,
      (statuses.get(row.listingStatus) ?? 0) + row.count,
    );
    if (row.activityDate) {
      days.set(row.activityDate, (days.get(row.activityDate) ?? 0) + row.count);
    }
    totalEvents += row.count;
  }

  const byEvent = [...events.entries()]
    .map(([eventType, count]) => ({ eventType, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalEvents,
    views: events.get("view") ?? 0,
    inquiries: events.get("inquiry") ?? 0,
    saves: events.get("save") ?? 0,
    shares: events.get("share") ?? 0,
    contactReveals: events.get("contact_reveal") ?? 0,
    byEvent,
    byStatus: [...statuses.entries()]
      .map(([listingStatus, count]) => ({ listingStatus, count }))
      .sort((a, b) => b.count - a.count),
    daily: sortIsoDates(days.keys()).map((date) => ({
      date,
      count: days.get(date)!,
    })),
    topEvent: byEvent[0] ?? null,
  };
}

/** Stock health, catalogue value and the products that need attention. */
export function summarizeInventory(
  rows: readonly InventoryRow[],
): InventorySummary {
  const availability = new Map<string, number>();
  const catalogueValue = new Map<string, number>();
  const items: StockItem[] = [];
  let published = 0;
  let draft = 0;
  let lowStock = 0;
  let outOfStock = 0;
  let inStock = 0;
  let orderedProducts = 0;

  for (const row of rows) {
    availability.set(
      row.availability,
      (availability.get(row.availability) ?? 0) + 1,
    );
    catalogueValue.set(
      row.currency,
      (catalogueValue.get(row.currency) ?? 0) + row.priceMinor * row.stock,
    );
    items.push({
      sku: row.sku,
      title: row.title,
      stock: row.stock,
      timesOrdered: row.timesOrdered,
    });

    if (row.publishState === "published") published += 1;
    if (row.publishState === "draft") draft += 1;
    if (row.stock <= 0) outOfStock += 1;
    else {
      inStock += 1;
      if (row.stock <= 5) lowStock += 1;
    }
    if (row.timesOrdered > 0) orderedProducts += 1;
  }

  return {
    total: rows.length,
    published,
    draft,
    lowStock,
    outOfStock,
    inStock,
    orderedProducts,
    publishedShare: percent(published, rows.length),
    catalogueValue: [...catalogueValue.entries()]
      .map(([currency, valueMinor]) => ({ currency, valueMinor }))
      .sort((a, b) => b.valueMinor - a.valueMinor),
    lowStockItems: items
      .filter((item) => item.stock > 0 && item.stock <= 5)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 8),
    topOrdered: items
      .filter((item) => item.timesOrdered > 0)
      .sort((a, b) => b.timesOrdered - a.timesOrdered)
      .slice(0, 5),
    byAvailability: [...availability.entries()]
      .map(([key, count]) => ({ availability: key, count }))
      .sort((a, b) => b.count - a.count),
  };
}
