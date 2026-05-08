-- =============================================================================
-- CradleHub — Service Booking Visibility
-- =============================================================================
-- Adds a booking_visibility column to branch_services so individual services
-- can be restricted to CSR/internal staff or VIP customers without being
-- shown in the public booking wizard.
--
-- Values:
--   'public'   (default) — visible in public online booking and CRM
--   'csr_only'           — visible in CRM/inhouse booking only; hidden from public wizard
--   'vip'                — reserved for VIP customers; hidden from public wizard
--
-- Also adds a manager UPDATE/INSERT policy on branch_services so branch managers
-- can configure their own branch's service catalog without owner access.
-- =============================================================================

-- ─── booking_visibility column ───────────────────────────────────────────────

ALTER TABLE public.branch_services
  ADD COLUMN IF NOT EXISTS booking_visibility TEXT NOT NULL DEFAULT 'public';

ALTER TABLE public.branch_services
  DROP CONSTRAINT IF EXISTS branch_services_booking_visibility_check;

ALTER TABLE public.branch_services
  ADD CONSTRAINT branch_services_booking_visibility_check
  CHECK (booking_visibility IN ('public', 'csr_only', 'vip'));

COMMENT ON COLUMN public.branch_services.booking_visibility IS
  'Controls where this service appears: public = all booking surfaces; csr_only = CRM/inhouse only; vip = VIP only (hidden from public wizard).';

-- ─── Manager policy on branch_services ───────────────────────────────────────
-- Allows managers to INSERT, UPDATE, and DELETE branch_services rows for their
-- own branch (e.g. add/remove services, toggle eligibility, set visibility).
-- SELECT is already covered by the open branch_services_public_read policy.

DROP POLICY IF EXISTS "branch_services_manager_manage" ON public.branch_services;
CREATE POLICY "branch_services_manager_manage"
  ON public.branch_services FOR ALL
  TO authenticated
  USING (
    get_auth_role() = 'manager'
    AND branch_id = get_auth_branch_id()
  )
  WITH CHECK (
    get_auth_role() = 'manager'
    AND branch_id = get_auth_branch_id()
  );
