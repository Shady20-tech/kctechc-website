import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loaders = vi.hoisted(() => ({
  loadSalesReport: vi.fn(),
  loadPipelineReport: vi.fn(),
  loadInquiryReport: vi.fn(),
  loadListingActivityReport: vi.fn(),
  loadInventoryReport: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({
  requireAdmin: vi.fn().mockResolvedValue({
    id: "user-1",
    role: "super_admin",
    fullName: "Test Admin",
    email: "admin@example.com",
    avatarPath: null,
  }),
}));

vi.mock("@/lib/admin/reports", () => loaders);

import AdminReportsPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  loaders.loadSalesReport.mockResolvedValue([
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
  ]);
  loaders.loadPipelineReport.mockResolvedValue([
    {
      status: "pending_payment",
      currency: "XAF",
      orderCount: 3,
      totalMinor: 300_000,
    },
    {
      status: "fulfilled",
      currency: "XAF",
      orderCount: 2,
      totalMinor: 200_000,
    },
  ]);
  loaders.loadInquiryReport.mockResolvedValue([
    {
      inquiryDate: "2026-11-25",
      departmentSlug: "digital-marketing",
      inquiryType: "quote",
      source: "service_inquiry",
      count: 4,
      responded: 3,
    },
  ]);
  loaders.loadListingActivityReport.mockResolvedValue([
    {
      activityDate: "2026-11-25",
      eventType: "view",
      listingStatus: "published",
      count: 40,
    },
  ]);
  loaders.loadInventoryReport.mockResolvedValue([
    {
      productId: "product-1",
      sku: "KC-TEST-1",
      title: "Test product",
      stock: 3,
      availability: "in_stock",
      publishState: "published",
      priceMinor: 100_000,
      currency: "XAF",
      lowStock: true,
      timesOrdered: 2,
    },
  ]);
});

describe("AdminReportsPage", () => {
  it("renders the analysis sections and the supporting records", async () => {
    render(await AdminReportsPage());

    expect(screen.getByText("Confirmed revenue (XAF)")).toBeInTheDocument();
    expect(
      screen.getByText("Daily confirmed revenue — XAF"),
    ).toBeInTheDocument();
    expect(screen.getByText("What the numbers say")).toBeInTheDocument();
    expect(screen.getByText("Supporting records")).toBeInTheDocument();
    expect(screen.getAllByText("Test product").length).toBeGreaterThan(0);
    expect(screen.queryByText(/adminReports\./)).not.toBeInTheDocument();
  });

  it("keeps empty sections honest instead of drawing an empty chart", async () => {
    loaders.loadSalesReport.mockResolvedValue([]);
    loaders.loadPipelineReport.mockResolvedValue([]);
    loaders.loadInquiryReport.mockResolvedValue([]);
    loaders.loadListingActivityReport.mockResolvedValue([]);
    loaders.loadInventoryReport.mockResolvedValue([]);

    render(await AdminReportsPage());

    expect(
      screen.getAllByText("No confirmed payments have been recorded yet.")
        .length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("No products exist yet.").length,
    ).toBeGreaterThan(0);
  });
});
