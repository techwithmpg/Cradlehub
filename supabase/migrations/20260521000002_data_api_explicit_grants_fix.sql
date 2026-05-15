-- =============================================================================
-- CradleHub — Data API Grants Fix
-- Migration: 20260521000002_data_api_explicit_grants_fix.sql
-- =============================================================================
-- The previous migration (20260521000001) failed midway at the GRANT statement
-- for "public.role_definitions", which does not exist in the live database.
-- This left the following ungranted:
--   • Tables: branch_resources, branch_booking_rules, daily_cash_reconciliations,
--             booking_payment_logs, waitlist_requests, staff_onboarding_requests,
--             workspace_notifications, workflow_tasks, staff_services,
--             scheduling_rules, staff_scheduling_preferences,
--             schedule_suggestions, schedule_health_checks,
--             staff_location_snapshots
--   • ALL function execute grants (Section 4 never ran)
--
-- This migration completes those missing grants.
-- role_definitions and job_title_definitions are intentionally excluded —
-- they do not exist in the live database.
--
-- Run AFTER confirming 20260521000001 is applied up to staff_service_categories.
-- Running this on a clean DB (both migrations unapplied) is also safe.
-- =============================================================================


-- =============================================================================
-- SECTION A: REMAINING AUTHENTICATED WORKSPACE TABLES
-- (All were skipped because the previous migration failed at role_definitions)
-- =============================================================================

-- branch_resources: bookable spaces/beds/chairs; manager configures, staff reads
grant select, insert, update, delete  on table public.branch_resources to authenticated;
grant select, insert, update, delete  on table public.branch_resources to service_role;

-- branch_booking_rules: branch-level operational rules; manager configures, staff reads
grant select, insert, update, delete  on table public.branch_booking_rules to authenticated;
grant select, insert, update, delete  on table public.branch_booking_rules to service_role;

-- daily_cash_reconciliations: end-of-day cash totals; desk staff, manager, owner
grant select, insert, update, delete  on table public.daily_cash_reconciliations to authenticated;
grant select, insert, update, delete  on table public.daily_cash_reconciliations to service_role;

-- booking_payment_logs: append-only payment audit trail
-- authenticated gets SELECT and INSERT (append); UPDATE/DELETE reserved for service_role.
grant select, insert                  on table public.booking_payment_logs to authenticated;
grant select, insert, update, delete  on table public.booking_payment_logs to service_role;

-- waitlist_requests: desk staff manage waitlist; public insert uses admin API route (service_role)
grant select, insert, update, delete  on table public.waitlist_requests to authenticated;
grant select, insert, update, delete  on table public.waitlist_requests to service_role;

-- staff_onboarding_requests: applicants read own after authentication; manager/owner review
grant select, insert, update, delete  on table public.staff_onboarding_requests to authenticated;
grant select, insert, update, delete  on table public.staff_onboarding_requests to service_role;

-- workspace_notifications: all workspace portals read and update own notifications
grant select, insert, update, delete  on table public.workspace_notifications to authenticated;
grant select, insert, update, delete  on table public.workspace_notifications to service_role;

-- workflow_tasks: manager and owner read action-required tasks; staff reads own
grant select, insert, update, delete  on table public.workflow_tasks to authenticated;
grant select, insert, update, delete  on table public.workflow_tasks to service_role;

-- staff_services: staff-to-service capability mapping; manager manages
grant select, insert, update, delete  on table public.staff_services to authenticated;
grant select, insert, update, delete  on table public.staff_services to service_role;

-- staff_location_snapshots: GPS tracking for home-service drivers; sensitive — no anon
grant select, insert, update, delete  on table public.staff_location_snapshots to authenticated;
grant select, insert, update, delete  on table public.staff_location_snapshots to service_role;


-- =============================================================================
-- SECTION B: SCHEDULING FOUNDATION TABLES
-- =============================================================================

-- scheduling_rules: one row per branch; manager/owner configure scheduling constraints
grant select, insert, update, delete  on table public.scheduling_rules to authenticated;
grant select, insert, update, delete  on table public.scheduling_rules to service_role;

-- staff_scheduling_preferences: per-staff soft constraints; staff and manager set
grant select, insert, update, delete  on table public.staff_scheduling_preferences to authenticated;
grant select, insert, update, delete  on table public.staff_scheduling_preferences to service_role;

-- schedule_suggestions: system-generated shift suggestions; manager approves/rejects
grant select, insert, update, delete  on table public.schedule_suggestions to authenticated;
grant select, insert, update, delete  on table public.schedule_suggestions to service_role;

-- schedule_health_checks: daily coverage snapshots; manager and owner read
grant select, insert, update, delete  on table public.schedule_health_checks to authenticated;
grant select, insert, update, delete  on table public.schedule_health_checks to service_role;


-- =============================================================================
-- SECTION C: RPC FUNCTION EXECUTE GRANTS
-- This entire section was skipped in 20260521000001 because the migration
-- failed before reaching it.
-- =============================================================================

-- RLS helper functions used in policy USING/WITH CHECK clauses.
-- Must be executable by every role that evaluates policies on those tables.
grant execute on function public.get_auth_role()        to anon, authenticated, service_role;
grant execute on function public.get_auth_branch_id()   to anon, authenticated, service_role;
grant execute on function public.get_auth_staff_id()    to anon, authenticated, service_role;

-- Booking end-time computation.
-- Called via createClient() during public online booking — anon session on public pages.
-- Also called by authenticated managers (walk-in, booking edit).
grant execute on function public.compute_booking_end_time(time, uuid)
  to anon, authenticated, service_role;

-- Unified booking progress update — called via authenticated createClient() from staff portal.
-- (Supersedes update_home_service_tracking which no longer exists in the live DB.)
grant execute on function public.update_booking_progress(uuid, text)
  to authenticated, service_role;

-- Daily schedule reader — called via authenticated createClient() from manager portal.
grant execute on function public.get_daily_schedule(uuid, date)
  to authenticated, service_role;

-- Core availability engine — called via createAdminClient() (service_role).
-- Grant authenticated as well for any future direct client access.
grant execute on function public.get_available_slots(uuid, uuid, uuid, date)
  to authenticated, service_role;

-- Customer upsert — always called via createAdminClient() (service_role only).
grant execute on function public.upsert_customer(text, text, text)
  to service_role;

-- Effective price calculator — branch-specific or global price lookup.
grant execute on function public.get_effective_price(uuid, uuid)
  to authenticated, service_role;
