-- =============================================================================
-- CradleHub — Migration: CSR Role Expansion
-- =============================================================================
-- Adds distinct csr_head and csr_staff system_role values for front-desk
-- team access control. Keeps existing 'csr' for backward compatibility.
--
-- Prerequisites: staff table exists with system_role CHECK constraint.
-- =============================================================================

-- ── 1. Expand system_role CHECK constraint ──────────────────────────────────
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_system_role_check;
ALTER TABLE staff ADD CONSTRAINT staff_system_role_check
  CHECK (system_role IN (
    'owner',
    'manager',
    'crm',
    'csr',
    'csr_head',
    'csr_staff',
    'staff'
  ));

COMMENT ON COLUMN staff.system_role IS
  'Controls which workspace the user sees on login.
   owner      = Full system access
   manager    = Branch operations
   crm        = Customer analytics and reports
   csr        = Customer Service Rep (legacy, same as csr_staff)
   csr_head   = CSR Supervisor — can cancel/reassign bookings
   csr_staff  = Front-desk CSR — booking creation, customer lookup, schedule view
   staff      = Therapist/Technician — own schedule only';
