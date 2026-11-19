-- =============================================================================
-- Behavioural validation of the geography reference data and its integrity.
--
-- What this guards against
-- ------------------------
-- Location was typed by hand on several surfaces. Two failures follow from that:
--
--   1. A misspelt region ("Sud-Ouest" beside "Southwest") fragments every filter
--      and count that groups by it.
--   2. A row can name a subdivision from one division and a division from
--      another, because nothing compared the two. The card then renders a
--      location that does not exist.
--
-- `20260101000071_geography_reference_data.sql` closes both: it corrects the
-- mangled place names from the supplied dataset and makes the three levels agree
-- through composite foreign keys. This file proves the boundary on a fresh
-- database, because a constraint that exists only in a comment is not a
-- constraint.
--
-- The checks that matter are the *rejections*. Accepting a correct row proves
-- little; refusing an inconsistent one is the behaviour the UI relies on.
-- =============================================================================

do $$
declare
  v_count integer;
  v_region_id uuid;
  v_division_id uuid;
  v_subdivision_id uuid;
  v_other_region_id uuid;
  v_other_division_id uuid;
  v_department_id uuid;
  v_refused boolean;
begin
  -- ---------------------------------------------------------------------------
  -- 1. The accented names from the dataset are in place.
  --
  -- These are the corrections that were lost in migration 55. A user searching
  -- "Ngaoundéré" must find the city, not "Ngaoundere".
  -- ---------------------------------------------------------------------------
  select count(*) into v_count
    from public.subdivisions
   where name = 'Ngaoundéré 1er';
  if v_count <> 1 then
    raise exception 'VALIDATION FAIL: Ngaoundéré 1er is missing or duplicated';
  end if;

  select count(*) into v_count
    from public.subdivisions
   where name in ('Bangangté', 'Nyété', 'Eséka', 'Kaélé');
  if v_count <> 4 then
    raise exception 'VALIDATION FAIL: expected 4 accented subdivision names, found %', v_count;
  end if;

  -- A hyphenated correction, not just a diacritic one.
  select count(*) into v_count
    from public.subdivisions
   where name = 'Ekondo-Titi';
  if v_count <> 1 then
    raise exception 'VALIDATION FAIL: Ekondo-Titi was not hyphenated';
  end if;

  -- The slug must NOT have changed: a rename must not move a published URL.
  select count(*) into v_count
    from public.subdivisions
   where name = 'Ekondo-Titi' and slug = 'ekondo-titi';
  if v_count <> 1 then
    raise exception 'VALIDATION FAIL: the corrected name changed its slug';
  end if;

  raise notice 'PASS  accented place names corrected without changing slugs';

  -- ---------------------------------------------------------------------------
  -- 2. The hierarchy is still complete.
  -- ---------------------------------------------------------------------------
  select count(*) into v_count from public.regions;
  if v_count <> 10 then
    raise exception 'VALIDATION FAIL: expected 10 regions, found %', v_count;
  end if;

  select count(*) into v_count from public.divisions;
  if v_count <> 58 then
    raise exception 'VALIDATION FAIL: expected 58 divisions, found %', v_count;
  end if;

  select count(*) into v_count from public.subdivisions;
  if v_count <> 360 then
    raise exception 'VALIDATION FAIL: expected 360 subdivisions, found %', v_count;
  end if;

  raise notice 'PASS  10 regions / 58 divisions / 360 subdivisions';

  -- ---------------------------------------------------------------------------
  -- 3. The reference RPC returns the whole tree.
  --
  -- It must be callable as a browser role (the public filter needs it) and must
  -- return one row per subdivision, not one per region.
  -- ---------------------------------------------------------------------------
  select count(*) into v_count from public.geography_reference_tree();
  if v_count <> 360 then
    raise exception 'VALIDATION FAIL: geography_reference_tree returned % rows, expected 360', v_count;
  end if;

  select count(*) into v_count
    from public.geography_reference_tree()
   where region_id is null or division_id is null or subdivision_id is null;
  if v_count <> 0 then
    raise exception 'VALIDATION FAIL: % reference rows have a null level', v_count;
  end if;

  if not has_function_privilege('anon', 'public.geography_reference_tree()', 'EXECUTE') then
    raise exception 'VALIDATION FAIL: anon cannot execute geography_reference_tree (the filter would break)';
  end if;

  raise notice 'PASS  geography_reference_tree returns the full hierarchy to a browser role';

  -- ---------------------------------------------------------------------------
  -- 4. Pick a real region / division / subdivision triple to test against.
  -- ---------------------------------------------------------------------------
  select s.id, d.id, r.id
    into v_subdivision_id, v_division_id, v_region_id
    from public.subdivisions s
    join public.divisions d on d.id = s.division_id
    join public.regions r on r.id = d.region_id
   where r.code = 'CE'
   limit 1;

  if v_subdivision_id is null then
    raise exception 'VALIDATION FAIL: no Centre subdivision to test with';
  end if;

  -- A division from a DIFFERENT region, to build an inconsistent pair.
  select d.id, d.region_id
    into v_other_division_id, v_other_region_id
    from public.divisions d
   where d.region_id <> v_region_id
   limit 1;

  -- `electrical_projects.department_id` is NOT NULL, so the fixtures need one.
  select id into v_department_id from public.departments limit 1;
  if v_department_id is null then
    raise exception 'VALIDATION FAIL: no department row to attach a project fixture to';
  end if;

  -- ---------------------------------------------------------------------------
  -- 5. A mismatched (division, region) pair is refused.
  --
  -- This is the composite foreign key. Without it, a project could claim a
  -- Littoral division while sitting in the Centre region.
  -- ---------------------------------------------------------------------------
  v_refused := false;
  begin
    insert into public.electrical_projects
      (slug, department_id, title, summary, region_id, division_id, publish_state)
    values
      ('geography-check-mismatch', v_department_id, 'Geography check', 'Fixture',
       v_region_id, v_other_division_id, 'draft');
  exception
    when foreign_key_violation then v_refused := true;
  end;

  if not v_refused then
    raise exception 'VALIDATION FAIL: electrical_projects accepted a division from another region';
  end if;

  raise notice 'PASS  a division from another region is refused by electrical_projects';

  -- ---------------------------------------------------------------------------
  -- 6. A subdivision without a division is refused.
  --
  -- MATCH SIMPLE would let this through (the FK is skipped when a column is
  -- NULL), which is what `*_geography_depth` exists for.
  -- ---------------------------------------------------------------------------
  v_refused := false;
  begin
    insert into public.agent_profiles
      (display_name, slug, region_id, subdivision_id)
    values
      ('Geography Check Agent', 'geography-check-agent', v_region_id, v_subdivision_id);
  exception
    when check_violation then v_refused := true;
  end;

  if not v_refused then
    raise exception 'VALIDATION FAIL: agent_profiles accepted a subdivision with no division';
  end if;

  raise notice 'PASS  a subdivision with no division is refused by agent_profiles';

  -- ---------------------------------------------------------------------------
  -- 7. The consistent triple IS accepted, so the constraint is not simply
  --    refusing everything.
  -- ---------------------------------------------------------------------------
  insert into public.electrical_projects
    (slug, department_id, title, summary, region_id, division_id, subdivision_id, publish_state)
  values
    ('geography-check-ok', v_department_id, 'Geography check', 'Fixture',
     v_region_id, v_division_id, v_subdivision_id, 'draft');

  select count(*) into v_count
    from public.electrical_projects
   where slug = 'geography-check-ok'
     and region_id = v_region_id
     and division_id = v_division_id
     and subdivision_id = v_subdivision_id;
  if v_count <> 1 then
    raise exception 'VALIDATION FAIL: a consistent geography triple was not stored';
  end if;

  -- Clean up the fixture so the harness leaves no residue.
  delete from public.electrical_projects where slug = 'geography-check-ok';

  raise notice 'PASS  a consistent region/division/subdivision triple is accepted';

  -- ---------------------------------------------------------------------------
  -- 7b. Clearing the region clears the deeper levels.
  --
  -- This is the deletion path: `region_id` is `on delete set null`, so deleting a
  -- region nulls it. Without the trigger the row would keep a division pointing
  -- into a region that no longer exists, and the composite FK would not complain
  -- because MATCH SIMPLE skips a NULL.
  -- ---------------------------------------------------------------------------
  insert into public.electrical_projects
    (slug, department_id, title, summary, region_id, division_id, subdivision_id, publish_state)
  values
    ('geography-check-cascade', v_department_id, 'Geography check', 'Fixture',
     v_region_id, v_division_id, v_subdivision_id, 'draft');

  update public.electrical_projects
     set region_id = null
   where slug = 'geography-check-cascade';

  select count(*) into v_count
    from public.electrical_projects
   where slug = 'geography-check-cascade'
     and (division_id is not null or subdivision_id is not null);
  if v_count <> 0 then
    raise exception 'VALIDATION FAIL: clearing the region left a dangling division/subdivision';
  end if;

  delete from public.electrical_projects where slug = 'geography-check-cascade';

  raise notice 'PASS  clearing the region clears division and subdivision with it';

  -- ---------------------------------------------------------------------------
  -- 8. The four tables that gained the columns really have them, nullable.
  --
  -- Nullable is the contract: an existing row written before this migration
  -- must remain valid, and a record may be captured before the level is known.
  -- ---------------------------------------------------------------------------
  select count(*) into v_count
    from information_schema.columns
   where table_schema = 'public'
     and table_name in ('electrical_projects', 'agent_profiles', 'inquiries', 'profiles')
     and column_name in ('division_id', 'subdivision_id')
     and is_nullable = 'YES';
  if v_count <> 8 then
    raise exception 'VALIDATION FAIL: expected 8 nullable geography columns, found %', v_count;
  end if;

  raise notice 'PASS  four tables carry nullable division_id / subdivision_id';

  -- ---------------------------------------------------------------------------
  -- 9. The geography tables carry the trust caveat.
  --
  -- A place name is not evidence of land title, and the comment is what stops a
  -- future UI label from implying that it is.
  -- ---------------------------------------------------------------------------
  select count(*) into v_count
    from pg_description d
    join pg_class c on c.oid = d.objoid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in ('regions', 'divisions', 'subdivisions')
     and (
       d.description ilike '%no information about land ownership%'
       or d.description ilike '%no ownership or title implication%'
     );
  if v_count <> 3 then
    raise exception 'VALIDATION FAIL: expected the 3 geography tables to carry the title caveat, found %', v_count;
  end if;

  raise notice 'PASS  geography tables document that a place name is not proof of title';
end
$$;
