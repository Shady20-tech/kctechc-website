-- Development demo accounts.
--
-- Dev-only. This is NOT a migration and must never become one: a migration runs on
-- production, and these rows carry a known password. It exists so the demo accounts
-- are reproducible instead of living only in a shell history.
--
-- Run against a local Supabase stack (the CLI stack listens on 127.0.0.1:54322):
--   docker exec -i supabase_db_kctechc-website psql -U postgres -d postgres \
--     < scripts/seed-demo-users.sql
--
-- Every account signs in with the password `DemoPass!2026` from
-- `/[locale]/admin/login`. The role drives the post-sign-in landing:
-- admin/staff roles reach the console, `customer` reaches the account hub.
--
-- Idempotent: an existing account keeps its password and only its role/name are
-- refreshed.

create extension if not exists pgcrypto;

create or replace function pg_temp.mk_user(
  p_email text,
  p_role public.user_role,
  p_name text,
  p_pw text
) returns uuid
language plpgsql
as $$
declare
  uid uuid;
begin
  select id into uid from auth.users where email = p_email;
  if uid is null then
    uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      p_email, crypt(p_pw, gen_salt('bf')), now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('role', p_role::text, 'full_name', p_name, 'locale', 'en'),
      '', '', '', ''
    );
    insert into auth.identities (
      id, user_id, provider_id, provider, identity_data, created_at, updated_at
    ) values (
      gen_random_uuid(), uid, uid::text, 'email',
      jsonb_build_object('sub', uid::text, 'email', p_email, 'email_verified', true),
      now(), now()
    );
  end if;

  insert into public.profiles (id, email, full_name, role, locale)
  values (uid, p_email, p_name, p_role, 'en')
  on conflict (id) do update
    set role = excluded.role,
        full_name = excluded.full_name,
        email = excluded.email;

  return uid;
end $$;

-- Customer: the end-user demo. Lands on the account hub.
select pg_temp.mk_user('customer@demo.kctechc.test', 'customer', 'Customer (demo)', 'DemoPass!2026');

-- Real estate
select pg_temp.mk_user('re.agent@demo.kctechc.test', 'real_estate_agent', 'Demo RE Agent', 'DemoPass!2026');
select pg_temp.mk_user('re.admin@demo.kctechc.test', 'real_estate_admin', 'Demo RE Admin', 'DemoPass!2026');

-- Digital marketing
select pg_temp.mk_user('dm.staff@demo.kctechc.test', 'digital_marketing_staff', 'Demo DM Staff', 'DemoPass!2026');
select pg_temp.mk_user('dm.admin@demo.kctechc.test', 'digital_marketing_admin', 'Demo DM Admin', 'DemoPass!2026');

-- Electrical services
select pg_temp.mk_user('es.staff@demo.kctechc.test', 'electrical_staff', 'Demo ES Staff', 'DemoPass!2026');
select pg_temp.mk_user('es.admin@demo.kctechc.test', 'electrical_admin', 'Demo ES Admin', 'DemoPass!2026');

-- Cross-department staff and the super admin
select pg_temp.mk_user('dept.staff@demo.kctechc.test', 'department_staff', 'Demo Department Staff', 'DemoPass!2026');
select pg_temp.mk_user('super@demo.kctechc.test', 'super_admin', 'Demo Super Admin', 'DemoPass!2026');

select email, role from public.profiles order by role, email;
