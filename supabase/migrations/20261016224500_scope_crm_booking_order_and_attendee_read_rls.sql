-- =============================================================================
-- CradleHub — Scope CRM Booking Orders and Attendees Read RLS to Branch
-- =============================================================================
-- Context:
-- In migration 20260927080000_bkg3_booking_order_atomic.sql, broad SELECT policies
-- were added:
--   - booking_orders_crm_read_all (USING: public.get_auth_role() = 'crm')
--   - booking_attendees_crm_read_all (USING: public.get_auth_role() = 'crm')
--
-- Under the CradleHub security architecture:
--   - Owner has global cross-branch visibility.
--   - Operational CRM / Front Desk staff are strictly branch-scoped.
--   - Booking, attendee, and payment operational data must be enforced at the
--     database RLS layer, not merely by application query filters.
--
-- Reconciliation:
-- 1. Drop broad cross-branch CRM read policies on booking_orders and booking_attendees.
-- 2. Create branch-scoped SELECT policies for CRM:
--    - booking_orders: branch_id = public.get_auth_branch_id()
--    - booking_attendees: parent booking_order.branch_id = public.get_auth_branch_id()
-- 3. Preserve Owner global read policies intact.
-- 4. Preserve Management (manager, assistant_manager, store_manager) branch policies intact.
-- 5. Preserve service_role full access policies intact.
-- 6. Strictly read-only: zero direct INSERT, UPDATE, or DELETE policies granted to CRM.
-- =============================================================================

-- ─── 1. BOOKING ORDERS ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "booking_orders_crm_read_all" ON public.booking_orders;
DROP POLICY IF EXISTS "booking_orders_crm_read_branch" ON public.booking_orders;

CREATE POLICY "booking_orders_crm_read_branch"
  ON public.booking_orders FOR SELECT
  TO authenticated
  USING (
    public.get_auth_role() = 'crm'
    AND branch_id = public.get_auth_branch_id()
  );

COMMENT ON POLICY "booking_orders_crm_read_branch" ON public.booking_orders IS
  'Restricts Front Desk CRM users to reading booking orders from their authenticated branch.';

-- ─── 2. BOOKING ATTENDEES ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "booking_attendees_crm_read_all" ON public.booking_attendees;
DROP POLICY IF EXISTS "booking_attendees_crm_read_branch" ON public.booking_attendees;

CREATE POLICY "booking_attendees_crm_read_branch"
  ON public.booking_attendees FOR SELECT
  TO authenticated
  USING (
    public.get_auth_role() = 'crm'
    AND EXISTS (
      SELECT 1 FROM public.booking_orders bo
      WHERE bo.id = booking_attendees.booking_order_id
        AND bo.branch_id = public.get_auth_branch_id()
    )
  );

COMMENT ON POLICY "booking_attendees_crm_read_branch" ON public.booking_attendees IS
  'Restricts Front Desk CRM users to reading attendees whose parent booking order belongs to their authenticated branch.';
