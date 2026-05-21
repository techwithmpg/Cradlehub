-- =============================================================================
-- CradleHub — Staff Shift Check-ins
-- =============================================================================
-- Adds staff_shift_checkins table to track actual staff attendance.
-- Schedule (staff_schedules) remains the plan; check-ins represent real
-- physical presence. Used by CRM Live Availability to distinguish
-- scheduled staff from staff who actually reported to work.
--
-- Core rule:
--   Scheduled + inside shift window + checked in + not checked out + not busy
--   = truly available
-- =============================================================================


-- ─── Table ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.staff_shift_checkins (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  staff_id      UUID        NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  branch_id     UUID        NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,

  shift_date    DATE        NOT NULL,
  shift_type    TEXT        NOT NULL DEFAULT 'single'
                CHECK (shift_type IN ('single', 'opening', 'closing')),

  checked_in_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_out_at TIMESTAMPTZ,

  status        TEXT        NOT NULL DEFAULT 'checked_in'
                CHECK (status IN ('checked_in', 'checked_out', 'voided')),

  -- Who performed the check-in (NULL = self check-in via staff portal)
  recorded_by   UUID        REFERENCES public.staff(id) ON DELETE SET NULL,
  notes         TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One active check-in record per staff per shift per day.
  -- Prevents duplicate check-ins for the same shift window.
  CONSTRAINT staff_shift_checkins_unique_day_shift
    UNIQUE (staff_id, shift_date, shift_type)
);

COMMENT ON TABLE public.staff_shift_checkins IS
  'Tracks staff presence for scheduled shifts. Used by CRM Live Availability '
  'to distinguish scheduled staff from actually present staff. '
  'Schedule = plan; check-in = attendance truth.';

COMMENT ON COLUMN public.staff_shift_checkins.recorded_by IS
  'NULL means the staff member self-checked-in via their own portal. '
  'Non-null means a manager or CRM operator performed the check-in on their behalf.';

COMMENT ON COLUMN public.staff_shift_checkins.status IS
  'checked_in: currently present. '
  'checked_out: shift ended, no longer present. '
  'voided: admin-cancelled record (data entry error).';


-- ─── Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS staff_shift_checkins_branch_date_idx
  ON public.staff_shift_checkins (branch_id, shift_date);

CREATE INDEX IF NOT EXISTS staff_shift_checkins_staff_date_idx
  ON public.staff_shift_checkins (staff_id, shift_date);

-- Partial index covering only active (not-yet-checked-out) records —
-- the most common lookup in the availability snapshot.
CREATE INDEX IF NOT EXISTS staff_shift_checkins_active_idx
  ON public.staff_shift_checkins (branch_id, shift_date, status)
  WHERE checked_out_at IS NULL;


-- ─── updated_at trigger ──────────────────────────────────────────────────────
-- fn_update_updated_at() is defined in 20260429000004_triggers.sql and
-- re-declared idempotently in several later migrations. Reuse here.

DROP TRIGGER IF EXISTS trg_staff_shift_checkins_updated_at
  ON public.staff_shift_checkins;
CREATE TRIGGER trg_staff_shift_checkins_updated_at
  BEFORE UPDATE ON public.staff_shift_checkins
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at();


-- ─── Row Level Security ──────────────────────────────────────────────────────

ALTER TABLE public.staff_shift_checkins ENABLE ROW LEVEL SECURITY;

-- Owner: full access across all branches
DROP POLICY IF EXISTS "checkins_owner_all" ON public.staff_shift_checkins;
CREATE POLICY "checkins_owner_all"
  ON public.staff_shift_checkins FOR ALL
  TO authenticated
  USING     (get_auth_role() = 'owner')
  WITH CHECK (get_auth_role() = 'owner');

-- Manager roles: full access for own branch only
DROP POLICY IF EXISTS "checkins_manager_branch_all" ON public.staff_shift_checkins;
CREATE POLICY "checkins_manager_branch_all"
  ON public.staff_shift_checkins FOR ALL
  TO authenticated
  USING (
    get_auth_role() IN ('manager', 'assistant_manager', 'store_manager')
    AND branch_id = get_auth_branch_id()
  )
  WITH CHECK (
    get_auth_role() IN ('manager', 'assistant_manager', 'store_manager')
    AND branch_id = get_auth_branch_id()
  );

-- CRM / CSR roles: full access for own branch
DROP POLICY IF EXISTS "checkins_csr_branch_all" ON public.staff_shift_checkins;
CREATE POLICY "checkins_csr_branch_all"
  ON public.staff_shift_checkins FOR ALL
  TO authenticated
  USING (
    get_auth_role() IN ('crm', 'csr_head', 'csr_staff')
    AND branch_id = get_auth_branch_id()
  )
  WITH CHECK (
    get_auth_role() IN ('crm', 'csr_head', 'csr_staff')
    AND branch_id = get_auth_branch_id()
  );

-- Staff: read own check-in records
DROP POLICY IF EXISTS "checkins_staff_read_own" ON public.staff_shift_checkins;
CREATE POLICY "checkins_staff_read_own"
  ON public.staff_shift_checkins FOR SELECT
  TO authenticated
  USING (staff_id = get_auth_staff_id());

-- Staff: self check-in — can insert their own record at their own branch
DROP POLICY IF EXISTS "checkins_staff_self_insert" ON public.staff_shift_checkins;
CREATE POLICY "checkins_staff_self_insert"
  ON public.staff_shift_checkins FOR INSERT
  TO authenticated
  WITH CHECK (
    staff_id  = get_auth_staff_id()
    AND branch_id = get_auth_branch_id()
  );

-- Staff: self check-out — can update their own check-in record
DROP POLICY IF EXISTS "checkins_staff_self_update" ON public.staff_shift_checkins;
CREATE POLICY "checkins_staff_self_update"
  ON public.staff_shift_checkins FOR UPDATE
  TO authenticated
  USING  (staff_id = get_auth_staff_id())
  WITH CHECK (staff_id = get_auth_staff_id());


-- ─── Data API grants ─────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.staff_shift_checkins TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.staff_shift_checkins TO service_role;
