-- =============================================================================
-- CradleHub — Migration 009: Staff Role & Department Expansion
-- =============================================================================
-- Aligns the staff table with the actual Cradle Wellness Living Inc.
-- organizational structure from the official org chart document.
--
-- CHANGES:
--   1. Add department_id — links staff to their department
--   2. Add job_title — stores the exact title from the org structure
--      (e.g., "Nail Technician", "Aesthetician/Facialist", "CSR Head", "Driver")
--   3. Expand system_role CHECK — adds assistant_manager, store_manager, csr
--   4. Expand tier CHECK — adds 'head' (Salon Head, CSR Head) and 'n/a'
--      (for drivers, utility, CSR who don't have a seniority tier)
--   5. Add is_cross_branch flag — for roles like Manager and Asst. Manager
--      who oversee multiple branches simultaneously
--
-- BACKWARD COMPATIBILITY:
--   All existing data is preserved. New columns are nullable.
--   Existing CHECK constraints are dropped and re-added (safe for empty DB).
--   Once real staff data is entered, job_title and department_id can be set.
-- =============================================================================


-- ── 1. Department link ──────────────────────────────────────────────────────
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS department_id UUID
    REFERENCES departments(id) ON DELETE SET NULL;

COMMENT ON COLUMN staff.department_id IS
  'Which department this staff member belongs to. '
  'NULL = not yet assigned. Determines which services they can be booked for.';

CREATE INDEX IF NOT EXISTS idx_staff_department
  ON staff (department_id) WHERE department_id IS NOT NULL;


-- ── 2. Job title ────────────────────────────────────────────────────────────
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS job_title TEXT;

COMMENT ON COLUMN staff.job_title IS
  'Exact job title from the org structure. '
  'Examples: Therapist, Nail Technician, Aesthetician/Facialist, '
  'CSR, CSR Head, Salon Head, Store Manager, Assistant Manager, Driver, Utility.';


-- ── 3. Cross-branch flag ────────────────────────────────────────────────────
-- The Manager (Charilyn Abellar) and Asst. Manager (Lyn Me Bayato) oversee
-- BOTH branches simultaneously. This flag marks them as cross-branch.
-- Cross-branch staff can manage any branch without being tied to branch_id.
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS is_cross_branch BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN staff.is_cross_branch IS
  'TRUE for roles that oversee multiple branches simultaneously '
  '(e.g., Manager who manages both Main and SM branches). '
  'Cross-branch staff see all branches in their workspace.';


-- ── 4. Expand system_role CHECK ─────────────────────────────────────────────
-- New roles from org structure:
--   assistant_manager — Asst. Manager (same workspace as manager, cross-branch)
--   store_manager     — Store Manager for SM Branch (branch-scoped, under manager)
--   csr               — Customer Service Rep (front desk, distinct from analytics crm)
--
-- The existing 'crm' role stays for backward compatibility but going forward
-- CSR staff get 'csr' role. The 'crm' role will be the analytics/reporting role.
--
-- Workspace routing update (in proxy.ts):
--   owner             → /owner
--   manager           → /manager (cross-branch schedule + operations)
--   assistant_manager → /manager (same workspace as manager)
--   store_manager     → /manager (branch-scoped version)
--   crm               → /crm (analytics, repeat/lapsed customers)
--   csr               → /manager/walkin (front desk — walk-in creation + schedule view)
--   staff             → /staff-portal (own schedule only)

ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_system_role_check;
ALTER TABLE staff ADD CONSTRAINT staff_system_role_check
  CHECK (system_role IN (
    'owner',
    'manager',
    'assistant_manager',
    'store_manager',
    'crm',
    'csr',
    'staff'
  ));

COMMENT ON COLUMN staff.system_role IS
  'Controls which workspace the user sees on login.
   owner             = President/Owner/GM — full system access
   manager           = Branch Manager — cross-branch operations
   assistant_manager = Asst. Branch Manager — same as manager workspace
   store_manager     = Store Manager (e.g. SM Branch) — branch-scoped manager view
   crm               = CRM/Analytics team — customer data and reports
   csr               = Customer Service Rep — front desk, walk-ins, phone bookings
   staff             = Therapist/Technician — own schedule and bookings only';


-- ── 5. Expand tier CHECK ────────────────────────────────────────────────────
-- New tiers from org structure:
--   head — Department heads (Salon Head: Reynante Jacinto, CSR Head: Jonalyn Villando)
--   n/a  — Non-service roles with no seniority tier (Drivers, Utility, CSR)
--
-- Existing tiers kept: senior, mid, junior (for therapist seniority)

ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_tier_check;
ALTER TABLE staff ADD CONSTRAINT staff_tier_check
  CHECK (tier IN ('senior', 'mid', 'junior', 'head', 'n/a'));

COMMENT ON COLUMN staff.tier IS
  'Staff classification within their role.
   senior / mid / junior — Therapist seniority (used for any-therapist assignment)
   head                  — Department head (Salon Head, CSR Head)
   n/a                   — Non-service roles: Drivers, Utility, CSR staff';


-- =============================================================================
-- ROLE REFERENCE TABLE (read-only, for UI display)
-- =============================================================================
-- Documents what each role means in the Cradle org structure.
-- Used by the owner's staff management UI to show role descriptions.

CREATE TABLE IF NOT EXISTS role_definitions (
  system_role   TEXT        PRIMARY KEY,
  display_name  TEXT        NOT NULL,
  description   TEXT        NOT NULL,
  workspace     TEXT        NOT NULL,
  can_book      BOOLEAN     NOT NULL DEFAULT FALSE,
  can_manage    BOOLEAN     NOT NULL DEFAULT FALSE,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE
);

INSERT INTO role_definitions (system_role, display_name, description, workspace, can_book, can_manage)
VALUES
  ('owner',
   'Owner / General Manager',
   'President and General Manager. Full access to all branches, all data, all settings.',
   '/owner', TRUE, TRUE),

  ('manager',
   'Branch Manager',
   'Manages daily operations across all branches. Same person manages both Main and SM branches.',
   '/manager', TRUE, TRUE),

  ('assistant_manager',
   'Assistant Branch Manager',
   'Supports the Branch Manager across both branches. Same workspace access as Manager.',
   '/manager', TRUE, TRUE),

  ('store_manager',
   'Store Manager',
   'Manages a specific branch location (e.g. SM Branch). Reports to Branch Manager.',
   '/manager', TRUE, TRUE),

  ('crm',
   'CRM / Analytics',
   'Customer relationship management. Views customer history, repeat and lapsed client reports.',
   '/crm', FALSE, FALSE),

  ('csr',
   'Customer Service Representative',
   'Front desk team. Creates walk-in bookings, handles phone reservations, manages the appointment queue.',
   '/manager/walkin', TRUE, FALSE),

  ('staff',
   'Therapist / Technician',
   'Service staff. Sees own schedule and assigned bookings only. Cannot view other staff or customer contacts.',
   '/staff-portal', FALSE, FALSE)
ON CONFLICT (system_role) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      description  = EXCLUDED.description,
      workspace    = EXCLUDED.workspace,
      can_book     = EXCLUDED.can_book,
      can_manage   = EXCLUDED.can_manage;


-- =============================================================================
-- JOB TITLE REFERENCE TABLE
-- =============================================================================
-- Enumerates all job titles from the org structure.
-- Used as a dropdown in the staff invite form.

CREATE TABLE IF NOT EXISTS job_title_definitions (
  job_title     TEXT        PRIMARY KEY,
  department_id UUID        REFERENCES departments(id),
  system_role   TEXT        NOT NULL,
  tier          TEXT        NOT NULL DEFAULT 'n/a',
  is_service    BOOLEAN     NOT NULL DEFAULT FALSE, -- does this role serve customers directly?
  display_order INT         NOT NULL DEFAULT 0
);

INSERT INTO job_title_definitions (job_title, department_id, system_role, tier, is_service, display_order)
VALUES
  -- Management
  ('General Manager',      NULL,                                             'owner',             'n/a',    FALSE, 1),
  ('Branch Manager',       NULL,                                             'manager',           'n/a',    FALSE, 2),
  ('Assistant Manager',    NULL,                                             'assistant_manager', 'n/a',    FALSE, 3),
  ('Store Manager',        NULL,                                             'store_manager',     'n/a',    FALSE, 4),

  -- Customer Service Department
  ('CSR Head',             'd1000000-0000-0000-0000-000000000003',           'csr',               'head',   FALSE, 5),
  ('CSR',                  'd1000000-0000-0000-0000-000000000003',           'csr',               'n/a',    FALSE, 6),

  -- Massage & Therapy Department
  ('Senior Therapist',     'd1000000-0000-0000-0000-000000000001',           'staff',             'senior', TRUE,  7),
  ('Mid Therapist',        'd1000000-0000-0000-0000-000000000001',           'staff',             'mid',    TRUE,  8),
  ('Junior Therapist',     'd1000000-0000-0000-0000-000000000001',           'staff',             'junior', TRUE,  9),

  -- Salon Department
  ('Salon Head',           'd1000000-0000-0000-0000-000000000002',           'staff',             'head',   TRUE,  10),
  ('Nail Technician',      'd1000000-0000-0000-0000-000000000002',           'staff',             'senior', TRUE,  11),
  ('Aesthetician/Facialist','d1000000-0000-0000-0000-000000000002',          'staff',             'senior', TRUE,  12),

  -- Operations & Support Department
  ('Driver',               'd1000000-0000-0000-0000-000000000004',           'staff',             'n/a',    FALSE, 13),
  ('Utility',              'd1000000-0000-0000-0000-000000000004',           'staff',             'n/a',    FALSE, 14)
ON CONFLICT (job_title) DO NOTHING;

COMMENT ON TABLE job_title_definitions IS
  'All official job titles from the Cradle Wellness Living Inc. org structure. '
  'Used to auto-populate system_role and tier when the owner creates a staff record.';


-- =============================================================================
-- UPDATE EXISTING STAFF QUERY FUNCTION (helper)
-- =============================================================================
-- Function to get staff eligible for booking a specific service category.
-- Used by the booking flow instead of raw getStaffByBranch.
-- Only returns staff who have that service category in staff_service_categories.

CREATE OR REPLACE FUNCTION get_bookable_staff(
  p_branch_id         UUID,
  p_service_category_id UUID
)
RETURNS TABLE (
  id        UUID,
  full_name TEXT,
  tier      TEXT,
  job_title TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.full_name,
    s.tier,
    s.job_title
  FROM staff s
  JOIN staff_service_categories ssc ON ssc.staff_id = s.id
  WHERE s.is_active = TRUE
    AND ssc.service_category_id = p_service_category_id
    -- Cross-branch staff appear for any branch; branch-specific staff only for their branch
    AND (s.branch_id = p_branch_id OR s.is_cross_branch = TRUE)
  GROUP BY
    s.id,
    s.full_name,
    s.tier,
    s.job_title
  ORDER BY
    CASE s.tier
      WHEN 'head'   THEN 0
      WHEN 'senior' THEN 1
      WHEN 'mid'    THEN 2
      WHEN 'junior' THEN 3
      ELSE 4
    END,
    s.full_name;
$$;

COMMENT ON FUNCTION get_bookable_staff IS
  'Returns only staff who are qualified to perform a specific service category. '
  'Filters by staff_service_categories — staff with no entries are excluded. '
  'Used by the booking flow to populate the therapist selector correctly. '
  'Cross-branch staff appear for any branch.';
