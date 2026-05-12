-- =============================================================================
-- CradleHub — Staff Profile Enhancements for MVP Stabilization
-- =============================================================================
-- Adds metadata JSONB to staff for profile completeness tracking and
-- requested service capabilities. Idempotently expands tier CHECK.
--
-- Safe to run on any deployment state:
--   - metadata column is added with DEFAULT '{}' if missing
--   - tier CHECK is expanded to include 'head' and 'n/a' if not already
-- =============================================================================

-- ── 1. Add metadata JSONB to staff ──────────────────────────────────────────
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.staff.metadata IS
  'Forward-compatible extension point for profile completeness, requested service capabilities, and other staff-scoped data.';

-- ── 2. Expand tier CHECK ────────────────────────────────────────────────────
-- Idempotent: drop the old constraint (if it exists) and recreate the broad one.
-- All existing data ('senior', 'mid', 'junior') remain valid.
ALTER TABLE public.staff
  DROP CONSTRAINT IF EXISTS staff_tier_check;

ALTER TABLE public.staff
  ADD CONSTRAINT staff_tier_check
  CHECK (tier IN ('senior', 'mid', 'junior', 'head', 'n/a'));

-- ── 3. Index for metadata lookups (optional, lightweight) ───────────────────
CREATE INDEX IF NOT EXISTS staff_metadata_gin_idx
  ON public.staff USING GIN (metadata);
