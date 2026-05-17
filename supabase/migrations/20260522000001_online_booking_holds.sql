-- =============================================================================
-- CradleHub — Online Booking Holds
-- =============================================================================
-- Phase 2: Online bookings begin life as `pending_payment` (not `pending`).
-- Adds `hold_expires_at` to temporarily reserve a slot while the customer
-- arranges payment. The availability engine treats holds as blocking only
-- while hold_expires_at is in the future.
--
-- Also adds `pending_crm_confirmation` for bookings that have been paid but
-- are awaiting CRM review before being fully confirmed.
-- =============================================================================

-- ─── 1. Expand bookings.status CHECK ─────────────────────────────────────────
-- Original: pending | confirmed | in_progress | completed | cancelled | no_show
-- Adds: pending_payment | pending_crm_confirmation

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;

ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN (
    'pending',
    'pending_payment',
    'pending_crm_confirmation',
    'confirmed',
    'in_progress',
    'completed',
    'cancelled',
    'no_show'
  ));

COMMENT ON COLUMN bookings.status IS
  'pending              = CRM created, not yet confirmed
   pending_payment      = Online booking awaiting payment (hold active)
   pending_crm_confirmation = Paid online booking awaiting CRM review
   confirmed            = Confirmed and scheduled
   in_progress          = Session has started
   completed            = Session finished
   cancelled            = Booking cancelled
   no_show              = Customer did not arrive';

-- ─── 2. Expand booking_events status CHECK constraints ───────────────────────
-- Keep booking_events in sync with bookings.status values.

ALTER TABLE booking_events DROP CONSTRAINT IF EXISTS booking_events_from_status_check;
ALTER TABLE booking_events DROP CONSTRAINT IF EXISTS booking_events_to_status_check;

ALTER TABLE booking_events ADD CONSTRAINT booking_events_from_status_check
  CHECK (from_status IN (
    'pending', 'pending_payment', 'pending_crm_confirmation',
    'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'
  ));

ALTER TABLE booking_events ADD CONSTRAINT booking_events_to_status_check
  CHECK (to_status IN (
    'pending', 'pending_payment', 'pending_crm_confirmation',
    'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'
  ));

-- ─── 3. Add hold_expires_at column ───────────────────────────────────────────
-- Set when an online booking is created. Availability engine checks this:
-- a pending_payment booking only blocks the slot if hold_expires_at > now().
-- CRM confirmation clears this to NULL.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS hold_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN bookings.hold_expires_at IS
  'When this hold expires. Non-null only for pending_payment bookings. The
   availability engine ignores bookings with hold_expires_at <= now(). CRM
   confirmation sets this to NULL.';

-- ─── 4. Index for expired hold cleanup and availability queries ───────────────
CREATE INDEX IF NOT EXISTS idx_bookings_hold_expires_at
  ON bookings (hold_expires_at)
  WHERE hold_expires_at IS NOT NULL;

-- Composite index for availability engine: status + date + branch for hold check
CREATE INDEX IF NOT EXISTS idx_bookings_pending_payment_branch_date
  ON bookings (branch_id, booking_date, status)
  WHERE status = 'pending_payment';
