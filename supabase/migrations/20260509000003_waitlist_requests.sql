-- =============================================================================
-- CradleHub — Waitlist / Callback Queue
-- =============================================================================
-- Public customers can join a waitlist for a specific date/service/branch.
-- CRM staff can view and work through the queue, converting to bookings or
-- marking them as contacted/expired.
-- =============================================================================

CREATE TABLE IF NOT EXISTS waitlist_requests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       UUID        NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  customer_name   TEXT        NOT NULL CHECK (char_length(customer_name) BETWEEN 2 AND 100),
  customer_phone  TEXT        NOT NULL CHECK (char_length(customer_phone) BETWEEN 7 AND 20),
  customer_email  TEXT,
  preferred_date  DATE,
  preferred_time  TEXT,       -- e.g. '09:00:00' (optional)
  service_id      UUID        REFERENCES services(id) ON DELETE SET NULL,
  visit_type      TEXT        CHECK (visit_type IN ('in_spa', 'home_service')),
  notes           TEXT,

  -- Workflow
  status          TEXT        NOT NULL DEFAULT 'waiting'
                    CHECK (status IN ('waiting', 'contacted', 'converted', 'expired', 'cancelled')),
  contacted_by    UUID        REFERENCES staff(id) ON DELETE SET NULL,
  contacted_at    TIMESTAMPTZ,
  converted_to_booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_branch_status
  ON waitlist_requests (branch_id, status, preferred_date NULLS LAST);

COMMENT ON TABLE waitlist_requests
  IS 'Public waitlist / callback requests. One record per customer request.';
