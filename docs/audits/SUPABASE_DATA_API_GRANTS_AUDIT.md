# Supabase Data API Grants Audit

**Date:** 2026-05-15
**Trigger:** Supabase announcement — new `public` schema tables will no longer be automatically
exposed to the Data API / PostgREST. Effective May 30 2026 for new projects; Oct 30 2026 for
existing projects.
**Status:** ✅ Complete — all table grants and function execute grants applied

**Migration History:**
- `20260521000001_data_api_explicit_grants.sql` — Ran Sections 1–2 partially (up to
  `staff_service_categories`). Failed at `role_definitions` (table does not exist in live DB).
  Section 4 (function grants) never ran.
- `20260521000002_data_api_explicit_grants_fix.sql` — Completed all remaining table grants
  (including `staff_location_snapshots`) and all function execute grants.

**Functions not in live DB (excluded from grants):**
- `get_bookable_staff` — not created in live DB
- `update_home_service_tracking` — not created in live DB (superseded by `update_booking_progress`)

---

## Context

Grants and RLS are separate layers:
- **GRANT** — decides whether a PostgreSQL role (anon, authenticated, service_role) can access a
  table at all.
- **RLS policies** — decide which rows that role can see or write.

Prior to this change, Supabase auto-granted access for tables in the `public` schema. After the
change, every table must have explicit `GRANT` statements.

**Finding:** No explicit GRANT statements existed in any CradleHub migration prior to this fix.
All access relied on Supabase's automatic exposure, which will cease working for new tables.

---

## Supabase Client Role Mapping (CradleHub)

| Client | Role | Used for |
|--------|------|----------|
| `createAdminClient()` | `service_role` | Server actions that bypass RLS (bookings create, customer upsert, onboarding) |
| `createClient()` (server, authenticated session) | `authenticated` | Logged-in staff portal, manager, CRM, owner |
| `createClient()` (server, no session / public page) | `anon` | Public booking flow, public site pages |

---

## Table Audit

| Table | Data API needed? | anon grants | authenticated grants | service_role grants | RLS enabled | Policies exist | Action |
|-------|-----------------|-------------|---------------------|--------------------|-----------|----|--------|
| `branches` | Yes | SELECT | SELECT/INSERT/UPDATE/DELETE | ALL | ✅ | ✅ public_read, owner_all | GRANT added |
| `service_categories` | Yes | SELECT | SELECT/INSERT/UPDATE/DELETE | ALL | ✅ | ✅ public_read, owner_all | GRANT added |
| `services` | Yes | SELECT | SELECT/INSERT/UPDATE/DELETE | ALL | ✅ | ✅ public_read, owner_all | GRANT added |
| `branch_services` | Yes | SELECT | SELECT/INSERT/UPDATE/DELETE | ALL | ✅ | ✅ public_read, owner_all, manager | GRANT added |
| `public_site_sections` | Yes | SELECT | SELECT/INSERT/UPDATE/DELETE | ALL | ✅ | ✅ public_read (TO anon,authenticated) | GRANT added |
| `public_site_assets` | Yes | SELECT | SELECT/INSERT/UPDATE/DELETE | ALL | ✅ | ✅ public_read (TO anon,authenticated) | GRANT added |
| `staff` | Yes | None | SELECT/INSERT/UPDATE/DELETE | ALL | ✅ | ✅ read_own, manager_branch, owner_all | GRANT added |
| `staff_schedules` | Yes | None | SELECT/INSERT/UPDATE/DELETE | ALL | ✅ | ✅ staff_read_own, manager_rw, owner_all | GRANT added |
| `schedule_overrides` | Yes | None | SELECT/INSERT/UPDATE/DELETE | ALL | ✅ | ✅ staff_read_own, manager_all, owner_all | GRANT added |
| `blocked_times` | Yes | None | SELECT/INSERT/UPDATE/DELETE | ALL | ✅ | ✅ staff_read_own, manager_all, owner_all | GRANT added |
| `customers` | Yes | None | SELECT/INSERT/UPDATE/DELETE | ALL | ✅ | ✅ crm_read, manager_rw, owner_all | GRANT added |
| `bookings` | Yes | None | SELECT/INSERT/UPDATE/DELETE | ALL | ✅ | ✅ staff_own, crm_read, manager_rw, owner_all | GRANT added |
| `booking_events` | Yes | None | SELECT only | ALL | ✅ | ✅ staff_read_own, manager_branch, crm_read, owner_all | GRANT added (SELECT only for authenticated — trigger-written only) |
| `departments` | Yes | None | SELECT/INSERT/UPDATE/DELETE | ALL | ✅ | ⚠️ None — but no app direct-write; seed data only | GRANT added; policies needed if staff access via API |
| `staff_service_categories` | Yes | None | SELECT/INSERT/UPDATE/DELETE | ALL | ✅ | ⚠️ None found | GRANT added |
| `role_definitions` | ❌ N/A | — | — | — | — | — | **Does not exist in live DB** — excluded from grants |
| `job_title_definitions` | ❌ N/A | — | — | — | — | — | **Does not exist in live DB** — excluded from grants |
| `branch_resources` | Yes | None | SELECT/INSERT/UPDATE/DELETE | ALL | ✅ | ✅ owner_all, manager_all, crm_read, staff_read | GRANT added |
| `branch_booking_rules` | Yes | None | SELECT/INSERT/UPDATE/DELETE | ALL | ✅ | ✅ owner_all, manager_rw, staff_read | GRANT added |
| `daily_cash_reconciliations` | Yes | None | SELECT/INSERT/UPDATE/DELETE | ALL | ✅ | ✅ owner_all, desk_rw | GRANT added |
| `booking_payment_logs` | Yes | None | SELECT/INSERT only | ALL | ✅ | ✅ authenticated_insert/select (true) | GRANT added (no UPDATE/DELETE — append-only) |
| `waitlist_requests` | Yes | None | SELECT/INSERT/UPDATE/DELETE | ALL | ✅ | ✅ desk_rw; public insert via admin client | GRANT added (no anon — public API uses admin client) |
| `staff_onboarding_requests` | Yes | None | SELECT/INSERT/UPDATE/DELETE | ALL | ✅ | ✅ owner_all, manager_branch, own_read | GRANT added |
| `workspace_notifications` | Yes | None | SELECT/INSERT/UPDATE/DELETE | ALL | ✅ | ✅ per workspace role | GRANT added |
| `workflow_tasks` | Yes | None | SELECT/INSERT/UPDATE/DELETE | ALL | ✅ | ✅ owner_rw, manager_branch_rw, staff_own | GRANT added |
| `staff_services` | Yes | None | SELECT/INSERT/UPDATE/DELETE | ALL | ✅ | ✅ csr_read | GRANT added |
| `scheduling_rules` | Yes | None | SELECT/INSERT/UPDATE/DELETE | ALL | ✅ | ✅ managers_own_branch, owners_all | GRANT added |
| `staff_scheduling_preferences` | Yes | None | SELECT/INSERT/UPDATE/DELETE | ALL | ✅ | ✅ staff_own, manager_branch, owner_all | GRANT added |
| `schedule_suggestions` | Yes | None | SELECT/INSERT/UPDATE/DELETE | ALL | ✅ | ✅ managers_branch, owners_all, staff_own_read | GRANT added |
| `schedule_health_checks` | Yes | None | SELECT/INSERT/UPDATE/DELETE | ALL | ✅ | ✅ managers_branch_read/write, owners_all | GRANT added |

---

## RPC Function Grants

| Function | Signature | anon | authenticated | service_role | Reason |
|----------|-----------|------|---------------|-------------|--------|
| `get_auth_role` | `()` | ✅ | ✅ | ✅ | Used in RLS policy USING clauses for all roles |
| `get_auth_branch_id` | `()` | ✅ | ✅ | ✅ | Used in RLS policy USING clauses |
| `get_auth_staff_id` | `()` | ✅ | ✅ | ✅ | Used in RLS policy USING clauses |
| `compute_booking_end_time` | `(time, uuid)` | ✅ | ✅ | ✅ | Called via `createClient()` during public online booking (anon session) |
| `update_booking_progress` | `(uuid, text)` | — | ✅ | ✅ | `supabase.rpc()` in staff portal (authenticated createClient) |
| `update_home_service_tracking` | `(uuid, text)` | — | ❌ | ❌ | **Does not exist in live DB** — superseded by `update_booking_progress`; excluded |
| `get_daily_schedule` | `(uuid, date)` | — | ✅ | ✅ | `supabase.rpc()` in manager schedule (authenticated createClient) |
| `get_bookable_staff` | `(uuid, uuid)` | — | ❌ | ❌ | **Does not exist in live DB** — excluded |
| `get_available_slots` | `(uuid, uuid, uuid, date)` | — | ✅ | ✅ | Called via admin client; exposed for potential direct API access |
| `upsert_customer` | `(text, text, text)` | — | — | ✅ | Always called via `createAdminClient()` |
| `get_effective_price` | `(uuid, uuid)` | — | ✅ | ✅ | Price lookup for booking confirmation |

---

## Tables NOT Granted to anon (Intentional)

All tables except the 6 public-facing ones above are intentionally withheld from `anon`:

- `staff`, `staff_schedules`, `schedule_overrides`, `blocked_times` — internal staff data
- `customers`, `bookings`, `booking_events` — sensitive CRM data
- `daily_cash_reconciliations`, `booking_payment_logs` — financial audit data
- `waitlist_requests` — public insert goes through admin API route (service_role)
- `staff_onboarding_requests` — authenticated users only (after registration)
- `workspace_notifications`, `workflow_tasks` — internal workflow data
- `scheduling_rules`, `schedule_suggestions`, `schedule_health_checks` — internal ops data
- `departments` — internal reference data (no anon access)
- Note: `role_definitions`, `job_title_definitions` do not exist in the live database

---

## RLS Issues Found

| Table | Issue | Severity | Recommendation |
|-------|-------|----------|---------------|
| `departments` | RLS enabled but no policies found | Medium | Add read policy for authenticated; ensure seed-only writes use service_role |
| `staff_service_categories` | RLS enabled but no policies found | Medium | Add read policy for authenticated staff/manager |
| `role_definitions` | Table does not exist in live DB | — | No action needed |
| `job_title_definitions` | Table does not exist in live DB | — | No action needed |

These tables have RLS enabled (which blocks all access by default without a policy), but no
policies exist. Access currently works only because `createAdminClient()` (service_role) bypasses
RLS entirely. If any `createClient()` path ever queries these tables, it will return empty rows
silently (not an error — RLS just filters everything).

---

## Sequences

No explicit `CREATE SEQUENCE` statements found. All primary keys use `gen_random_uuid()` (no
sequences required). No sequence grants needed.

---

## Storage Buckets

`staff-pictures` storage bucket has separate RLS policies via Supabase Storage (not PostgREST
table grants). No action needed for bucket access.

---

## Verification Plan

After applying the migration, run in Supabase SQL editor:

```sql
-- Verify grants are present
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated', 'service_role')
order by table_name, grantee, privilege_type;

-- Verify no public table lacks RLS
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and rowsecurity = false
order by tablename;
```

Then smoke-test all critical paths — see Section 12 of the task prompt.
