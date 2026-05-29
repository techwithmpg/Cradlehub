-- =============================================================================
-- CradleHub — Migration: CRM/CSR Customer UPDATE
-- =============================================================================
-- Problem: The `customers` table has only `customers_manager_update` for UPDATE.
-- CRM and CSR roles cannot update customer records (notes, preferences, contact
-- details). Any edit from the CRM customer profile view silently fails.
--
-- Fix: Add branch-scoped UPDATE policies for crm and csr_* roles. Customers
-- do not have a direct branch_id column; branch scope is enforced by requiring
-- the customer to have at least one booking at the actor's branch.
--
-- Not granted: DELETE (no operational need).
-- Not granted: cross-branch update (enforced via bookings.branch_id subquery).
-- =============================================================================

DO $$
BEGIN
  CREATE POLICY "customers_crm_update_branch_related"
    ON public.customers
    FOR UPDATE
    TO authenticated
    USING (
      public.get_auth_role() = 'crm'
      AND id IN (
        SELECT customer_id
        FROM public.bookings
        WHERE branch_id = public.get_auth_branch_id()
          AND customer_id IS NOT NULL
      )
    )
    WITH CHECK (
      public.get_auth_role() = 'crm'
    );
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Policy customers_crm_update_branch_related already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "customers_csr_update_branch_related"
    ON public.customers
    FOR UPDATE
    TO authenticated
    USING (
      public.get_auth_role() = ANY (ARRAY['csr', 'csr_head', 'csr_staff'])
      AND id IN (
        SELECT customer_id
        FROM public.bookings
        WHERE branch_id = public.get_auth_branch_id()
          AND customer_id IS NOT NULL
      )
    )
    WITH CHECK (
      public.get_auth_role() = ANY (ARRAY['csr', 'csr_head', 'csr_staff'])
    );
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Policy customers_csr_update_branch_related already exists, skipping.';
END $$;
