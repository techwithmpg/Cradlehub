-- Read-only catalog inventory for local-migration versus linked-live comparison.
-- This file intentionally makes no schema or data changes.

select jsonb_build_object(
  'functions', (
    select coalesce(jsonb_agg(distinct p.proname order by p.proname), '[]'::jsonb)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  ),
  'policies', (
    select coalesce(jsonb_agg(x.key order by x.key), '[]'::jsonb)
    from (
      select distinct tablename || '|' || policyname as key
      from pg_policies
      where schemaname = 'public'
    ) x
  ),
  'indexes', (
    select coalesce(jsonb_agg(distinct indexname order by indexname), '[]'::jsonb)
    from pg_indexes
    where schemaname = 'public'
  ),
  'triggers', (
    select coalesce(jsonb_agg(distinct tg.tgname order by tg.tgname), '[]'::jsonb)
    from pg_trigger tg
    join pg_class c on c.oid = tg.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and not tg.tgisinternal
  ),
  'constraints', (
    select coalesce(jsonb_agg(x.key order by x.key), '[]'::jsonb)
    from (
      select distinct c.relname || '|' || con.conname as key
      from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
    ) x
  ),
  'views', (
    select coalesce(jsonb_agg(table_name order by table_name), '[]'::jsonb)
    from information_schema.views
    where table_schema = 'public'
  ),
  'rls_disabled', (
    select coalesce(jsonb_agg(c.relname order by c.relname), '[]'::jsonb)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not c.relrowsecurity
  )
) as catalog;
