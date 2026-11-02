-- LOCAL PostgreSQL 17 test prerequisites only. These are narrow projections of
-- Supabase-managed Auth and accepted branches/device/schedule relations.
-- They do not establish authenticated Supabase TEST behavior.
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
create table public.branches (
  id uuid primary key,
  name text not null,
  address text not null,
  is_active boolean not null default true
);
alter table public.branches enable row level security;
