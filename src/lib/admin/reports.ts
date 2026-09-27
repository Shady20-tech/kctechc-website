import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Report queries.
 *
 * Each function reads one `report_*` view. Those views are `security_invoker`, so
 * the caller's policies still apply, and each reports only what the tables have
 * actually recorded — an empty array means "nothing recorded", never a zero
 * standing in for a measurement. That distinction is preserved in the return type:
 * the count and the rows are separate so the page can say "nothing yet" rather
 * than drawing an empty chart that looks like a result of zero.
 */

export type SalesRow = {
  saleDate: string;
  currency: string;
  paidOrderCount: number;
  grossMinor: number;
  orderedMinor: number;
  overpaymentMinor: number;
};

export type PipelineRow = {
  status: string;
  currency: string;
  orderCount: number;
  totalMinor: number;
};

export type InquiryRow = {
  inquiryDate: string;
  departmentSlug: string | null;
  inquiryType: string;
  source: string;
  count: number;
  responded: number;
};

export type ListingActivityRow = {
  activityDate: string;
  eventType: string;
  listingStatus: string;
  count: number;
};

export type InventoryRow = {
  productId: string;
  sku: string;
  title: string;
  stock: number;
  availability: string;
  publishState: string;
  priceMinor: number;
  currency: string;
  lowStock: boolean;
  timesOrdered: number;
};

export async function loadSalesReport(limit = 30): Promise<SalesRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("report_sales_daily")
    .select("sale_date, currency, paid_order_count, gross_minor, ordered_minor, overpayment_minor")
    .order("sale_date", { ascending: false })
    .limit(limit);
  return (data ?? []).map((row) => ({
    saleDate: row.sale_date ?? "",
    currency: row.currency ?? "XAF",
    paidOrderCount: row.paid_order_count ?? 0,
    grossMinor: Number(row.gross_minor ?? 0),
    orderedMinor: Number(row.ordered_minor ?? 0),
    overpaymentMinor: Number(row.overpayment_minor ?? 0),
  }));
}

export async function loadPipelineReport(): Promise<PipelineRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("report_order_pipeline")
    .select("status, currency, order_count, total_minor")
    .order("order_count", { ascending: false });
  return (data ?? []).map((row) => ({
    status: row.status ?? "",
    currency: row.currency ?? "XAF",
    orderCount: row.order_count ?? 0,
    totalMinor: Number(row.total_minor ?? 0),
  }));
}

export async function loadInquiryReport(limit = 30): Promise<InquiryRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("report_inquiries_daily")
    .select("inquiry_date, department_slug, inquiry_type, source, inquiry_count, responded_count")
    .order("inquiry_date", { ascending: false })
    .limit(limit);
  return (data ?? []).map((row) => ({
    inquiryDate: row.inquiry_date ?? "",
    departmentSlug: row.department_slug,
    inquiryType: row.inquiry_type ?? "",
    source: row.source ?? "",
    count: row.inquiry_count ?? 0,
    responded: row.responded_count ?? 0,
  }));
}

export async function loadListingActivityReport(limit = 30): Promise<ListingActivityRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("report_listing_activity_daily")
    .select("activity_date, event_type, listing_status, event_count")
    .order("activity_date", { ascending: false })
    .limit(limit);
  return (data ?? []).map((row) => ({
    activityDate: row.activity_date ?? "",
    eventType: row.event_type ?? "",
    listingStatus: row.listing_status ?? "",
    count: row.event_count ?? 0,
  }));
}

export async function loadInventoryReport(): Promise<InventoryRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("report_inventory_status")
    .select("product_id, sku, title, stock, availability, publish_state, price_minor, currency, low_stock, times_ordered")
    .order("title", { ascending: true });
  return (data ?? []).map((row) => ({
    productId: row.product_id ?? "",
    sku: row.sku ?? "",
    title: row.title ?? "",
    stock: row.stock ?? 0,
    availability: row.availability ?? "",
    publishState: row.publish_state ?? "",
    priceMinor: row.price_minor ?? 0,
    currency: row.currency ?? "XAF",
    lowStock: row.low_stock ?? false,
    timesOrdered: row.times_ordered ?? 0,
  }));
}
