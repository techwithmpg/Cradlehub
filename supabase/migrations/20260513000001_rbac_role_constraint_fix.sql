-- =============================================================================
-- CradleHub — Migration: RBAC Role Constraint Forward-Fix
-- =============================================================================
-- Context
-- -------
-- Migration 20260429000009 added assistant_manager and store_manager to the
-- system_role CHECK constraint. Migration 20260501000002 then re-set the
-- constraint to only CSR-era roles, inadvertently removing those two values.
-- On a fresh db reset, migration 010 inserts rows with assistant_manager /
-- store_manager before 20260501000002 removes them from the constraint, which
-- causes 20260501000002 to fail row validation.
--
-- This forward-fix migration re-creates the constraint with the full intended
-- role set. It also adds new roles that will be used going forward:
--   service_head, service_staff, driver, utility
--
-- Safe for running instances: DROP CONSTRAINT IF EXISTS is used before ADD.
-- =============================================================================

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
    'staff',
    'service_head',
    'service_staff',
    'driver',
    'utility'
  ));

COMMENT ON COLUMN staff.system_role IS
  'Controls which workspace the user sees on login.
   owner             = Full system access
   manager           = Branch operations (primary manager)
   assistant_manager = Branch operations (assistant, same /manager workspace)
   store_manager     = Branch operations (SM branch manager, same /manager workspace)
   crm               = Customer analytics and reports
   csr               = Customer Service Rep (legacy alias for csr_staff)
   csr_head          = CSR Supervisor — can cancel/reassign bookings
   csr_staff         = Front-desk CSR — booking creation, customer lookup
   staff             = Service staff (legacy, kept for backward compatibility)
   service_head      = Salon/service department head — staff portal
   service_staff     = Therapist / Nail Tech / Aesthetician — staff portal
   driver            = Driver — driver panel
   utility           = Utility / Housekeeping — utility panel';
