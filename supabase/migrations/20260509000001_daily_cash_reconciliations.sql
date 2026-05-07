-- =============================================================================
-- CradleHub — Daily Cash Reconciliations
-- =============================================================================
-- End-of-day reconciliation record: expected vs. actual cash count per branch.
-- One record per branch per day. Staff submit; owner/manager can approve.
-- =============================================================================

CREATE TABLE IF NOT EXISTS daily_cash_reconciliations (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id           UUID        NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  reconciliation_date DATE        NOT NULL,
  recorded_by         UUID        REFERENCES staff(id) ON DELETE SET NULL,

  -- Expected from bookings (sum of amount_paid for paid bookings that day)
  expected_cash       NUMERIC(10, 2) NOT NULL DEFAULT 0,
  expected_gcash      NUMERIC(10, 2) NOT NULL DEFAULT 0,
  expected_maya       NUMERIC(10, 2) NOT NULL DEFAULT 0,
  expected_card       NUMERIC(10, 2) NOT NULL DEFAULT 0,
  expected_other      NUMERIC(10, 2) NOT NULL DEFAULT 0,

  -- Actual physical count entered by staff
  actual_cash         NUMERIC(10, 2) NOT NULL DEFAULT 0,
  actual_gcash        NUMERIC(10, 2) NOT NULL DEFAULT 0,
  actual_maya         NUMERIC(10, 2) NOT NULL DEFAULT 0,
  actual_card         NUMERIC(10, 2) NOT NULL DEFAULT 0,
  actual_other        NUMERIC(10, 2) NOT NULL DEFAULT 0,

  notes               TEXT,
  status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'submitted', 'approved')),

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (branch_id, reconciliation_date)
);

CREATE INDEX IF NOT EXISTS idx_reconciliations_branch_date
  ON daily_cash_reconciliations (branch_id, reconciliation_date DESC);

COMMENT ON TABLE daily_cash_reconciliations
  IS 'End-of-day cash reconciliation records per branch. One entry per branch per day.';
