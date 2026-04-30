-- =============================================================================
-- CradleHub — Migration 008: Staff Organizational Structure
-- =============================================================================
-- Goal: Model real spa job functions without changing the security role system.
--
-- Design:
--   ✦ staff.system_role remains the access-control role (owner/manager/crm/staff)
--   ✦ staff.staff_type models the real-world job function (therapist/nail_tech/...)
--   ✦ staff.is_head marks department heads and supervisors
--   ✦ staff_services junction records which services each staff member can perform
--
-- Safety:
--   ✦ DEFAULT 'therapist' on existing rows — no data loss
--   ✦ DEFAULT false on is_head — no data loss
--   ✦ staff_services starts empty; availability engine falls back to legacy behavior
--     when no rows exist for a service
-- =============================================================================

-- ─── STAFF: add staff_type ───────────────────────────────────────────────────
ALTER TABLE public.staff
ADD COLUMN IF NOT EXISTS staff_type TEXT NOT NULL DEFAULT 'therapist';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'staff_staff_type_check'
    AND conrelid = 'staff'::regclass
  ) THEN
    ALTER TABLE public.staff
    ADD CONSTRAINT staff_staff_type_check
    CHECK (staff_type IN (
      'therapist',
      'nail_tech',
      'aesthetician',
      'csr',
      'driver',
      'utility',
      'salon_head',
      'managerial'
    ));
  END IF;
END $$;

COMMENT ON COLUMN public.staff.staff_type IS
  'Real-world job function. Separate from system_role which controls app access.';

-- ─── STAFF: add is_head ──────────────────────────────────────────────────────
ALTER TABLE public.staff
ADD COLUMN IF NOT EXISTS is_head BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.staff.is_head IS
  'TRUE if this staff member is a department head or supervisor (e.g. CSR Head, Salon Head).';

-- ─── STAFF SERVICES: service capability junction ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.staff_services (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id   UUID         NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  service_id UUID         NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (staff_id, service_id)
);

COMMENT ON TABLE public.staff_services IS
  'Maps staff members to services they are qualified to perform. Empty table = legacy behavior (any staff can be assigned).';

-- ─── RLS on staff_services ───────────────────────────────────────────────────
ALTER TABLE public.staff_services ENABLE ROW LEVEL SECURITY;

-- Owner: full CRUD
CREATE POLICY IF NOT EXISTS "staff_services_owner_all"
  ON public.staff_services FOR ALL
  TO authenticated
  USING     (get_auth_role() = 'owner')
  WITH CHECK (get_auth_role() = 'owner');

-- Manager: read/write for staff in their branch
CREATE POLICY IF NOT EXISTS "staff_services_manager_all"
  ON public.staff_services FOR ALL
  TO authenticated
  USING (
    get_auth_role() = 'manager'
    AND staff_id IN (
      SELECT id FROM public.staff WHERE branch_id = get_auth_branch_id()
    )
  )
  WITH CHECK (
    get_auth_role() = 'manager'
    AND staff_id IN (
      SELECT id FROM public.staff WHERE branch_id = get_auth_branch_id()
    )
  );

-- Staff: read own rows
CREATE POLICY IF NOT EXISTS "staff_services_staff_read_own"
  ON public.staff_services FOR SELECT
  TO authenticated
  USING (staff_id = get_auth_staff_id());

-- Public: no direct access (service role / RPC only)

-- ─── Update trigger for staff.updated_at ─────────────────────────────────────
-- The existing fn_update_updated_at trigger already covers staff table.
-- No new trigger needed.
