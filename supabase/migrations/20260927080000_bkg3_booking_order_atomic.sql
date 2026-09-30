-- =============================================================================
-- BKG3: Additive Canonical Booking Order + Atomic Creation RPC (FINAL DRAFT)
-- =============================================================================
-- WORKING REPOSITORY MIGRATION DRAFT ONLY.
-- DO NOT APPLY TO LIVE/STAGING/TEST/LOCAL DATABASE WITHOUT EXPLICIT OWNER GATE.
--
-- Hierarchy:
--   booking_orders (1 per checkout aggregate / organizer visit)
--     └── booking_attendees (1..N persons receiving care; guests need no auth)
--           └── bookings (service appointment lines, preserving bookings.id PK)
--
-- Security & Operational Architecture:
--   1. Zero historical mutation: legacy bookings with order_id IS NULL remain valid.
--   2. Strict server/database-authoritative idempotency:
--      - Caller passes idempotency_key + canonical JSONB payload.
--      - DB/RPC computes canonical SHA-256 payload digest (no client-supplied hash trust).
--      - Rapid concurrent calls serialized via pg_advisory_xact_lock.
--      - Mismatch on same key throws IDEMPOTENCY_CONFLICT.
--   3. Random order_number generation with collision retry loop (up to 20 attempts).
--      - Fail-closed if collision threshold reached (never duplicates).
--   4. booking_orders is NON-FINANCIAL and has NO independent stored status lifecycle:
--      - Operational status is strictly DERIVED from child bookings via derive_booking_order_status().
--      - View public.v_booking_orders created WITH (security_invoker = true).
--      - Canonical payment_preference is strictly 'pay_at_spa' (no online checkout gateway).
--   5. Organizer vs Attendee semantics frozen:
--      - bookings.customer_id ALWAYS references organizer_customer_id (legacy non-null compatibility).
--      - bookings.attendee_id references booking_attendees(id) (actual service recipient).
--      - Guests do not require customer profile (booking_attendees.customer_id is NULL).
--   6. Hardened Security & Explicit Grants:
--      - Tables: REVOKE ALL from PUBLIC, anon, authenticated; GRANT SELECT to authenticated; GRANT ALL to service_role.
--      - View: WITH (security_invoker = true); REVOKE from PUBLIC, anon; GRANT SELECT to authenticated, service_role.
--      - RPC function: SECURITY INVOKER; REVOKE from PUBLIC, anon, authenticated; GRANT EXECUTE to service_role.
--   7. Preserved Accepted RLS Semantics:
--      - Owner: full cross-branch SELECT.
--      - CRM: cross-branch booking read SELECT.
--      - Manager / Assistant Manager / Store Manager: branch-scoped SELECT.
--      - Therapists and Drivers: NO direct table SELECT on parent/attendee tables;
--        their access remains through their assigned service lines and dedicated server endpoints.
-- =============================================================================

BEGIN;

-- ─── 0. EXTENSIONS & FAIL-CLOSED PREFLIGHT GUARDS ─────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $preflight$
BEGIN
  -- Guard against unexpected collision on booking_orders
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'booking_orders'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'booking_orders' AND column_name = 'idempotency_key'
    ) THEN
      RAISE EXCEPTION 'MIGRATION_HALT: public.booking_orders already exists with incompatible structure.'
        USING ERRCODE = '55000';
    END IF;
  END IF;

  -- Guard against unexpected collision on booking_attendees
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'booking_attendees'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'booking_attendees' AND column_name = 'sequence'
    ) THEN
      RAISE EXCEPTION 'MIGRATION_HALT: public.booking_attendees already exists with incompatible structure.'
        USING ERRCODE = '55000';
    END IF;
  END IF;

  -- Guard against incompatible columns on public.bookings
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'order_id'
      AND data_type <> 'uuid'
  ) THEN
    RAISE EXCEPTION 'MIGRATION_HALT: public.bookings.order_id exists but is not UUID.'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'attendee_id'
      AND data_type <> 'uuid'
  ) THEN
    RAISE EXCEPTION 'MIGRATION_HALT: public.bookings.attendee_id exists but is not UUID.'
      USING ERRCODE = '55000';
  END IF;
END;
$preflight$;


-- ─── 1. TABLE: booking_orders ────────────────────────────────────────────────
-- Canonical checkout / visit aggregate.
-- Non-financial. No independent mutable status column.
CREATE TABLE IF NOT EXISTS public.booking_orders (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number            TEXT          NOT NULL UNIQUE,
  branch_id               UUID          NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  organizer_customer_id   UUID          NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  delivery_type           TEXT          NOT NULL DEFAULT 'in_spa'
                                        CHECK (delivery_type IN ('in_spa', 'home_service')),
  booking_date            DATE          NOT NULL,
  currency                TEXT          NOT NULL DEFAULT 'PHP',
  payment_preference      TEXT          NOT NULL DEFAULT 'pay_at_spa'
                                        CHECK (payment_preference = 'pay_at_spa'),
  idempotency_key         TEXT          NOT NULL UNIQUE,
  payload_hash            TEXT          NOT NULL,
  metadata                JSONB         NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.booking_orders IS
  'Canonical parent booking order representing a single customer checkout or visit aggregate. Non-financial.';
COMMENT ON COLUMN public.booking_orders.order_number IS
  'Human-friendly reference code (e.g. CRD-2609-A8B2) generated server-side for customer confirmations.';
COMMENT ON COLUMN public.booking_orders.organizer_customer_id IS
  'Customer who organized and placed the order. Canonical CRM contact for the visit.';
COMMENT ON COLUMN public.booking_orders.idempotency_key IS
  'Client-provided stable UUID token preventing duplicate order creation on network retries.';
COMMENT ON COLUMN public.booking_orders.payload_hash IS
  'Server/DB-computed SHA-256 digest of the canonical order payload. Mismatches are rejected with IDEMPOTENCY_CONFLICT.';

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trg_booking_orders_updated_at ON public.booking_orders;
CREATE TRIGGER trg_booking_orders_updated_at
  BEFORE UPDATE ON public.booking_orders
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_booking_orders_branch_date
  ON public.booking_orders (branch_id, booking_date);

CREATE INDEX IF NOT EXISTS idx_booking_orders_organizer
  ON public.booking_orders (organizer_customer_id);

CREATE INDEX IF NOT EXISTS idx_booking_orders_created_at
  ON public.booking_orders (created_at DESC);


-- ─── 2. TABLE: booking_attendees ─────────────────────────────────────────────
-- People receiving care within a booking order.
-- Guests do NOT require a Supabase Auth account or a customer profile.
CREATE TABLE IF NOT EXISTS public.booking_attendees (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_order_id  UUID          NOT NULL REFERENCES public.booking_orders(id) ON DELETE CASCADE,
  sequence          INT           NOT NULL DEFAULT 1 CHECK (sequence >= 1),
  display_name      TEXT          NOT NULL,
  customer_id       UUID          REFERENCES public.customers(id) ON DELETE SET NULL,
  notes             TEXT,
  metadata          JSONB         NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT booking_attendees_order_seq_unique UNIQUE (booking_order_id, sequence)
);

COMMENT ON TABLE public.booking_attendees IS
  'Individuals receiving care in a booking order. Guests do not require Auth accounts or customer records.';
COMMENT ON COLUMN public.booking_attendees.customer_id IS
  'Optional link to CRM customer record if the attendee is an existing customer or has a profile.';
COMMENT ON COLUMN public.booking_attendees.sequence IS
  '1-based index of the attendee within the order (e.g. 1 = primary guest, 2 = companion).';

CREATE INDEX IF NOT EXISTS idx_booking_attendees_order_id
  ON public.booking_attendees (booking_order_id);

CREATE INDEX IF NOT EXISTS idx_booking_attendees_customer_id
  ON public.booking_attendees (customer_id)
  WHERE customer_id IS NOT NULL;


-- ─── 3. ADDITIVE COLUMNS ON public.bookings ──────────────────────────────────
-- Preserves existing bookings.id as canonical service-line appointment IDs.
-- bookings.customer_id ALWAYS points to organizer_customer_id for legacy compatibility.
-- bookings.attendee_id points to the recipient in booking_attendees.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.booking_orders(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS attendee_id UUID REFERENCES public.booking_attendees(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS line_sequence INT CHECK (line_sequence >= 1);

COMMENT ON COLUMN public.bookings.order_id IS
  'Additive link to parent booking order. NULL for historical legacy bookings.';
COMMENT ON COLUMN public.bookings.attendee_id IS
  'Additive link to specific attendee receiving this service line. NULL for legacy bookings.';
COMMENT ON COLUMN public.bookings.line_sequence IS
  'Sequential index of this service line within the attendee appointment (1, 2, ...).';

CREATE INDEX IF NOT EXISTS idx_bookings_order_id
  ON public.bookings (order_id)
  WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_attendee_id
  ON public.bookings (attendee_id)
  WHERE attendee_id IS NOT NULL;


-- ─── 4. DERIVED PARENT STATUS FUNCTION & VIEW ─────────────────────────────────
-- Parent order status is strictly DERIVED from child service lines.
-- An order with no active child lines will NEVER derive 'confirmed'.
CREATE OR REPLACE FUNCTION public.derive_booking_order_status(p_order_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total       INT;
  v_in_progress INT;
  v_confirmed   INT;
  v_pending     INT;
  v_completed   INT;
  v_cancelled   INT;
  v_no_show     INT;
  v_expired     INT;
BEGIN
  SELECT
    count(*),
    count(*) FILTER (WHERE b.status = 'in_progress'),
    count(*) FILTER (WHERE b.status = 'confirmed'),
    count(*) FILTER (WHERE b.status IN ('pending', 'pending_payment', 'pending_crm_confirmation')),
    count(*) FILTER (WHERE b.status = 'completed'),
    count(*) FILTER (WHERE b.status = 'cancelled'),
    count(*) FILTER (WHERE b.status = 'no_show'),
    count(*) FILTER (WHERE b.status = 'expired')
  INTO
    v_total,
    v_in_progress,
    v_confirmed,
    v_pending,
    v_completed,
    v_cancelled,
    v_no_show,
    v_expired
  FROM public.bookings b
  WHERE b.order_id = p_order_id;

  -- 1. No child service lines
  IF v_total = 0 THEN
    RETURN 'no_lines';
  END IF;

  -- 2. Active in-progress service takes operational precedence
  IF v_in_progress > 0 THEN
    RETURN 'in_progress';
  END IF;

  -- 3. Confirmed scheduled service exists
  IF v_confirmed > 0 THEN
    RETURN 'confirmed';
  END IF;

  -- 4. Pending hold / confirmation exists
  IF v_pending > 0 THEN
    RETURN 'pending';
  END IF;

  -- INVARIANT: If execution reaches here, ALL child lines are in terminal states!
  -- Under NO circumstance can execution derive 'confirmed' here!

  -- 5. Service delivery was fulfilled (at least one service completed)
  -- Covers: all completed, completed + cancelled, completed + no_show
  IF v_completed > 0 THEN
    RETURN 'completed';
  END IF;

  -- 6. Customer no-show without fulfilled service
  -- Covers: all no_show, no_show + cancelled
  IF v_no_show > 0 THEN
    RETURN 'no_show';
  END IF;

  -- 7. Slot hold expiration
  IF v_expired > 0 AND v_cancelled = 0 THEN
    RETURN 'expired';
  END IF;

  -- 8. Cancellation
  RETURN 'cancelled';
END;
$$;

COMMENT ON FUNCTION public.derive_booking_order_status(UUID) IS
  'Derives the authoritative parent order status from its child service-line appointments.';

-- Secure View with security_invoker = true
-- Postgres checks underlying table permissions and RLS against the invoking user.
CREATE OR REPLACE VIEW public.v_booking_orders
WITH (security_invoker = true)
AS
SELECT
  bo.*,
  public.derive_booking_order_status(bo.id) AS derived_status
FROM public.booking_orders bo;

COMMENT ON VIEW public.v_booking_orders IS
  'Canonical booking orders view with dynamically derived status. Executes with caller permissions (security_invoker = true).';


-- ─── 5. ROW LEVEL SECURITY (RLS) — PRESERVED ACCEPTED SEMANTICS ───────────────
ALTER TABLE public.booking_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_attendees ENABLE ROW LEVEL SECURITY;

-- A. Owner: Full cross-branch SELECT visibility
DROP POLICY IF EXISTS "booking_orders_owner_read_all" ON public.booking_orders;
CREATE POLICY "booking_orders_owner_read_all"
  ON public.booking_orders FOR SELECT
  TO authenticated
  USING (public.get_auth_role() = 'owner');

DROP POLICY IF EXISTS "booking_attendees_owner_read_all" ON public.booking_attendees;
CREATE POLICY "booking_attendees_owner_read_all"
  ON public.booking_attendees FOR SELECT
  TO authenticated
  USING (public.get_auth_role() = 'owner');

-- B. CRM: Cross-branch SELECT read access (preserves accepted CRM cross-branch read behavior)
DROP POLICY IF EXISTS "booking_orders_crm_read_all" ON public.booking_orders;
CREATE POLICY "booking_orders_crm_read_all"
  ON public.booking_orders FOR SELECT
  TO authenticated
  USING (public.get_auth_role() = 'crm');

DROP POLICY IF EXISTS "booking_attendees_crm_read_all" ON public.booking_attendees;
CREATE POLICY "booking_attendees_crm_read_all"
  ON public.booking_attendees FOR SELECT
  TO authenticated
  USING (public.get_auth_role() = 'crm');

-- C. Management / Branch Operational Roles: Branch-scoped SELECT access
DROP POLICY IF EXISTS "booking_orders_management_read_branch" ON public.booking_orders;
CREATE POLICY "booking_orders_management_read_branch"
  ON public.booking_orders FOR SELECT
  TO authenticated
  USING (
    public.get_auth_role() IN ('manager', 'assistant_manager', 'store_manager')
    AND branch_id = public.get_auth_branch_id()
  );

DROP POLICY IF EXISTS "booking_attendees_management_read_branch" ON public.booking_attendees;
CREATE POLICY "booking_attendees_management_read_branch"
  ON public.booking_attendees FOR SELECT
  TO authenticated
  USING (
    public.get_auth_role() IN ('manager', 'assistant_manager', 'store_manager')
    AND EXISTS (
      SELECT 1 FROM public.booking_orders bo
      WHERE bo.id = booking_attendees.booking_order_id
        AND bo.branch_id = public.get_auth_branch_id()
    )
  );

-- D. Service Role: Full access for trusted server actions
DROP POLICY IF EXISTS "booking_orders_service_role_all" ON public.booking_orders;
CREATE POLICY "booking_orders_service_role_all"
  ON public.booking_orders FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "booking_attendees_service_role_all" ON public.booking_attendees;
CREATE POLICY "booking_attendees_service_role_all"
  ON public.booking_attendees FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ─── 6. EXPLICIT TABLE & VIEW GRANTS ─────────────────────────────────────────
-- Fail-closed privilege model:
-- 1. anon: Zero permissions on tables and view.
-- 2. authenticated: SELECT only (writes completely blocked; enforced by lack of INSERT/UPDATE/DELETE grants and RLS).
-- 3. service_role: Full access for trusted server backend.

-- booking_orders
REVOKE ALL ON TABLE public.booking_orders FROM PUBLIC;
REVOKE ALL ON TABLE public.booking_orders FROM anon;
REVOKE ALL ON TABLE public.booking_orders FROM authenticated;
GRANT SELECT ON TABLE public.booking_orders TO authenticated;
GRANT ALL ON TABLE public.booking_orders TO service_role;

-- booking_attendees
REVOKE ALL ON TABLE public.booking_attendees FROM PUBLIC;
REVOKE ALL ON TABLE public.booking_attendees FROM anon;
REVOKE ALL ON TABLE public.booking_attendees FROM authenticated;
GRANT SELECT ON TABLE public.booking_attendees TO authenticated;
GRANT ALL ON TABLE public.booking_attendees TO service_role;

-- v_booking_orders view
REVOKE ALL ON TABLE public.v_booking_orders FROM PUBLIC;
REVOKE ALL ON TABLE public.v_booking_orders FROM anon;
GRANT SELECT ON TABLE public.v_booking_orders TO authenticated;
GRANT SELECT ON TABLE public.v_booking_orders TO service_role;


-- ─── 7. ATOMIC POSTGRES FUNCTION (SECURITY INVOKER / SERVER-ONLY) ────────────
-- Function execution is restricted strictly to service_role.
-- Runs with SECURITY INVOKER so it operates with caller privileges (no definer escalation).
CREATE OR REPLACE FUNCTION public.create_booking_order_atomic(
  p_idempotency_key       TEXT,
  p_order                 JSONB,
  p_attendees             JSONB,
  p_service_lines         JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_computed_payload_hash TEXT;
  v_canonical_payload_str TEXT;
  v_existing_order        RECORD;
  v_new_order_id          UUID;
  v_order_number          TEXT;
  v_candidate             TEXT;
  v_yymm                  TEXT;
  v_attempt               INT;

  v_branch_id             UUID;
  v_organizer_customer_id UUID;
  v_delivery_type         TEXT;
  v_booking_date          DATE;
  v_currency              TEXT;
  v_payment_preference    TEXT;
  v_order_metadata        JSONB;

  v_attendee_record       JSONB;
  v_seq                   INT;
  v_new_att_id            UUID;
  v_attendee_map          JSONB := '{}'::jsonb;

  v_line_record           JSONB;
  v_line_seq              INT;
  v_target_att_seq        INT;
  v_target_att_id         UUID;
  v_service_id            UUID;
  v_staff_id              UUID;
  v_start_time            TIME;
  v_end_time              TIME;
  v_travel_buffer         INT;
  v_line_metadata         JSONB;
  v_new_booking_id        UUID;

  v_inserted_line_ids     UUID[] := ARRAY[]::UUID[];
  v_inserted_att_ids      UUID[] := ARRAY[]::UUID[];
  v_ret_line_ids          JSONB;
  v_ret_att_ids           JSONB;
BEGIN
  -- A. Input sanity
  IF p_idempotency_key IS NULL OR trim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED' USING ERRCODE = '22023';
  END IF;

  -- B. Concurrency advisory lock scoped to the idempotency key
  PERFORM pg_advisory_xact_lock(
    hashtext('bkg_order_idempotency:' || p_idempotency_key)::bigint
  );

  -- C. Database-authoritative canonical payload hashing
  -- Deterministic concatenation of the JSONB payload structures
  v_canonical_payload_str := p_order::text || '||' || p_attendees::text || '||' || p_service_lines::text;
  v_computed_payload_hash := encode(
    extensions.digest(v_canonical_payload_str::bytea, 'sha256'),
    'hex'
  );

  -- D. Check existing order by idempotency key
  SELECT id, order_number, payload_hash
  INTO v_existing_order
  FROM public.booking_orders
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    -- Mismatch detection: same key with different payload is strictly rejected
    IF v_existing_order.payload_hash IS DISTINCT FROM v_computed_payload_hash THEN
      RAISE EXCEPTION USING
        ERRCODE = '23505',
        MESSAGE = 'IDEMPOTENCY_CONFLICT',
        DETAIL = 'The idempotency key has already been used with a different payload.';
    END IF;

    -- Return the existing order details idempotently
    SELECT coalesce(jsonb_agg(b.id ORDER BY coalesce(b.line_sequence, 1), b.created_at), '[]'::jsonb)
    INTO v_ret_line_ids
    FROM public.bookings b
    WHERE b.order_id = v_existing_order.id;

    SELECT coalesce(jsonb_agg(ba.id ORDER BY ba.sequence), '[]'::jsonb)
    INTO v_ret_att_ids
    FROM public.booking_attendees ba
    WHERE ba.booking_order_id = v_existing_order.id;

    RETURN jsonb_build_object(
      'ok', true,
      'idempotency_status', 'replayed',
      'order_id', v_existing_order.id,
      'order_number', v_existing_order.order_number,
      'status', public.derive_booking_order_status(v_existing_order.id),
      'service_line_ids', v_ret_line_ids,
      'attendee_ids', v_ret_att_ids
    );
  END IF;

  -- E. Parse and validate order parameters
  v_branch_id             := (p_order->>'branch_id')::UUID;
  v_organizer_customer_id := (p_order->>'organizer_customer_id')::UUID;
  v_delivery_type         := coalesce(p_order->>'delivery_type', 'in_spa');
  v_booking_date          := (p_order->>'booking_date')::DATE;
  v_currency              := coalesce(p_order->>'currency', 'PHP');
  v_payment_preference    := coalesce(p_order->>'payment_preference', 'pay_at_spa');
  v_order_metadata        := coalesce(p_order->'metadata', '{}'::jsonb);

  IF v_branch_id IS NULL OR v_organizer_customer_id IS NULL OR v_booking_date IS NULL THEN
    RAISE EXCEPTION 'ORDER_PAYLOAD_INVALID: missing branch_id, organizer_customer_id, or booking_date'
      USING ERRCODE = '22023';
  END IF;

  IF v_payment_preference <> 'pay_at_spa' THEN
    RAISE EXCEPTION 'UNSUPPORTED_PAYMENT_PREFERENCE: only pay_at_spa is supported in this stage.'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_array_length(p_attendees) = 0 THEN
    RAISE EXCEPTION 'ATTENDEES_REQUIRED' USING ERRCODE = '22023';
  END IF;

  IF jsonb_array_length(p_service_lines) = 0 THEN
    RAISE EXCEPTION 'SERVICE_LINES_REQUIRED' USING ERRCODE = '22023';
  END IF;

  -- Verify branch and organizer customer exist
  IF NOT EXISTS (SELECT 1 FROM public.branches WHERE id = v_branch_id) THEN
    RAISE EXCEPTION 'BRANCH_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = v_organizer_customer_id) THEN
    RAISE EXCEPTION 'CUSTOMER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- F. Random order_number generation with collision retry loop
  v_yymm := to_char(v_booking_date, 'YYMM');
  v_order_number := NULL;
  FOR v_attempt IN 1..20 LOOP
    v_candidate := 'CRD-' || v_yymm || '-' || upper(substr(encode(extensions.gen_random_bytes(3), 'hex'), 1, 4));
    IF NOT EXISTS (
      SELECT 1 FROM public.booking_orders WHERE order_number = v_candidate
    ) THEN
      v_order_number := v_candidate;
      EXIT;
    END IF;
  END LOOP;

  IF v_order_number IS NULL THEN
    RAISE EXCEPTION 'ORDER_NUMBER_GENERATION_FAILED: collision threshold reached, retry checkout.'
      USING ERRCODE = '54000';
  END IF;

  -- G. Insert parent booking_orders row (non-financial, no stored status)
  INSERT INTO public.booking_orders (
    order_number,
    branch_id,
    organizer_customer_id,
    delivery_type,
    booking_date,
    currency,
    payment_preference,
    idempotency_key,
    payload_hash,
    metadata
  ) VALUES (
    v_order_number,
    v_branch_id,
    v_organizer_customer_id,
    v_delivery_type,
    v_booking_date,
    v_currency,
    v_payment_preference,
    p_idempotency_key,
    v_computed_payload_hash,
    v_order_metadata
  )
  RETURNING id INTO v_new_order_id;

  -- H. Insert attendees
  FOR v_attendee_record IN SELECT * FROM jsonb_array_elements(p_attendees)
  LOOP
    v_seq := coalesce((v_attendee_record->>'sequence')::INT, 1);
    INSERT INTO public.booking_attendees (
      booking_order_id,
      sequence,
      display_name,
      customer_id,
      notes,
      metadata
    ) VALUES (
      v_new_order_id,
      v_seq,
      coalesce(v_attendee_record->>'display_name', 'Guest ' || v_seq::text),
      (v_attendee_record->>'customer_id')::UUID,
      v_attendee_record->>'notes',
      coalesce(v_attendee_record->'metadata', '{}'::jsonb)
    )
    RETURNING id INTO v_new_att_id;

    v_inserted_att_ids := array_append(v_inserted_att_ids, v_new_att_id);
    v_attendee_map := jsonb_set(
      v_attendee_map,
      ARRAY[v_seq::text],
      to_jsonb(v_new_att_id::text)
    );
  END LOOP;

  -- I. Insert service-line bookings
  FOR v_line_record IN SELECT * FROM jsonb_array_elements(p_service_lines)
  LOOP
    v_target_att_seq   := coalesce((v_line_record->>'attendee_sequence')::INT, 1);
    v_target_att_id    := (v_attendee_map->>v_target_att_seq::text)::UUID;
    v_line_seq         := coalesce((v_line_record->>'line_sequence')::INT, 1);
    v_service_id       := (v_line_record->>'service_id')::UUID;
    v_staff_id         := (v_line_record->>'staff_id')::UUID;
    v_start_time       := (v_line_record->>'start_time')::TIME;
    v_end_time         := (v_line_record->>'end_time')::TIME;
    v_travel_buffer    := (v_line_record->>'travel_buffer_mins')::INT;
    v_line_metadata    := coalesce(v_line_record->'metadata', '{}'::jsonb);

    IF v_target_att_id IS NULL THEN
      RAISE EXCEPTION 'ATTENDEE_SEQUENCE_UNRESOLVED: %', v_target_att_seq USING ERRCODE = '22023';
    END IF;

    IF v_service_id IS NULL OR v_staff_id IS NULL OR v_start_time IS NULL OR v_end_time IS NULL THEN
      RAISE EXCEPTION 'SERVICE_LINE_PAYLOAD_INVALID' USING ERRCODE = '22023';
    END IF;

    -- Augment line metadata with order and attendee linkages
    v_line_metadata := v_line_metadata || jsonb_build_object(
      'order_id', v_new_order_id,
      'order_number', v_order_number,
      'attendee_id', v_target_att_id
    );

    -- Insert into canonical bookings table.
    -- Critical Compatibility Rule:
    -- customer_id ALWAYS references organizer_customer_id (legacy non-null foreign key).
    -- attendee_id references the specific booking_attendees recipient.
    INSERT INTO public.bookings (
      branch_id,
      service_id,
      staff_id,
      customer_id,
      booking_date,
      start_time,
      end_time,
      type,
      delivery_type,
      status,
      payment_method,
      payment_status,
      amount_paid,
      travel_buffer_mins,
      order_id,
      attendee_id,
      line_sequence,
      metadata
    ) VALUES (
      v_branch_id,
      v_service_id,
      v_staff_id,
      v_organizer_customer_id,
      v_booking_date,
      v_start_time,
      v_end_time,
      'online',
      v_delivery_type,
      'confirmed',
      'pay_on_site',
      'unpaid',
      0,
      v_travel_buffer,
      v_new_order_id,
      v_target_att_id,
      v_line_seq,
      v_line_metadata
    )
    RETURNING id INTO v_new_booking_id;

    v_inserted_line_ids := array_append(v_inserted_line_ids, v_new_booking_id);
  END LOOP;

  -- J. Return complete creation response
  SELECT coalesce(jsonb_agg(to_jsonb(id)), '[]'::jsonb)
  INTO v_ret_line_ids
  FROM unnest(v_inserted_line_ids) AS id;

  SELECT coalesce(jsonb_agg(to_jsonb(id)), '[]'::jsonb)
  INTO v_ret_att_ids
  FROM unnest(v_inserted_att_ids) AS id;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotency_status', 'created',
    'order_id', v_new_order_id,
    'order_number', v_order_number,
    'status', 'confirmed',
    'service_line_ids', v_ret_line_ids,
    'attendee_ids', v_ret_att_ids
  );
END;
$$;

COMMENT ON FUNCTION public.create_booking_order_atomic(TEXT, JSONB, JSONB, JSONB) IS
  'Atomically creates a parent booking_order, its attendees, and all service-line bookings in one ACID transaction. '
  'Enforces strict server/DB idempotency and rolls back completely on any failure. Server-only execution.';

-- ─── 8. PERMISSIONS & GRANTS — HARDENED SERVER-ONLY EXECUTION ─────────────────
-- The browser must NEVER directly execute this privileged booking function.
-- Only trusted server-side execution via service_role is permitted.
REVOKE ALL ON FUNCTION public.create_booking_order_atomic(TEXT, JSONB, JSONB, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_booking_order_atomic(TEXT, JSONB, JSONB, JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.create_booking_order_atomic(TEXT, JSONB, JSONB, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_booking_order_atomic(TEXT, JSONB, JSONB, JSONB) TO service_role;

REVOKE ALL ON FUNCTION public.derive_booking_order_status(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.derive_booking_order_status(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.derive_booking_order_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.derive_booking_order_status(UUID) TO service_role;

COMMIT;
