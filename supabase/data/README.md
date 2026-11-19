# Cameroon administrative divisions — source data

Reference data for the Region → Division → Subdivision hierarchy used by the
real-estate location filters and the posting forms.

| File | Rows | Columns of interest |
| --- | --- | --- |
| `cameroon_regions.csv` | 10 | `region_code`, `region_name_en`, `region_name_fr`, `region_headquarters` |
| `cameroon_divisions.csv` | 58 | `division_code`, `division_name`, `division_headquarters`, `region_code` |
| `cameroon_subdivisions.csv` | 360 | `subdivision_code`, `subdivision_name`, `division_code` |

## Provenance and licence

**Source:** "Cameroon Administrative Divisions", Open Admin Data —
<https://github.com/open-admin-data/cameroon-administrative-divisions>

**Licence:** CC BY 4.0. Attribution is required. The attribution obligation is
carried in the migrations that consume this data
(`20260101000055_cameroon_divisions_and_subdivisions.sql` and
`20260101000072_region_and_division_headquarters.sql`); any future surface that
renders the hierarchy to the public must carry a visible credit.

## These files are the input, not the runtime source of truth

The database is authoritative. `supabase/migrations/` seeds and backfills from
this data; the application reads the database. Nothing at runtime parses these
CSVs. They are committed so a later correction can be re-derived and diffed
rather than retyped from memory.

## Why the codes here are not the codes in the database

These files use `CM-AD` / `CM-AD-DJE` / `CM-AD-DJE-01`. The database uses
`AD` / `CM001001` / `CM001001001`, and region codes `OU`/`SU` where these files
use `WE`/`SO` for West and South.

The database codes were not changed to match, for two reasons:

- `regions_code_format` is `^[A-Z]{2,4}$`, which rejects `CM-AD`.
- Existing rows in `property_listings`, `inquiries`, `electrical_projects`,
  `agent_profiles` and `profiles` already reference the hierarchy, and the CSV
  import path matches by code.

Mapping between the two therefore happens in the migration, by **name**, never by
position. See the gotchas in `AGENTS.md` under "Region and division
headquarters" — `update ... where code = '...'` succeeds while touching zero
rows, so a copied code fails silently.
