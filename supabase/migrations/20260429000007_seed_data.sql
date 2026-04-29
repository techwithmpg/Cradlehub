-- =============================================================================
-- CradleHub — Migration 007: Seed Data
-- =============================================================================
-- Initial data for Cradle Massage & Wellness Spa.
-- This migration is safe to run multiple times (uses INSERT ... ON CONFLICT DO NOTHING).
-- Update values here to match actual branch details before running.
-- Owner account must be created in Supabase Auth first, then the UUID
-- placed in the staff INSERT below.
-- =============================================================================


-- ─── SERVICE CATEGORIES ──────────────────────────────────────────────────────
INSERT INTO service_categories (id, name, display_order)
VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Swedish Massage',     1),
  ('a1000000-0000-0000-0000-000000000002', 'Deep Tissue Massage',  2),
  ('a1000000-0000-0000-0000-000000000003', 'Hot Stone Therapy',    3),
  ('a1000000-0000-0000-0000-000000000004', 'Reflexology',          4),
  ('a1000000-0000-0000-0000-000000000005', 'Facial Treatments',    5),
  ('a1000000-0000-0000-0000-000000000006', 'Body Scrubs & Wraps',  6)
ON CONFLICT (id) DO NOTHING;


-- ─── SERVICES ────────────────────────────────────────────────────────────────
-- buffer_after = 10 min on all services for room turnover / linens
INSERT INTO services (id, category_id, name, description, duration_minutes, price, buffer_before, buffer_after)
VALUES
  -- Swedish Massage
  ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
   'Swedish Massage 60min',
   'Classic full-body relaxation massage with long gliding strokes.',
   60, 700.00, 0, 10),

  ('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001',
   'Swedish Massage 90min',
   'Extended full-body Swedish massage for deep relaxation.',
   90, 950.00, 0, 10),

  -- Deep Tissue
  ('b1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000002',
   'Deep Tissue 60min',
   'Targets chronic muscle tension and knots with firm pressure.',
   60, 800.00, 0, 10),

  ('b1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000002',
   'Deep Tissue 90min',
   'Extended deep tissue treatment for full-body muscle relief.',
   90, 1050.00, 0, 10),

  -- Hot Stone
  ('b1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000003',
   'Hot Stone Therapy 60min',
   'Smooth heated stones combined with massage for deep muscle relaxation.',
   60, 950.00, 10, 15),  -- buffer_before = 10 (stone heating time)

  ('b1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000003',
   'Hot Stone Therapy 90min',
   'Full hot stone therapy with extended relaxation sequence.',
   90, 1200.00, 10, 15),

  -- Reflexology
  ('b1000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000004',
   'Foot Reflexology 45min',
   'Pressure-point therapy on the feet to promote whole-body wellness.',
   45, 550.00, 0, 10),

  ('b1000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000004',
   'Full Reflexology 60min',
   'Foot and hand reflexology for complete energy balance.',
   60, 700.00, 0, 10)
ON CONFLICT (id) DO NOTHING;


-- ─── BRANCHES ────────────────────────────────────────────────────────────────
-- UPDATE these values with actual branch details before first deploy.
-- Maps embed URLs must be updated with actual Google Maps embed codes.
INSERT INTO branches (id, name, address, phone, email, slot_interval_minutes)
VALUES
  ('c1000000-0000-0000-0000-000000000001',
   'Cradle Spa — Main Branch',
   'UPDATE WITH ACTUAL ADDRESS, Bacolod City, Negros Occidental',
   'UPDATE WITH BRANCH PHONE',
   'main@cradlespa.com',
   30),

  ('c1000000-0000-0000-0000-000000000002',
   'Cradle Spa — Branch 2',
   'UPDATE WITH ACTUAL ADDRESS, Bacolod City, Negros Occidental',
   'UPDATE WITH BRANCH PHONE',
   'branch2@cradlespa.com',
   30)
ON CONFLICT (id) DO NOTHING;


-- ─── BRANCH SERVICES ─────────────────────────────────────────────────────────
-- Link all services to all branches (using default prices for now).
-- To set a branch-specific price: UPDATE branch_services SET custom_price = X
-- WHERE branch_id = '...' AND service_id = '...';
INSERT INTO branch_services (branch_id, service_id)
SELECT
  b.id    AS branch_id,
  s.id    AS service_id
FROM branches b
CROSS JOIN services s
ON CONFLICT (branch_id, service_id) DO NOTHING;


-- =============================================================================
-- HOW TO CREATE THE OWNER ACCOUNT
-- =============================================================================
-- 1. Create the user in Supabase Auth (Dashboard → Auth → Users → Invite)
-- 2. Copy the user's UUID from the Auth panel
-- 3. Run this INSERT (replace the UUID and details):
--
-- INSERT INTO staff (branch_id, auth_user_id, full_name, phone, tier, system_role)
-- VALUES (
--   'c1000000-0000-0000-0000-000000000001',  -- assign to main branch
--   'PASTE-AUTH-USER-UUID-HERE',
--   'Owner Name',
--   'OWNER PHONE',
--   'senior',
--   'owner'
-- );
--
-- The owner can then log in and create managers/staff from the dashboard.
-- =============================================================================
