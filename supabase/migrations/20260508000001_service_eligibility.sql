-- =============================================================================
-- CradleHub — Service Eligibility per Branch
-- =============================================================================
-- Adds visit-type eligibility flags to branch_services so owners/managers can
-- control which services are available for in-spa vs home service bookings.
-- Stored on branch_services (not services) so eligibility can vary per branch.
-- =============================================================================

ALTER TABLE branch_services
  ADD COLUMN IF NOT EXISTS available_in_spa       BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS available_home_service BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN branch_services.available_in_spa
  IS 'Whether this service can be booked as an in-spa appointment at this branch.';
COMMENT ON COLUMN branch_services.available_home_service
  IS 'Whether this service can be booked as a home service appointment at this branch.';

-- Index for fast eligibility filtering in the booking flow
CREATE INDEX IF NOT EXISTS idx_branch_services_eligibility
  ON branch_services (branch_id, available_in_spa, available_home_service)
  WHERE is_active = TRUE;
