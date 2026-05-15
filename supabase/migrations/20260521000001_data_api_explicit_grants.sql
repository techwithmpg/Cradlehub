-- =============================================================================
-- CradleHub — Explicit Data API Grants
-- Migration: 20260521000001_data_api_explicit_grants.sql
-- =============================================================================
-- Supabase announced that new public schema tables will no longer be
-- automatically exposed to the Data API / PostgREST after May 30 2026 (new
-- projects) and Oct 30 2026 (existing projects).
--
-- GRANTS control role-level table access; RLS policies control row-level access.
-- Both layers are required. This migration adds explicit grants for all existing
-- public tables so that CradleHub Data API access is forward-compatible.
--
-- Roles:
--   anon         — unauthenticated visitors (public site, public booking flow)
--   authenticated — logged-in staff (all workspace portals)
--   service_role  — admin client (server actions using createAdminClient())
--
-- Do NOT remove or weaken any RLS policies.
-- Do NOT grant anon access to private/internal tables.
-- =============================================================================


-- =============================================================================
-- SECTION 1: PUBLIC-FACING TABLES
-- Accessed by unauthenticated visitors through the public booking site and
-- marketing pages. anon role needs SELECT; public booking inserts go via
-- server actions using createAdminClient() (service_role), so no anon INSERT.
-- =============================================================================

-- branches: public booking branch selector, marketing pages
grant select                          on table public.branches to anon;
grant select, insert, update, delete  on table public.branches to authenticated;
grant select, insert, update, delete  on table public.branches to service_role;

-- service_categories: public booking wizard service groups
grant select                          on table public.service_categories to anon;
grant select, insert, update, delete  on table public.service_categories to authenticated;
grant select, insert, update, delete  on table public.service_categories to service_role;

-- services: public booking wizard and public site service listings
grant select                          on table public.services to anon;
grant select, insert, update, delete  on table public.services to authenticated;
grant select, insert, update, delete  on table public.services to service_role;

-- branch_services: public booking availability, pricing, and eligibility
grant select                          on table public.branch_services to anon;
grant select, insert, update, delete  on table public.branch_services to authenticated;
grant select, insert, update, delete  on table public.branch_services to service_role;

-- public_site_sections: marketing site content managed by owner
grant select                          on table public.public_site_sections to anon;
grant select, insert, update, delete  on table public.public_site_sections to authenticated;
grant select, insert, update, delete  on table public.public_site_sections to service_role;

-- public_site_assets: marketing site image and card assets
grant select                          on table public.public_site_assets to anon;
grant select, insert, update, delete  on table public.public_site_assets to authenticated;
grant select, insert, update, delete  on table public.public_site_assets to service_role;


-- =============================================================================
-- SECTION 2: AUTHENTICATED WORKSPACE TABLES — CORE OPERATIONS
-- Accessed by logged-in staff, managers, CRM, and owners via createClient()
-- (authenticated role). RLS policies enforce branch-scoped access.
-- =============================================================================

-- staff: all workspace portals read own record; manager reads branch; owner reads all
grant select, insert, update, delete  on table public.staff to authenticated;
grant select, insert, update, delete  on table public.staff to service_role;

-- staff_schedules: staff portal schedule, manager schedule editor
grant select, insert, update, delete  on table public.staff_schedules to authenticated;
grant select, insert, update, delete  on table public.staff_schedules to service_role;

-- schedule_overrides: date-specific schedule exceptions
grant select, insert, update, delete  on table public.schedule_overrides to authenticated;
grant select, insert, update, delete  on table public.schedule_overrides to service_role;

-- blocked_times: manual time blocks (breaks, training)
grant select, insert, update, delete  on table public.blocked_times to authenticated;
grant select, insert, update, delete  on table public.blocked_times to service_role;

-- customers: CRM and manager read/write; RLS enforces branch scope
grant select, insert, update, delete  on table public.customers to authenticated;
grant select, insert, update, delete  on table public.customers to service_role;

-- bookings: all workspaces — staff read own, CRM/manager read branch, owner reads all
grant select, insert, update, delete  on table public.bookings to authenticated;
grant select, insert, update, delete  on table public.bookings to service_role;

-- booking_events: immutable audit log — written only by triggers, read by all staff roles
-- Authenticated gets SELECT only; INSERT/UPDATE/DELETE is reserved for service_role (triggers).
grant select                          on table public.booking_events to authenticated;
grant select, insert, update, delete  on table public.booking_events to service_role;

-- departments: org structure reference; owned by service_role operations
grant select, insert, update, delete  on table public.departments to authenticated;
grant select, insert, update, delete  on table public.departments to service_role;

-- staff_service_categories: maps staff to service categories they can perform
grant select, insert, update, delete  on table public.staff_service_categories to authenticated;
grant select, insert, update, delete  on table public.staff_service_categories to service_role;

-- role_definitions: read-only reference table describing role meanings
grant select                          on table public.role_definitions to authenticated;
grant select, insert, update, delete  on table public.role_definitions to service_role;

-- job_title_definitions: read-only reference table for org job titles
grant select                          on table public.job_title_definitions to authenticated;
grant select, insert, update, delete  on table public.job_title_definitions to service_role;

-- branch_resources: bookable spaces/beds/chairs; manager configures, staff reads
grant select, insert, update, delete  on table public.branch_resources to authenticated;
grant select, insert, update, delete  on table public.branch_resources to service_role;

-- branch_booking_rules: branch-level operational rules; manager configures, staff reads
-- Public booking rules are fetched server-side via createAdminClient().
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


-- =============================================================================
-- SECTION 3: SCHEDULING FOUNDATION TABLES
-- Manager and owner configure scheduling; staff reads own suggestions.
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
-- SECTION 4: RPC FUNCTION EXECUTE GRANTS
-- Functions called via supabase.rpc() need explicit EXECUTE grants for the role
-- making the call. Functions used in RLS policy USING clauses also need EXECUTE
-- on the roles that evaluate those policies.
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
grant execute on function public.update_booking_progress(uuid, text)
  to authenticated, service_role;

-- Home service tracking progression — called via authenticated createClient() from staff portal.
grant execute on function public.update_home_service_tracking(uuid, text)
  to authenticated, service_role;

-- Daily schedule reader — called via authenticated createClient() from manager portal.
grant execute on function public.get_daily_schedule(uuid, date)
  to authenticated, service_role;

-- Bookable staff resolver — staff qualification lookup for booking assignment.
grant execute on function public.get_bookable_staff(uuid, uuid)
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
