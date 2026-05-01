-- =============================================================================
-- CradleHub — Migration: CSR Role Expansion
-- =============================================================================
-- Adds distinct csr_head and csr_staff system_role values for front-desk
-- team access control. Keeps existing 'csr' role for backward compatibility.
--
-- BACKWARD COMPATIBILITY:
--   Existing 'csr' users continue to work. New invite flow supports both
--   csr_head and csr_staff.
-- =============================================================================

-- ── 1. Expand system_role CHECK constraint ──────────────────────────────────
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_system_role_check;
ALTER TABLE staff ADD CONSTRAINT staff_system_role_check
  CHECK (system_role IN (
    'owner',
    'manager',
    'assistant_manager',
    'store_manager',
    'crm',
    'csr',
    'csr_head',
    'csr_staff',
    'staff'
  ));

COMMENT ON COLUMN staff.system_role IS
  'Controls which workspace the user sees on login.
   owner             = President/Owner/GM — full system access
   manager           = Branch Manager — cross-branch operations
   assistant_manager = Asst. Branch Manager — same as manager workspace
   store_manager     = Store Manager (e.g. SM Branch) — branch-scoped manager view
   crm               = CRM/Analytics team — customer data and reports
   csr               = Customer Service Rep (legacy, same as csr_staff)
   csr_head          = CSR Supervisor — can cancel/reassign bookings, view reports
   csr_staff         = Front-desk CSR — booking creation, customer lookup, schedule view
   staff             = Therapist/Technician — own schedule and bookings only';


-- ── 2. Update role_definitions reference table ──────────────────────────────
INSERT INTO role_definitions (system_role, display_name, description, workspace, can_book, can_manage)
VALUES
  ('csr_head',
   'CSR Head',
   'Front-desk supervisor. Can create bookings, cancel bookings, reassign therapists, and view light operational reports.',
   '/crm', TRUE, FALSE),

  ('csr_staff',
   'CSR Staff',
   'Front-desk team member. Can create walk-in and phone bookings, manage customers, and view the schedule.',
   '/crm', TRUE, FALSE)
ON CONFLICT (system_role) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      description  = EXCLUDED.description,
      workspace    = EXCLUDED.workspace,
      can_book     = EXCLUDED.can_book,
      can_manage   = EXCLUDED.can_manage;


-- ── 3. Update job_title_definitions for CSR roles ───────────────────────────
-- CSR Head Main → csr_head
-- CSR Staff → csr_staff
INSERT INTO job_title_definitions (job_title, department_id, system_role, tier, is_service, display_order)
VALUES
  ('CSR Head Main', 'd1000000-0000-0000-0000-000000000003', 'csr_head', 'head', FALSE, 5),
  ('CSR Staff',     'd1000000-0000-0000-0000-000000000003', 'csr_staff', 'n/a', FALSE, 6)
ON CONFLICT (job_title) DO UPDATE
  SET system_role = EXCLUDED.system_role,
      tier        = EXCLUDED.tier;
