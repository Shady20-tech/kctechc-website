-- =============================================================================
-- Behavioural validation: a keyword search must reach a listing's category.
--
-- Run after the migrations. This is the counterpart to
-- `src/lib/real-estate/searchable-taxonomy.test.ts`: that file asserts the shape
-- of the migration, this one asks a real database whether the behaviour is right.
--
-- The defect it pins was reported from the running site: a visitor typed "land"
-- into the marketplace search and was told "No properties match your filters",
-- while browsing listed land. `property_listings.search_vector` was generated
-- from title, description, locality and highlights only, so the three taxonomy
-- columns were in no search path at all. The listings were there and the keyword
-- could not reach them.
--
-- Every assertion is a call to `search_property_listings` as `anon`, which is the
-- caller the browser is, so a grant that regressed fails here too.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  v_region uuid;
  v_division uuid;
  v_subdivision uuid;
  v_owner uuid := gen_random_uuid();
  v_land uuid;
  v_house uuid;
  v_office uuid;
  v_draft uuid;
  v_n integer;
  v_ids uuid[];
begin
  select id into v_region from public.regions where slug = 'SW';
  select id into v_division from public.divisions where slug = 'SW-FAKO';
  select id into v_subdivision from public.subdivisions where slug = 'SW-FAKO-LIMBE';
  if v_region is null or v_division is null or v_subdivision is null then
    raise exception 'VALIDATION FAIL: the seeded geography is missing; run the migrations first';
  end if;

  insert into auth.users (id, email) values (v_owner, 'taxonomy-proof@example.test');

  -- Three published listings with deliberately *unhelpful* titles, so the only
  -- way a keyword can find them is through the taxonomy. This is the point: the
  -- reported listing was titled "Titled plot in Buea", which does not contain the
  -- word "land" anywhere.
  insert into public.property_listings (
    title, description, listing_type, property_kind, property_type,
    region_id, division_id, subdivision_id, locality, owner_id, status, slug
  ) values (
    'Residential parcel at Mile Four',
    'A serviced parcel with a surveyed boundary, ready for construction.',
    'sale', 'land', 'residential',
    v_region, v_division, v_subdivision, 'Limbe', v_owner, 'published',
    'taxonomy-proof-land'
  ) returning id into v_land;

  insert into public.property_listings (
    title, description, listing_type, property_kind, property_type,
    region_id, division_id, subdivision_id, locality, owner_id, status, slug
  ) values (
    'Four bedroom family residence',
    'A walled family residence with a garden and a covered terrace.',
    'rent', 'house', 'residential',
    v_region, v_division, v_subdivision, 'Limbe', v_owner, 'published',
    'taxonomy-proof-house'
  ) returning id into v_house;

  insert into public.property_listings (
    title, description, listing_type, property_kind, property_type,
    region_id, division_id, subdivision_id, locality, owner_id, status, slug
  ) values (
    'Second floor business premises',
    'An open plan business premises above a ground floor commercial unit.',
    'lease', 'office', 'commercial',
    v_region, v_division, v_subdivision, 'Limbe', v_owner, 'published',
    'taxonomy-proof-office'
  ) returning id into v_office;

  -- A draft of the same kind. A keyword search must never reach it: the
  -- visibility predicate is the security control and a search improvement must
  -- not widen it.
  insert into public.property_listings (
    title, description, listing_type, property_kind, property_type,
    region_id, division_id, subdivision_id, locality, owner_id, status, slug
  ) values (
    'Unpublished parcel draft',
    'A parcel that has not been reviewed, so it must stay out of search.',
    'sale', 'land', 'residential',
    v_region, v_division, v_subdivision, 'Limbe', v_owner, 'draft',
    'taxonomy-proof-draft'
  ) returning id into v_draft;

  -- ---------------------------------------------------------------------------
  -- 1. The reported case: the enum value itself, as a bare word.
  -- ---------------------------------------------------------------------------
  perform set_config('role', 'anon', true);
  select coalesce(array_agg(id), '{}'), count(*) into v_ids, v_n
  from public.search_property_listings(p_query => 'land', p_limit => 100, p_offset => 0);
  perform set_config('role', 'postgres', true);

  if not (v_land = any (v_ids)) then
    raise exception 'VALIDATION FAIL: searching "land" did not return a land listing titled "Residential parcel at Mile Four"';
  end if;
  if v_house = any (v_ids) or v_office = any (v_ids) then
    raise exception 'VALIDATION FAIL: searching "land" returned a non-land listing';
  end if;
  if v_draft = any (v_ids) then
    raise exception 'VALIDATION FAIL: searching "land" returned a DRAFT listing';
  end if;

  -- ---------------------------------------------------------------------------
  -- 2. The synonyms a visitor actually types, in both site languages.
  -- ---------------------------------------------------------------------------
  perform set_config('role', 'anon', true);
  select coalesce(array_agg(id), '{}') into v_ids
  from public.search_property_listings(p_query => 'plot', p_limit => 100, p_offset => 0);
  if not (v_land = any (v_ids)) then
    raise exception 'VALIDATION FAIL: "plot" did not return the land listing';
  end if;

  select coalesce(array_agg(id), '{}') into v_ids
  from public.search_property_listings(p_query => 'terrain', p_limit => 100, p_offset => 0);
  if not (v_land = any (v_ids)) then
    raise exception 'VALIDATION FAIL: the French "terrain" did not return the land listing';
  end if;

  select coalesce(array_agg(id), '{}') into v_ids
  from public.search_property_listings(p_query => 'parcelle', p_limit => 100, p_offset => 0);
  if not (v_land = any (v_ids)) then
    raise exception 'VALIDATION FAIL: the French "parcelle" did not return the land listing';
  end if;

  select coalesce(array_agg(id), '{}') into v_ids
  from public.search_property_listings(p_query => 'house', p_limit => 100, p_offset => 0);
  if not (v_house = any (v_ids)) then
    raise exception 'VALIDATION FAIL: "house" did not return the house listing';
  end if;

  select coalesce(array_agg(id), '{}') into v_ids
  from public.search_property_listings(p_query => 'maison', p_limit => 100, p_offset => 0);
  if not (v_house = any (v_ids)) then
    raise exception 'VALIDATION FAIL: the French "maison" did not return the house listing';
  end if;

  select coalesce(array_agg(id), '{}') into v_ids
  from public.search_property_listings(p_query => 'office', p_limit => 100, p_offset => 0);
  if not (v_office = any (v_ids)) then
    raise exception 'VALIDATION FAIL: "office" did not return the office listing';
  end if;

  -- ---------------------------------------------------------------------------
  -- 3. A listing type, which is a property of the offer, not of the building.
  -- ---------------------------------------------------------------------------
  select coalesce(array_agg(id), '{}') into v_ids
  from public.search_property_listings(p_query => 'for rent', p_limit => 100, p_offset => 0);
  if not (v_house = any (v_ids)) then
    raise exception 'VALIDATION FAIL: "for rent" did not return the rented house';
  end if;
  if v_land = any (v_ids) then
    raise exception 'VALIDATION FAIL: "for rent" returned a listing offered for sale';
  end if;

  select coalesce(array_agg(id), '{}') into v_ids
  from public.search_property_listings(p_query => 'lease', p_limit => 100, p_offset => 0);
  if not (v_office = any (v_ids)) then
    raise exception 'VALIDATION FAIL: "lease" did not return the leased office';
  end if;

  -- ---------------------------------------------------------------------------
  -- 4. A place name typed into the keyword box. "Limbe" is the locality, but
  --    "Fako" is only the division name and "Southwest" only the region name -
  --    neither is a listing column, so these were unsearchable before.
  -- ---------------------------------------------------------------------------
  select coalesce(array_agg(id), '{}') into v_ids
  from public.search_property_listings(p_query => 'Fako', p_limit => 100, p_offset => 0);
  if not (v_land = any (v_ids) and v_house = any (v_ids)) then
    raise exception 'VALIDATION FAIL: the division name "Fako" did not return its listings';
  end if;

  select coalesce(array_agg(id), '{}') into v_ids
  from public.search_property_listings(p_query => 'Southwest', p_limit => 100, p_offset => 0);
  if not (v_land = any (v_ids)) then
    raise exception 'VALIDATION FAIL: the region name "Southwest" did not return its listings';
  end if;

  select coalesce(array_agg(id), '{}') into v_ids
  from public.search_property_listings(p_query => 'Limbe', p_limit => 100, p_offset => 0);
  if not (v_land = any (v_ids)) then
    raise exception 'VALIDATION FAIL: the subdivision/locality "Limbe" did not return its listings';
  end if;

  -- ---------------------------------------------------------------------------
  -- 5. A word that is a substring of a category must not select it. Without the
  --    whole-phrase comparison, "island" would match "land".
  -- ---------------------------------------------------------------------------
  select coalesce(array_agg(id), '{}') into v_ids
  from public.search_property_listings(p_query => 'island', p_limit => 100, p_offset => 0);
  if v_land = any (v_ids) then
    raise exception 'VALIDATION FAIL: "island" matched a land listing, so the synonym match is a substring match';
  end if;

  -- ---------------------------------------------------------------------------
  -- 6. The prose search still works. The taxonomy arms are additional ORs, not a
  --    replacement for the text search.
  -- ---------------------------------------------------------------------------
  select coalesce(array_agg(id), '{}') into v_ids
  from public.search_property_listings(p_query => 'surveyed', p_limit => 100, p_offset => 0);
  if not (v_land = any (v_ids)) then
    raise exception 'VALIDATION FAIL: a word that appears only in the description no longer matches';
  end if;

  perform set_config('role', 'postgres', true);

  -- ---------------------------------------------------------------------------
  -- 7. The ranking arm. An exact category match must rank, not merely filter,
  --    or "land" sorts below every fuzzy trigram hit and reads as noise.
  -- ---------------------------------------------------------------------------
  select count(*) into v_n
  from public.search_property_listings(p_query => 'land', p_sort => 'relevance', p_limit => 100, p_offset => 0)
  where id = v_land and rank > 0;
  if v_n = 0 then
    raise exception 'VALIDATION FAIL: a synonym match ranked 0.0, so an exact category match sorts as irrelevant';
  end if;

  -- ---------------------------------------------------------------------------
  -- Cleanup. Inserting the listings fired `sync_listing_translation_index`,
  -- whose rows have no foreign key to the listing and would otherwise be
  -- stranded. Entries are deleted first so their queued jobs cascade.
  -- ---------------------------------------------------------------------------
  delete from public.translation_entries
  where entity_type = 'property_listing'
    and entity_id in (v_land, v_house, v_office, v_draft);
  delete from public.content_translations
  where entity_type = 'property_listing'
    and entity_id in (v_land, v_house, v_office, v_draft);
  delete from public.property_listings
  where id in (v_land, v_house, v_office, v_draft);
  delete from public.audit_logs where actor_id = v_owner;
  delete from public.profiles where id = v_owner;
  delete from public.real_estate_memberships where user_id = v_owner;
  delete from auth.users where id = v_owner;

  raise notice 'VALIDATION OK: keyword search reaches the taxonomy (land/plot/terrain/parcelle, house/maison, office, for rent, lease) and never a draft';
end
$$;
