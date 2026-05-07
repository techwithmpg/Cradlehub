-- =============================================================================
-- CradleHub — Home Service Driver Capacity
-- =============================================================================
-- Adds per-branch driver capacity to branch_booking_rules so the dispatch
-- conflict helper knows how many concurrent home-service trips the branch can
-- support. Default 1 = one driver at a time.
-- =============================================================================

ALTER TABLE public.branch_booking_rules
ADD COLUMN IF NOT EXISTS home_service_driver_capacity INTEGER NOT NULL DEFAULT 1
  CONSTRAINT branch_booking_rules_driver_capacity_range
    CHECK (home_service_driver_capacity >= 0 AND home_service_driver_capacity <= 20);

COMMENT ON COLUMN public.branch_booking_rules.home_service_driver_capacity IS
  'How many concurrent home-service trips/drivers this branch can support. Used by dispatch conflict checking.';
