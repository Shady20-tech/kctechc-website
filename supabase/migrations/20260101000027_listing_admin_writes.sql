-- =============================================================================
-- Phase 6 — Writing the private details.
--
-- `listing_locations_api` and `listing_private_details_api` expose the geometry
-- as longitude and latitude for reading, but PostgREST cannot accept a geometry
-- value on a write: a REST client has no `geometry(Point,4326)` type to send. The
-- admin form and the CSV importer both collect plain decimal coordinates, so they
-- need a way to set the exact position.
--
-- `security invoker` (the default — no `security definer` here) is deliberate. The
-- RLS policies on `listing_private_details` decide who may write: an agent their
-- own listing's row, an administrator any row. A `security definer` function
-- would bypass those policies and move the access rule into this body, which is
-- exactly the arrangement the earlier phases avoid.
--
-- The coordinate range is validated here as well as in the form. The form can be
-- bypassed; the constraint on the table is the real limit, and this raises a
-- message the operator can act on rather than a raw check-constraint failure.
-- =============================================================================

create or replace function public.set_listing_private_details(
  p_listing_id uuid,
  p_longitude double precision default null,
  p_latitude double precision default null,
  p_exact_address text default null,
  p_owner_name text default null,
  p_owner_phone text default null,
  p_owner_email text default null,
  p_owner_notes text default null,
  p_internal_notes text default null
)
returns void
language plpgsql
as $$
begin
  -- Both coordinates or neither. One without the other cannot be plotted and
  -- would be stored as a position the map cannot use.
  if (p_longitude is null) <> (p_latitude is null) then
    raise exception 'Supply both coordinates, or neither'
      using errcode = 'check_violation';
  end if;

  if p_longitude is not null and (p_longitude < 8.0 or p_longitude > 17.0) then
    raise exception 'Longitude must be between 8.0 and 17.0 for Cameroon'
      using errcode = 'check_violation';
  end if;

  if p_latitude is not null and (p_latitude < 1.0 or p_latitude > 13.5) then
    raise exception 'Latitude must be between 1.0 and 13.5 for Cameroon'
      using errcode = 'check_violation';
  end if;

  update public.listing_private_details
  set exact_location = case
        when p_longitude is null then null
        else extensions.ST_SetSRID(
          extensions.ST_MakePoint(p_longitude, p_latitude),
          4326
        )
      end,
      exact_address = nullif(btrim(coalesce(p_exact_address, '')), ''),
      owner_name = nullif(btrim(coalesce(p_owner_name, '')), ''),
      owner_phone = nullif(btrim(coalesce(p_owner_phone, '')), ''),
      owner_email = nullif(btrim(coalesce(p_owner_email, '')), '')::extensions.citext,
      owner_notes = nullif(btrim(coalesce(p_owner_notes, '')), ''),
      internal_notes = nullif(btrim(coalesce(p_internal_notes, '')), '')
  where listing_id = p_listing_id;

  -- No row updated means either the listing does not exist or the caller's RLS
  -- policies do not reach it. Both are "you may not write this", and saying so is
  -- better than returning silently and letting the form report success.
  if not found then
    raise exception 'Listing % not found, or you may not edit it', p_listing_id
      using errcode = 'no_data_found';
  end if;
end;
$$;

comment on function public.set_listing_private_details is
  'Sets a listing''s exact coordinate (from plain longitude/latitude) and owner contact. security invoker, so listing_private_details RLS decides who may write.';

-- -----------------------------------------------------------------------------
-- The same for the localized slug.
--
-- `listing_slugs` is written from the admin form so a French URL segment can be
-- set alongside the canonical slug. Upserted rather than inserted, because
-- re-saving a listing must correct its French slug rather than fail on the unique
-- constraint.
-- -----------------------------------------------------------------------------
create or replace function public.set_listing_localized_slug(
  p_listing_id uuid,
  p_locale public.locale_code,
  p_slug text
)
returns void
language plpgsql
as $$
begin
  if nullif(btrim(coalesce(p_slug, '')), '') is null then
    delete from public.listing_slugs
    where listing_id = p_listing_id and locale = p_locale;
    return;
  end if;

  if p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'A slug must be lowercase words separated by hyphens'
      using errcode = 'check_violation';
  end if;

  insert into public.listing_slugs (listing_id, locale, slug)
  values (p_listing_id, p_locale, p_slug)
  on conflict (listing_id, locale) do update set slug = excluded.slug, updated_at = now();
end;
$$;

comment on function public.set_listing_localized_slug is
  'Upserts or clears a listing''s localized URL slug. security invoker, so listing_slugs RLS applies.';

-- -----------------------------------------------------------------------------
-- Reference column default.
--
-- `reference` is always generated — the admin form and the CSV importer never
-- supply one, and `enforce_listing_lifecycle` fills it when it is null. But the
-- column has no DEFAULT, so the generated TypeScript marks it as required on
-- insert, and every typed caller is forced to pass a value it must not choose.
--
-- A DEFAULT states the same fact in the schema, where the type generator can see
-- it: the reference has a value the database supplies. The trigger's null-fill
-- remains as the backstop for a caller that passes an explicit null.
-- -----------------------------------------------------------------------------
alter table public.property_listings
  alter column reference set default public.generate_listing_reference();

-- -----------------------------------------------------------------------------
-- Grants. The functions run as the caller, so the caller needs EXECUTE.
-- -----------------------------------------------------------------------------
grant execute on function public.set_listing_private_details to authenticated;
grant execute on function public.set_listing_localized_slug to authenticated;
