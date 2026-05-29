-- =============================================================================
-- CradleHub — Migration: CRM/CSR Staff Profile UPDATE RLS Fix
-- =============================================================================
-- Problem: Operational roles (CRM, CSR, assistant_manager, store_manager)
-- cannot save staff profile edits because the staff table has no UPDATE
-- RLS policy for non-owner roles. Only staff_owner_all allows UPDATE.
--
-- Fix: Add a narrow, branch-scoped UPDATE policy for all operational roles
-- that need to edit staff profiles in their assigned branch.
-- =============================================================================

-- ─── STAFF UPDATE POLICY ────────────────────────────────────────────────────
-- Existing policies: staff_read_own, staff_manager_read_branch, staff_owner_all.
-- Missing: UPDATE for assistant_manager, store_manager, crm, csr_head, csr_staff, csr.
--
-- Use DO block for idempotency in case a previous migration attempt partially
-- created this policy.
DO $$
BEGIN
  CREATE POLICY "staff_operational_update_branch"
    ON public.staff FOR UPDATE
    TO authenticated
    USING (
      get_auth_role() IN (
        'manager',
        'assistant_manager',
        'store_manager',
        'crm',
        'csr_head',
        'csr_staff',
        'csr'
      )
      AND branch_id = get_auth_branch_id()
    )
    WITH CHECK (
      get_auth_role() IN (
        'manager',
        'assistant_manager',
        'store_manager',
        'crm',
        'csr_head',
        'csr_staff',
        'csr'
      )
      AND branch_id = get_auth_branch_id()
    );
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Policy staff_operational_update_branch already exists, skipping.';
END $$;

-- ─── STAFF SERVICES WRITE POLICY ────────────────────────────────────────────
-- Existing policies: staff_services_owner_all, staff_services_manager_all,
-- staff_services_staff_read_own, staff_services_csr_read.
-- Missing write access for operational roles when editing service capabilities.
--
-- Drop the old manager-only policy and recreate with operational roles.
-- Wrapped in DO blocks for idempotency.
DO $$
BEGIN
  DROP POLICY IF EXISTS "staff_services_manager_all" ON public.staff_services;
END $$;

DO $$
BEGIN
  CREATE POLICY "staff_services_operational_all"
    ON public.staff_services FOR ALL
    TO authenticated
    USING (
      get_auth_role() IN (
        'manager',
        'assistant_manager',
        'store_manager',
        'crm',
        'csr_head',
        'csr_staff',
        'csr'
      )
      AND staff_id IN (
        SELECT id FROM public.staff WHERE branch_id = get_auth_branch_id()
      )
    )
    WITH CHECK (
      get_auth_role() IN (
        'manager',
        'assistant_manager',
        'store_manager',
        'crm',
        'csr_head',
        'csr_staff',
        'csr'
      )
      AND staff_id IN (
        SELECT id FROM public.staff WHERE branch_id = get_auth_branch_id()
      )
    );
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Policy staff_services_operational_all already exists, skipping.';
END $$;
