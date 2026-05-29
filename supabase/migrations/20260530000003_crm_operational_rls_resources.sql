-- =============================================================================
-- CradleHub — Migration: Branch Resources CRM Scope Fix
-- =============================================================================
-- Problem 1: The existing `branch_resources_crm_read` policy has no
-- `branch_id = get_auth_branch_id()` clause. CRM/CSR users can see active
-- resources from ALL branches, which is a cross-branch data leak.
--
-- Problem 2: CRM has no UPDATE access on branch_resources. During MVP CRM is
-- the temporary operational backbone so crm and csr_head need to manage rooms
-- and resources (mark active/inactive, rename, adjust sort order).
--
-- Fix: Rebuild the read policy with correct branch scope. Add a branch-scoped
-- UPDATE policy for elevated CRM roles (crm + csr_head). csr_staff retains
-- read-only access to their branch resources.
--
-- Decision: csr_staff can READ but NOT UPDATE branch resources.
--           crm and csr_head can READ and UPDATE their branch resources.
-- =============================================================================

-- ─── Rebuild read policy with branch scope ──────────────────────────────────
DROP POLICY IF EXISTS "branch_resources_crm_read" ON public.branch_resources;

CREATE POLICY "branch_resources_crm_read"
  ON public.branch_resources
  FOR SELECT
  TO authenticated
  USING (
    public.get_auth_role() = ANY (ARRAY['crm', 'csr_head', 'csr_staff'])
    AND branch_id = public.get_auth_branch_id()
    AND is_active = true
  );

-- ─── Add UPDATE for elevated CRM roles ──────────────────────────────────────
DO $$
BEGIN
  CREATE POLICY "branch_resources_crm_update"
    ON public.branch_resources
    FOR UPDATE
    TO authenticated
    USING (
      public.get_auth_role() = ANY (ARRAY['crm', 'csr_head'])
      AND branch_id = public.get_auth_branch_id()
    )
    WITH CHECK (
      public.get_auth_role() = ANY (ARRAY['crm', 'csr_head'])
      AND branch_id = public.get_auth_branch_id()
    );
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Policy branch_resources_crm_update already exists, skipping.';
END $$;
