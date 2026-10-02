-- ==============================================================================
-- P1: CASH SESSION CLOSE, HANDOVER, AND DAY CLOSE RECONCILIATION PARITY
-- Architecture: Controlled Stabilization — Physical Cash Lifecycle Completion
-- Target: CradleHub Web — Cash Flow & Reconciliation
--
-- Invariants:
-- 1. Persistent physical cash drawer account (account_type = 'cash_drawer').
-- 2. Exactly one open session per cash drawer at any time.
-- 3. Opening float is operational state, contributing to expected physical cash,
--    NOT revenue or income.
-- 4. Handover preserves continuity on the same drawer session with physical count,
--    expected cash, variance, and explicit outgoing/incoming custodian accountability.
-- 5. Closing records final physical count, authoritative expected cash, variance,
--    and closed_at/closed_by metadata.
-- 6. Closed session rejects all new cash payments, expenses, adjustments, transfers,
--    and safe drops.
-- 7. Variance is recorded as operational evidence; never manufactured balancing txs.
-- ==============================================================================

BEGIN;

-- ─── 1. FORWARD-ONLY EXTENSIONS TO public.cash_sessions ───────────────────────

ALTER TABLE public.cash_sessions
  ADD COLUMN IF NOT EXISTS current_custodian_id UUID NULL REFERENCES public.staff(id) ON DELETE RESTRICT;

ALTER TABLE public.cash_sessions
  ADD COLUMN IF NOT EXISTS counted_cash NUMERIC(12,2) NULL CHECK (counted_cash IS NULL OR counted_cash >= 0);

ALTER TABLE public.cash_sessions
  ADD COLUMN IF NOT EXISTS expected_cash_at_close NUMERIC(12,2) NULL;

ALTER TABLE public.cash_sessions
  ADD COLUMN IF NOT EXISTS variance NUMERIC(12,2) NULL;

ALTER TABLE public.cash_sessions
  ADD COLUMN IF NOT EXISTS closing_note TEXT NULL;

ALTER TABLE public.cash_sessions
  ADD COLUMN IF NOT EXISTS close_idempotency_key TEXT NULL UNIQUE;

-- Backfill current_custodian_id for existing rows from opened_by
UPDATE public.cash_sessions
SET current_custodian_id = opened_by
WHERE current_custodian_id IS NULL;

ALTER TABLE public.cash_sessions
  ALTER COLUMN current_custodian_id SET NOT NULL;

-- Update lifecycle check constraint
ALTER TABLE public.cash_sessions
  DROP CONSTRAINT IF EXISTS check_cash_session_lifecycle;

ALTER TABLE public.cash_sessions
  ADD CONSTRAINT check_cash_session_lifecycle
    CHECK (
      (status = 'open' AND closed_at IS NULL AND closed_by IS NULL)
      OR
      (status = 'closed' AND closed_at IS NOT NULL AND closed_by IS NOT NULL AND counted_cash IS NOT NULL AND expected_cash_at_close IS NOT NULL AND variance IS NOT NULL)
    );

COMMENT ON COLUMN public.cash_sessions.current_custodian_id IS
  'Active staff custodian currently in physical custody of the drawer.';
COMMENT ON COLUMN public.cash_sessions.counted_cash IS
  'Counted physical cash at drawer close.';
COMMENT ON COLUMN public.cash_sessions.expected_cash_at_close IS
  'Authoritative calculated expected cash at moment of session close.';
COMMENT ON COLUMN public.cash_sessions.variance IS
  'Physical cash variance at close (counted_cash - expected_cash_at_close). Operational evidence.';
COMMENT ON COLUMN public.cash_sessions.close_idempotency_key IS
  'Unique idempotency key ensuring duplicate close requests are safely replayed.';


-- ─── 2. TABLE: public.cash_session_handovers ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cash_session_handovers (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_session_id         UUID          NOT NULL REFERENCES public.cash_sessions(id) ON DELETE RESTRICT,
  cash_drawer_account_id  UUID          NOT NULL REFERENCES public.financial_accounts(id) ON DELETE RESTRICT,
  branch_id               UUID          NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  outgoing_custodian_id   UUID          NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  incoming_custodian_id   UUID          NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  expected_cash           NUMERIC(12,2) NOT NULL,
  counted_cash            NUMERIC(12,2) NOT NULL CHECK (counted_cash >= 0),
  variance                NUMERIC(12,2) NOT NULL,
  notes                   TEXT          NULL,
  recorded_by             UUID          NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  idempotency_key         TEXT          NOT NULL UNIQUE,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT check_differing_custodians
    CHECK (outgoing_custodian_id <> incoming_custodian_id)
);

COMMENT ON TABLE public.cash_session_handovers IS
  'Audit log of physical drawer custody handovers between staff members during an active session.';

CREATE INDEX IF NOT EXISTS idx_cash_session_handovers_session
  ON public.cash_session_handovers (cash_session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cash_session_handovers_drawer
  ON public.cash_session_handovers (cash_drawer_account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cash_session_handovers_branch
  ON public.cash_session_handovers (branch_id, created_at DESC);


-- ─── 3. ROW-LEVEL SECURITY FOR HANDOVERS ───────────────────────────────────────

ALTER TABLE public.cash_session_handovers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cash_session_handovers_owner_all" ON public.cash_session_handovers;
CREATE POLICY "cash_session_handovers_owner_all"
  ON public.cash_session_handovers FOR SELECT
  TO authenticated
  USING (
    public.get_auth_role() = 'owner'
    OR EXISTS (
      SELECT 1 FROM public.staff
      WHERE auth_user_id = (SELECT auth.uid())
        AND is_active = true
        AND system_role = 'owner'
    )
  );

DROP POLICY IF EXISTS "cash_session_handovers_branch_read" ON public.cash_session_handovers;
CREATE POLICY "cash_session_handovers_branch_read"
  ON public.cash_session_handovers FOR SELECT
  TO authenticated
  USING (
    branch_id = public.get_auth_branch_id()
    OR branch_id IN (
      SELECT branch_id FROM public.staff
      WHERE auth_user_id = (SELECT auth.uid())
        AND is_active = true
    )
  );

DROP POLICY IF EXISTS "cash_session_handovers_service_role_all" ON public.cash_session_handovers;
CREATE POLICY "cash_session_handovers_service_role_all"
  ON public.cash_session_handovers FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.cash_session_handovers FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.cash_session_handovers TO authenticated;
GRANT ALL ON TABLE public.cash_session_handovers TO service_role;


-- ─── 4. UPDATED WRITER RPC: open_cash_session_atomic ───────────────────────────

CREATE OR REPLACE FUNCTION public.open_cash_session_atomic(
  p_branch_id               UUID,
  p_cash_drawer_account_id  UUID,
  p_opening_float           NUMERIC,
  p_business_date           DATE,
  p_opening_note            TEXT DEFAULT NULL,
  p_idempotency_key         TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  v_auth_uid            UUID;
  v_staff               RECORD;
  v_branch              RECORD;
  v_account             RECORD;
  v_existing_session    RECORD;
  v_open_session        RECORD;
  v_session_id          UUID;
  v_now                 TIMESTAMPTZ := clock_timestamp();
  v_clean_key           TEXT;
BEGIN
  -- 1. Input Sanity Validation
  IF p_branch_id IS NULL THEN
    RAISE EXCEPTION 'BRANCH_REQUIRED: Branch ID is required';
  END IF;

  IF p_cash_drawer_account_id IS NULL THEN
    RAISE EXCEPTION 'DRAWER_ACCOUNT_REQUIRED: Cash drawer account ID is required';
  END IF;

  IF p_opening_float IS NULL OR p_opening_float < 0 THEN
    RAISE EXCEPTION 'INVALID_OPENING_FLOAT: Opening float must be non-negative, got %', p_opening_float;
  END IF;

  IF p_business_date IS NULL THEN
    RAISE EXCEPTION 'BUSINESS_DATE_REQUIRED: Business date is required';
  END IF;

  v_clean_key := trim(COALESCE(p_idempotency_key, ''));
  IF v_clean_key = '' THEN
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED: Idempotency key is required';
  END IF;

  -- Authenticate before replay lookup
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Unauthenticated caller cannot open cash session';
  END IF;
  SELECT s.id, s.branch_id, s.system_role, s.is_active, s.full_name
    INTO v_staff
  FROM public.staff s WHERE s.auth_user_id = v_auth_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STAFF_NOT_FOUND: No staff record for authenticated caller';
  END IF;
  IF NOT v_staff.is_active THEN
    RAISE EXCEPTION 'STAFF_INACTIVE: Caller is inactive';
  END IF;
  IF v_staff.system_role NOT IN ('owner', 'manager', 'assistant_manager', 'store_manager', 'crm') THEN
    RAISE EXCEPTION 'CASH_ROLE_UNAUTHORIZED: Caller cannot open a cash drawer';
  END IF;
  IF v_staff.system_role <> 'owner' AND v_staff.branch_id IS DISTINCT FROM p_branch_id THEN
    RAISE EXCEPTION 'BRANCH_UNAUTHORIZED: Caller cannot open a drawer in this branch';
  END IF;

  -- 2. Concurrency serialization
  PERFORM pg_advisory_xact_lock(hashtext('cash_drawer_lock_' || p_cash_drawer_account_id::text));
  PERFORM pg_advisory_xact_lock(hashtext('cash_session_idem_' || v_clean_key));

  -- 3. Idempotency Check
  SELECT cs.id, cs.branch_id, cs.cash_drawer_account_id, cs.business_date,
         cs.status, cs.opening_float, cs.opening_note, cs.opened_by, cs.opened_at,
         cs.current_custodian_id, s.full_name AS opened_by_name,
         fa.name AS cash_drawer_name
  INTO v_existing_session
  FROM public.cash_sessions cs
  LEFT JOIN public.staff s ON s.id = cs.opened_by
  LEFT JOIN public.financial_accounts fa ON fa.id = cs.cash_drawer_account_id
  WHERE cs.open_idempotency_key = v_clean_key;

  IF FOUND THEN
    IF v_existing_session.branch_id <> p_branch_id
       OR v_existing_session.cash_drawer_account_id <> p_cash_drawer_account_id
       OR v_existing_session.business_date <> p_business_date
       OR v_existing_session.opening_float <> p_opening_float::numeric(12,2)
       OR v_existing_session.opening_note IS DISTINCT FROM p_opening_note THEN
      RAISE EXCEPTION 'IDEMPOTENCY_PAYLOAD_MISMATCH: Idempotency key % already used for differing session parameters', v_clean_key;
    END IF;

    RETURN jsonb_build_object(
      'ok', true,
      'sessionId', v_existing_session.id,
      'branchId', v_existing_session.branch_id,
      'cashDrawerAccountId', v_existing_session.cash_drawer_account_id,
      'cashDrawerName', v_existing_session.cash_drawer_name,
      'businessDate', v_existing_session.business_date,
      'openingFloat', v_existing_session.opening_float,
      'openedBy', v_existing_session.opened_by,
      'openedByName', v_existing_session.opened_by_name,
      'currentCustodianId', v_existing_session.current_custodian_id,
      'currentCustodianName', v_existing_session.opened_by_name,
      'openedAt', v_existing_session.opened_at,
      'status', v_existing_session.status,
      'idempotentReplay', true
    );
  END IF;

  -- 4. Validate branch existence & active status
  SELECT b.id, b.is_active
  INTO v_branch
  FROM public.branches b
  WHERE b.id = p_branch_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BRANCH_NOT_FOUND: Branch % does not exist', p_branch_id;
  END IF;

  IF NOT v_branch.is_active THEN
    RAISE EXCEPTION 'BRANCH_INACTIVE: Branch % is inactive', p_branch_id;
  END IF;

  -- 5. Validate financial account
  SELECT fa.id, fa.branch_id, fa.name, fa.account_type, fa.currency, fa.is_active
  INTO v_account
  FROM public.financial_accounts fa
  WHERE fa.id = p_cash_drawer_account_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACCOUNT_NOT_FOUND: Financial account % does not exist', p_cash_drawer_account_id;
  END IF;

  IF NOT v_account.is_active THEN
    RAISE EXCEPTION 'ACCOUNT_INACTIVE: Financial account % is inactive', p_cash_drawer_account_id;
  END IF;

  IF v_account.account_type <> 'cash_drawer' THEN
    RAISE EXCEPTION 'ACCOUNT_INVALID_TYPE: Account % is type %, expected cash_drawer',
      p_cash_drawer_account_id, v_account.account_type;
  END IF;

  IF v_account.branch_id <> p_branch_id THEN
    RAISE EXCEPTION 'ACCOUNT_BRANCH_MISMATCH: Drawer account % belongs to branch %, expected %',
      p_cash_drawer_account_id, v_account.branch_id, p_branch_id;
  END IF;

  IF v_account.currency <> 'PHP' THEN
    RAISE EXCEPTION 'ACCOUNT_INVALID_CURRENCY: Account currency % is not supported, expected PHP', v_account.currency;
  END IF;

  -- 6. Enforce single open session per physical drawer
  SELECT cs.id, cs.opened_at, cs.opened_by
  INTO v_open_session
  FROM public.cash_sessions cs
  WHERE cs.cash_drawer_account_id = p_cash_drawer_account_id
    AND cs.status = 'open'
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'DRAWER_ALREADY_OPEN: Cash drawer account % already has an open session (session % opened at %)',
      p_cash_drawer_account_id, v_open_session.id, v_open_session.opened_at;
  END IF;

  -- 7. Insert canonical cash session record
  INSERT INTO public.cash_sessions (
    branch_id,
    cash_drawer_account_id,
    business_date,
    status,
    opening_float,
    opening_note,
    opened_by,
    current_custodian_id,
    opened_at,
    open_idempotency_key
  ) VALUES (
    p_branch_id,
    p_cash_drawer_account_id,
    p_business_date,
    'open',
    p_opening_float,
    p_opening_note,
    v_staff.id,
    v_staff.id,
    v_now,
    v_clean_key
  )
  RETURNING id INTO v_session_id;

  RETURN jsonb_build_object(
    'ok', true,
    'sessionId', v_session_id,
    'branchId', p_branch_id,
    'cashDrawerAccountId', p_cash_drawer_account_id,
    'cashDrawerName', v_account.name,
    'businessDate', p_business_date,
    'openingFloat', p_opening_float,
    'openedBy', v_staff.id,
    'openedByName', v_staff.full_name,
    'currentCustodianId', v_staff.id,
    'currentCustodianName', v_staff.full_name,
    'openedAt', v_now,
    'status', 'open',
    'idempotentReplay', false
  );
END;
$func$;

REVOKE ALL ON FUNCTION public.open_cash_session_atomic(UUID, UUID, NUMERIC, DATE, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_cash_session_atomic(UUID, UUID, NUMERIC, DATE, TEXT, TEXT) TO authenticated, service_role;


-- ─── 5. CANONICAL WRITER RPC: close_cash_session_atomic ────────────────────────

CREATE OR REPLACE FUNCTION public.close_cash_session_atomic(
  p_session_id        UUID,
  p_counted_cash      NUMERIC,
  p_closing_note      TEXT DEFAULT NULL,
  p_idempotency_key   TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  v_auth_uid          UUID;
  v_staff             RECORD;
  v_session           RECORD;
  v_account           RECORD;
  v_clean_key         TEXT;
  v_expected_cash     NUMERIC(12,2);
  v_variance          NUMERIC(12,2);
  v_movements_total   NUMERIC(12,2);
  v_now               TIMESTAMPTZ := clock_timestamp();
  v_existing_by_key   RECORD;
BEGIN
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'SESSION_ID_REQUIRED: Cash session ID is required';
  END IF;

  IF p_counted_cash IS NULL OR p_counted_cash < 0 THEN
    RAISE EXCEPTION 'INVALID_COUNTED_CASH: Counted cash must be non-negative, got %', p_counted_cash;
  END IF;

  v_clean_key := trim(COALESCE(p_idempotency_key, ''));
  IF v_clean_key = '' THEN
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED: Idempotency key is required';
  END IF;

  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Unauthenticated caller cannot close cash session';
  END IF;

  SELECT s.id, s.branch_id, s.system_role, s.is_active, s.full_name
    INTO v_staff
  FROM public.staff s WHERE s.auth_user_id = v_auth_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STAFF_NOT_FOUND: No staff record for authenticated caller';
  END IF;
  IF NOT v_staff.is_active THEN
    RAISE EXCEPTION 'STAFF_INACTIVE: Caller is inactive';
  END IF;
  IF v_staff.system_role NOT IN ('owner', 'manager', 'assistant_manager', 'store_manager', 'crm') THEN
    RAISE EXCEPTION 'CASH_ROLE_UNAUTHORIZED: Caller cannot close a cash drawer';
  END IF;

  -- Concurrency serialization
  PERFORM pg_advisory_xact_lock(hashtext('cash_session_close_' || p_session_id::text));
  PERFORM pg_advisory_xact_lock(hashtext('cash_session_close_idem_' || v_clean_key));

  -- Idempotency check: was this idempotency key already used?
  SELECT cs.id, cs.branch_id, cs.cash_drawer_account_id, cs.business_date,
         cs.status, cs.opening_float, cs.counted_cash, cs.expected_cash_at_close,
         cs.variance, cs.closing_note, cs.closed_by, cs.closed_at,
         s.full_name AS closed_by_name, fa.name AS cash_drawer_name
  INTO v_existing_by_key
  FROM public.cash_sessions cs
  LEFT JOIN public.staff s ON s.id = cs.closed_by
  LEFT JOIN public.financial_accounts fa ON fa.id = cs.cash_drawer_account_id
  WHERE cs.close_idempotency_key = v_clean_key;

  IF FOUND THEN
    IF v_existing_by_key.id <> p_session_id
       OR v_existing_by_key.counted_cash <> p_counted_cash::numeric(12,2)
       OR v_existing_by_key.closing_note IS DISTINCT FROM p_closing_note THEN
      RAISE EXCEPTION 'IDEMPOTENCY_PAYLOAD_MISMATCH: Idempotency key % already used for differing close parameters', v_clean_key;
    END IF;

    RETURN jsonb_build_object(
      'ok', true,
      'sessionId', v_existing_by_key.id,
      'branchId', v_existing_by_key.branch_id,
      'cashDrawerAccountId', v_existing_by_key.cash_drawer_account_id,
      'cashDrawerName', v_existing_by_key.cash_drawer_name,
      'businessDate', v_existing_by_key.business_date,
      'status', v_existing_by_key.status,
      'openingFloat', v_existing_by_key.opening_float,
      'expectedCash', v_existing_by_key.expected_cash_at_close,
      'countedCash', v_existing_by_key.counted_cash,
      'variance', v_existing_by_key.variance,
      'closedBy', v_existing_by_key.closed_by,
      'closedByName', v_existing_by_key.closed_by_name,
      'closedAt', v_existing_by_key.closed_at,
      'idempotentReplay', true
    );
  END IF;

  -- Lock session row for update
  SELECT cs.*
  INTO v_session
  FROM public.cash_sessions cs
  WHERE cs.id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND: Cash session % does not exist', p_session_id;
  END IF;

  IF v_session.status = 'closed' THEN
    RAISE EXCEPTION 'SESSION_ALREADY_CLOSED: Cash session % is already closed', p_session_id;
  END IF;

  IF v_staff.system_role <> 'owner' AND v_staff.branch_id IS DISTINCT FROM v_session.branch_id THEN
    RAISE EXCEPTION 'BRANCH_UNAUTHORIZED: Caller cannot close a session in this branch';
  END IF;

  -- Lock cash drawer account
  SELECT fa.id, fa.name INTO v_account
  FROM public.financial_accounts fa
  WHERE fa.id = v_session.cash_drawer_account_id
  FOR UPDATE;

  -- Calculate expected cash atomically from opening float + posted movements since opened_at
  SELECT COALESCE(SUM(fam.amount), 0.00)
  INTO v_movements_total
  FROM public.financial_account_movements fam
  JOIN public.financial_transactions ft ON ft.id = fam.transaction_id
  WHERE fam.financial_account_id = v_session.cash_drawer_account_id
    AND ft.status = 'posted'
    AND fam.created_at >= v_session.opened_at;

  v_expected_cash := v_session.opening_float + v_movements_total;
  v_variance := (p_counted_cash::numeric(12,2)) - v_expected_cash;

  -- Update session to closed
  UPDATE public.cash_sessions
  SET status = 'closed',
      closed_by = v_staff.id,
      closed_at = v_now,
      counted_cash = p_counted_cash::numeric(12,2),
      expected_cash_at_close = v_expected_cash,
      variance = v_variance,
      closing_note = p_closing_note,
      close_idempotency_key = v_clean_key,
      updated_at = v_now
  WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'ok', true,
    'sessionId', p_session_id,
    'branchId', v_session.branch_id,
    'cashDrawerAccountId', v_session.cash_drawer_account_id,
    'cashDrawerName', v_account.name,
    'businessDate', v_session.business_date,
    'status', 'closed',
    'openingFloat', v_session.opening_float,
    'expectedCash', v_expected_cash,
    'countedCash', p_counted_cash::numeric(12,2),
    'variance', v_variance,
    'closedBy', v_staff.id,
    'closedByName', v_staff.full_name,
    'closedAt', v_now,
    'idempotentReplay', false
  );
END;
$func$;

REVOKE ALL ON FUNCTION public.close_cash_session_atomic(UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_cash_session_atomic(UUID, NUMERIC, TEXT, TEXT) TO authenticated, service_role;


-- ─── 6. CANONICAL WRITER RPC: handover_cash_session_atomic ─────────────────────

CREATE OR REPLACE FUNCTION public.handover_cash_session_atomic(
  p_session_id              UUID,
  p_incoming_custodian_id   UUID,
  p_counted_cash            NUMERIC,
  p_notes                   TEXT DEFAULT NULL,
  p_idempotency_key         TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  v_auth_uid          UUID;
  v_staff             RECORD;
  v_session           RECORD;
  v_incoming          RECORD;
  v_clean_key         TEXT;
  v_expected_cash     NUMERIC(12,2);
  v_variance          NUMERIC(12,2);
  v_movements_total   NUMERIC(12,2);
  v_now               TIMESTAMPTZ := clock_timestamp();
  v_existing_by_key   RECORD;
  v_handover_id       UUID;
  v_outgoing_id       UUID;
  v_outgoing_name     TEXT;
BEGIN
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'SESSION_ID_REQUIRED: Cash session ID is required';
  END IF;

  IF p_incoming_custodian_id IS NULL THEN
    RAISE EXCEPTION 'INCOMING_CUSTODIAN_REQUIRED: Incoming custodian ID is required';
  END IF;

  IF p_counted_cash IS NULL OR p_counted_cash < 0 THEN
    RAISE EXCEPTION 'INVALID_COUNTED_CASH: Counted cash must be non-negative, got %', p_counted_cash;
  END IF;

  v_clean_key := trim(COALESCE(p_idempotency_key, ''));
  IF v_clean_key = '' THEN
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED: Idempotency key is required';
  END IF;

  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Unauthenticated caller cannot execute handover';
  END IF;

  SELECT s.id, s.branch_id, s.system_role, s.is_active, s.full_name
    INTO v_staff
  FROM public.staff s WHERE s.auth_user_id = v_auth_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STAFF_NOT_FOUND: No staff record for authenticated caller';
  END IF;
  IF NOT v_staff.is_active THEN
    RAISE EXCEPTION 'STAFF_INACTIVE: Caller is inactive';
  END IF;
  IF v_staff.system_role NOT IN ('owner', 'manager', 'assistant_manager', 'store_manager', 'crm') THEN
    RAISE EXCEPTION 'CASH_ROLE_UNAUTHORIZED: Caller cannot perform drawer handover';
  END IF;

  -- Concurrency serialization
  PERFORM pg_advisory_xact_lock(hashtext('cash_session_handover_' || p_session_id::text));
  PERFORM pg_advisory_xact_lock(hashtext('cash_session_handover_idem_' || v_clean_key));

  -- Idempotency check
  SELECT h.id, h.cash_session_id, h.outgoing_custodian_id, h.incoming_custodian_id,
         h.expected_cash, h.counted_cash, h.variance, h.notes, h.created_at,
         s_out.full_name AS outgoing_name, s_in.full_name AS incoming_name
  INTO v_existing_by_key
  FROM public.cash_session_handovers h
  LEFT JOIN public.staff s_out ON s_out.id = h.outgoing_custodian_id
  LEFT JOIN public.staff s_in ON s_in.id = h.incoming_custodian_id
  WHERE h.idempotency_key = v_clean_key;

  IF FOUND THEN
    IF v_existing_by_key.cash_session_id <> p_session_id
       OR v_existing_by_key.incoming_custodian_id <> p_incoming_custodian_id
       OR v_existing_by_key.counted_cash <> p_counted_cash::numeric(12,2)
       OR v_existing_by_key.notes IS DISTINCT FROM p_notes THEN
      RAISE EXCEPTION 'IDEMPOTENCY_PAYLOAD_MISMATCH: Idempotency key % already used for differing handover parameters', v_clean_key;
    END IF;

    RETURN jsonb_build_object(
      'ok', true,
      'handoverId', v_existing_by_key.id,
      'sessionId', v_existing_by_key.cash_session_id,
      'outgoingCustodianId', v_existing_by_key.outgoing_custodian_id,
      'outgoingCustodianName', v_existing_by_key.outgoing_name,
      'incomingCustodianId', v_existing_by_key.incoming_custodian_id,
      'incomingCustodianName', v_existing_by_key.incoming_name,
      'expectedCash', v_existing_by_key.expected_cash,
      'countedCash', v_existing_by_key.counted_cash,
      'variance', v_existing_by_key.variance,
      'recordedAt', v_existing_by_key.created_at,
      'idempotentReplay', true
    );
  END IF;

  -- Lock session row for update
  SELECT cs.*
  INTO v_session
  FROM public.cash_sessions cs
  WHERE cs.id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND: Cash session % does not exist', p_session_id;
  END IF;

  IF v_session.status <> 'open' THEN
    RAISE EXCEPTION 'SESSION_NOT_OPEN: Cannot execute handover on % session', v_session.status;
  END IF;

  IF v_staff.system_role <> 'owner' AND v_staff.branch_id IS DISTINCT FROM v_session.branch_id THEN
    RAISE EXCEPTION 'BRANCH_UNAUTHORIZED: Caller cannot perform handover in this branch';
  END IF;

  v_outgoing_id := COALESCE(v_session.current_custodian_id, v_session.opened_by);

  -- Fetch outgoing custodian name
  SELECT s.full_name INTO v_outgoing_name
  FROM public.staff s WHERE s.id = v_outgoing_id;

  -- Validate incoming custodian
  SELECT s.id, s.branch_id, s.system_role, s.is_active, s.full_name
  INTO v_incoming
  FROM public.staff s
  WHERE s.id = p_incoming_custodian_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INCOMING_STAFF_NOT_FOUND: Incoming custodian % does not exist', p_incoming_custodian_id;
  END IF;

  IF NOT v_incoming.is_active THEN
    RAISE EXCEPTION 'INCOMING_STAFF_INACTIVE: Incoming custodian is inactive';
  END IF;

  IF v_incoming.system_role NOT IN ('owner', 'manager', 'assistant_manager', 'store_manager', 'crm') THEN
    RAISE EXCEPTION 'INCOMING_STAFF_ROLE_UNAUTHORIZED: Incoming custodian cannot hold drawer custody';
  END IF;

  IF v_incoming.system_role <> 'owner' AND v_incoming.branch_id IS DISTINCT FROM v_session.branch_id THEN
    RAISE EXCEPTION 'INCOMING_STAFF_BRANCH_MISMATCH: Incoming custodian does not belong to branch %', v_session.branch_id;
  END IF;

  IF v_incoming.id = v_outgoing_id THEN
    RAISE EXCEPTION 'IDENTICAL_CUSTODIAN: Incoming custodian must be different from current custodian';
  END IF;

  -- Calculate expected cash atomically from opening float + posted movements since opened_at
  SELECT COALESCE(SUM(fam.amount), 0.00)
  INTO v_movements_total
  FROM public.financial_account_movements fam
  JOIN public.financial_transactions ft ON ft.id = fam.transaction_id
  WHERE fam.financial_account_id = v_session.cash_drawer_account_id
    AND ft.status = 'posted'
    AND fam.created_at >= v_session.opened_at;

  v_expected_cash := v_session.opening_float + v_movements_total;
  v_variance := (p_counted_cash::numeric(12,2)) - v_expected_cash;

  -- Record the handover event
  INSERT INTO public.cash_session_handovers (
    cash_session_id,
    cash_drawer_account_id,
    branch_id,
    outgoing_custodian_id,
    incoming_custodian_id,
    expected_cash,
    counted_cash,
    variance,
    notes,
    recorded_by,
    idempotency_key,
    created_at
  ) VALUES (
    p_session_id,
    v_session.cash_drawer_account_id,
    v_session.branch_id,
    v_outgoing_id,
    v_incoming.id,
    v_expected_cash,
    p_counted_cash::numeric(12,2),
    v_variance,
    p_notes,
    v_staff.id,
    v_clean_key,
    v_now
  )
  RETURNING id INTO v_handover_id;

  -- Update session current custodian
  UPDATE public.cash_sessions
  SET current_custodian_id = v_incoming.id,
      updated_at = v_now
  WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'ok', true,
    'handoverId', v_handover_id,
    'sessionId', p_session_id,
    'outgoingCustodianId', v_outgoing_id,
    'outgoingCustodianName', v_outgoing_name,
    'incomingCustodianId', v_incoming.id,
    'incomingCustodianName', v_incoming.full_name,
    'expectedCash', v_expected_cash,
    'countedCash', p_counted_cash::numeric(12,2),
    'variance', v_variance,
    'recordedAt', v_now,
    'idempotentReplay', false
  );
END;
$func$;

REVOKE ALL ON FUNCTION public.handover_cash_session_atomic(UUID, UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.handover_cash_session_atomic(UUID, UUID, NUMERIC, TEXT, TEXT) TO authenticated, service_role;


-- ─── 7. EXPENSE POST-CLOSE DRAWER GUARD ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.post_expense_atomic(
  p_branch_id            UUID,
  p_idempotency_key      TEXT,
  p_amount               NUMERIC,
  p_category_id          UUID,
  p_financial_account_id UUID,
  p_payee                TEXT,
  p_description          TEXT,
  p_receipt_reference    TEXT DEFAULT NULL,
  p_business_date        DATE DEFAULT NULL,
  p_notes                TEXT DEFAULT NULL,
  p_receipt_image_path   TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  v_auth_uid        UUID;
  v_staff           RECORD;
  v_account         RECORD;
  v_category        RECORD;
  v_existing_tx     RECORD;
  v_business_date   DATE;
  v_now             TIMESTAMPTZ := clock_timestamp();
  v_transaction_id  UUID;
  v_movement_id     UUID;
  v_expense_id      UUID;
  v_amount          NUMERIC(12,2);
BEGIN
  -- 1. Input sanity
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: Expense amount must be greater than zero';
  END IF;
  v_amount := ROUND(p_amount::numeric, 2);

  IF p_category_id IS NULL THEN
    RAISE EXCEPTION 'CATEGORY_REQUIRED: Expense category is required';
  END IF;

  IF p_financial_account_id IS NULL THEN
    RAISE EXCEPTION 'ACCOUNT_REQUIRED: Financial payment account is required';
  END IF;

  IF p_description IS NULL OR TRIM(p_description) = '' THEN
    RAISE EXCEPTION 'DESCRIPTION_REQUIRED: Expense description is required';
  END IF;

  -- 2. Actor authentication & authorization
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Authentication required to post expense';
  ELSE
    SELECT * INTO v_staff FROM public.staff WHERE auth_user_id = v_auth_uid AND is_active = true LIMIT 1;
    IF v_staff IS NULL THEN
      RAISE EXCEPTION 'STAFF_NOT_FOUND: Active staff record not found for authenticated user';
    END IF;
  END IF;

  -- Determine effective branch
  IF p_branch_id IS NULL THEN
    p_branch_id := v_staff.branch_id;
  END IF;

  IF p_branch_id IS NULL THEN
    RAISE EXCEPTION 'BRANCH_REQUIRED: Branch ID is required';
  END IF;

  IF v_staff.system_role NOT IN ('owner', 'manager', 'assistant_manager', 'store_manager', 'crm') THEN
    RAISE EXCEPTION 'EXPENSE_ROLE_UNAUTHORIZED: Caller cannot post expenses';
  END IF;
  IF v_staff.system_role <> 'owner' AND v_staff.branch_id <> p_branch_id THEN
    RAISE EXCEPTION 'BRANCH_MISMATCH: Staff member is not authorized for branch %', p_branch_id;
  END IF;

  -- 3. Idempotency Check
  IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
    SELECT * INTO v_existing_tx FROM public.financial_transactions
    WHERE idempotency_key = TRIM(p_idempotency_key);

    IF v_existing_tx.id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'transactionId', v_existing_tx.id,
        'idempotentReplay', true,
        'amount', v_amount
      );
    END IF;
  END IF;

  -- 4. Validate category
  SELECT * INTO v_category FROM public.financial_expense_categories
  WHERE id = p_category_id AND is_active = true;
  IF v_category.id IS NULL THEN
    RAISE EXCEPTION 'INVALID_CATEGORY: Expense category does not exist or is inactive';
  END IF;

  -- 5. Validate financial account
  SELECT * INTO v_account FROM public.financial_accounts
  WHERE id = p_financial_account_id;
  IF v_account.id IS NULL THEN
    RAISE EXCEPTION 'ACCOUNT_NOT_FOUND: Financial account does not exist';
  END IF;
  IF NOT v_account.is_active THEN
    RAISE EXCEPTION 'ACCOUNT_INACTIVE: Financial account is inactive';
  END IF;
  IF v_account.branch_id IS NOT NULL AND v_account.branch_id <> p_branch_id THEN
    RAISE EXCEPTION 'ACCOUNT_BRANCH_MISMATCH: Financial account does not belong to branch %', p_branch_id;
  END IF;

  -- 5b. Cash drawer session requirement (P1 Cash Flow protection)
  IF v_account.account_type = 'cash_drawer'
     AND NOT EXISTS (
       SELECT 1
       FROM public.cash_sessions cs
       WHERE cs.branch_id = p_branch_id
         AND cs.cash_drawer_account_id = v_account.id
         AND cs.status = 'open'
     ) THEN
    RAISE EXCEPTION 'CASH_DRAWER_SESSION_REQUIRED: Open the selected cash drawer before recording a cash expense.';
  END IF;

  -- 6. Business date
  v_business_date := COALESCE(p_business_date, CURRENT_DATE);

  -- 7. Insert Canonical Financial Transaction Header
  INSERT INTO public.financial_transactions (
    branch_id,
    transaction_type,
    business_date,
    occurred_at,
    recorded_at,
    recorded_by,
    currency,
    status,
    idempotency_key,
    source_type,
    source_id,
    external_reference,
    notes
  ) VALUES (
    p_branch_id,
    'operational_expense',
    v_business_date,
    v_now,
    v_now,
    v_staff.id,
    'PHP',
    'posted',
    p_idempotency_key,
    NULL,
    NULL,
    p_receipt_reference,
    p_notes
  ) RETURNING id INTO v_transaction_id;

  -- 8. Insert Negative Account Movement (Outflow = -amount per CF1-D08)
  INSERT INTO public.financial_account_movements (
    transaction_id,
    financial_account_id,
    amount,
    payment_method,
    external_reference,
    created_at
  ) VALUES (
    v_transaction_id,
    v_account.id,
    -v_amount, -- NEGATIVE SIGNED OUTFLOW
    CASE v_account.account_type
      WHEN 'cash_drawer' THEN 'cash'
      WHEN 'card_terminal' THEN 'card'
      ELSE v_account.account_type
    END,
    p_receipt_reference,
    v_now
  ) RETURNING id INTO v_movement_id;

  -- 9. Insert Expense Detail with Receipt Image Path (Persisted to receipt_image_url)
  INSERT INTO public.financial_expense_details (
    transaction_id,
    category_id,
    payee,
    description,
    receipt_reference,
    receipt_image_url,
    approval_status,
    approved_by,
    notes,
    created_at
  ) VALUES (
    v_transaction_id,
    v_category.id,
    COALESCE(TRIM(p_payee), 'Direct Vendor'),
    TRIM(p_description),
    p_receipt_reference,
    p_receipt_image_path,
    'approved_instant',
    v_staff.id,
    p_notes,
    v_now
  ) RETURNING id INTO v_expense_id;

  -- 10. Return canonical result
  RETURN jsonb_build_object(
    'success', true,
    'transactionId', v_transaction_id,
    'movementId', v_movement_id,
    'expenseDetailId', v_expense_id,
    'amount', v_amount,
    'category', v_category.name,
    'account', v_account.name,
    'businessDate', v_business_date,
    'receiptImagePath', p_receipt_image_path,
    'idempotentReplay', false
  );
END;
$func$;

REVOKE ALL ON FUNCTION public.post_expense_atomic(UUID, TEXT, NUMERIC, UUID, UUID, TEXT, TEXT, TEXT, DATE, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_expense_atomic(UUID, TEXT, NUMERIC, UUID, UUID, TEXT, TEXT, TEXT, DATE, TEXT, TEXT) TO authenticated, service_role;

COMMIT;
