-- =============================================================================
-- CradleHub — Migration: CRM/CSR Schedule RLS Fix
-- =============================================================================
-- Problem: Existing RLS policies on staff_schedules, schedule_overrides,
-- blocked_times, and staff only allowed `manager` and `owner` roles.
-- CRM, CSR Head, CSR Staff, CSR, assistant_manager, and store_manager
-- were blocked from reading branch staff and editing schedules through
-- the regular Supabase client, causing silent save failures in the
-- CRM Edit Availability modal and Staff Schedule tab.
--
-- Fix: Add branch-scoped SELECT/ALL policies for all operational roles
-- that need schedule management access. Replace overly strict manager-only
-- schedule policies with operational-role policies.
-- =============================================================================

-- ─── STAFF ──────────────────────────────────────────────────────────────────
-- Existing policies: staff_read_own, staff_manager_read_branch, staff_owner_all.
-- Missing: assistant_manager, store_manager, crm, csr_head, csr_staff, csr.
CREATE POLICY "staff_operational_read_branch"
  ON staff FOR SELECT
  TO authenticated
  USING (
    get_auth_role() IN ('assistant_manager', 'store_manager', 'crm', 'csr_head', 'csr_staff', 'csr')
    AND branch_id = get_auth_branch_id()
  );

-- Operational roles also need UPDATE on staff in their branch for profile edits.
CREATE POLICY "staff_operational_update_branch"
  ON staff FOR UPDATE
  TO authenticated
  USING (
    get_auth_role() IN ('manager', 'assistant_manager', 'store_manager', 'crm', 'csr_head', 'csr_staff', 'csr')
    AND branch_id = get_auth_branch_id()
  )
  WITH CHECK (
    get_auth_role() IN ('manager', 'assistant_manager', 'store_manager', 'crm', 'csr_head', 'csr_staff', 'csr')
    AND branch_id = get_auth_branch_id()
  );

-- ─── STAFF SERVICES ─────────────────────────────────────────────────────────
-- Existing policies: staff_services_owner_all, staff_services_manager_all,
-- staff_services_staff_read_own, staff_services_csr_read.
-- Missing write access for CRM/CSR operational roles.
DROP POLICY IF EXISTS "staff_services_manager_all" ON public.staff_services;

CREATE POLICY "staff_services_operational_all"
  ON public.staff_services FOR ALL
  TO authenticated
  USING (
    get_auth_role() IN ('manager', 'assistant_manager', 'store_manager', 'crm', 'csr_head', 'csr_staff', 'csr')
    AND staff_id IN (
      SELECT id FROM public.staff WHERE branch_id = get_auth_branch_id()
    )
  )
  WITH CHECK (
    get_auth_role() IN ('manager', 'assistant_manager', 'store_manager', 'crm', 'csr_head', 'csr_staff', 'csr')
    AND staff_id IN (
      SELECT id FROM public.staff WHERE branch_id = get_auth_branch_id()
    )
  );

-- ─── STAFF SCHEDULES ────────────────────────────────────────────────────────
-- Drop old manager-only policies and recreate with full operational role set.
DROP POLICY IF EXISTS "staff_schedules_manager_read" ON staff_schedules;
DROP POLICY IF EXISTS "staff_schedules_manager_write" ON staff_schedules;
DROP POLICY IF EXISTS "staff_schedules_manager_update" ON staff_schedules;

CREATE POLICY "staff_schedules_operational_read"
  ON staff_schedules FOR SELECT
  TO authenticated
  USING (
    get_auth_role() IN ('manager', 'assistant_manager', 'store_manager', 'crm', 'csr_head', 'csr_staff', 'csr')
    AND staff_id IN (
      SELECT id FROM staff WHERE branch_id = get_auth_branch_id()
    )
  );

CREATE POLICY "staff_schedules_operational_insert"
  ON staff_schedules FOR INSERT
  TO authenticated
  WITH CHECK (
    get_auth_role() IN ('manager', 'assistant_manager', 'store_manager', 'crm', 'csr_head', 'csr_staff', 'csr')
    AND staff_id IN (
      SELECT id FROM staff WHERE branch_id = get_auth_branch_id()
    )
  );

CREATE POLICY "staff_schedules_operational_update"
  ON staff_schedules FOR UPDATE
  TO authenticated
  USING (
    get_auth_role() IN ('manager', 'assistant_manager', 'store_manager', 'crm', 'csr_head', 'csr_staff', 'csr')
    AND staff_id IN (
      SELECT id FROM staff WHERE branch_id = get_auth_branch_id()
    )
  )
  WITH CHECK (
    get_auth_role() IN ('manager', 'assistant_manager', 'store_manager', 'crm', 'csr_head', 'csr_staff', 'csr')
    AND staff_id IN (
      SELECT id FROM staff WHERE branch_id = get_auth_branch_id()
    )
  );

-- ─── SCHEDULE OVERRIDES ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "schedule_overrides_manager_all" ON schedule_overrides;

CREATE POLICY "schedule_overrides_operational_all"
  ON schedule_overrides FOR ALL
  TO authenticated
  USING (
    get_auth_role() IN ('manager', 'assistant_manager', 'store_manager', 'crm', 'csr_head', 'csr_staff', 'csr')
    AND staff_id IN (
      SELECT id FROM staff WHERE branch_id = get_auth_branch_id()
    )
  )
  WITH CHECK (
    get_auth_role() IN ('manager', 'assistant_manager', 'store_manager', 'crm', 'csr_head', 'csr_staff', 'csr')
    AND staff_id IN (
      SELECT id FROM staff WHERE branch_id = get_auth_branch_id()
    )
  );

-- ─── BLOCKED TIMES ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "blocked_times_manager_all" ON blocked_times;

CREATE POLICY "blocked_times_operational_all"
  ON blocked_times FOR ALL
  TO authenticated
  USING (
    get_auth_role() IN ('manager', 'assistant_manager', 'store_manager', 'crm', 'csr_head', 'csr_staff', 'csr')
    AND staff_id IN (
      SELECT id FROM staff WHERE branch_id = get_auth_branch_id()
    )
  )
  WITH CHECK (
    get_auth_role() IN ('manager', 'assistant_manager', 'store_manager', 'crm', 'csr_head', 'csr_staff', 'csr')
    AND staff_id IN (
      SELECT id FROM staff WHERE branch_id = get_auth_branch_id()
    )
  );
