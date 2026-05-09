-- =============================================================================
-- CradleHub — Migration: Real Cradle Staff RBAC Seed
-- =============================================================================
-- Requires: migration 20260513000001_rbac_role_constraint_fix.sql
-- (The new system_role values used below must be in the CHECK constraint.)
--
-- This migration:
--   1. Inserts Anna Liza F. Lacson as the Owner record.
--   2. Updates all existing staff records (seeded by migration 010) to use
--      the correct, precise system_role and staff_type for each position.
--
-- All operations are idempotent:
--   - INSERT uses ON CONFLICT (id) DO UPDATE so re-running corrects any drift.
--   - UPDATE targets fixed UUIDs from migration 010 — safe to re-run.
--
-- No auth_user_id is set — staff are invited via the owner workspace UI.
-- Existing rows with is_active = FALSE are left as-is (inactive until invited).
-- =============================================================================


-- ── Owner ────────────────────────────────────────────────────────────────────
-- Anna Liza F. Lacson — Owner, cross-branch executive.
-- Primary branch set to Main; is_cross_branch = TRUE because she oversees both.
-- Future improvement: a staff_branch_assignments junction table would handle
-- multi-branch executives more precisely.
INSERT INTO staff (
  id,
  branch_id,
  full_name,
  tier,
  system_role,
  staff_type,
  job_title,
  is_head,
  is_cross_branch,
  is_active
)
VALUES (
  'e0000000-0000-0000-0000-000000000001',
  'c1000000-0000-0000-0000-000000000001',
  'Anna Liza F. Lacson',
  'n/a',
  'owner',
  'managerial',
  'Owner',
  FALSE,
  TRUE,
  FALSE
)
ON CONFLICT (id) DO UPDATE SET
  system_role     = EXCLUDED.system_role,
  staff_type      = EXCLUDED.staff_type,
  job_title       = EXCLUDED.job_title,
  is_cross_branch = EXCLUDED.is_cross_branch;


-- ── Management: staff_type + is_cross_branch ─────────────────────────────────
-- Charilyn Abellar (manager) and Lyn Me T. Bayato (assistant_manager)
-- already have the correct system_role from migration 010; fill missing fields.
UPDATE staff
SET
  staff_type      = 'managerial',
  is_cross_branch = TRUE
WHERE id IN (
  'e1000000-0000-0000-0000-000000000001',  -- Charilyn Abellar, Branch Manager
  'e1000000-0000-0000-0000-000000000002'   -- Lyn Me T. Bayato, Asst. Manager
);

-- Mylene Grace B. Deraco — Store Manager, SM Branch (not cross-branch)
UPDATE staff
SET staff_type = 'managerial'
WHERE id = 'e5000000-0000-0000-0000-000000000001';


-- ── CSR: precise csr_head / csr_staff + staff_type ───────────────────────────
-- Jonalyn T. Villando — CSR Head, Main Branch
UPDATE staff
SET system_role = 'csr_head', staff_type = 'csr', is_head = TRUE
WHERE id = 'e2000000-0000-0000-0000-000000000001';

-- Main Branch CSR staff
UPDATE staff
SET system_role = 'csr_staff', staff_type = 'csr'
WHERE id IN (
  'e2000000-0000-0000-0000-000000000002',  -- Nikki D. Jumiller
  'e2000000-0000-0000-0000-000000000003',  -- Apple Rose Roque
  'e2000000-0000-0000-0000-000000000004'   -- Michelle Duqueza
);

-- SM Branch CSR staff
UPDATE staff
SET system_role = 'csr_staff', staff_type = 'csr'
WHERE id IN (
  'e5000000-0000-0000-0000-000000000002',  -- Mary Ann J. Gerafil
  'e5000000-0000-0000-0000-000000000003'   -- Karen Grace P. Panti
);


-- ── Salon department: service_head / service_staff ───────────────────────────
-- Reynante Jacinto — Salon Head, Main Branch
UPDATE staff
SET system_role = 'service_head', staff_type = 'salon_head', is_head = TRUE
WHERE id = 'e3000000-0000-0000-0000-000000000001';

-- Nail Technicians, Main Branch
UPDATE staff
SET system_role = 'service_staff', staff_type = 'nail_tech'
WHERE id IN (
  'e3000000-0000-0000-0000-000000000002',  -- Renalyn Tiangson
  'e3000000-0000-0000-0000-000000000003'   -- Melrose Canoy
);

-- Aesthetician / Facialist, Main Branch
UPDATE staff
SET system_role = 'service_staff', staff_type = 'aesthetician'
WHERE id = 'e3000000-0000-0000-0000-000000000004';  -- Riza Tambocon


-- ── Therapy department: service_staff ────────────────────────────────────────
UPDATE staff
SET system_role = 'service_staff', staff_type = 'therapist'
WHERE id IN (
  'e4000000-0000-0000-0000-000000000001',  -- Lya Descutido
  'e4000000-0000-0000-0000-000000000002',  -- Shiela Caburnay
  'e4000000-0000-0000-0000-000000000003'   -- Divina Batisla-on
);


-- ── Drivers ──────────────────────────────────────────────────────────────────
-- Previously stored as system_role='staff' / job_title='Driver'.
-- Now promoted to their own system_role='driver' for workspace routing.
UPDATE staff
SET system_role = 'driver', staff_type = 'driver'
WHERE id IN (
  'e6000000-0000-0000-0000-000000000001',  -- Daniel T. Depaloma
  'e6000000-0000-0000-0000-000000000002',  -- Dante T. Depaloma
  'e6000000-0000-0000-0000-000000000003'   -- Danilo T. Depaloma Jr.
);


-- ── Utility / Housekeeping ────────────────────────────────────────────────────
-- Previously stored as system_role='staff' / job_title='Utility'.
-- Now promoted to their own system_role='utility' for workspace routing.
UPDATE staff
SET system_role = 'utility', staff_type = 'utility'
WHERE id IN (
  'e6000000-0000-0000-0000-000000000004',  -- Lilanie Ampodia
  'e6000000-0000-0000-0000-000000000005'   -- Elena Bantillo
);
