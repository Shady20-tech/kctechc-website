-- =============================================================================
-- Remove the development demo accounts.
--
-- A set of demo accounts (one per role, all sharing the password `DemoPass!2026`)
-- was provisioned for local demonstration and lived only in a throwaway script,
-- never in a migration. The script has been deleted, but a database that ran it
-- still holds the rows, so deleting the script alone leaves nine live
-- known-credential logins — one of them a super admin — on any environment the
-- script was ever applied to.
--
-- This migration is the cleanup half of that removal: it deletes the accounts by
-- their reserved demo domain so a seeded database is brought back to a
-- no-demo-accounts state. It is deliberately scoped to `@demo.kctechc.test`
-- rather than to "any user whose password is known", and it is idempotent — on a
-- database that never ran the seed it matches nothing and does nothing.
--
-- Deleting from `auth.users` cascades to `public.profiles` (the FK is
-- `on delete cascade`) and to the customer-owned tables that cascade from it.
-- `auth.identities` is deleted first because its FK to `auth.users` is not
-- declared cascade in every Supabase version.
--
-- Do not reintroduce demo accounts: a committed seed with a known password is a
-- credential in version control, and the rows it creates are a live
-- known-credential wherever they are applied.
-- =============================================================================

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'auth' and table_name = 'identities'
  ) then
    delete from auth.identities
    where user_id in (
      select id from auth.users where email like '%@demo.kctechc.test'
    );
  end if;
end
$$;

delete from auth.users where email like '%@demo.kctechc.test';
