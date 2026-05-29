-- =============================================================================
-- CradleHub — Migration: CRM Operational Booking INSERT + UPDATE
-- =============================================================================
-- Problem: The `crm` system_role can SELECT bookings (via bookings_crm_read_all)
-- but has NO INSERT or UPDATE policy. Any booking write from a `crm` role user
-- (payment confirmation, status update, dispatch assignment) is silently blocked
-- by RLS and returns 0 rows updated.
--
-- Fix: Add narrow, branch-scoped INSERT and UPDATE policies for the `crm` role,
-- matching the access already granted to `csr`, `csr_head`, and `csr_staff`.
--
-- Not granted: DELETE (no operational need).
-- Not granted: cross-branch write (branch_id = get_auth_branch_id() enforced).
-- =============================================================================

DO $$
BEGIN
  CREATE POLICY "bookings_crm_operational_insert"
    ON public.bookings
    FOR INSERT
    TO authenticated
    WITH CHECK (
      public.get_auth_role() = 'crm'
      AND branch_id = public.get_auth_branch_id()
    );
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Policy bookings_crm_operational_insert already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "bookings_crm_operational_update"
    ON public.bookings
    FOR UPDATE
    TO authenticated
    USING (
      public.get_auth_role() = 'crm'
      AND branch_id = public.get_auth_branch_id()
    )
    WITH CHECK (
      public.get_auth_role() = 'crm'
      AND branch_id = public.get_auth_branch_id()
    );
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Policy bookings_crm_operational_update already exists, skipping.';
END $$;
