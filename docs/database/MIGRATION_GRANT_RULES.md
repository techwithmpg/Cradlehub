# CradleHub — Migration Grant Rules

> **Mandatory for all future migrations that create public schema tables.**

---

## Why This Matters

Supabase announced (effective May 30 2026 for new projects, Oct 30 2026 for existing) that tables
in the `public` schema are **no longer automatically exposed** to the Data API (PostgREST) or
GraphQL API. Every new table must have explicit `GRANT` statements.

**RLS is not a replacement for GRANT.** Both layers are required:
- `GRANT` — decides whether a role can access the table at all
- `RLS policies` — decide which rows that role can see or write

---

## Mandatory Migration Template

Every migration that creates a new `public` table must include all four elements:

```sql
-- 1. Create the table
create table if not exists public.example_table (
  id         uuid primary key default gen_random_uuid(),
  branch_id  uuid not null references public.branches(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Explicit grants (choose the appropriate pattern below)
grant select, insert, update, delete
  on table public.example_table
  to authenticated;
grant select, insert, update, delete
  on table public.example_table
  to service_role;

-- 3. Enable RLS
alter table public.example_table enable row level security;

-- 4. At least one RLS policy per required role/action
create policy "example: branch members can read"
  on public.example_table
  for select
  to authenticated
  using (
    branch_id = public.get_auth_branch_id()
    or public.get_auth_role() = 'owner'
  );
```

---

## Grant Patterns by Table Type

### Public / Customer-Facing Tables
Tables read by unauthenticated visitors (public booking, marketing site):

```sql
grant select                         on table public.TABLE to anon;
grant select, insert, update, delete on table public.TABLE to authenticated;
grant select, insert, update, delete on table public.TABLE to service_role;
```

Current public tables: `branches`, `services`, `service_categories`, `branch_services`,
`public_site_sections`, `public_site_assets`.

**Only add `anon` if the table is truly needed by the public site.** Check whether public
reads happen via `createClient()` (needs anon grant) or `createAdminClient()` (no anon grant
needed — service_role bypasses RLS).

### Authenticated Workspace Tables
Tables used by logged-in staff via `createClient()`:

```sql
grant select, insert, update, delete on table public.TABLE to authenticated;
grant select, insert, update, delete on table public.TABLE to service_role;
```

RLS policies must enforce branch/role scope on all mutations.

### Append-Only Audit Tables
Tables that should only be appended to (never updated or deleted) by app code:

```sql
grant select, insert                 on table public.TABLE to authenticated;
grant select, insert, update, delete on table public.TABLE to service_role;
```

Examples: `booking_payment_logs`, `booking_events` (events are trigger-only: SELECT only for authenticated).

### Read-Only Reference Tables
Tables that contain static reference data:

```sql
grant select                         on table public.TABLE to authenticated;
grant select, insert, update, delete on table public.TABLE to service_role;
```

Examples: `role_definitions`, `job_title_definitions`.

### Server-Only / Admin Tables
Tables only accessed via `createAdminClient()` (never via `createClient()`):

```sql
grant select, insert, update, delete on table public.TABLE to service_role;
```

Do NOT grant `anon` or `authenticated` unless there is a confirmed app need.

---

## Function Grants

For any RPC function called via `supabase.rpc()` from app code, add:

```sql
-- If called from authenticated client (logged-in staff):
grant execute on function public.my_function(arg1_type, arg2_type)
  to authenticated, service_role;

-- If called from anon client (public booking flow, unauthenticated pages):
grant execute on function public.my_function(arg1_type, arg2_type)
  to anon, authenticated, service_role;

-- If called only via createAdminClient() (service_role):
grant execute on function public.my_function(arg1_type, arg2_type)
  to service_role;
```

For functions used in RLS policy USING/WITH CHECK clauses:

```sql
-- These need EXECUTE for every role that evaluates the policy:
grant execute on function public.get_auth_role()      to anon, authenticated, service_role;
grant execute on function public.get_auth_branch_id() to anon, authenticated, service_role;
grant execute on function public.get_auth_staff_id()  to anon, authenticated, service_role;
```

---

## Rules

```
Never grant anon access unless the table is intentionally public.
Never create a public table without explicit grants.
Never create a public function without explicit execute grants if called via RPC.
RLS is not a replacement for GRANT. Both are required.
service_role bypasses RLS, but still needs a GRANT for forward compatibility.
```

---

## Checklist for Every New Table Migration

- [ ] `create table if not exists public.TABLE_NAME (...)`
- [ ] Explicit `grant` statements for the appropriate role pattern
- [ ] `alter table public.TABLE_NAME enable row level security`
- [ ] At least one RLS policy for each role/operation the table supports
- [ ] Sequence/function grants if applicable
- [ ] Migration applied and verified in Supabase SQL editor
