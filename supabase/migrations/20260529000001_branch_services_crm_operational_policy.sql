-- =============================================================================
-- CradleHub — CRM branch service operational access
-- =============================================================================
-- CRM/CSR users need to update operational service availability for their own
-- branch from /crm/services. This keeps RLS branch-scoped and does not grant
-- cross-branch branch_services writes.
-- =============================================================================

DROP POLICY IF EXISTS "branch_services_crm_branch_read" ON public.branch_services;
DROP POLICY IF EXISTS "branch_services_crm_operational_update" ON public.branch_services;

CREATE POLICY "branch_services_crm_branch_read"
  ON public.branch_services FOR SELECT
  TO authenticated
  USING (
    public.get_auth_role() IN ('crm', 'csr_head', 'csr_staff', 'csr')
    AND branch_id = public.get_auth_branch_id()
  );

CREATE POLICY "branch_services_crm_operational_update"
  ON public.branch_services FOR UPDATE
  TO authenticated
  USING (
    public.get_auth_role() IN ('crm', 'csr_head', 'csr_staff', 'csr')
    AND branch_id = public.get_auth_branch_id()
  )
  WITH CHECK (
    public.get_auth_role() IN ('crm', 'csr_head', 'csr_staff', 'csr')
    AND branch_id = public.get_auth_branch_id()
  );
