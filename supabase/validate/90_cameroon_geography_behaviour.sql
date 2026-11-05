-- =============================================================================
-- Behavioural validation of the seeded Cameroon geography.
--
-- The defect this guards against
-- ----------------------------
-- `20260101000004_geography.sql` seeds only the ten Regions, because the business
-- brief supplies only those: divisions and subdivisions were to arrive "from a
-- vetted administrative dataset via a validated import path, never guessed". The
-- dataset was never applied, so on every deployment the `divisions` and
-- `subdivisions` tables were empty and the real-estate filter's two lower
-- selectors were permanently disabled — there was nothing to choose.
--
-- `20260101000055_cameroon_divisions_and_subdivisions.sql` applies the vetted
-- dataset as schema data. This file runs on migrations alone (the harness never
-- applies `seed.sql`), so it fails if that migration ever stops seeding the full
-- hierarchy — for instance if the Region rows it joins against are removed from
-- it, since migrations run before `seed.sql`.
--
-- The assertions identify the seeded rows by the dataset's own code format
-- (`CM008001`) rather than by a bare table count, because
-- `20_real_estate_platform_behaviour.sql` adds its own geography fixtures earlier
-- in the run. A bare count would be coupled to those fixtures; a count of the
-- dataset's codes is not.
-- =============================================================================

do $$
declare
  v_count integer;
begin
  -- ---------------------------------------------------------------------------
  -- 1. The ten regions exist after migrations alone.
  -- ---------------------------------------------------------------------------
  select count(*) into v_count from public.regions;
  if v_count <> 10 then
    raise exception 'VALIDATION FAIL: expected 10 regions, found %', v_count;
  end if;

  select count(*) into v_count
    from public.regions
   where code in ('AD','CE','ES','EN','LT','NO','NW','OU','SU','SW');
  if v_count <> 10 then
    raise exception 'VALIDATION FAIL: expected the 10 brief region codes, found %', v_count;
  end if;

  -- The dataset spells two regions `North-West` / `South-West`; the brief and
  -- `HOME_REGION_SLUG` use `northwest` / `southwest`. The migration must not have
  -- overwritten them, or a fresh database would serve different region URLs than
  -- production.
  select count(*) into v_count
    from public.regions
   where slug in ('northwest', 'southwest');
  if v_count <> 2 then
    raise exception 'VALIDATION FAIL: expected the brief region slugs northwest/southwest, found %', v_count;
  end if;
  raise notice 'PASS  ten regions present with the brief slugs';

  -- ---------------------------------------------------------------------------
  -- 2. All 58 divisions are seeded, identified by the dataset code format.
  -- ---------------------------------------------------------------------------
  select count(*) into v_count
    from public.divisions
   where code ~ '^CM0[0-9]{2}[0-9]{3}$';
  if v_count <> 58 then
    raise exception 'VALIDATION FAIL: expected 58 seeded divisions, found %', v_count;
  end if;
  raise notice 'PASS  58 divisions seeded';

  -- ---------------------------------------------------------------------------
  -- 3. All 360 subdivisions are seeded.
  -- ---------------------------------------------------------------------------
  select count(*) into v_count
    from public.subdivisions
   where code ~ '^CM0[0-9]{2}[0-9]{3}[0-9]{3}$';
  if v_count <> 360 then
    raise exception 'VALIDATION FAIL: expected 360 seeded subdivisions, found %', v_count;
  end if;
  raise notice 'PASS  360 subdivisions seeded';

  -- ---------------------------------------------------------------------------
  -- 4. The hierarchy is intact: every seeded division belongs to a region and
  --    every seeded subdivision belongs to the same region as its division. The
  --    composite FK from migration 16 makes the second part unrepresentable, but
  --    asserting it here is what proves the seed wrote the column at all —
  --    `subdivisions.region_id` is NOT NULL, and an insert that omitted it would
  --    have failed rather than silently stored null.
  -- ---------------------------------------------------------------------------
  select count(*) into v_count
    from public.divisions d
    left join public.regions r on r.id = d.region_id
   where d.code ~ '^CM0[0-9]{2}[0-9]{3}$'
     and r.id is null;
  if v_count <> 0 then
    raise exception 'VALIDATION FAIL: % seeded divisions have no region', v_count;
  end if;

  select count(*) into v_count
    from public.subdivisions s
    join public.divisions d on d.id = s.division_id
   where s.code ~ '^CM0[0-9]{2}[0-9]{3}[0-9]{3}$'
     and s.region_id <> d.region_id;
  if v_count <> 0 then
    raise exception 'VALIDATION FAIL: % seeded subdivisions disagree with their division''s region', v_count;
  end if;
  raise notice 'PASS  the seeded hierarchy is internally consistent';

  -- ---------------------------------------------------------------------------
  -- 5. The seeded rows are reachable with the anonymous key the public filter
  --    uses. Without this the selectors stay empty for a visitor even though the
  --    rows exist.
  -- ---------------------------------------------------------------------------
  set local role anon;
  select count(*) into v_count
    from public.divisions
   where code ~ '^CM0[0-9]{2}[0-9]{3}$';
  if v_count <> 58 then
    raise exception 'VALIDATION FAIL: anon sees % seeded divisions, expected 58', v_count;
  end if;
  select count(*) into v_count
    from public.subdivisions
   where code ~ '^CM0[0-9]{2}[0-9]{3}[0-9]{3}$';
  if v_count <> 360 then
    raise exception 'VALIDATION FAIL: anon sees % seeded subdivisions, expected 360', v_count;
  end if;
  reset role;
  raise notice 'PASS  the seeded geography is anon-visible';

  -- ---------------------------------------------------------------------------
  -- 6. A filtering chain a visitor would actually build returns something. The
  --    counts above prove the rows exist; this proves the cascade resolves them —
  --    Littoral → Wouri → Douala 1er — which is the path the filter's slug
  --    lookups take. It deliberately does not assert a listing count: the seed
  --    contains no listings, and this file is about the geography.
  -- ---------------------------------------------------------------------------
  select count(*) into v_count
    from public.divisions d
    join public.regions r on r.id = d.region_id
   where r.code = 'LT' and d.slug = 'wouri';
  if v_count <> 1 then
    raise exception 'VALIDATION FAIL: expected Littoral/Wouri to resolve, found %', v_count;
  end if;

  select count(*) into v_count
    from public.subdivisions s
    join public.divisions d on d.id = s.division_id
   where d.slug = 'wouri' and s.slug = 'douala-1er';
  if v_count <> 1 then
    raise exception 'VALIDATION FAIL: expected Wouri/Douala 1er to resolve, found %', v_count;
  end if;
  raise notice 'PASS  the Littoral/Wouri/Douala 1er cascade resolves';
end
$$;
