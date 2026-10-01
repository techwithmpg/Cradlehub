-- ==============================================================================
-- CF8-B1/B2: CANONICAL CASH SESSION FOUNDATION + OPEN SESSION WRITER
-- Architecture: CF8 Stage — Drawer Session Lifecycle & Physical Float Authority
-- Target: CradleHub Web — Cash Flow
-- Invariant: ONE OPEN SESSION PER PHYSICAL CASH DRAWER
-- Invariant: Opening float is operational session state, NOT revenue/income/movement
-- Invariant: STRICT CF4 Authentication Pattern (auth.uid() required; zero fallback)
-- ==============================================================================

-- ─── 1. TABLE: public.cash_sessions ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cash_sessions (
  id                        UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id                 UUID          NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  cash_drawer_account_id    UUID          NOT NULL REFERENCES public.financial_accounts(id) ON DELETE RESTRICT,
  business_date             DATE          NOT NULL,
  status                    TEXT          NOT NULL DEFAULT 'open'
                                          CHECK (status IN ('open', 'closed')),
  opening_float             NUMERIC(12,2) NOT NULL CHECK (opening_float >= 0),
  opening_note              TEXT          NULL,
  opened_by                 UUID          NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  opened_at                 TIMESTAMPTZ   NOT NULL DEFAULT now(),
  closed_by                 UUID          NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  closed_at                 TIMESTAMPTZ   NULL,
  open_idempotency_key      TEXT          NOT NULL UNIQUE,
  created_at                TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT check_cash_session_lifecycle
    CHECK (
      (status = 'open' AND closed_at IS NULL AND closed_by IS NULL)
      OR
      (status = 'closed' AND closed_at IS NOT NULL)
    )
);

COMMENT ON TABLE public.cash_sessions IS
  'Canonical physical cash drawer session lifecycle authority (opening float, drawer state, and closing custody).';
COMMENT ON COLUMN public.cash_sessions.opening_float IS
  'Counted physical opening cash float in drawer. Operational state, NOT revenue or ledger movement.';
COMMENT ON COLUMN public.cash_sessions.open_idempotency_key IS
  'Unique idempotency key ensuring duplicate open requests are safely suppressed.';


-- ─── 2. INDEXES & CONSTRAINTS ────────────────────────────────────────────────
-- Concurrency invariant: EXACTLY ONE OPEN SESSION PER PHYSICAL CASH DRAWER
CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_sessions_open_drawer
  ON public.cash_sessions (cash_drawer_account_id)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_cash_sessions_branch_status
  ON public.cash_sessions (branch_id, status);

CREATE INDEX IF NOT EXISTS idx_cash_sessions_drawer_opened_at
  ON public.cash_sessions (cash_drawer_account_id, opened_at DESC);

CREATE INDEX IF NOT EXISTS idx_cash_sessions_business_date
  ON public.cash_sessions (branch_id, business_date);


-- ─── 3. ROW-LEVEL SECURITY (RLS) ─────────────────────────────────────────────
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;

-- 3.1. Owner, Finance, Admin: Full cross-branch read access
DROP POLICY IF EXISTS "cash_sessions_owner_finance_read_all" ON public.cash_sessions;
CREATE POLICY "cash_sessions_owner_finance_read_all"
  ON public.cash_sessions FOR SELECT
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

-- 3.2. Branch Staff & Front Desk: Read sessions strictly within own authorized branch
DROP POLICY IF EXISTS "cash_sessions_branch_read" ON public.cash_sessions;
CREATE POLICY "cash_sessions_branch_read"
  ON public.cash_sessions FOR SELECT
  TO authenticated
  USING (
    branch_id = public.get_auth_branch_id()
    OR branch_id IN (
      SELECT branch_id FROM public.staff
      WHERE auth_user_id = (SELECT auth.uid())
        AND is_active = true
    )
  );

-- 3.3. Service Role: Unrestricted for trusted administrative / test tasks
DROP POLICY IF EXISTS "cash_sessions_service_role_all" ON public.cash_sessions;
CREATE POLICY "cash_sessions_service_role_all"
  ON public.cash_sessions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Direct mutation is completely revoked from authenticated/anon (must use canonical RPC)
REVOKE ALL ON TABLE public.cash_sessions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.cash_sessions TO authenticated;
GRANT ALL ON TABLE public.cash_sessions TO service_role;


-- ─── 4. CANONICAL WRITER RPC: open_cash_session_atomic ───────────────────────
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

  -- Authenticate before the replay lookup so an untrusted caller cannot read
  -- an existing drawer session by guessing its idempotency key.
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

  -- 2. Concurrency serialization: Acquire advisory transaction lock for drawer & idempotency key
  PERFORM pg_advisory_xact_lock(hashtext('cash_drawer_lock_' || p_cash_drawer_account_id::text));
  PERFORM pg_advisory_xact_lock(hashtext('cash_session_idem_' || v_clean_key));

  -- 3. Idempotency Check: Existing session with identical key returns identical payload
  SELECT cs.id, cs.branch_id, cs.cash_drawer_account_id, cs.business_date,
         cs.status, cs.opening_float, cs.opening_note, cs.opened_by, cs.opened_at, s.full_name AS opened_by_name,
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

  -- 7. Validate financial account
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

  -- 8. Enforce single open session per physical drawer
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

  -- 9. Insert canonical cash session record
  -- CRITICAL: Does NOT create financial_transactions or financial_account_movements.
  -- The opening float is operational session state.
  INSERT INTO public.cash_sessions (
    branch_id,
    cash_drawer_account_id,
    business_date,
    status,
    opening_float,
    opening_note,
    opened_by,
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
    v_now,
    v_clean_key
  )
  RETURNING id INTO v_session_id;

  -- 10. Return structured JSON payload
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
    'openedAt', v_now,
    'status', 'open',
    'idempotentReplay', false
  );
END;
$func$;

REVOKE ALL ON FUNCTION public.open_cash_session_atomic(UUID, UUID, NUMERIC, DATE, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_cash_session_atomic(UUID, UUID, NUMERIC, DATE, TEXT, TEXT) TO authenticated, service_role;
