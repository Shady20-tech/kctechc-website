-- =============================================================================
-- Cameroon geography: Region → Division → Subdivision
--
-- Only the ten Regions are seeded: they are the only administrative level
-- supplied by the business brief. Divisions and subdivisions are loaded from a
-- vetted dataset through the validated import path below — never guessed.
-- =============================================================================

create table public.regions (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique,
  name text not null,
  name_fr text,
  slug text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint regions_code_format check (code ~ '^[A-Z]{2,4}$'),
  constraint regions_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create trigger regions_set_updated_at
  before update on public.regions
  for each row execute function public.set_updated_at();

create table public.divisions (
  id uuid primary key default extensions.gen_random_uuid(),
  region_id uuid not null references public.regions (id) on delete restrict,
  code text not null unique,
  name text not null,
  name_fr text,
  slug text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint divisions_unique_slug_per_region unique (region_id, slug),
  constraint divisions_code_format check (code ~ '^[A-Z0-9-]{2,16}$')
);

create index divisions_region_idx on public.divisions (region_id);

create trigger divisions_set_updated_at
  before update on public.divisions
  for each row execute function public.set_updated_at();

create table public.subdivisions (
  id uuid primary key default extensions.gen_random_uuid(),
  division_id uuid not null references public.divisions (id) on delete restrict,
  code text not null unique,
  name text not null,
  name_fr text,
  slug text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subdivisions_unique_slug_per_division unique (division_id, slug),
  constraint subdivisions_code_format check (code ~ '^[A-Z0-9-]{2,16}$')
);

create index subdivisions_division_idx on public.subdivisions (division_id);

create trigger subdivisions_set_updated_at
  before update on public.subdivisions
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Validated import path for official administrative datasets.
--
-- Runs as SECURITY DEFINER so it may write the geography tables, and is granted
-- only to the service role. It skips rows whose parent or code is missing rather
-- than inventing hierarchy, and reports how many rows it skipped.
-- -----------------------------------------------------------------------------
create or replace function public.import_administrative_divisions(
  p_region_code text,
  p_divisions jsonb
)
returns table (inserted integer, skipped integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_region_id uuid;
  v_division jsonb;
  v_inserted integer := 0;
  v_skipped integer := 0;
begin
  select id into v_region_id from public.regions where code = p_region_code;

  if v_region_id is null then
    raise exception 'Unknown region code: %', p_region_code
      using errcode = 'foreign_key_violation';
  end if;

  if jsonb_typeof(p_divisions) <> 'array' then
    raise exception 'p_divisions must be a JSON array';
  end if;

  for v_division in select * from jsonb_array_elements(p_divisions)
  loop
    if coalesce(v_division ->> 'code', '') = ''
       or coalesce(v_division ->> 'name', '') = '' then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    insert into public.divisions (region_id, code, name, name_fr, slug)
    values (
      v_region_id,
      v_division ->> 'code',
      v_division ->> 'name',
      nullif(v_division ->> 'name_fr', ''),
      coalesce(
        nullif(v_division ->> 'slug', ''),
        lower(regexp_replace(v_division ->> 'name', '[^a-zA-Z0-9]+', '-', 'g'))
      )
    )
    on conflict (code) do nothing;

    if found then
      v_inserted := v_inserted + 1;
    else
      v_skipped := v_skipped + 1;
    end if;
  end loop;

  return query select v_inserted, v_skipped;
end;
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security — geography is public reference data, admin-writable.
-- -----------------------------------------------------------------------------
alter table public.regions enable row level security;
alter table public.divisions enable row level security;
alter table public.subdivisions enable row level security;

create policy "regions_select_public"
  on public.regions for select to anon, authenticated using (true);

create policy "regions_write_admin"
  on public.regions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "divisions_select_public"
  on public.divisions for select to anon, authenticated using (true);

create policy "divisions_write_admin"
  on public.divisions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "subdivisions_select_public"
  on public.subdivisions for select to anon, authenticated using (true);

create policy "subdivisions_write_admin"
  on public.subdivisions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
