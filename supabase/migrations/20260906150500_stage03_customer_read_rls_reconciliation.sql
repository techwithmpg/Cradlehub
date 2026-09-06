-- =============================================================================
-- CradleHub - Migration: Stage 03 Customer Read RLS Reconciliation
-- =============================================================================
-- Context:
-- 1. Historical migrations (20260429000005_rls_policies.sql) defined global
--    SELECT policies for the `crm` role (`bookings_crm_read_all`, `customers_crm_read_all`)
--    under the legacy assumption that CRM was a global analytics role.
-- 2. In modern CradleHub architecture (20260701130406_normalize_front_desk_crm_roles.sql),
--    `crm` is the canonical branch-scoped Front Desk CRM operational role.
-- 3. Operational management roles `assistant_manager` and `store_manager` have CRM
--    workspace authority (canAccessCrmWorkspace) but previously lacked SELECT policies
--    on `bookings`, `customers`, and `waitlist_requests`.
--
-- Reconciliation:
-- 1. Narrow `crm` SELECT access on `bookings` and `customers` to branch-scoped access.
-- 2. Add branch-scoped SELECT access on `bookings`, `customers`, and `waitlist_requests`
--    for `assistant_manager` and `store_manager`.
-- 3. Preserve existing `owner` (global) and `manager` (branch) policies unchanged.
-- 4. READ-ONLY: strictly FOR SELECT. Zero INSERT, UPDATE, or DELETE permissions broadened.
-- =============================================================================

-- =============================================================================
-- 1. BOOKINGS: Narrow CRM to branch scope; add assistant_manager & store_manager
-- =============================================================================

DROP POLICY IF EXISTS "bookings_crm_read_all" ON public.bookings;
DROP POLICY IF EXISTS "bookings_crm_management_read_branch" ON public.bookings;

CREATE POLICY "bookings_crm_management_read_branch"
  ON public.bookings
  FOR SELECT
  TO authenticated
  USING (
    public.get_auth_role() IN ('crm', 'assistant_manager', 'store_manager')
    AND branch_id = public.get_auth_branch_id()
  );

-- =============================================================================
-- 2. CUSTOMERS: Narrow CRM to booking-derived branch scope; add assistant_manager & store_manager
-- =============================================================================

DROP POLICY IF EXISTS "customers_crm_read_all" ON public.customers;
DROP POLICY IF EXISTS "customers_crm_management_read_branch" ON public.customers;

CREATE POLICY "customers_crm_management_read_branch"
  ON public.customers
  FOR SELECT
  TO authenticated
  USING (
    public.get_auth_role() IN ('crm', 'assistant_manager', 'store_manager')
    AND id IN (
      SELECT customer_id
      FROM public.bookings
      WHERE branch_id = public.get_auth_branch_id()
        AND customer_id IS NOT NULL
    )
  );

-- =============================================================================
-- 3. WAITLIST REQUESTS: Add assistant_manager & store_manager (CRM already branch-scoped)
-- =============================================================================

DROP POLICY IF EXISTS "waitlist_management_read_branch" ON public.waitlist_requests;

CREATE POLICY "waitlist_management_read_branch"
  ON public.waitlist_requests
  FOR SELECT
  TO authenticated
  USING (
    public.get_auth_role() IN ('assistant_manager', 'store_manager')
    AND branch_id = public.get_auth_branch_id()
  );
