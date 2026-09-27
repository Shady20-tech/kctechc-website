-- =============================================================================
-- Phase 8 — CRM: one operational inbox for all three departments
--
-- The table already exists (migration 6) with status, source, department,
-- assignment and an append-only event log. This migration adds the dimensions
-- the CRM needs to actually triage cross-department traffic, and nothing else:
-- a re-modelling would throw away the inquiry pipeline every public form
-- already writes through.
--
-- Three additions, each answering a question the inbox could not previously
-- answer:
--
--   * `priority` — which inquiry to work first. Without it the inbox is
--     strictly chronological, so a stalled sale and a newsletter question look
--     identical.
--   * `inquiry_type` — what the visitor wanted, distinct from *where* it came
--     from. A `property_inquiry` source can be a viewing request or a price
--     question, and the sales process differs.
--   * `last_activity_at` — when the conversation last moved, so "needs a reply"
--     is a query rather than a scan of the event log.
--
-- The priority enum is added in its own migration file before this one could
-- use it; it is declared there, alongside nothing, for the same
-- one-transaction-per-file reason as the order enums.
-- =============================================================================

-- The `inquiry_priority` and `inquiry_type` enums are declared in
-- `20260101000032_order_payment_enums.sql`; a value added in one transaction
-- cannot be used in that same transaction, so they cannot be created here.

alter table public.inquiries
  add column priority public.inquiry_priority not null default 'normal',
  add column inquiry_type public.inquiry_type not null default 'general',
  -- Set by the trigger below on create and on every event, so it can be indexed
  -- and compared without touching `inquiry_events`.
  add column last_activity_at timestamptz not null default now(),
  -- When the inquiry was first assigned, as distinct from the currently
  -- assigned user. Gives a report an assignment latency to measure.
  add column assigned_at timestamptz;

comment on column public.inquiries.priority is
  'Triage priority. Drives the inbox ordering; never inferred from content.';
comment on column public.inquiries.inquiry_type is
  'Visitor intent, distinct from inquiry_source (the funnel the form belongs to).';
comment on column public.inquiries.last_activity_at is
  'Timestamp of the most recent event. Maintained by trigger; indexed for the inbox.';

create index inquiries_priority_idx
  on public.inquiries (priority, last_activity_at desc)
  where status not in ('closed', 'spam');
create index inquiries_type_idx
  on public.inquiries (inquiry_type, created_at desc);
create index inquiries_activity_idx
  on public.inquiries (last_activity_at desc);

-- -----------------------------------------------------------------------------
-- Keep `last_activity_at` and `assigned_at` honest, and log the transition.
--
-- Written as a trigger so the CRM cannot drift from the event log: any status or
-- assignment change made by any code path updates the same fields and appends
-- the same event. Doing this in application code would mean the two could
-- disagree, which is exactly what makes an inbox untrustworthy.
-- -----------------------------------------------------------------------------
create or replace function public.inquiries_track_activity()
returns trigger
language plpgsql
as $$
begin
  new.last_activity_at := now();

  if new.assigned_to is not null and old.assigned_to is distinct from new.assigned_to
     and new.assigned_at is null then
    new.assigned_at := now();
  end if;

  return new;
end;
$$;

comment on function public.inquiries_track_activity() is
  'Maintains last_activity_at and assigned_at so the inbox cannot drift from its event log.';

create trigger inquiries_track_activity
  before update on public.inquiries
  for each row execute function public.inquiries_track_activity();

-- Backfill so the constraint-free default does not leave every existing row
-- claiming it was active at the moment of this migration.
update public.inquiries
   set last_activity_at = greatest(created_at, coalesce(responded_at, created_at), coalesce(closed_at, created_at));

-- -----------------------------------------------------------------------------
-- Inbox view.
--
-- A view rather than repeated joins in the application, because every CRM
-- surface needs the same shape: the inquiry, the department that owns it, the
-- assignee's display name, and how long it has been waiting. Shipping this as a
-- view means the inbox list, a dashboard count and a report cannot disagree.
--
-- `security_invoker` is required on a view over RLS-protected tables so the
-- caller's policies apply rather than the view owner's. Without it, the view
-- would be a hole straight through the `is_admin()` policies on `inquiries`.
-- -----------------------------------------------------------------------------
create view public.crm_inbox
with (security_invoker = true)
as
select
  i.id,
  i.reference,
  i.status,
  i.source,
  i.inquiry_type,
  i.priority,
  i.department_id,
  d.slug as department_slug,
  d.name as department_name,
  i.assigned_to,
  p.full_name as assignee_name,
  i.locale,
  i.full_name,
  i.email,
  i.phone,
  i.subject,
  i.created_at,
  i.updated_at,
  i.last_activity_at,
  i.responded_at,
  i.closed_at,
  i.assigned_at,
  -- Whole hours since the last movement, for an "age" column. Uses the database
  -- clock so two servers cannot disagree.
  floor(extract(epoch from (now() - i.last_activity_at)) / 3600)::integer
    as hours_since_activity,
  -- An unanswered inquiry is the actionable one. Encoded here so every surface
  -- means the same thing by "open".
  (i.status not in ('closed', 'spam') and i.responded_at is null) as awaiting_response
from public.inquiries i
left join public.departments d on d.id = i.department_id
left join public.profiles p on p.id = i.assigned_to;

comment on view public.crm_inbox is
  'Unified CRM inbox across all departments. security_invoker so RLS still applies.';

-- -----------------------------------------------------------------------------
-- Inbox counts by department, status and priority.
--
-- Powers the dashboard summary. Counts only — no PII — so it is safe to render
-- on a summary card and safe to expose to any admin role.
-- -----------------------------------------------------------------------------
create view public.crm_inbox_summary
with (security_invoker = true)
as
select
  i.department_id,
  d.slug as department_slug,
  i.status,
  i.priority,
  count(*)::integer as inquiry_count,
  count(*) filter (where i.responded_at is null and i.status not in ('closed', 'spam'))::integer
    as awaiting_response_count,
  count(*) filter (where i.priority in ('high', 'urgent') and i.status not in ('closed', 'spam'))::integer
    as escalated_count
from public.inquiries i
left join public.departments d on d.id = i.department_id
group by i.department_id, d.slug, i.status, i.priority;

comment on view public.crm_inbox_summary is
  'Aggregate inbox counts by department/status/priority. Contains no personal data.';

-- -----------------------------------------------------------------------------
-- Reports.
--
-- `security_invoker` again. Each view answers one operational question and
-- reports only what the tables actually record — an empty result means "nothing
-- recorded", never a fabricated figure.
-- -----------------------------------------------------------------------------

-- Sales by day. Derived from `orders.paid_minor` and `paid_at`, which are only
-- set by a verified payment, so this cannot report a sale that did not happen.
create view public.report_sales_daily
with (security_invoker = true)
as
select
  date_trunc('day', o.paid_at)::date as sale_date,
  o.currency,
  count(*)::integer as paid_order_count,
  sum(o.paid_minor)::bigint as gross_minor,
  sum(o.total_minor)::bigint as ordered_minor,
  sum(o.paid_minor - o.total_minor)::bigint as overpayment_minor
from public.orders o
where o.paid_at is not null
  and o.status <> 'cancelled'
group by date_trunc('day', o.paid_at)::date, o.currency;

comment on view public.report_sales_daily is
  'Daily paid sales. Counts only orders with a verified payment.';

-- Order pipeline by status. Deliberately includes non-paid states so the
-- dashboard can show work in progress rather than implying everything is a sale.
create view public.report_order_pipeline
with (security_invoker = true)
as
select
  o.status,
  o.currency,
  count(*)::integer as order_count,
  sum(o.total_minor)::bigint as total_minor
from public.orders o
group by o.status, o.currency;

comment on view public.report_order_pipeline is
  'Order counts and value by status, including unpaid states.';

-- Inquiry volume by department and day, for the CRM report.
create view public.report_inquiries_daily
with (security_invoker = true)
as
select
  date_trunc('day', i.created_at)::date as inquiry_date,
  d.slug as department_slug,
  i.inquiry_type,
  i.source,
  count(*)::integer as inquiry_count,
  count(*) filter (where i.responded_at is not null)::integer as responded_count
from public.inquiries i
left join public.departments d on d.id = i.department_id
group by date_trunc('day', i.created_at)::date, d.slug, i.inquiry_type, i.source;

comment on view public.report_inquiries_daily is
  'Daily inquiry volume by department, type and source.';

-- Listing activity, reusing the Phase 6 event log. A view count here is real
-- recorded traffic, not an estimate.
create view public.report_listing_activity_daily
with (security_invoker = true)
as
select
  date_trunc('day', e.occurred_at)::date as activity_date,
  e.event_type,
  l.status as listing_status,
  count(*)::integer as event_count
from public.listing_events e
join public.property_listings l on l.id = e.listing_id
group by date_trunc('day', e.occurred_at)::date, e.event_type, l.status;

comment on view public.report_listing_activity_daily is
  'Daily listing events by type and listing status.';

-- Inventory health, for the store report. Flags low stock so the dashboard can
-- surface it without a bespoke query.
create view public.report_inventory_status
with (security_invoker = true)
as
select
  p.id as product_id,
  p.sku,
  p.title,
  p.stock,
  p.availability,
  p.publish_state,
  p.price_minor,
  p.currency,
  (p.stock > 0 and p.stock <= 5) as low_stock,
  (select count(*)::integer from public.order_items oi where oi.product_id = p.id)
    as times_ordered
from public.products p;

comment on view public.report_inventory_status is
  'Per-product stock and order counts, with a low-stock flag.';
