-- =============================================================================
-- CradleHub — Branch Public Display Fields
-- =============================================================================
-- Adds minimal public-facing fields to the branches table so operational
-- contact data (hours, secondary phone) can be maintained in one place
-- instead of being hardcoded across public pages and components.
-- =============================================================================

ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS opening_hours TEXT,
  ADD COLUMN IF NOT EXISTS secondary_phone TEXT,
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.branches.opening_hours IS
  'Public-facing hours string, e.g. "Daily · 10:00 AM – 10:00 PM"';

COMMENT ON COLUMN public.branches.secondary_phone IS
  'Secondary public contact number (e.g. alternate branch line or business mobile).';

COMMENT ON COLUMN public.branches.sort_order IS
  'Display order on public pages. Lower values appear first.';
