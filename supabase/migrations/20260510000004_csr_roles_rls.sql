-- =============================================================================
-- CradleHub — CSR Role RLS Patch
-- =============================================================================
-- csr, csr_head, and csr_staff system_role values were introduced in
-- 20260501000002_csr_roles.sql but the existing RLS policies on bookings,
-- customers, staff, and staff_services only cover the older 'crm' role.
-- This migration adds branch-scoped policies for all three CSR variants.
-- =============================================================================


-- =============================================================================
-- BOOKINGS
-- =============================================================================

-- CSR roles: SELECT bookings at own branch (powers CRM today, schedule, list)
DROP POLICY IF EXISTS "bookings_csr_read_branch" ON public.bookings;
CREATE POLICY "bookings_csr_read_branch"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (
    get_auth_role() IN ('csr', 'csr_head', 'csr_staff')
    AND branch_id = get_auth_branch_id()
  );

-- CSR roles: INSERT bookings at own branch (walk-in / front-desk creation)
DROP POLICY IF EXISTS "bookings_csr_insert" ON public.bookings;
CREATE POLICY "bookings_csr_insert"
  ON public.bookings FOR INSERT
  TO authenticated
  WITH CHECK (
    get_auth_role() IN ('csr', 'csr_head', 'csr_staff')
    AND branch_id = get_auth_branch_id()
  );

-- CSR roles: UPDATE bookings at own branch (status transitions, payment, reschedule)
DROP POLICY IF EXISTS "bookings_csr_update" ON public.bookings;
CREATE POLICY "bookings_csr_update"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (
    get_auth_role() IN ('csr', 'csr_head', 'csr_staff')
    AND branch_id = get_auth_branch_id()
  )
  WITH CHECK (
    get_auth_role() IN ('csr', 'csr_head', 'csr_staff')
    AND branch_id = get_auth_branch_id()
  );


-- =============================================================================
-- CUSTOMERS
-- =============================================================================
-- customers has no branch_id column — access is derived through bookings.
-- Pattern mirrors existing customers_manager_read_branch policy.

-- CSR roles: SELECT customers with bookings at own branch
DROP POLICY IF EXISTS "customers_csr_read_branch" ON public.customers;
CREATE POLICY "customers_csr_read_branch"
  ON public.customers FOR SELECT
  TO authenticated
  USING (
    get_auth_role() IN ('csr', 'csr_head', 'csr_staff')
    AND id IN (
      SELECT customer_id FROM public.bookings
      WHERE branch_id = get_auth_branch_id()
    )
  );

-- CSR roles: INSERT customers (walk-in entry, phone lookup — no branch constraint
-- since customers are identified by phone number and are global records)
DROP POLICY IF EXISTS "customers_csr_insert" ON public.customers;
CREATE POLICY "customers_csr_insert"
  ON public.customers FOR INSERT
  TO authenticated
  WITH CHECK (get_auth_role() IN ('csr', 'csr_head', 'csr_staff'));


-- =============================================================================
-- STAFF
-- =============================================================================
-- CSR roles need to SELECT staff at their branch for the therapist picker in
-- the booking creation flow (crm/bookings/new).

DROP POLICY IF EXISTS "staff_csr_read_branch" ON public.staff;
CREATE POLICY "staff_csr_read_branch"
  ON public.staff FOR SELECT
  TO authenticated
  USING (
    get_auth_role() IN ('csr', 'csr_head', 'csr_staff')
    AND branch_id = get_auth_branch_id()
  );


-- =============================================================================
-- STAFF_SERVICES
-- =============================================================================
-- CSR roles need to SELECT staff_services to build the service→therapist
-- mapping used in booking assignment.

DROP POLICY IF EXISTS "staff_services_csr_read" ON public.staff_services;
CREATE POLICY "staff_services_csr_read"
  ON public.staff_services FOR SELECT
  TO authenticated
  USING (
    get_auth_role() IN ('csr', 'csr_head', 'csr_staff')
    AND staff_id IN (
      SELECT id FROM public.staff WHERE branch_id = get_auth_branch_id()
    )
  );
