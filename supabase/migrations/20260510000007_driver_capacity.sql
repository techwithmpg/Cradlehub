-- =============================================================================
-- CradleHub — Branch Booking Rules: home_service_driver_capacity column
-- =============================================================================
-- The original branch_booking_rules migration (20260507000001) did not include
-- home_service_driver_capacity. This migration adds it safely using IF NOT EXISTS
-- so it is idempotent on environments where it was already added manually.
-- =============================================================================

ALTER TABLE public.branch_booking_rules
  ADD COLUMN IF NOT EXISTS home_service_driver_capacity INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.branch_booking_rules
  DROP CONSTRAINT IF EXISTS branch_booking_rules_home_service_driver_capacity_check;

ALTER TABLE public.branch_booking_rules
  ADD CONSTRAINT branch_booking_rules_home_service_driver_capacity_check
  CHECK (home_service_driver_capacity >= 0 AND home_service_driver_capacity <= 20);

COMMENT ON COLUMN public.branch_booking_rules.home_service_driver_capacity IS
  'Maximum number of concurrent home service trips this branch can dispatch. 0 = home service disabled.';
