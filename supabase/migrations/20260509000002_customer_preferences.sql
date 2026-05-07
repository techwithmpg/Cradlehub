-- =============================================================================
-- CradleHub — Customer Preferences
-- =============================================================================
-- Adds preference and profile columns to the customers table.
-- All nullable so existing records are unaffected.
-- =============================================================================

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS preferred_staff_id        UUID        REFERENCES staff(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS preferred_service_id      UUID        REFERENCES services(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS preferred_visit_type      TEXT        CHECK (preferred_visit_type IN ('in_spa', 'home_service')),
  ADD COLUMN IF NOT EXISTS pressure_preference       TEXT        CHECK (pressure_preference IN ('light', 'medium', 'firm', 'deep_tissue')),
  ADD COLUMN IF NOT EXISTS health_notes              TEXT,
  ADD COLUMN IF NOT EXISTS birthday                  DATE,
  ADD COLUMN IF NOT EXISTS loyalty_tier              TEXT        NOT NULL DEFAULT 'standard'
                                                       CHECK (loyalty_tier IN ('standard', 'silver', 'gold', 'vip'));

COMMENT ON COLUMN customers.preferred_staff_id   IS 'The therapist this customer prefers, if any.';
COMMENT ON COLUMN customers.preferred_service_id IS 'The service this customer books most often.';
COMMENT ON COLUMN customers.preferred_visit_type IS 'Whether the customer prefers in-spa or home service.';
COMMENT ON COLUMN customers.pressure_preference  IS 'Massage pressure preference for therapist notes.';
COMMENT ON COLUMN customers.health_notes         IS 'Allergies, conditions, or contraindications (staff-visible).';
COMMENT ON COLUMN customers.birthday             IS 'Customer birthday for loyalty and greeting campaigns.';
COMMENT ON COLUMN customers.loyalty_tier         IS 'CRM loyalty segment: standard, silver, gold, or vip.';
