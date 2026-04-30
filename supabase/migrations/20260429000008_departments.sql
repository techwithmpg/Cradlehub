-- =============================================================================
-- CradleHub — Migration 008: Departments
-- =============================================================================
-- Based on actual org structure of Cradle Wellness Living Inc.
--
-- Departments found in organizational document:
--   1. Massage & Therapy  — Therapists
--   2. Salon              — Nail Tech, Aesthetician/Facialist, Salon Head
--   3. Customer Service   — CSR Head, CSR Staff
--   4. Operations Support — Drivers, Utility
--
-- This table is the foundation for:
--   - Staff-to-service-category matching (booking accuracy)
--   - Department-aware scheduling visibility
--   - Future: department reporting and payroll grouping
-- =============================================================================

CREATE TABLE IF NOT EXISTS departments (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL UNIQUE,
  description   TEXT,
  color         TEXT        NOT NULL DEFAULT '#78716C', -- for UI display
  display_order INT         NOT NULL DEFAULT 0,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE departments IS
  'Business departments from the organizational structure. '
  'Links staff to their department and controls which services they can be booked for.';

-- Seed the four departments from the org document
INSERT INTO departments (id, name, description, color, display_order)
VALUES
  ('d1000000-0000-0000-0000-000000000001',
   'Massage & Therapy',
   'Licensed massage therapists providing massage and body wellness services.',
   '#0F6E56', 1),

  ('d1000000-0000-0000-0000-000000000002',
   'Salon',
   'Nail technicians, aestheticians, and facialists providing beauty and skin services.',
   '#993556', 2),

  ('d1000000-0000-0000-0000-000000000003',
   'Customer Service',
   'CSR team — front desk, customer relations, walk-in coordination.',
   '#185FA5', 3),

  ('d1000000-0000-0000-0000-000000000004',
   'Operations & Support',
   'Drivers and utility staff supporting daily operations.',
   '#5F5E5A', 4)
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- Staff-Service Category Mapping
-- =============================================================================
-- CRITICAL for booking accuracy.
--
-- Problem: the current system allows any staff member to be assigned to any
-- service. A nail technician should NEVER appear as an option for massage
-- bookings, and vice versa.
--
-- Solution: link staff to the service categories they are qualified to perform.
-- The availability engine's get_available_slots RPC filters by staff_id already.
-- The application layer uses this table to build the correct staff pool when
-- loading the booking form — only showing therapists for massage services,
-- only showing nail techs for nail services, etc.
--
-- If a staff member has NO entries in this table, they are excluded from
-- all bookings (e.g., drivers, utility, CSR — non-service roles).
-- =============================================================================

CREATE TABLE IF NOT EXISTS staff_service_categories (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id            UUID        NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  service_category_id UUID        NOT NULL REFERENCES service_categories(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (staff_id, service_category_id)
);

COMMENT ON TABLE staff_service_categories IS
  'Maps which service categories a staff member can be booked for. '
  'Staff with no entries here are non-service roles (CSR, driver, utility) '
  'and will not appear in the booking flow therapist selector.';

-- Index for the booking flow: "which staff can perform this service category?"
CREATE INDEX IF NOT EXISTS idx_staff_service_cats_category
  ON staff_service_categories (service_category_id);

-- Index for staff profile: "what categories can this person perform?"
CREATE INDEX IF NOT EXISTS idx_staff_service_cats_staff
  ON staff_service_categories (staff_id);
