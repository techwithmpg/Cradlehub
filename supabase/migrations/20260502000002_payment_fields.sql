-- Payment recording fields on bookings
-- Safe ALTER TABLE: all columns have NOT NULL defaults, no existing queries broken.
-- Existing bookings default to pay_on_site / unpaid (correct — they haven't been paid yet).

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'pay_on_site'
    CHECK (payment_method IN ('cash', 'gcash', 'maya', 'card', 'pay_on_site', 'other')),
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'refunded')),
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10, 2) NOT NULL DEFAULT 0
    CHECK (amount_paid >= 0);

-- Support fast daily cash summary queries (aggregate by method/status/date)
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status_date
  ON bookings (payment_status, booking_date, branch_id);

CREATE INDEX IF NOT EXISTS idx_bookings_payment_method_date
  ON bookings (payment_method, booking_date, branch_id);
