import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/db/database.types";

type InquiryStatus = Database["public"]["Enums"]["inquiry_status"];
type InquiryPriority = Database["public"]["Enums"]["inquiry_priority"];
type InquiryType = Database["public"]["Enums"]["inquiry_type"];

const INQUIRY_STATUSES = [
  "new",
  "assigned",
  "in_progress",
  "responded",
  "closed",
  "spam",
] as const satisfies readonly InquiryStatus[];
const INQUIRY_PRIORITIES = ["low", "normal", "high", "urgent"] as const satisfies readonly InquiryPriority[];
const INQUIRY_TYPES = [
  "general",
  "quote",
  "property",
  "viewing",
  "service",
  "support",
] as const satisfies readonly InquiryType[];

export function isInquiryStatus(value: unknown): value is InquiryStatus {
  return typeof value === "string" && (INQUIRY_STATUSES as readonly string[]).includes(value);
}
export function isInquiryPriority(value: unknown): value is InquiryPriority {
  return typeof value === "string" && (INQUIRY_PRIORITIES as readonly string[]).includes(value);
}
export function isInquiryType(value: unknown): value is InquiryType {
  return typeof value === "string" && (INQUIRY_TYPES as readonly string[]).includes(value);
}

/**
 * CRM inbox queries.
 *
 * Everything reads the `crm_inbox` view, which is `security_invoker`, so the
 * `is_admin()` policy on `inquiries` remains the boundary. A department admin sees
 * the whole inbox rather than only their department's, because the view's purpose
 * is a single queue across departments — narrowing by role is a product decision
 * the page can layer on later without touching this module.
 */

export type CrmRow = {
  id: string;
  reference: string;
  status: string;
  source: string;
  inquiryType: string;
  priority: string;
  departmentSlug: string | null;
  departmentName: string | null;
  assignedTo: string | null;
  assigneeName: string | null;
  locale: string | null;
  fullName: string | null;
  email: string | null;
  subject: string | null;
  createdAt: string;
  lastActivityAt: string | null;
  respondedAt: string | null;
  hoursSinceActivity: number | null;
  awaitingResponse: boolean;
};

export type CrmFilters = {
  status?: InquiryStatus;
  priority?: InquiryPriority;
  department?: string;
  type?: InquiryType;
  limit?: number;
};

const SELECT =
  "id, reference, status, source, inquiry_type, priority, department_slug, department_name, assigned_to, assignee_name, locale, full_name, email, subject, created_at, last_activity_at, responded_at, hours_since_activity, awaiting_response";

export async function listCrmInbox(filters: CrmFilters = {}): Promise<CrmRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  let query = supabase
    .from("crm_inbox")
    .select(SELECT)
    .order("awaiting_response", { ascending: false })
    .order("last_activity_at", { ascending: false })
    .limit(Math.min(filters.limit ?? 100, 300));

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.priority) query = query.eq("priority", filters.priority);
  if (filters.department) query = query.eq("department_slug", filters.department);
  if (filters.type) query = query.eq("inquiry_type", filters.type);

  const { data, error } = await query;
  if (error || !data) return [];
  return data.map(mapRow);
}

export async function getCrmInquiry(id: string): Promise<{
  row: CrmRow;
  message: string | null;
  consentGiven: boolean;
  consentAt: string | null;
  phone: string | null;
  serviceId: string | null;
  locality: string | null;
  regionId: string | null;
  events: CrmEvent[];
} | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("inquiries")
    .select(
      "id, reference, status, source, inquiry_type, priority, department_id, assigned_to, locale, full_name, email, phone, subject, message, consent_given, consent_at, created_at, updated_at, last_activity_at, responded_at, closed_at, assigned_at, service_id, locality, region_id",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  const [department, assignee, events] = await Promise.all([
    data.department_id
      ? supabase
          .from("departments")
          .select("slug, name")
          .eq("id", data.department_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    data.assigned_to
      ? supabase
          .from("profiles")
          .select("full_name")
          .eq("id", data.assigned_to)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("inquiry_events")
      .select("id, event_type, note, from_status, to_status, created_at, actor_id")
      .eq("inquiry_id", id)
      .order("created_at", { ascending: true }),
  ]);

  const row: CrmRow = {
    id: data.id,
    reference: data.reference,
    status: data.status,
    source: data.source,
    inquiryType: data.inquiry_type,
    priority: data.priority,
    departmentSlug: department.data?.slug ?? null,
    departmentName: department.data?.name ?? null,
    assignedTo: data.assigned_to,
    assigneeName: assignee.data?.full_name ?? null,
    locale: data.locale,
    fullName: data.full_name,
    email: data.email,
    subject: data.subject,
    createdAt: data.created_at,
    lastActivityAt: data.last_activity_at,
    respondedAt: data.responded_at,
    hoursSinceActivity: null,
    awaitingResponse:
      data.responded_at === null && !["closed", "spam"].includes(data.status),
  };

  return {
    row,
    message: data.message,
    consentGiven: data.consent_given,
    consentAt: data.consent_at,
    phone: data.phone,
    serviceId: data.service_id,
    locality: data.locality,
    regionId: data.region_id,
    events: (events.data ?? []).map((event) => ({
      id: event.id,
      eventType: event.event_type,
      note: event.note,
      fromStatus: event.from_status,
      toStatus: event.to_status,
      createdAt: event.created_at,
      actorId: event.actor_id,
    })),
  };
}

/** Aggregate counts per department, for the summary strip. */
export async function crmSummary(): Promise<
  { departmentSlug: string | null; awaiting: number; escalated: number; total: number }[]
> {
  const supabase = await createClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("crm_inbox_summary")
    .select("department_slug, inquiry_count, awaiting_response_count, escalated_count");

  if (!data) return [];

  const byDepartment = new Map<
    string | null,
    { awaiting: number; escalated: number; total: number }
  >();
  for (const row of data) {
    const key = row.department_slug;
    const current = byDepartment.get(key) ?? { awaiting: 0, escalated: 0, total: 0 };
    current.awaiting += row.awaiting_response_count ?? 0;
    current.escalated += row.escalated_count ?? 0;
    current.total += row.inquiry_count ?? 0;
    byDepartment.set(key, current);
  }

  return [...byDepartment.entries()].map(([departmentSlug, value]) => ({
    departmentSlug,
    ...value,
  }));
}

/** Staff who can be assigned an enquiry. */
export async function listAssignees(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, is_active")
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  return (data ?? []).map((profile) => ({
    id: profile.id,
    name: profile.full_name || profile.email || profile.id,
  }));
}

export type CrmEvent = {
  id: string;
  eventType: string;
  note: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  createdAt: string;
  actorId: string | null;
};

type ViewRow = {
  id: string | null;
  reference: string | null;
  status: string | null;
  source: string | null;
  inquiry_type: string | null;
  priority: string | null;
  department_slug: string | null;
  department_name: string | null;
  assigned_to: string | null;
  assignee_name: string | null;
  locale: string | null;
  full_name: string | null;
  email: string | null;
  subject: string | null;
  created_at: string | null;
  last_activity_at: string | null;
  responded_at: string | null;
  hours_since_activity: number | null;
  awaiting_response: boolean | null;
};

function mapRow(row: ViewRow): CrmRow {
  return {
    id: row.id ?? "",
    reference: row.reference ?? "",
    status: row.status ?? "new",
    source: row.source ?? "",
    inquiryType: row.inquiry_type ?? "",
    priority: row.priority ?? "normal",
    departmentSlug: row.department_slug,
    departmentName: row.department_name,
    assignedTo: row.assigned_to,
    assigneeName: row.assignee_name,
    locale: row.locale,
    fullName: row.full_name,
    email: row.email,
    subject: row.subject,
    createdAt: row.created_at ?? "",
    lastActivityAt: row.last_activity_at,
    respondedAt: row.responded_at,
    hoursSinceActivity: row.hours_since_activity,
    awaitingResponse: row.awaiting_response ?? false,
  };
}
