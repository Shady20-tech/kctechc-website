-- =============================================================================
-- Phase 6 — Listing Row Level Security, and the agent access boundary.
--
-- This is the migration that answers the phase's acceptance criterion: "Agents
-- cannot access another agent's private listing management data."
--
-- The trap it avoids: `is_admin()` is true for `real_estate_agent`, because an
-- agent reaches the internal admin surface. Reusing that helper here would give
-- every agent read and write access to every listing and every other agent's
-- submissions — the exact opposite of what is required. So the policies below use
-- `is_real_estate_admin()` for broad access and `current_agent_id()` for the
-- narrow, own-listings case. The distinction between "may use the admin surface"
-- and "may manage this record" is the whole point.
--
-- A note on why the public policy is `status = 'published'` and not a broader set
-- that includes `under_offer`/`sold`/`rented`: those listings ARE shown on the
-- public site, but they are shown because the loader queries them explicitly.
-- Making them anonymously readable here would also make a draft-turned-sold
-- listing readable during the moment it is not published, and the narrower
-- policy is the safer default. The loaders read with the service role for the
-- public list, and the anonymous policy exists so a direct client read cannot
-- reach anything unpublished.
-- =============================================================================

alter table public.property_listings enable row level security;
alter table public.listing_slugs enable row level security;
alter table public.listing_private_details enable row level security;
alter table public.public_listing_locations enable row level security;

-- -----------------------------------------------------------------------------
-- Public visibility.
--
-- Only a published listing is anonymously readable. This is the boundary that
-- keeps an unfinished or owner-submitted listing out of the public API, not a
-- filter in the UI — a hidden row that is still selectable is not hidden.
-- -----------------------------------------------------------------------------
create policy "property_listings_select_public"
  on public.property_listings for select
  to anon, authenticated
  using (status = 'published');

-- An agent sees their own listings in every state, which is what lets them work
-- a draft.
create policy "property_listings_select_own_agent"
  on public.property_listings for select
  to authenticated
  using (agent_id = public.current_agent_id());

-- A real-estate admin sees everything in the department.
create policy "property_listings_select_admin"
  on public.property_listings for select
  to authenticated
  using (public.is_real_estate_admin());

-- An agent may create a listing only for themselves: `with check` pins agent_id
-- to their own agent record, so an agent cannot file a listing under another
-- agent's name.
create policy "property_listings_insert_own_agent"
  on public.property_listings for insert
  to authenticated
  with check (agent_id = public.current_agent_id());

-- An agent may edit their own listing, and `with check` re-asserts ownership so
-- an update cannot hand the listing to someone else.
create policy "property_listings_update_own_agent"
  on public.property_listings for update
  to authenticated
  using (agent_id = public.current_agent_id())
  with check (agent_id = public.current_agent_id());

create policy "property_listings_write_admin"
  on public.property_listings for all
  to authenticated
  using (public.is_real_estate_admin())
  with check (public.is_real_estate_admin());

-- -----------------------------------------------------------------------------
-- Localized slugs.
--
-- Public for published listings so a localized URL resolves; an agent manages
-- their own; an admin manages all.
-- -----------------------------------------------------------------------------
create policy "listing_slugs_select_public"
  on public.listing_slugs for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.property_listings p
      where p.id = listing_id and p.status = 'published'
    )
  );

create policy "listing_slugs_write_own_agent"
  on public.listing_slugs for all
  to authenticated
  using (
    exists (
      select 1 from public.property_listings p
      where p.id = listing_id and p.agent_id = public.current_agent_id()
    )
  )
  with check (
    exists (
      select 1 from public.property_listings p
      where p.id = listing_id and p.agent_id = public.current_agent_id()
    )
  );

create policy "listing_slugs_write_admin"
  on public.listing_slugs for all
  to authenticated
  using (public.is_real_estate_admin())
  with check (public.is_real_estate_admin());

-- -----------------------------------------------------------------------------
-- PRIVATE details.
--
-- There is deliberately NO anonymous policy and no agent-wide policy. An agent
-- reaches their own listing's private row through the ownership check below;
-- nobody else can read it at all. This is the control the phase's requirement
-- about private owner information rests on: the table is unreachable to the
-- public role, so a public query cannot disclose an address or a phone number
-- even if it asks for every column.
-- -----------------------------------------------------------------------------
create policy "listing_private_details_select_own_agent"
  on public.listing_private_details for select
  to authenticated
  using (
    exists (
      select 1 from public.property_listings p
      where p.id = listing_id and p.agent_id = public.current_agent_id()
    )
  );

create policy "listing_private_details_write_own_agent"
  on public.listing_private_details for all
  to authenticated
  using (
    exists (
      select 1 from public.property_listings p
      where p.id = listing_id and p.agent_id = public.current_agent_id()
    )
  )
  with check (
    exists (
      select 1 from public.property_listings p
      where p.id = listing_id and p.agent_id = public.current_agent_id()
    )
  );

create policy "listing_private_details_write_admin"
  on public.listing_private_details for all
  to authenticated
  using (public.is_real_estate_admin())
  with check (public.is_real_estate_admin());

-- -----------------------------------------------------------------------------
-- Public locations.
--
-- Readable wherever the listing is public, which is what the map needs. The
-- points are already coarsened by `sync_public_listing_location`, so publishing
-- them discloses a neighbourhood rather than an address.
-- -----------------------------------------------------------------------------
create policy "public_listing_locations_select_public"
  on public.public_listing_locations for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.property_listings p
      where p.id = listing_id
        and p.status in ('published', 'under_offer', 'sold', 'rented')
    )
  );

create policy "public_listing_locations_write_admin"
  on public.public_listing_locations for all
  to authenticated
  using (public.is_real_estate_admin())
  with check (public.is_real_estate_admin());

-- -----------------------------------------------------------------------------
-- Inquiry scoping.
--
-- The phase requires that an agent sees only inquiries belonging to their own
-- listings. The existing `inquiries_select_admin` policy uses `is_admin()`, which
-- is TRUE for `real_estate_agent` — so as it stands an agent can read every
-- inquiry in the system, including corporate and electrical ones, and every other
-- agent's property inquiries.
--
-- Adding a narrow agent policy is NOT enough on its own, and this is the part
-- that is easy to get wrong: RLS policies are permissive and OR'd together, so a
-- new restrictive-looking policy alongside the existing broad one grants the
-- UNION of the two. The broad policy has to be replaced, not supplemented.
--
-- So `is_admin()` is not reused here. A dedicated helper names the roles that may
-- read inquiry data across the system, and `real_estate_agent` is not among them.
-- The agent reaches their own listings' inquiries through the narrow policy
-- below, which is the whole of their access.
-- -----------------------------------------------------------------------------
create or replace function public.is_inquiry_manager()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    public.current_user_role() in (
      'digital_marketing_staff',
      'digital_marketing_admin',
      'electrical_staff',
      'electrical_admin',
      'real_estate_admin',
      'department_staff',
      'super_admin'
    ),
    false
  );
$$;

comment on function public.is_inquiry_manager is
  'Roles that may read inquiry data across the system. Deliberately excludes real_estate_agent, which is scoped to its own listings.';

create or replace function public.inquiry_is_for_agent_listing(p_inquiry_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.listing_events e
    join public.property_listings p on p.id = e.listing_id
    where e.inquiry_id = p_inquiry_id
      and e.event_type = 'inquiry'
      and p.agent_id = public.current_agent_id()
  );
$$;

comment on function public.inquiry_is_for_agent_listing is
  'True when the inquiry concerns a listing owned by the current agent. The join runs through listing_events.';

-- Replace the broad policies. Dropping first is required: a policy that is not
-- dropped keeps granting access, and the union of a broad and a narrow policy is
-- the broad one.
drop policy if exists "inquiries_select_admin" on public.inquiries;
create policy "inquiries_select_manager"
  on public.inquiries for select
  to authenticated
  using (public.is_inquiry_manager());

create policy "inquiries_select_own_agent_listing"
  on public.inquiries for select
  to authenticated
  using (public.inquiry_is_for_agent_listing(id));

-- An agent must not be able to change the status of an inquiry they can merely
-- see. Updating stays with the roles that manage the pipeline.
drop policy if exists "inquiries_update_admin" on public.inquiries;
create policy "inquiries_update_manager"
  on public.inquiries for update
  to authenticated
  using (public.is_inquiry_manager())
  with check (public.is_inquiry_manager());

-- Inquiry events carry the same PII as the inquiry, so the same boundary applies.
drop policy if exists "inquiry_events_select_admin" on public.inquiry_events;
create policy "inquiry_events_select_manager"
  on public.inquiry_events for select
  to authenticated
  using (public.is_inquiry_manager());

create policy "inquiry_events_select_own_agent_listing"
  on public.inquiry_events for select
  to authenticated
  using (public.inquiry_is_for_agent_listing(inquiry_id));

drop policy if exists "inquiry_events_insert_admin" on public.inquiry_events;
create policy "inquiry_events_insert_manager"
  on public.inquiry_events for insert
  to authenticated
  with check (public.is_inquiry_manager());

-- Attachments are the most sensitive inquiry data: a visitor's photographs. An
-- agent has no business reading another agent's, or any, attachment, so this is
-- narrowed to the manager roles with no agent policy at all.
drop policy if exists "inquiry_attachments_select_admin" on public.inquiry_attachments;
create policy "inquiry_attachments_select_manager"
  on public.inquiry_attachments for select
  to authenticated
  using (public.is_inquiry_manager());

drop policy if exists "inquiry_attachments_write_admin" on public.inquiry_attachments;
create policy "inquiry_attachments_write_manager"
  on public.inquiry_attachments for all
  to authenticated
  using (public.is_inquiry_manager())
  with check (public.is_inquiry_manager());

-- Site visits are requested against an inquiry, so they follow the inquiry's
-- boundary rather than being separately readable.
drop policy if exists "appointments_select_admin" on public.appointments;
create policy "appointments_select_manager"
  on public.appointments for select
  to authenticated
  using (public.is_inquiry_manager());

drop policy if exists "appointments_write_admin" on public.appointments;
create policy "appointments_write_manager"
  on public.appointments for all
  to authenticated
  using (public.is_inquiry_manager())
  with check (public.is_inquiry_manager());

-- -----------------------------------------------------------------------------
-- Audit trail.
--
-- The trail records who did what across the whole system, including other
-- agents' listing operations. `audit_logs_select_admin` uses `is_admin()`, which
-- is true for an agent, so an agent can currently read the entire trail — which
-- would expose exactly the "another agent's private listing management data" the
-- phase forbids.
--
-- Replaced with the manager set. An agent has no audit access; a real-estate
-- admin does.
-- -----------------------------------------------------------------------------
drop policy if exists "audit_logs_select_admin" on public.audit_logs;
create policy "audit_logs_select_manager"
  on public.audit_logs for select
  to authenticated
  using (public.is_inquiry_manager());

