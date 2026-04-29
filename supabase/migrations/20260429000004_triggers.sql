-- =============================================================================
-- CradleHub — Migration 004: Triggers
-- =============================================================================
-- Triggers handle three concerns:
--   1. updated_at maintenance — generic, applied to all mutable tables
--   2. Booking event logging — audit trail, always written by DB not app code
--   3. Customer stats maintenance — total_bookings, last_booking_date
--
-- The changed_by capture pattern for booking events:
--   Application code sets: SET LOCAL app.current_staff_id = '<uuid>';
--   Trigger reads: current_setting('app.current_staff_id', TRUE)
--   This passes the actor identity into the trigger without changing the
--   bookings table signature. The 'missing_ok = TRUE' param means it returns
--   NULL (not an error) when the variable isn't set (e.g., customer online booking).
-- =============================================================================


-- ─── 1. GENERIC updated_at TRIGGER ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION fn_update_updated_at IS
  'Generic trigger function. Sets updated_at = NOW() on any UPDATE.';

-- Apply to all tables that have updated_at
CREATE TRIGGER trg_branches_updated_at
  BEFORE UPDATE ON branches
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER trg_staff_updated_at
  BEFORE UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER trg_services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();


-- ─── 2. BOOKING EVENTS: Creation ─────────────────────────────────────────────
-- Fires AFTER INSERT on bookings.
-- Records the initial status (always 'pending').
-- from_status is NULL to mark this as the creation event.
-- changed_by is NULL — could be online customer or walk-in entry at the desk.

CREATE OR REPLACE FUNCTION fn_on_booking_created()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO booking_events (
    booking_id,
    from_status,
    to_status,
    changed_by,
    notes
  ) VALUES (
    NEW.id,
    NULL,       -- NULL = creation event (no previous status)
    NEW.status,
    NULL,       -- NULL = customer or system; staff attribution happens on updates
    NULL
  );
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION fn_on_booking_created IS
  'Logs initial booking status to booking_events on INSERT. from_status = NULL marks creation.';

CREATE TRIGGER trg_on_booking_created
  AFTER INSERT ON bookings
  FOR EACH ROW EXECUTE FUNCTION fn_on_booking_created();


-- ─── 3. BOOKING EVENTS: Status Change ────────────────────────────────────────
-- Fires AFTER UPDATE OF status on bookings.
-- Only runs when status actually changes (early return if same).
-- Reads app.current_staff_id session variable to capture who made the change.
--
-- To use: before your UPDATE statement, run:
--   SELECT set_config('app.current_staff_id', '<staff_uuid>', TRUE);
-- The TRUE means the setting is transaction-local (resets after commit/rollback).

CREATE OR REPLACE FUNCTION fn_on_booking_status_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_changed_by UUID;
BEGIN
  -- Early exit: no actual status change
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Read the staff ID set by the application layer
  -- NULLIF converts empty string to NULL (set_config stores empty string when not set)
  v_changed_by := NULLIF(
    current_setting('app.current_staff_id', TRUE),  -- TRUE = missing_ok, returns '' not error
    ''
  )::UUID;

  INSERT INTO booking_events (
    booking_id,
    from_status,
    to_status,
    changed_by
  ) VALUES (
    NEW.id,
    OLD.status,
    NEW.status,
    v_changed_by
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION fn_on_booking_status_changed IS
  'Logs status transitions to booking_events. '
  'Reads app.current_staff_id session variable for actor attribution. '
  'Set via: SELECT set_config(''app.current_staff_id'', ''<uuid>'', TRUE)';

-- Only fires when status column is the thing being updated
CREATE TRIGGER trg_on_booking_status_changed
  AFTER UPDATE OF status ON bookings
  FOR EACH ROW EXECUTE FUNCTION fn_on_booking_status_changed();


-- ─── 4. CUSTOMER STATS MAINTENANCE ───────────────────────────────────────────
-- Fires AFTER UPDATE OF status on bookings.
-- Increments total_bookings and updates date fields when status → completed.
-- Handles the edge case of un-completing (e.g., status changed AWAY from completed).
-- first_booking_date uses COALESCE — set once, never overwritten.

CREATE OR REPLACE FUNCTION fn_maintain_customer_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Booking just reached 'completed'
  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    UPDATE customers
    SET
      total_bookings     = total_bookings + 1,
      last_booking_date  = NEW.booking_date,
      first_booking_date = COALESCE(first_booking_date, NEW.booking_date),
      updated_at         = NOW()
    WHERE id = NEW.customer_id;

  -- Booking was 'completed' but is now being un-completed (rare but possible)
  ELSIF OLD.status = 'completed' AND NEW.status <> 'completed' THEN
    UPDATE customers
    SET
      total_bookings = GREATEST(total_bookings - 1, 0), -- floor at 0
      updated_at     = NOW()
    WHERE id = NEW.customer_id;
    -- Note: we do NOT revert last_booking_date or first_booking_date here.
    -- Those are point-in-time facts and reverting them would require a full
    -- recalculation from booking history, which is too expensive for a trigger.
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION fn_maintain_customer_stats IS
  'Keeps customers.total_bookings and last_booking_date in sync with completed bookings. '
  'Fires on every booking status change. Un-completing a booking decrements the counter '
  'but does not revert date fields (by design — recalculation would be expensive).';

CREATE TRIGGER trg_maintain_customer_stats
  AFTER UPDATE OF status ON bookings
  FOR EACH ROW EXECUTE FUNCTION fn_maintain_customer_stats();
