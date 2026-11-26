import { describe, expect, it } from "vitest";

import {
  salesMomentum,
  summarizeInquiries,
  summarizeInventory,
  summarizeListingActivity,
  summarizePipeline,
  summarizeSales,
} from "./report-metrics";
import type {
  InquiryRow,
  InventoryRow,
  ListingActivityRow,
  PipelineRow,
  SalesRow,
} from "./reports";

const sales: SalesRow[] = [
  {
    saleDate: "2026-11-24",
    currency: "XAF",
    paidOrderCount: 2,
    grossMinor: 200_000,
    orderedMinor: 220_000,
    overpaymentMinor: 0,
  },
  {
    saleDate: "2026-11-25",
    currency: "XAF",
    paidOrderCount: 1,
    grossMinor: 150_000,
    orderedMinor: 150_000,
    overpaymentMinor: 0,
  },
  {
    saleDate: "2026-11-25",
    currency: "USD",
    paidOrderCount: 1,
    grossMinor: 30_000,
    orderedMinor: 30_000,
    overpaymentMinor: 0,
  },
];

describe("summarizeSales", () => {
  it("keeps currencies separate and averages within each currency", () => {
    const summary = summarizeSales(sales);
    expect(summary.totalPaidOrders).toBe(4);
    expect(summary.latestSaleDate).toBe("2026-11-25");
    expect(summary.currencies).toHaveLength(2);

    const xaf = summary.currencies.find((entry) => entry.currency === "XAF")!;
    expect(xaf.paidOrders).toBe(3);
    expect(xaf.grossMinor).toBe(350_000);
    expect(xaf.averageOrderMinor).toBe(116_667);
    expect(xaf.days.map((day) => day.date)).toEqual([
      "2026-11-24",
      "2026-11-25",
    ]);
    expect(xaf.bestDay?.date).toBe("2026-11-24");
  });

  it("does not fabricate an average when nothing was paid", () => {
    const summary = summarizeSales([]);
    expect(summary.currencies).toEqual([]);
    expect(summary.totalPaidOrders).toBe(0);
    expect(summary.latestSaleDate).toBeNull();
  });
});

describe("salesMomentum", () => {
  it("compares recent recorded days with the preceding window", () => {
    const days = [100, 100, 100, 200, 200, 200].map((grossMinor, index) => ({
      date: `2026-11-${String(index + 1).padStart(2, "0")}`,
      grossMinor,
      paidOrders: 1,
    }));
    const momentum = salesMomentum(days, 3);
    expect(momentum?.changePct).toBe(100);
  });

  it("returns null when there is no baseline", () => {
    expect(salesMomentum([], 3)).toBeNull();
    expect(
      salesMomentum(
        [1, 2, 3].map((grossMinor, index) => ({
          date: `2026-11-0${index + 1}`,
          grossMinor,
          paidOrders: 1,
        })),
        3,
      ),
    ).toBeNull();
  });
});

const pipeline: PipelineRow[] = [
  {
    status: "pending_payment",
    currency: "XAF",
    orderCount: 4,
    totalMinor: 400_000,
  },
  { status: "paid", currency: "XAF", orderCount: 2, totalMinor: 200_000 },
  { status: "fulfilled", currency: "XAF", orderCount: 3, totalMinor: 300_000 },
  { status: "cancelled", currency: "XAF", orderCount: 1, totalMinor: 100_000 },
];

describe("summarizePipeline", () => {
  it("separates orders needing attention from completed work", () => {
    const summary = summarizePipeline(pipeline);
    expect(summary.totalOrders).toBe(10);
    expect(summary.pendingOrders).toBe(4);
    expect(summary.activeOrders).toBe(2);
    expect(summary.completedOrders).toBe(3);
    expect(summary.cancelledOrders).toBe(1);
    expect(summary.paidShare).toBe(50);
    expect(summary.pendingValues).toEqual([
      { currency: "XAF", totalMinor: 400_000 },
    ]);
  });

  it("returns a null share when there are no orders", () => {
    const summary = summarizePipeline([]);
    expect(summary.totalOrders).toBe(0);
    expect(summary.paidShare).toBeNull();
  });
});

const inquiries: InquiryRow[] = [
  {
    inquiryDate: "2026-11-24",
    departmentSlug: "digital-marketing",
    inquiryType: "quote",
    source: "service_inquiry",
    count: 4,
    responded: 2,
  },
  {
    inquiryDate: "2026-11-25",
    departmentSlug: "digital-marketing",
    inquiryType: "contact",
    source: "contact_form",
    count: 3,
    responded: 3,
  },
  {
    inquiryDate: "2026-11-25",
    departmentSlug: null,
    inquiryType: "contact",
    source: "contact_form",
    count: 1,
    responded: 0,
  },
];

describe("summarizeInquiries", () => {
  it("computes a response rate over the whole set", () => {
    const summary = summarizeInquiries(inquiries);
    expect(summary.total).toBe(8);
    expect(summary.responded).toBe(5);
    expect(summary.unanswered).toBe(3);
    expect(summary.responseRate).toBe(62.5);
    expect(summary.topDepartment?.departmentSlug).toBe("digital-marketing");
    expect(summary.topDepartment?.responseRate).toBe(71.4);
    expect(summary.daily.map((day) => day.date)).toEqual([
      "2026-11-24",
      "2026-11-25",
    ]);
  });

  it("does not report a rate for an empty inbox", () => {
    const summary = summarizeInquiries([]);
    expect(summary.total).toBe(0);
    expect(summary.responseRate).toBeNull();
    expect(summary.topDepartment).toBeNull();
  });
});

const activity: ListingActivityRow[] = [
  {
    activityDate: "2026-11-24",
    eventType: "view",
    listingStatus: "published",
    count: 40,
  },
  {
    activityDate: "2026-11-24",
    eventType: "inquiry",
    listingStatus: "published",
    count: 4,
  },
  {
    activityDate: "2026-11-25",
    eventType: "view",
    listingStatus: "under_offer",
    count: 10,
  },
];

describe("summarizeListingActivity", () => {
  it("breaks activity down by event and status", () => {
    const summary = summarizeListingActivity(activity);
    expect(summary.totalEvents).toBe(54);
    expect(summary.views).toBe(50);
    expect(summary.inquiries).toBe(4);
    expect(summary.topEvent).toEqual({ eventType: "view", count: 50 });
    expect(summary.byStatus[0]).toEqual({
      listingStatus: "published",
      count: 44,
    });
    expect(summary.daily).toEqual([
      { date: "2026-11-24", count: 44 },
      { date: "2026-11-25", count: 10 },
    ]);
  });
});

const inventory: InventoryRow[] = [
  {
    productId: "1",
    sku: "A",
    title: "Alpha",
    stock: 0,
    availability: "out_of_stock",
    publishState: "published",
    priceMinor: 100_000,
    currency: "XAF",
    lowStock: false,
    timesOrdered: 5,
  },
  {
    productId: "2",
    sku: "B",
    title: "Beta",
    stock: 3,
    availability: "in_stock",
    publishState: "published",
    priceMinor: 50_000,
    currency: "XAF",
    lowStock: true,
    timesOrdered: 2,
  },
  {
    productId: "3",
    sku: "C",
    title: "Gamma",
    stock: 20,
    availability: "in_stock",
    publishState: "draft",
    priceMinor: 10_000,
    currency: "XAF",
    lowStock: false,
    timesOrdered: 0,
  },
];

describe("summarizeInventory", () => {
  it("reports stock health and catalogue value without inventing demand", () => {
    const summary = summarizeInventory(inventory);
    expect(summary.total).toBe(3);
    expect(summary.published).toBe(2);
    expect(summary.draft).toBe(1);
    expect(summary.outOfStock).toBe(1);
    expect(summary.lowStock).toBe(1);
    expect(summary.inStock).toBe(2);
    expect(summary.publishedShare).toBe(66.7);
    expect(summary.catalogueValue).toEqual([
      { currency: "XAF", valueMinor: 350_000 },
    ]);
    expect(summary.lowStockItems.map((item) => item.sku)).toEqual(["B"]);
    expect(summary.topOrdered.map((item) => item.sku)).toEqual(["A", "B"]);
  });

  it("returns null shares for an empty catalogue", () => {
    const summary = summarizeInventory([]);
    expect(summary.total).toBe(0);
    expect(summary.publishedShare).toBeNull();
    expect(summary.catalogueValue).toEqual([]);
  });
});
