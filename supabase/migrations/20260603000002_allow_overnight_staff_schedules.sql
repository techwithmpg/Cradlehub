-- =============================================================================
-- MIGRATION: Allow overnight shifts in staff_schedules
-- =============================================================================
-- The original CHECK (end_time > start_time) rejects closing shifts that cross
-- midnight (e.g. 17:00 → 01:30). Validation now lives in the TypeScript layer
-- (getShiftDurationMinutes adds 24 h when end <= start, then enforces 1 min-16 h).
--
-- Dropping the DB constraint is safe because:
--   1. The server action validates every save before writing.
--   2. PostgreSQL TIME columns cannot natively express "overnight" ranges, so
--      the constraint was always too strict for multi-shift schedules.
--   3. The unique index on (staff_id, day_of_week, shift_type) still prevents
--      duplicate rows per shift slot.
-- =============================================================================

ALTER TABLE staff_schedules
  DROP CONSTRAINT IF EXISTS staff_schedules_time_check;

-- Add a softer guard: the two times must differ (prevents start = end typos).
-- Overnight shifts (end < start) are intentional and now permitted.
-- Wrapped in DO block so this migration is idempotent (safe to re-run).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'staff_schedules'::regclass
      AND conname   = 'staff_schedules_times_differ'
  ) THEN
    ALTER TABLE staff_schedules
      ADD CONSTRAINT staff_schedules_times_differ
        CHECK (start_time <> end_time);
  END IF;
END $$;

COMMENT ON CONSTRAINT staff_schedules_times_differ ON staff_schedules IS
  'Prevents start_time = end_time. Overnight shifts (end_time < start_time) are valid.';
