-- =============================================================================
-- CradleHub — Branch Booking Rules
-- =============================================================================
-- Branch-scoped business rules for booking availability. Public booking APIs read
-- these rules server-side; browser clients do not write to this table directly.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.branch_booking_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  in_spa_start_time TIME NOT NULL DEFAULT '10:00',
  in_spa_end_time TIME NOT NULL DEFAULT '22:30',
  home_service_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  home_service_start_time TIME NOT NULL DEFAULT '14:30',
  home_service_end_time TIME NOT NULL DEFAULT '22:00',
  travel_buffer_mins INTEGER NOT NULL DEFAULT 30,
  max_advance_booking_days INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT branch_booking_rules_branch_id_key UNIQUE (branch_id),
  CONSTRAINT branch_booking_rules_in_spa_time_order
    CHECK (in_spa_start_time < in_spa_end_time),
  CONSTRAINT branch_booking_rules_home_service_time_order
    CHECK (home_service_start_time < home_service_end_time),
  CONSTRAINT branch_booking_rules_travel_buffer_range
    CHECK (travel_buffer_mins >= 0 AND travel_buffer_mins <= 240),
  CONSTRAINT branch_booking_rules_max_advance_range
    CHECK (max_advance_booking_days >= 1 AND max_advance_booking_days <= 365)
);

COMMENT ON TABLE public.branch_booking_rules IS
  'Branch-level booking availability and operational rules.';
COMMENT ON COLUMN public.branch_booking_rules.in_spa_start_time IS
  'Earliest allowed in-spa appointment start time for the branch.';
COMMENT ON COLUMN public.branch_booking_rules.in_spa_end_time IS
  'Latest allowed in-spa appointment start time for the branch.';
COMMENT ON COLUMN public.branch_booking_rules.home_service_enabled IS
  'Whether customers and staff may create home service bookings for the branch.';
COMMENT ON COLUMN public.branch_booking_rules.travel_buffer_mins IS
  'Default travel buffer minutes for home service bookings.';
COMMENT ON COLUMN public.branch_booking_rules.max_advance_booking_days IS
  'Maximum number of days ahead that booking flows may accept.';

INSERT INTO public.branch_booking_rules (branch_id)
SELECT id
FROM public.branches
ON CONFLICT (branch_id) DO NOTHING;

ALTER TABLE public.branch_booking_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "branch_booking_rules_owner_all" ON public.branch_booking_rules;
CREATE POLICY "branch_booking_rules_owner_all"
  ON public.branch_booking_rules FOR ALL
  TO authenticated
  USING     (get_auth_role() = 'owner')
  WITH CHECK (get_auth_role() = 'owner');

DROP POLICY IF EXISTS "branch_booking_rules_manager_read" ON public.branch_booking_rules;
CREATE POLICY "branch_booking_rules_manager_read"
  ON public.branch_booking_rules FOR SELECT
  TO authenticated
  USING (
    get_auth_role() = 'manager'
    AND branch_id = get_auth_branch_id()
  );

DROP POLICY IF EXISTS "branch_booking_rules_manager_update" ON public.branch_booking_rules;
CREATE POLICY "branch_booking_rules_manager_update"
  ON public.branch_booking_rules FOR UPDATE
  TO authenticated
  USING (
    get_auth_role() = 'manager'
    AND branch_id = get_auth_branch_id()
  )
  WITH CHECK (
    get_auth_role() = 'manager'
    AND branch_id = get_auth_branch_id()
  );

DROP POLICY IF EXISTS "branch_booking_rules_staff_read" ON public.branch_booking_rules;
CREATE POLICY "branch_booking_rules_staff_read"
  ON public.branch_booking_rules FOR SELECT
  TO authenticated
  USING (
    get_auth_role() IN ('crm', 'csr', 'csr_head', 'csr_staff', 'staff')
    AND branch_id = get_auth_branch_id()
  );

CREATE OR REPLACE FUNCTION public.fn_update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_branch_booking_rules_updated_at
  ON public.branch_booking_rules;
CREATE TRIGGER trg_branch_booking_rules_updated_at
  BEFORE UPDATE ON public.branch_booking_rules
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at();
