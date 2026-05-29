-- =============================================================================
-- CradleHub — Fix branch_services management RLS policy
-- =============================================================================
-- The existing branch_services_manager_manage policy (added in
-- 20260510000008_service_visibility.sql) only covers system_role = 'manager'.
-- However, the application allows assistant_manager and store_manager to
-- manage branch services too (via requireOwnerOrBranchManager in actions.ts).
-- This migration widens the policy to match the application's access matrix.
-- =============================================================================

DROP POLICY IF EXISTS "branch_services_manager_manage" ON public.branch_services;

CREATE POLICY "branch_services_management_roles"
  ON public.branch_services FOR ALL
  TO authenticated
  USING (
    get_auth_role() IN ('manager', 'assistant_manager', 'store_manager')
    AND branch_id = get_auth_branch_id()
  )
  WITH CHECK (
    get_auth_role() IN ('manager', 'assistant_manager', 'store_manager')
    AND branch_id = get_auth_branch_id()
  );
