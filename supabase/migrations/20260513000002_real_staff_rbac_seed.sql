-- =============================================================================
-- CradleHub — Migration: Real Cradle Staff RBAC Seed
-- =============================================================================
-- Requires: migration 20260513000001_rbac_role_constraint_fix.sql
-- (The new system_role values used below must be in the CHECK constraint.)
--
-- This migration:
--   1. Inserts Anna Liza F. Lacson as the Owner record.
--   2. Updates all existing staff records (seeded by migration 010) to use
--      the correct, precise system_role for each position.
--
-- NOTE: Targets the live schema which does NOT have staff_type, is_head,
-- is_cross_branch, or job_title columns. Only columns present in the live
-- staff table are referenced: id, branch_id, full_name, tier, system_role,
-- is_active, auth_user_id, created_at, updated_at.
-- tier only allows 'senior' | 'mid' | 'junior' — 'n/a' is not valid.
--
-- All operations are idempotent:
--   - INSERT uses ON CONFLICT (id) DO UPDATE so re-running corrects any drift.
--   - UPDATE targets fixed UUIDs from migration 010 — safe to re-run.
--
-- No auth_user_id is set — staff are invited via the owner workspace UI.
-- =============================================================================


-- ── Owner ────────────────────────────────────────────────────────────────────
-- Anna Liza F. Lacson — Owner.
INSERT INTO staff (
  id,
  branch_id,
  full_name,
  tier,
  system_role,
  is_active
)
VALUES (
  'e0000000-0000-0000-0000-000000000001',
  'c1000000-0000-0000-0000-000000000001',
  'Anna Liza F. Lacson',
  'junior',
  'owner',
  FALSE
)
ON CONFLICT (id) DO UPDATE SET
  system_role = EXCLUDED.system_role;


-- ── Management: system_role corrections ──────────────────────────────────────
-- Charilyn Abellar and Lyn Me T. Bayato already have correct roles from
-- migration 010 (manager / assistant_manager). No changes needed.

-- Mylene Grace B. Deraco — Store Manager, SM Branch.
-- Migration 010 may have stored her as 'manager'; correct to store_manager.
UPDATE staff
SET system_role = 'store_manager'
WHERE id = 'e5000000-0000-0000-0000-000000000001';


-- ── CSR: precise csr_head / csr_staff ────────────────────────────────────────
-- Jonalyn T. Villando — CSR Head, Main Branch
UPDATE staff
SET system_role = 'csr_head'
WHERE id = 'e2000000-0000-0000-0000-000000000001';

-- Main Branch CSR staff
UPDATE staff
SET system_role = 'csr_staff'
WHERE id IN (
  'e2000000-0000-0000-0000-000000000002',  -- Nikki D. Jumiller
  'e2000000-0000-0000-0000-000000000003',  -- Apple Rose Roque
  'e2000000-0000-0000-0000-000000000004'   -- Michelle Duqueza
);

-- SM Branch CSR staff
UPDATE staff
SET system_role = 'csr_staff'
WHERE id IN (
  'e5000000-0000-0000-0000-000000000002',  -- Mary Ann J. Gerafil
  'e5000000-0000-0000-0000-000000000003'   -- Karen Grace P. Panti
);


-- ── Salon / Therapy: service_head / service_staff ────────────────────────────
-- Reynante Jacinto — Salon Head, Main Branch
UPDATE staff
SET system_role = 'service_head'
WHERE id = 'e3000000-0000-0000-0000-000000000001';

-- Nail Technicians + Aesthetician, Main Branch
UPDATE staff
SET system_role = 'service_staff'
WHERE id IN (
  'e3000000-0000-0000-0000-000000000002',  -- Renalyn Tiangson
  'e3000000-0000-0000-0000-000000000003',  -- Melrose Canoy
  'e3000000-0000-0000-0000-000000000004'   -- Riza Tambocon
);

-- Therapists
UPDATE staff
SET system_role = 'service_staff'
WHERE id IN (
  'e4000000-0000-0000-0000-000000000001',  -- Lya Descutido
  'e4000000-0000-0000-0000-000000000002',  -- Shiela Caburnay
  'e4000000-0000-0000-0000-000000000003'   -- Divina Batisla-on
);


-- ── Drivers ──────────────────────────────────────────────────────────────────
UPDATE staff
SET system_role = 'driver'
WHERE id IN (
  'e6000000-0000-0000-0000-000000000001',  -- Daniel T. Depaloma
  'e6000000-0000-0000-0000-000000000002',  -- Dante T. Depaloma
  'e6000000-0000-0000-0000-000000000003'   -- Danilo T. Depaloma Jr.
);


-- ── Utility / Housekeeping ────────────────────────────────────────────────────
UPDATE staff
SET system_role = 'utility'
WHERE id IN (
  'e6000000-0000-0000-0000-000000000004',  -- Lilanie Ampodia
  'e6000000-0000-0000-0000-000000000005'   -- Elena Bantillo
);
