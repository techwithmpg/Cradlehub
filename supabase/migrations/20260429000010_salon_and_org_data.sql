-- =============================================================================
-- CradleHub — Migration 010: Salon Service Categories + Org Data
-- =============================================================================
-- The org structure reveals a full Salon department (nail, facial) that is
-- completely separate from the Massage & Therapy department.
-- This migration adds the salon service categories and service stubs.
--
-- Also seeds the actual staff names from the org document for reference
-- (without auth_user_id — they will be invited later by the owner).
-- =============================================================================


-- ── Salon service categories ────────────────────────────────────────────────
INSERT INTO service_categories (id, name, display_order)
VALUES
  ('a1000000-0000-0000-0000-000000000007', 'Nail Care',         7),
  ('a1000000-0000-0000-0000-000000000008', 'Facial & Skincare', 8),
  ('a1000000-0000-0000-0000-000000000009', 'Hair & Salon',      9)
ON CONFLICT (id) DO NOTHING;


-- ── Salon service stubs (pricing TBD by owner) ──────────────────────────────
-- Prices set to 0.00 until owner configures them via the owner workspace.

INSERT INTO services (id, category_id, name, description, duration_minutes, price, buffer_before, buffer_after)
VALUES
  -- Nail Care
  ('b1000000-0000-0000-0000-000000000009',
   'a1000000-0000-0000-0000-000000000007',
   'Manicure',
   'Classic nail care for hands.',
   45, 0.00, 0, 5),

  ('b1000000-0000-0000-0000-000000000010',
   'a1000000-0000-0000-0000-000000000007',
   'Pedicure',
   'Classic nail care for feet.',
   60, 0.00, 0, 5),

  ('b1000000-0000-0000-0000-000000000011',
   'a1000000-0000-0000-0000-000000000007',
   'Gel Manicure',
   'Long-lasting gel nail application.',
   60, 0.00, 0, 5),

  ('b1000000-0000-0000-0000-000000000012',
   'a1000000-0000-0000-0000-000000000007',
   'Gel Pedicure',
   'Long-lasting gel nail application for feet.',
   75, 0.00, 0, 5),

  -- Facial & Skincare
  ('b1000000-0000-0000-0000-000000000013',
   'a1000000-0000-0000-0000-000000000008',
   'Classic Facial',
   'Deep cleansing facial treatment for all skin types.',
   60, 0.00, 5, 10),

  ('b1000000-0000-0000-0000-000000000014',
   'a1000000-0000-0000-0000-000000000008',
   'Whitening Facial',
   'Brightening treatment targeting uneven skin tone.',
   75, 0.00, 5, 10),

  ('b1000000-0000-0000-0000-000000000015',
   'a1000000-0000-0000-0000-000000000008',
   'Acne Facial',
   'Targeted treatment for acne-prone skin.',
   60, 0.00, 5, 10)
ON CONFLICT (id) DO NOTHING;


-- ── Link salon services to both branches ────────────────────────────────────
INSERT INTO branch_services (branch_id, service_id)
SELECT b.id, s.id
FROM branches b
CROSS JOIN services s
WHERE s.id IN (
  'b1000000-0000-0000-0000-000000000009',
  'b1000000-0000-0000-0000-000000000010',
  'b1000000-0000-0000-0000-000000000011',
  'b1000000-0000-0000-0000-000000000012',
  'b1000000-0000-0000-0000-000000000013',
  'b1000000-0000-0000-0000-000000000014',
  'b1000000-0000-0000-0000-000000000015'
)
ON CONFLICT (branch_id, service_id) DO NOTHING;


-- =============================================================================
-- NAMED STAFF FROM ORG DOCUMENT (no auth_user_id — for record only)
-- =============================================================================
-- These records establish the organizational hierarchy in the DB.
-- The owner will invite each person via the staff management UI,
-- which will update their auth_user_id when they accept the invite.
--
-- ALL inserted with is_active = FALSE until formally onboarded.
-- The owner activates them after inviting and onboarding each person.
--
-- Note: Using fixed UUIDs so future migrations can reference them.
-- =============================================================================

-- ── Management (cross-branch) ────────────────────────────────────────────────
INSERT INTO staff (id, branch_id, full_name, tier, system_role, job_title, is_cross_branch, is_active)
VALUES
  ('e1000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000001',  -- Main branch as primary
   'Charilyn Abellar', 'n/a', 'manager', 'Branch Manager', TRUE, FALSE),

  ('e1000000-0000-0000-0000-000000000002',
   'c1000000-0000-0000-0000-000000000001',
   'Lyn Me T. Bayato', 'n/a', 'assistant_manager', 'Assistant Manager', TRUE, FALSE)
ON CONFLICT (id) DO NOTHING;


-- ── Main Branch — CSR Department ─────────────────────────────────────────────
INSERT INTO staff (id, branch_id, full_name, tier, system_role, job_title, department_id, is_active)
VALUES
  ('e2000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000001',
   'Jonalyn T. Villando', 'head', 'csr', 'CSR Head',
   'd1000000-0000-0000-0000-000000000003', FALSE),

  ('e2000000-0000-0000-0000-000000000002',
   'c1000000-0000-0000-0000-000000000001',
   'Nikki D. Jumiller', 'n/a', 'csr', 'CSR',
   'd1000000-0000-0000-0000-000000000003', FALSE),

  ('e2000000-0000-0000-0000-000000000003',
   'c1000000-0000-0000-0000-000000000001',
   'Apple Rose Roque', 'n/a', 'csr', 'CSR',
   'd1000000-0000-0000-0000-000000000003', FALSE),

  ('e2000000-0000-0000-0000-000000000004',
   'c1000000-0000-0000-0000-000000000001',
   'Michelle Duqueza', 'n/a', 'csr', 'CSR',
   'd1000000-0000-0000-0000-000000000003', FALSE)
ON CONFLICT (id) DO NOTHING;


-- ── Main Branch — Salon Department ───────────────────────────────────────────
INSERT INTO staff (id, branch_id, full_name, tier, system_role, job_title, department_id, is_active)
VALUES
  ('e3000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000001',
   'Reynante Jacinto', 'head', 'staff', 'Salon Head',
   'd1000000-0000-0000-0000-000000000002', FALSE),

  ('e3000000-0000-0000-0000-000000000002',
   'c1000000-0000-0000-0000-000000000001',
   'Renalyn Tiangson', 'senior', 'staff', 'Nail Technician',
   'd1000000-0000-0000-0000-000000000002', FALSE),

  ('e3000000-0000-0000-0000-000000000003',
   'c1000000-0000-0000-0000-000000000001',
   'Melrose Canoy', 'senior', 'staff', 'Nail Technician',
   'd1000000-0000-0000-0000-000000000002', FALSE),

  ('e3000000-0000-0000-0000-000000000004',
   'c1000000-0000-0000-0000-000000000001',
   'Riza Tambocon', 'senior', 'staff', 'Aesthetician/Facialist',
   'd1000000-0000-0000-0000-000000000002', FALSE)
ON CONFLICT (id) DO NOTHING;

-- Link salon staff to salon service categories
INSERT INTO staff_service_categories (staff_id, service_category_id)
SELECT s.id, cat.id
FROM staff s
CROSS JOIN service_categories cat
WHERE s.job_title IN ('Nail Technician', 'Salon Head')
  AND cat.id = 'a1000000-0000-0000-0000-000000000007' -- Nail Care
ON CONFLICT (staff_id, service_category_id) DO NOTHING;

INSERT INTO staff_service_categories (staff_id, service_category_id)
SELECT s.id, cat.id
FROM staff s
CROSS JOIN service_categories cat
WHERE s.job_title IN ('Aesthetician/Facialist', 'Salon Head')
  AND cat.id = 'a1000000-0000-0000-0000-000000000008' -- Facial & Skincare
ON CONFLICT (staff_id, service_category_id) DO NOTHING;


-- ── Main Branch — Therapy Department ─────────────────────────────────────────
-- Only first few therapists seeded here as examples. Owner adds the rest via UI.
INSERT INTO staff (id, branch_id, full_name, tier, system_role, job_title, department_id, is_active)
VALUES
  ('e4000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000001',
   'Lya Descutido', 'senior', 'staff', 'Therapist',
   'd1000000-0000-0000-0000-000000000001', FALSE),

  ('e4000000-0000-0000-0000-000000000002',
   'c1000000-0000-0000-0000-000000000001',
   'Shiela Caburnay', 'senior', 'staff', 'Therapist',
   'd1000000-0000-0000-0000-000000000001', FALSE),

  ('e4000000-0000-0000-0000-000000000003',
   'c1000000-0000-0000-0000-000000000001',
   'Divina Batisla-on', 'mid', 'staff', 'Therapist',
   'd1000000-0000-0000-0000-000000000001', FALSE)
ON CONFLICT (id) DO NOTHING;

-- Link therapists to massage service categories
INSERT INTO staff_service_categories (staff_id, service_category_id)
SELECT s.id, cat.id
FROM staff s
CROSS JOIN service_categories cat
WHERE s.job_title = 'Therapist'
  AND cat.name IN ('Swedish Massage', 'Deep Tissue Massage', 'Hot Stone Therapy', 'Reflexology')
ON CONFLICT (staff_id, service_category_id) DO NOTHING;


-- ── SM Branch — Management ────────────────────────────────────────────────────
INSERT INTO staff (id, branch_id, full_name, tier, system_role, job_title, department_id, is_active)
VALUES
  ('e5000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000002',  -- SM Branch
   'Mylene Grace B. Deraco', 'n/a', 'store_manager', 'Store Manager', NULL, FALSE)
ON CONFLICT (id) DO NOTHING;


-- ── SM Branch — CSR ───────────────────────────────────────────────────────────
INSERT INTO staff (id, branch_id, full_name, tier, system_role, job_title, department_id, is_active)
VALUES
  ('e5000000-0000-0000-0000-000000000002',
   'c1000000-0000-0000-0000-000000000002',
   'Mary Ann J. Gerafil', 'n/a', 'csr', 'CSR',
   'd1000000-0000-0000-0000-000000000003', FALSE),

  ('e5000000-0000-0000-0000-000000000003',
   'c1000000-0000-0000-0000-000000000002',
   'Karen Grace P. Panti', 'n/a', 'csr', 'CSR',
   'd1000000-0000-0000-0000-000000000003', FALSE)
ON CONFLICT (id) DO NOTHING;


-- ── Support Staff (Main Branch) ───────────────────────────────────────────────
-- Drivers and Utility — system_role = 'staff' but no service categories
-- They appear in staff records for payroll/HR but NOT in booking flows

INSERT INTO staff (id, branch_id, full_name, tier, system_role, job_title, department_id, is_active)
VALUES
  ('e6000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000001',
   'Daniel T. Depaloma', 'n/a', 'staff', 'Driver',
   'd1000000-0000-0000-0000-000000000004', FALSE),

  ('e6000000-0000-0000-0000-000000000002',
   'c1000000-0000-0000-0000-000000000001',
   'Dante T. Depaloma', 'n/a', 'staff', 'Driver',
   'd1000000-0000-0000-0000-000000000004', FALSE),

  ('e6000000-0000-0000-0000-000000000003',
   'c1000000-0000-0000-0000-000000000001',
   'Danilo T. Depaloma Jr.', 'n/a', 'staff', 'Driver',
   'd1000000-0000-0000-0000-000000000004', FALSE),

  ('e6000000-0000-0000-0000-000000000004',
   'c1000000-0000-0000-0000-000000000001',
   'Lilanie Ampodia', 'n/a', 'staff', 'Utility',
   'd1000000-0000-0000-0000-000000000004', FALSE),

  ('e6000000-0000-0000-0000-000000000005',
   'c1000000-0000-0000-0000-000000000001',
   'Elena Bantillo', 'n/a', 'staff', 'Utility',
   'd1000000-0000-0000-0000-000000000004', FALSE)
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- PROXY.TS ROLE ROUTING UPDATE (documentation — implement in code)
-- =============================================================================
-- Update the ROLE_WORKSPACE mapping in src/proxy.ts:
--
-- const ROLE_WORKSPACE: Record<string, string> = {
--   owner:             "/owner",
--   manager:           "/manager",
--   assistant_manager: "/manager",   // same workspace as manager
--   store_manager:     "/manager",   // same workspace, branch-scoped via RLS
--   crm:               "/crm",
--   csr:               "/csr",       // NEW — front desk workspace (coming soon)
--   staff:             "/staff-portal",
-- };
--
-- PROTECTED_PREFIXES addition: "/csr"
--
-- For now, CSR routes to /manager/walkin as their primary entry point
-- until the dedicated CSR workspace is built.
-- =============================================================================
