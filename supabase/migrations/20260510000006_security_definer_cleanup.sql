-- =============================================================================
-- CradleHub — SECURITY DEFINER Function Access Cleanup
-- =============================================================================
-- Three SECURITY DEFINER functions were created without explicit REVOKE from
-- PUBLIC, leaving them callable by the anon role. This migration:
--
--   1. Restricts update_booking_progress to authenticated only.
--   2. Restricts get_bookable_staff to authenticated only (if it exists —
--      the function is absent from some environments where migration
--      20260429000009_staff_expansion was not applied).
--   3. Drops update_home_service_tracking (orphaned — replaced by
--      update_booking_progress in 20260501000004_unified_booking_progress.sql;
--      no application code calls it).
--
-- All operations use DO blocks so the migration is safe to run even when a
-- function is absent (REVOKE/GRANT have no IF EXISTS syntax in PostgreSQL).
-- =============================================================================

-- ─── update_booking_progress(UUID, TEXT) ─────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM   pg_proc p
    JOIN   pg_namespace n ON n.oid = p.pronamespace
    WHERE  n.nspname = 'public'
      AND  p.proname = 'update_booking_progress'
  ) THEN
    REVOKE ALL  ON FUNCTION public.update_booking_progress(UUID, TEXT) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.update_booking_progress(UUID, TEXT) TO authenticated;
  END IF;
END;
$$;

-- ─── get_bookable_staff(UUID, UUID) ──────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM   pg_proc p
    JOIN   pg_namespace n ON n.oid = p.pronamespace
    WHERE  n.nspname = 'public'
      AND  p.proname = 'get_bookable_staff'
  ) THEN
    REVOKE ALL  ON FUNCTION public.get_bookable_staff(UUID, UUID) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.get_bookable_staff(UUID, UUID) TO authenticated;
  END IF;
END;
$$;

-- ─── Drop orphaned update_home_service_tracking(UUID, TEXT) ──────────────────
-- Replaced by update_booking_progress. No application code references it;
-- only the auto-generated supabase.ts types file had an entry (now removed).
-- DROP FUNCTION IF EXISTS is already safe when the function is absent.

DROP FUNCTION IF EXISTS public.update_home_service_tracking(UUID, TEXT);
