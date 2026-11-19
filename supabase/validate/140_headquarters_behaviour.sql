-- =============================================================================
-- Behavioural validation of region and division headquarters.
--
-- What this guards against
-- ------------------------
-- The hierarchy carried a name for every region, division and subdivision, but
-- nothing recorded where each administration actually sits. The supplied dataset
-- has the column at two of the three levels, so a selector could offer
-- "Dja-et-Lobo" with no way to say that its capital is Sangmélima.
--
-- `20260101000072_region_and_division_headquarters.sql` adds the columns and
-- backfills all 10 regions and all 58 divisions. This file proves the backfill is
-- complete, that it landed on the right rows, and that subdivisions were left
-- alone (the dataset supplies no value for them, so inventing one would be
-- fabricated geography).
-- =============================================================================

do $$
declare
  v_count integer;
  v_named integer;
begin
  -- ---------------------------------------------------------------------------
  -- 1. The columns exist.
  -- ---------------------------------------------------------------------------
  select count(*) into v_count
    from information_schema.columns
   where table_schema = 'public'
     and table_name in ('regions', 'divisions')
     and column_name = 'headquarters'
     and data_type = 'text'
     and is_nullable = 'YES';
  if v_count <> 2 then
    raise exception 'VALIDATION FAIL: expected a nullable text headquarters on regions and divisions, found %', v_count;
  end if;

  raise notice 'PASS  regions and divisions carry a nullable text headquarters';

  -- ---------------------------------------------------------------------------
  -- 2. Subdivisions did NOT gain one.
  --
  -- The dataset's subdivision rows are `subdivision_code, subdivision_name,
  -- division_code` only. A headquarters here would be a duplicate of the name or
  -- an invention.
  -- ---------------------------------------------------------------------------
  select count(*) into v_count
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'subdivisions'
     and column_name = 'headquarters';
  if v_count <> 0 then
    raise exception 'VALIDATION FAIL: subdivisions gained a headquarters column the dataset does not supply';
  end if;

  raise notice 'PASS  subdivisions have no headquarters column';

  -- ---------------------------------------------------------------------------
  -- 3. Every row is populated — 10 regions, 58 divisions.
  -- ---------------------------------------------------------------------------
  select count(*), count(headquarters) into v_count, v_named from public.regions;
  if v_count <> 10 or v_named <> 10 then
    raise exception 'VALIDATION FAIL: % of % regions have a headquarters', v_named, v_count;
  end if;

  select count(*), count(headquarters) into v_count, v_named from public.divisions;
  if v_count <> 58 or v_named <> 58 then
    raise exception 'VALIDATION FAIL: % of % divisions have a headquarters', v_named, v_count;
  end if;

  raise notice 'PASS  10/10 regions and 58/58 divisions have a headquarters';

  -- ---------------------------------------------------------------------------
  -- 4. No blank values.
  --
  -- The check constraint enforces this, so this also proves the constraint is
  -- actually attached rather than merely written in the migration.
  -- ---------------------------------------------------------------------------
  select count(*) into v_count
    from public.regions
   where headquarters is not null and btrim(headquarters) = '';
  select count(*) + v_count into v_count
    from public.divisions
   where headquarters is not null and btrim(headquarters) = '';
  if v_count <> 0 then
    raise exception 'VALIDATION FAIL: % rows carry a blank headquarters', v_count;
  end if;

  begin
    update public.regions set headquarters = '   ' where code = 'CE';
    raise exception 'VALIDATION FAIL: a blank headquarters was accepted';
  exception
    when check_violation then null;
  end;

  raise notice 'PASS  a blank headquarters is refused';

  -- ---------------------------------------------------------------------------
  -- 5. The values are on the right rows.
  --
  -- Spot-checks across all three shapes: the two regions whose code differs
  -- between the CSV and this schema (`WE`/`SO` in the CSV, `OU`/`SU` here), a
  -- division whose capital is not an exact subdivision name, and one whose
  -- capital is.
  -- ---------------------------------------------------------------------------
  if not exists (select 1 from public.regions where code = 'SW' and headquarters = 'Buea') then
    raise exception 'VALIDATION FAIL: Southwest headquarters is not Buea';
  end if;
  if not exists (select 1 from public.regions where code = 'OU' and headquarters = 'Bafoussam') then
    raise exception 'VALIDATION FAIL: West (OU) headquarters is not Bafoussam';
  end if;
  if not exists (select 1 from public.regions where code = 'SU' and headquarters = 'Ebolowa') then
    raise exception 'VALIDATION FAIL: South (SU) headquarters is not Ebolowa';
  end if;

  -- Wouri's capital is Douala, which is not the name of any subdivision of Wouri
  -- (they are `Douala 1er` .. `Douala 6e`).
  if not exists (
    select 1 from public.divisions where code = 'CM005004' and headquarters = 'Douala'
  ) then
    raise exception 'VALIDATION FAIL: Wouri headquarters is not Douala';
  end if;
  -- Meme's capital is Kumba, which IS an exact subdivision name.
  if not exists (
    select 1 from public.divisions where code = 'CM010005' and headquarters = 'Kumba'
  ) then
    raise exception 'VALIDATION FAIL: Meme headquarters is not Kumba';
  end if;

  raise notice 'PASS  headquarters are attached to the correct rows';

  -- ---------------------------------------------------------------------------
  -- 6. No headquarters is an exact duplicate of its region's name.
  --
  -- A capital is a city; a region is an administrative area. A row where the two
  -- are identical is almost certainly a mis-mapped row rather than a coincidence.
  -- ---------------------------------------------------------------------------
  select count(*) into v_count
    from public.regions
   where headquarters = name;
  if v_count <> 0 then
    raise exception 'VALIDATION FAIL: % regions have their capital equal to their own name', v_count;
  end if;

  raise notice 'PASS  no region capital duplicates the region name';
end
$$;
