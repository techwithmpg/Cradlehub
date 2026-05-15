-- =============================================================================
-- CradleHub — Data API Grant Verification Script
-- Run in Supabase SQL Editor after applying 20260521000001_data_api_explicit_grants.sql
-- =============================================================================


-- 1. List all grants on public schema tables
--    Expected: anon on 6 public tables; authenticated on all 30; service_role on all 30
select
  table_name,
  grantee,
  privilege_type,
  is_grantable
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated', 'service_role')
order by table_name, grantee, privilege_type;


-- 2. Tables in public schema that have NO grants at all
--    Should return empty after applying the migration
select
  t.tablename
from pg_tables t
left join information_schema.role_table_grants g
  on g.table_schema = 'public'
  and g.table_name  = t.tablename
  and g.grantee     in ('anon', 'authenticated', 'service_role')
where t.schemaname = 'public'
  and g.table_name is null
order by t.tablename;


-- 3. Tables without RLS enabled
--    Should return empty — all public tables must have RLS enabled
select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and rowsecurity = false
order by tablename;


-- 4. Tables that have anon grants (verify these are intentional)
--    Expected: branches, branch_services, public_site_assets, public_site_sections,
--              service_categories, services
select distinct table_name
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee = 'anon'
order by table_name;


-- 5. Tables with anon INSERT grants (should be none for CradleHub)
--    Public booking inserts go through server actions using createAdminClient()
select table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee = 'anon'
  and privilege_type = 'INSERT'
order by table_name;


-- 6. RPC function grants (execute permissions)
select
  routine_schema,
  routine_name,
  grantee,
  privilege_type
from information_schema.role_routine_grants
where routine_schema = 'public'
  and grantee in ('anon', 'authenticated', 'service_role')
order by routine_name, grantee;


-- 7. PostgREST 42501 error scan
--    If you see errors like "permission denied for table X" in Supabase logs,
--    add the missing GRANT for that table/role combination and re-run this script.
--    Query to help diagnose: check the error hint in Supabase Dashboard > Logs > API.
