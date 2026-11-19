-- =============================================================================
-- Region and division headquarters (administrative capitals)
--
-- The hierarchy carried names but not the seat of each administration, so a
-- location selector could say "Dja-et-Lobo" but not that its capital is
-- Sangmélima, and nothing in the schema distinguished a region from its
-- capital. The supplied dataset has the column for both levels:
--
--   cameroon_regions.csv      region_headquarters      (10 of 10 populated)
--   cameroon_divisions.csv    division_headquarters    (58 of 58 populated)
--
-- Subdivisions are NOT given one. The dataset has no such column for them, and
-- a subdivision's seat is the subdivision itself; adding the column would invite
-- a value that is either a duplicate of `name` or an invention.
--
-- Source: "Cameroon Administrative Divisions", Open Admin Data,
-- https://github.com/open-admin-data/cameroon-administrative-divisions,
-- licensed CC BY 4.0. The ten regional capitals were additionally cross-checked
-- against the published list (Ngaoundéré, Yaoundé, Bertoua, Maroua, Douala,
-- Garoua, Bamenda, Bafoussam, Ebolowa, Buea) before being written here.
--
-- ---------------------------------------------------------------------------
-- Why headquarters is TEXT and not a foreign key
-- ---------------------------------------------------------------------------
-- It is tempting to point `headquarters_subdivision_id` at the subdivision the
-- capital sits in. That does not work with this dataset, and the reason is worth
-- recording so it is not attempted again:
--
--   * A region's capital is a CITY, not an administrative subdivision. The
--     subdivisions of Mfoundi are `Yaoundé 1er` .. `Yaoundé 7e`; none of them is
--     named `Yaoundé`. Only 1 of the 10 regional capitals (Buea) is an exact
--     subdivision name.
--   * 16 of the 58 division capitals do not match a subdivision name either
--     (`Ngaoundéré` in Vina, `Douala` in Wouri, `Bamenda` in Mezam, ...).
--
-- So a foreign key would either fail on most rows or force the capital name to
-- be rewritten to a subdivision it is not. The column is a display label for
-- "where the administration sits", stored as text, which is what the dataset
-- actually supplies.
--
-- ---------------------------------------------------------------------------
-- Why this is a separate migration from 20260101000071
-- ---------------------------------------------------------------------------
-- Migration 71 is already applied. Adding a column and backfilling it is a
-- different change from correcting names, and keeping them apart means a failure
-- here does not require re-running the name corrections.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. The columns.
--
-- Nullable: a database that has the hierarchy but not this dataset keeps working,
-- and `headquarters` is presentation data, not a constraint anything joins on.
-- -----------------------------------------------------------------------------
alter table public.regions
  add column if not exists headquarters text;

alter table public.divisions
  add column if not exists headquarters text;

comment on column public.regions.headquarters is
  'Seat of the regional administration (the regional capital), e.g. Buea for Southwest. Display text, not a foreign key: a capital is a city, while this hierarchy''s subdivisions are administrative areas.';
comment on column public.divisions.headquarters is
  'Seat of the divisional administration, e.g. Kumba for Meme. Display text, not a foreign key: 16 of the 58 capitals are not an exact subdivision name.';

-- A blank string is not a headquarters; treat it as "not stated" rather than
-- storing a value that renders as an empty cell and passes an `is not null` test.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'regions_headquarters_not_blank'
  ) then
    alter table public.regions
      add constraint regions_headquarters_not_blank
      check (headquarters is null or btrim(headquarters) <> '');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'divisions_headquarters_not_blank'
  ) then
    alter table public.divisions
      add constraint divisions_headquarters_not_blank
      check (headquarters is null or btrim(headquarters) <> '');
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 2. The ten regional capitals.
--
-- Matched on `code`, which is stable and unique. Each statement sets the value
-- unconditionally: unlike the name corrections in migration 71 there is no
-- "stale value" to guard against, because the column did not exist before this
-- migration and every row is null.
-- -----------------------------------------------------------------------------
update public.regions set headquarters = 'Ngaoundéré' where code = 'AD';  -- Adamawa
update public.regions set headquarters = 'Yaoundé' where code = 'CE';  -- Centre
update public.regions set headquarters = 'Bertoua' where code = 'ES';  -- East
update public.regions set headquarters = 'Maroua' where code = 'EN';  -- Far North
update public.regions set headquarters = 'Douala' where code = 'LT';  -- Littoral
update public.regions set headquarters = 'Garoua' where code = 'NO';  -- North
update public.regions set headquarters = 'Bamenda' where code = 'NW';  -- North-West
update public.regions set headquarters = 'Bafoussam' where code = 'OU';  -- West
update public.regions set headquarters = 'Ebolowa' where code = 'SU';  -- South
update public.regions set headquarters = 'Buea' where code = 'SW';  -- South-West

-- -----------------------------------------------------------------------------
-- 3. The 58 division capitals.
--
-- Matched on the dataset's own `code` (`CM001001`), which migration 55 seeded and
-- which is unique. The mapping was produced by matching each CSV division to the
-- stored row by folded name *within its region* — not by ordinal position, which
-- silently pairs a division with another division's capital whenever a row moves.
-- Region codes differ between the two sources (`OU`/`SU` here vs `WE`/`SO` in the
-- CSV), so the region was resolved by name for the same reason.
-- -----------------------------------------------------------------------------
update public.divisions set headquarters = 'Tibati' where code = 'CM001001';  -- Djérem
update public.divisions set headquarters = 'Tignère' where code = 'CM001002';  -- Faro-et-Déo
update public.divisions set headquarters = 'Banyo' where code = 'CM001003';  -- Mayo-Banyo
update public.divisions set headquarters = 'Meiganga' where code = 'CM001004';  -- Mbéré
update public.divisions set headquarters = 'Ngaoundéré' where code = 'CM001005';  -- Vina
update public.divisions set headquarters = 'Nanga-Eboko' where code = 'CM002001';  -- Haute-Sanaga
update public.divisions set headquarters = 'Monatélé' where code = 'CM002002';  -- Lekié
update public.divisions set headquarters = 'Bafia' where code = 'CM002003';  -- Mbam-et-Inoubou
update public.divisions set headquarters = 'Ntui' where code = 'CM002004';  -- Mbam-et-Kim
update public.divisions set headquarters = 'Mfou' where code = 'CM002005';  -- Mefou-et-Afamba
update public.divisions set headquarters = 'Ngoumou' where code = 'CM002006';  -- Mefou-et-Akono
update public.divisions set headquarters = 'Yaoundé' where code = 'CM002007';  -- Mfoundi
update public.divisions set headquarters = 'Eséka' where code = 'CM002008';  -- Nyong-et-Kellé
update public.divisions set headquarters = 'Akonolinga' where code = 'CM002009';  -- Nyong-et-Mfoumou
update public.divisions set headquarters = 'Mbalmayo' where code = 'CM002010';  -- Nyong-et-So’o
update public.divisions set headquarters = 'Yokadouma' where code = 'CM003001';  -- Boumba-et-Ngoko
update public.divisions set headquarters = 'Abong-Mbang' where code = 'CM003002';  -- Haut-Nyong
update public.divisions set headquarters = 'Batouri' where code = 'CM003003';  -- Kadey
update public.divisions set headquarters = 'Bertoua' where code = 'CM003004';  -- Lom-et-Djerem
update public.divisions set headquarters = 'Maroua' where code = 'CM004001';  -- Diamaré
update public.divisions set headquarters = 'Kousseri' where code = 'CM004002';  -- Logone-et-Chari
update public.divisions set headquarters = 'Yagoua' where code = 'CM004003';  -- Mayo-Danay
update public.divisions set headquarters = 'Kaélé' where code = 'CM004004';  -- Mayo-Kani
update public.divisions set headquarters = 'Mora' where code = 'CM004005';  -- Mayo-Sava
update public.divisions set headquarters = 'Mokolo' where code = 'CM004006';  -- Mayo-Tsanaga
update public.divisions set headquarters = 'Nkongsamba' where code = 'CM005001';  -- Moungo
update public.divisions set headquarters = 'Yabassi' where code = 'CM005002';  -- Nkam
update public.divisions set headquarters = 'Edéa' where code = 'CM005003';  -- Sanaga-Maritime
update public.divisions set headquarters = 'Douala' where code = 'CM005004';  -- Wouri
update public.divisions set headquarters = 'Garoua' where code = 'CM006001';  -- Bénoué
update public.divisions set headquarters = 'Poli' where code = 'CM006002';  -- Faro
update public.divisions set headquarters = 'Guider' where code = 'CM006003';  -- Mayo-Louti
update public.divisions set headquarters = 'Tcholliré' where code = 'CM006004';  -- Mayo-Rey
update public.divisions set headquarters = 'Fundong' where code = 'CM007001';  -- Boyo
update public.divisions set headquarters = 'Kumbo' where code = 'CM007002';  -- Bui
update public.divisions set headquarters = 'Nkambe' where code = 'CM007003';  -- Donga-Mantung
update public.divisions set headquarters = 'Wum' where code = 'CM007004';  -- Menchum
update public.divisions set headquarters = 'Bamenda' where code = 'CM007005';  -- Mezam
update public.divisions set headquarters = 'Mbengwi' where code = 'CM007006';  -- Momo
update public.divisions set headquarters = 'Ndop' where code = 'CM007007';  -- Ngo-Ketunjia
update public.divisions set headquarters = 'Mbouda' where code = 'CM008001';  -- Bamboutos
update public.divisions set headquarters = 'Bafang' where code = 'CM008002';  -- Haut-Nkam
update public.divisions set headquarters = 'Baham' where code = 'CM008003';  -- Hauts-Plateaux
update public.divisions set headquarters = 'Bandjoun' where code = 'CM008004';  -- Koung-Khi
update public.divisions set headquarters = 'Dschang' where code = 'CM008005';  -- Menoua
update public.divisions set headquarters = 'Bafoussam' where code = 'CM008006';  -- Mifi
update public.divisions set headquarters = 'Bangangté' where code = 'CM008007';  -- Ndé
update public.divisions set headquarters = 'Foumban' where code = 'CM008008';  -- Noun
update public.divisions set headquarters = 'Sangmelima' where code = 'CM009001';  -- Dja-et-Lobo
update public.divisions set headquarters = 'Ebolowa' where code = 'CM009002';  -- Mvila
update public.divisions set headquarters = 'Ambam' where code = 'CM009004';  -- Vallée-du-Ntem
update public.divisions set headquarters = 'Kribi' where code = 'CM009003';  -- Océan
update public.divisions set headquarters = 'Limbe' where code = 'CM010001';  -- Fako
update public.divisions set headquarters = 'Bangem' where code = 'CM010002';  -- Kupe-Manenguba
update public.divisions set headquarters = 'Menji' where code = 'CM010003';  -- Lebialem
update public.divisions set headquarters = 'Mamfe' where code = 'CM010004';  -- Manyu
update public.divisions set headquarters = 'Kumba' where code = 'CM010005';  -- Meme
update public.divisions set headquarters = 'Mundemba' where code = 'CM010006';  -- Ndian

-- -----------------------------------------------------------------------------
-- 4. Assertions.
--
-- The invariant is "no row this file targets is left without a headquarters".
-- It is NOT a whole-table row count, and it is NOT "exactly 10 rows exist".
--
-- A migration runs on whatever database it meets, so a total is a claim about
-- data this file does not own:
--
--   * A fresh database applies migrations before `seed.sql`, so `regions` can be
--     empty when this runs. `found 0` is then correct behaviour, not corruption,
--     and must not fail the migration.
--   * A populated database may legitimately hold a region row this dataset does
--     not describe (an operator's own entry), so 11 is not a failure either.
--
-- `count(*) filter (where ... is null)` is zero in both cases, which is the
-- property that actually matters: nothing targeted was skipped.
-- -----------------------------------------------------------------------------
do $$
declare
  v_regions integer;
  v_divisions integer;
  v_column integer;
begin
  select count(*) into v_regions
    from public.regions
   where code in ('AD', 'CE', 'ES', 'EN', 'LT', 'NO', 'NW', 'OU', 'SU', 'SW')
     and headquarters is null;
  if v_regions <> 0 then
    raise exception 'HQ FAIL: % seeded regions were left without a headquarters', v_regions;
  end if;

  select count(*) into v_divisions
    from public.divisions
   where code like 'CM%'
     and headquarters is null;
  if v_divisions <> 0 then
    raise exception 'HQ FAIL: % seeded divisions were left without a headquarters', v_divisions;
  end if;

  -- Subdivisions must NOT have gained a column: the dataset has no such value.
  select count(*) into v_column
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'subdivisions'
     and column_name = 'headquarters';
  if v_column <> 0 then
    raise exception 'HQ FAIL: subdivisions gained a headquarters column, which the dataset does not supply';
  end if;

  -- Spot-checks are guarded by existence, for the same reason: on a database
  -- whose hierarchy is not seeded yet there is no row to compare against.
  if exists (select 1 from public.regions where code = 'SW')
     and not exists (select 1 from public.regions where code = 'SW' and headquarters = 'Buea') then
    raise exception 'HQ FAIL: Southwest headquarters is not Buea';
  end if;
  if exists (select 1 from public.regions where code = 'OU')
     and not exists (select 1 from public.regions where code = 'OU' and headquarters = 'Bafoussam') then
    raise exception 'HQ FAIL: West (OU) headquarters is not Bafoussam';
  end if;
  if exists (select 1 from public.divisions where code = 'CM010005')
     and not exists (select 1 from public.divisions where code = 'CM010005' and headquarters = 'Kumba') then
    raise exception 'HQ FAIL: Meme headquarters is not Kumba';
  end if;

  select count(*) into v_regions from public.regions where headquarters is not null;
  select count(*) into v_divisions from public.divisions where headquarters is not null;

  -- An empty hierarchy is not an error (see above), but it must not be silent:
  -- the updates above matched nothing, so nothing was backfilled. Say so loudly,
  -- because the usual cause is migration 55 not having run, and a later run of 55
  -- would leave these columns null with 72 already recorded as applied.
  if v_regions = 0 and v_divisions = 0 then
    raise warning 'HQ NOTICE: regions/divisions were empty when this migration ran, so no headquarters were set. Apply 20260101000055 first, then re-run this migration.';
  end if;

  raise notice 'PASS  headquarters set on % region(s) and % division(s); no targeted row left null',
    v_regions, v_divisions;
end
$$;

commit;
