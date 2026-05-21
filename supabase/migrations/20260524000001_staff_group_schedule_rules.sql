-- =============================================================================
-- CradleHub Phase 2H — Universal Group Schedule Rules
-- =============================================================================
-- Adds staff_schedule_groups and staff_group_schedule_rules tables.
--
-- Core concept:
--   - Each branch has staff groups (Therapists, Drivers, CRM/Front Desk, etc.)
--   - Each group has default weekly schedule rules
--   - Individual staff_schedules override group defaults when needed
--   - Date overrides and blocked times still apply on top
-- =============================================================================

-- ─── Groups table ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.staff_schedule_groups (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  branch_id   UUID        NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,

  group_key   TEXT        NOT NULL,
  group_name  TEXT        NOT NULL,

  description TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT true,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT staff_schedule_groups_branch_group_key_unique
    UNIQUE (branch_id, group_key)
);

COMMENT ON TABLE public.staff_schedule_groups IS
  'Staff schedule groups per branch. Default weekly schedule rules are stored '
  'in staff_group_schedule_rules. Individual staff_schedules override group '
  'defaults when customized.';

COMMENT ON COLUMN public.staff_schedule_groups.group_key IS
  'Stable identifier like therapist, driver, csr, utility, managerial, nail_tech, aesthetician.';

-- ─── Group schedule rules table ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.staff_group_schedule_rules (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  group_id    UUID        NOT NULL REFERENCES public.staff_schedule_groups(id) ON DELETE CASCADE,

  day_of_week INTEGER     NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),

  shift_type  TEXT        NOT NULL DEFAULT 'single'
                CHECK (shift_type IN ('single', 'opening', 'closing')),

  start_time  TIME,
  end_time    TIME,

  is_day_off  BOOLEAN     NOT NULL DEFAULT false,
  is_active   BOOLEAN     NOT NULL DEFAULT true,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT staff_group_schedule_rules_group_day_shift_unique
    UNIQUE (group_id, day_of_week, shift_type)
);

COMMENT ON TABLE public.staff_group_schedule_rules IS
  'Default weekly schedule rules for a staff group. One row per day per shift_type. '
  'is_day_off=true means the group has the day off (start_time/end_time ignored).';

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS staff_schedule_groups_branch_idx
  ON public.staff_schedule_groups(branch_id);

CREATE INDEX IF NOT EXISTS staff_group_schedule_rules_group_day_idx
  ON public.staff_group_schedule_rules(group_id, day_of_week);

-- ─── updated_at triggers ─────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_staff_schedule_groups_updated_at
  ON public.staff_schedule_groups;
CREATE TRIGGER trg_staff_schedule_groups_updated_at
  BEFORE UPDATE ON public.staff_schedule_groups
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at();

DROP TRIGGER IF EXISTS trg_staff_group_schedule_rules_updated_at
  ON public.staff_group_schedule_rules;
CREATE TRIGGER trg_staff_group_schedule_rules_updated_at
  BEFORE UPDATE ON public.staff_group_schedule_rules
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at();

-- ─── Row Level Security ──────────────────────────────────────────────────────

ALTER TABLE public.staff_schedule_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_group_schedule_rules ENABLE ROW LEVEL SECURITY;

-- Owner: full access across all branches
DROP POLICY IF EXISTS "schedule_groups_owner_all" ON public.staff_schedule_groups;
CREATE POLICY "schedule_groups_owner_all"
  ON public.staff_schedule_groups FOR ALL
  TO authenticated
  USING     (get_auth_role() = 'owner')
  WITH CHECK (get_auth_role() = 'owner');

DROP POLICY IF EXISTS "schedule_group_rules_owner_all" ON public.staff_group_schedule_rules;
CREATE POLICY "schedule_group_rules_owner_all"
  ON public.staff_group_schedule_rules FOR ALL
  TO authenticated
  USING     (get_auth_role() = 'owner')
  WITH CHECK (get_auth_role() = 'owner');

-- Manager roles: full access for own branch only
DROP POLICY IF EXISTS "schedule_groups_manager_branch_all" ON public.staff_schedule_groups;
CREATE POLICY "schedule_groups_manager_branch_all"
  ON public.staff_schedule_groups FOR ALL
  TO authenticated
  USING (
    get_auth_role() IN ('manager', 'assistant_manager', 'store_manager')
    AND branch_id = get_auth_branch_id()
  )
  WITH CHECK (
    get_auth_role() IN ('manager', 'assistant_manager', 'store_manager')
    AND branch_id = get_auth_branch_id()
  );

DROP POLICY IF EXISTS "schedule_group_rules_manager_branch_all" ON public.staff_group_schedule_rules;
CREATE POLICY "schedule_group_rules_manager_branch_all"
  ON public.staff_group_schedule_rules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_schedule_groups g
      WHERE g.id = staff_group_schedule_rules.group_id
        AND g.branch_id = get_auth_branch_id()
    )
    AND get_auth_role() IN ('manager', 'assistant_manager', 'store_manager')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff_schedule_groups g
      WHERE g.id = staff_group_schedule_rules.group_id
        AND g.branch_id = get_auth_branch_id()
    )
    AND get_auth_role() IN ('manager', 'assistant_manager', 'store_manager')
  );

-- CRM / CSR roles: full access for own branch
DROP POLICY IF EXISTS "schedule_groups_csr_branch_all" ON public.staff_schedule_groups;
CREATE POLICY "schedule_groups_csr_branch_all"
  ON public.staff_schedule_groups FOR ALL
  TO authenticated
  USING (
    get_auth_role() IN ('crm', 'csr_head', 'csr_staff')
    AND branch_id = get_auth_branch_id()
  )
  WITH CHECK (
    get_auth_role() IN ('crm', 'csr_head', 'csr_staff')
    AND branch_id = get_auth_branch_id()
  );

DROP POLICY IF EXISTS "schedule_group_rules_csr_branch_all" ON public.staff_group_schedule_rules;
CREATE POLICY "schedule_group_rules_csr_branch_all"
  ON public.staff_group_schedule_rules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_schedule_groups g
      WHERE g.id = staff_group_schedule_rules.group_id
        AND g.branch_id = get_auth_branch_id()
    )
    AND get_auth_role() IN ('crm', 'csr_head', 'csr_staff')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff_schedule_groups g
      WHERE g.id = staff_group_schedule_rules.group_id
        AND g.branch_id = get_auth_branch_id()
    )
    AND get_auth_role() IN ('crm', 'csr_head', 'csr_staff')
  );

-- Staff: read-only access to their own branch schedule groups
DROP POLICY IF EXISTS "schedule_groups_staff_read" ON public.staff_schedule_groups;
CREATE POLICY "schedule_groups_staff_read"
  ON public.staff_schedule_groups FOR SELECT
  TO authenticated
  USING (branch_id = get_auth_branch_id());

DROP POLICY IF EXISTS "schedule_group_rules_staff_read" ON public.staff_group_schedule_rules;
CREATE POLICY "schedule_group_rules_staff_read"
  ON public.staff_group_schedule_rules FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_schedule_groups g
      WHERE g.id = staff_group_schedule_rules.group_id
        AND g.branch_id = get_auth_branch_id()
    )
  );

-- ─── Data API grants ─────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.staff_schedule_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.staff_schedule_groups TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.staff_group_schedule_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.staff_group_schedule_rules TO service_role;

-- ─── Seed default groups for existing active branches ────────────────────────
-- Idempotent: uses ON CONFLICT so it can be re-run safely.

INSERT INTO public.staff_schedule_groups (branch_id, group_key, group_name, description)
SELECT
  b.id,
  g.group_key,
  g.group_name,
  g.description
FROM public.branches b
CROSS JOIN (VALUES
  ('therapist',    'Therapists',        'Default schedule for therapist staff'),
  ('driver',       'Drivers',           'Default schedule for driver staff'),
  ('csr',          'CRM / Front Desk',  'Default schedule for CRM and front-desk staff'),
  ('utility',      'Utility',           'Default schedule for utility staff'),
  ('managerial',   'Managers',          'Default schedule for managerial staff'),
  ('nail_tech',    'Salon / Nail Tech', 'Default schedule for salon and nail tech staff'),
  ('aesthetician', 'Aesthetician',      'Default schedule for aesthetician staff')
) AS g(group_key, group_name, description)
WHERE b.is_active = true
ON CONFLICT (branch_id, group_key) DO NOTHING;
