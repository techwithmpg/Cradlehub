-- ============================================================
-- SCHED-RULES-001: Scheduling Rules Foundation
-- Four new tables that power the rule-based scheduling engine.
-- All foreign keys reference existing tables. No existing tables
-- are modified; the availability RPC is untouched.
-- ============================================================

-- ── 1. scheduling_rules ──────────────────────────────────────
-- One row per branch; upserted on first save.
-- Extends (does not replace) branch_booking_rules.
CREATE TABLE IF NOT EXISTS public.scheduling_rules (
  id                                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id                         uuid        NOT NULL UNIQUE REFERENCES public.branches(id) ON DELETE CASCADE,

  -- Coverage thresholds
  min_daily_staff                   integer     NOT NULL DEFAULT 1,
  min_daily_therapists              integer     NOT NULL DEFAULT 1,
  min_daily_csr                     integer     NOT NULL DEFAULT 1,
  min_daily_drivers                 integer     NOT NULL DEFAULT 0,
  min_daily_utility                 integer     NOT NULL DEFAULT 0,

  -- Day-off limits
  default_days_off_per_week         integer     NOT NULL DEFAULT 1,
  max_same_role_off_per_day         integer     NOT NULL DEFAULT 2,
  max_therapists_off_per_day        integer     NOT NULL DEFAULT 1,
  protect_weekends                  boolean     NOT NULL DEFAULT true,

  -- Break & working hour rules
  default_break_minutes             integer     NOT NULL DEFAULT 60,
  auto_breaks_enabled               boolean     NOT NULL DEFAULT true,
  max_working_hours_per_day         numeric(4,2) NOT NULL DEFAULT 8,
  max_services_per_staff_per_day    integer,

  -- Auto-blocking
  auto_generate_breaks              boolean     NOT NULL DEFAULT true,
  auto_generate_travel_buffers      boolean     NOT NULL DEFAULT true,
  auto_generate_room_reset_buffers  boolean     NOT NULL DEFAULT false,
  room_reset_buffer_minutes         integer     NOT NULL DEFAULT 15,

  -- Home service
  home_service_travel_buffer_minutes integer    NOT NULL DEFAULT 30,

  -- Approval flow
  suggestions_require_manager_approval boolean  NOT NULL DEFAULT true,

  created_at                        timestamptz NOT NULL DEFAULT now(),
  updated_at                        timestamptz NOT NULL DEFAULT now()
);

-- ── 2. staff_scheduling_preferences ─────────────────────────
-- Per-staff soft constraints (preferred days off, capability flags, limits).
CREATE TABLE IF NOT EXISTS public.staff_scheduling_preferences (
  id                                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id                            uuid        NOT NULL UNIQUE REFERENCES public.staff(id) ON DELETE CASCADE,
  branch_id                           uuid        REFERENCES public.branches(id) ON DELETE CASCADE,

  -- Day-off preference (0=Sun … 6=Sat, matching staff_schedules.day_of_week)
  preferred_day_off                   smallint    CHECK (preferred_day_off BETWEEN 0 AND 6),
  secondary_preferred_day_off         smallint    CHECK (secondary_preferred_day_off BETWEEN 0 AND 6),

  -- Default break window
  default_break_start                 time,
  default_break_end                   time,

  -- Capability flags (can be auto-populated from staff_type but overridable)
  can_do_home_service                 boolean     NOT NULL DEFAULT false,
  can_drive                           boolean     NOT NULL DEFAULT false,

  -- Work limits
  max_services_per_day                integer,
  max_trips_per_day                   integer,
  max_working_hours_per_day           numeric(4,2),

  requires_manager_approval_for_changes boolean   NOT NULL DEFAULT true,

  created_at                          timestamptz NOT NULL DEFAULT now(),
  updated_at                          timestamptz NOT NULL DEFAULT now()
);

-- ── 3. schedule_suggestions ──────────────────────────────────
-- System-generated suggestions awaiting manager approval.
CREATE TABLE IF NOT EXISTS public.schedule_suggestions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       uuid        NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  staff_id        uuid        REFERENCES public.staff(id) ON DELETE SET NULL,

  suggestion_type text        NOT NULL
    CHECK (suggestion_type IN (
      'move_day_off', 'add_day_off', 'add_break_block',
      'add_travel_buffer', 'add_room_reset_buffer',
      'reassign_booking', 'adjust_shift', 'mark_staff_unavailable',
      'resolve_understaffing'
    )),

  target_date     date        NOT NULL,
  start_time      time,
  end_time        time,

  current_value   jsonb,
  suggested_value jsonb       NOT NULL,

  reason          text        NOT NULL,
  impact_summary  text,

  priority        text        NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'critical')),

  status          text        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'applied', 'expired', 'cancelled')),

  created_by      text        NOT NULL DEFAULT 'system',
  approved_by     uuid        REFERENCES public.staff(id) ON DELETE SET NULL,
  approved_at     timestamptz,
  rejected_by     uuid        REFERENCES public.staff(id) ON DELETE SET NULL,
  rejected_at     timestamptz,
  applied_at      timestamptz,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ── 4. schedule_health_checks ────────────────────────────────
-- Daily coverage snapshot per branch.
CREATE TABLE IF NOT EXISTS public.schedule_health_checks (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id                   uuid        NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  check_date                  date        NOT NULL,

  status                      text        NOT NULL DEFAULT 'ok'
    CHECK (status IN ('ok', 'warning', 'critical')),

  scheduled_staff_count       integer     NOT NULL DEFAULT 0,
  available_staff_count       integer     NOT NULL DEFAULT 0,
  checked_in_staff_count      integer,

  scheduled_therapists_count  integer     NOT NULL DEFAULT 0,
  available_therapists_count  integer     NOT NULL DEFAULT 0,

  scheduled_drivers_count     integer     NOT NULL DEFAULT 0,
  available_drivers_count     integer     NOT NULL DEFAULT 0,

  missing_staff_count         integer     NOT NULL DEFAULT 0,
  affected_bookings_count     integer     NOT NULL DEFAULT 0,

  issues          jsonb       NOT NULL DEFAULT '[]'::jsonb,
  recommendations jsonb       NOT NULL DEFAULT '[]'::jsonb,

  created_at                  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (branch_id, check_date)
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS schedule_suggestions_branch_status_idx
  ON public.schedule_suggestions (branch_id, status, target_date);

CREATE INDEX IF NOT EXISTS schedule_suggestions_staff_idx
  ON public.schedule_suggestions (staff_id, status);

CREATE INDEX IF NOT EXISTS schedule_health_branch_date_idx
  ON public.schedule_health_checks (branch_id, check_date DESC);

-- ── Updated-at triggers ───────────────────────────────────────
-- fn_update_updated_at() is defined in 20260429000004_triggers.sql
DROP TRIGGER IF EXISTS scheduling_rules_updated_at ON public.scheduling_rules;
CREATE TRIGGER scheduling_rules_updated_at
  BEFORE UPDATE ON public.scheduling_rules
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at();

DROP TRIGGER IF EXISTS staff_sched_prefs_updated_at ON public.staff_scheduling_preferences;
CREATE TRIGGER staff_sched_prefs_updated_at
  BEFORE UPDATE ON public.staff_scheduling_preferences
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at();

DROP TRIGGER IF EXISTS schedule_suggestions_updated_at ON public.schedule_suggestions;
CREATE TRIGGER schedule_suggestions_updated_at
  BEFORE UPDATE ON public.schedule_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at();

-- ── Row-Level Security ────────────────────────────────────────

-- scheduling_rules: managers read/write their own branch; owners read/write all their branches
ALTER TABLE public.scheduling_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "managers_own_branch_scheduling_rules"
  ON public.scheduling_rules
  FOR ALL
  USING (branch_id = public.get_auth_branch_id())
  WITH CHECK (branch_id = public.get_auth_branch_id());

CREATE POLICY "owners_all_scheduling_rules"
  ON public.scheduling_rules
  FOR ALL
  USING (public.get_auth_role() = 'owner')
  WITH CHECK (public.get_auth_role() = 'owner');

-- staff_scheduling_preferences: staff can read their own; managers/owners can read/write their branch
ALTER TABLE public.staff_scheduling_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_own_preferences"
  ON public.staff_scheduling_preferences
  FOR SELECT
  USING (
    staff_id IN (
      SELECT id FROM public.staff WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "managers_branch_staff_preferences"
  ON public.staff_scheduling_preferences
  FOR ALL
  USING (branch_id = public.get_auth_branch_id())
  WITH CHECK (branch_id = public.get_auth_branch_id());

CREATE POLICY "owners_all_staff_preferences"
  ON public.staff_scheduling_preferences
  FOR ALL
  USING (public.get_auth_role() = 'owner')
  WITH CHECK (public.get_auth_role() = 'owner');

-- schedule_suggestions: managers read/write their branch; staff read only their own pending suggestions
ALTER TABLE public.schedule_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "managers_branch_suggestions"
  ON public.schedule_suggestions
  FOR ALL
  USING (branch_id = public.get_auth_branch_id())
  WITH CHECK (branch_id = public.get_auth_branch_id());

CREATE POLICY "owners_all_suggestions"
  ON public.schedule_suggestions
  FOR ALL
  USING (public.get_auth_role() = 'owner')
  WITH CHECK (public.get_auth_role() = 'owner');

CREATE POLICY "staff_own_suggestions_read"
  ON public.schedule_suggestions
  FOR SELECT
  USING (
    staff_id IN (
      SELECT id FROM public.staff WHERE auth_user_id = auth.uid()
    )
  );

-- schedule_health_checks: read for managers/owners; system writes via service role
ALTER TABLE public.schedule_health_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "managers_branch_health_read"
  ON public.schedule_health_checks
  FOR SELECT
  USING (branch_id = public.get_auth_branch_id());

CREATE POLICY "owners_all_health_read"
  ON public.schedule_health_checks
  FOR SELECT
  USING (public.get_auth_role() = 'owner');

CREATE POLICY "managers_branch_health_write"
  ON public.schedule_health_checks
  FOR INSERT
  WITH CHECK (branch_id = public.get_auth_branch_id());

CREATE POLICY "owners_health_write"
  ON public.schedule_health_checks
  FOR INSERT
  WITH CHECK (public.get_auth_role() = 'owner');
