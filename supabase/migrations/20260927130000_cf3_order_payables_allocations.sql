-- =============================================================================
-- CF3: Order Payables + Financial Allocation Foundation (FINAL DRAFT)
-- =============================================================================
-- Authoritative Contracts:
--   - CradleHub_CF1_Financial_Contract_Freeze.md (CF1-D05, CF1-D06, CF1-D07, CF1-D14, CF1-D15, CF1-D19, CF1-D22)
--   - CradleHub_CF2_Correction_1_Report.md
--
-- Scope:
--   1. public.order_payable_items: Canonical breakdown of what customer owes on a booking order.
--      - Approved charge taxonomy: service, home_service_fee, retail_product, surcharge, discount, manual_adjustment, other_charge.
--      - Strictly excludes: tip, voucher, customer_credit.
--      - Signed amount semantics: positive increases owed, negative (discount) reduces owed. Non-zero required.
--      - Service line bookings 1:1 cross-table order invariant.
--   2. public.financial_order_allocations: Two-tier allocation of financial movement value to orders.
--      - Order-level default (payable_item_id IS NULL).
--      - Item-level split allocation (payable_item_id IS NOT NULL, must belong to same order).
--      - Strict amount > 0, cannot exceed source movement amount.
--      - Append-only immutability safeguards against direct UPDATE/DELETE.
--   3. public.derive_order_payment_state: CF1-D07 pure derived state function (unpaid, partial, paid, overpaid, invalid_negative_payable).
--   4. public.v_booking_order_financial_summaries: Security-invoker derived financial view.
--   5. Hardened RLS and explicit privilege grants (deny-by-default write policies for authenticated role).
-- =============================================================================

BEGIN;

-- ─── 0. EXTENSIONS & DEPENDENCY PREFLIGHT ─────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $preflight$
BEGIN
  -- Verify prerequisite booking_orders table exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'booking_orders'
  ) THEN
    RAISE EXCEPTION 'MIGRATION_HALT: public.booking_orders does not exist. BKG3 migration required.'
      USING ERRCODE = '55000';
  END IF;

  -- Verify prerequisite financial_account_movements table exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'financial_account_movements'
  ) THEN
    RAISE EXCEPTION 'MIGRATION_HALT: public.financial_account_movements does not exist. CF2 migration required.'
      USING ERRCODE = '55000';
  END IF;
END;
$preflight$;


-- ─── 1. TABLE: order_payable_items ────────────────────────────────────────────
-- Canonical line-item components comprising the total payable amount of a booking order.
CREATE TABLE IF NOT EXISTS public.order_payable_items (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID            NOT NULL REFERENCES public.booking_orders(id) ON DELETE RESTRICT,
  booking_id      UUID            REFERENCES public.bookings(id) ON DELETE RESTRICT,
  charge_type     TEXT            NOT NULL,
  description     TEXT            NOT NULL,
  amount          NUMERIC(12,2)   NOT NULL,
  currency        TEXT            NOT NULL DEFAULT 'PHP',
  sequence        INT             NOT NULL DEFAULT 1,
  source_type     TEXT,
  source_id       UUID,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
  created_by      UUID            REFERENCES public.staff(id) ON DELETE RESTRICT,

  -- Currency constraint
  CONSTRAINT order_payable_items_currency_check
    CHECK (currency = 'PHP'),

  -- Deterministic sequence
  CONSTRAINT order_payable_items_sequence_check
    CHECK (sequence >= 1),

  -- Approved CF1 charge taxonomy constraint
  -- Strictly EXCLUDES tip, tip_collected, voucher, customer_credit
  CONSTRAINT order_payable_items_charge_type_check
    CHECK (charge_type IN (
      'service',
      'home_service_fee',
      'retail_product',
      'surcharge',
      'discount',
      'manual_adjustment',
      'other_charge'
    )),

  -- Signed amount semantics:
  -- Positive charges increase payable; discounts decrease payable; adjustments non-zero; zero strictly rejected.
  CONSTRAINT order_payable_items_amount_sign_check
    CHECK (
      (charge_type IN ('service', 'home_service_fee', 'retail_product', 'surcharge', 'other_charge') AND amount > 0) OR
      (charge_type = 'discount' AND amount < 0) OR
      (charge_type = 'manual_adjustment' AND amount <> 0)
    ),

  -- Service line bookings must provide booking_id
  CONSTRAINT order_payable_items_service_booking_check
    CHECK (charge_type <> 'service' OR booking_id IS NOT NULL)
);

COMMENT ON TABLE public.order_payable_items IS
  'Canonical line-item components comprising the total payable amount of a customer booking order.';
COMMENT ON COLUMN public.order_payable_items.order_id IS
  'Parent booking order aggregate.';
COMMENT ON COLUMN public.order_payable_items.booking_id IS
  'Referenced appointment service line if charge_type = service. Must belong to the same booking order.';
COMMENT ON COLUMN public.order_payable_items.charge_type IS
  'Approved charge taxonomy: service, home_service_fee, retail_product, surcharge, discount, manual_adjustment, other_charge.';
COMMENT ON COLUMN public.order_payable_items.amount IS
  'Signed nominal amount in PHP. Positive for charges, negative for discounts. Zero is strictly prohibited.';


-- ─── 2. TRIGGER: CROSS-ORDER BOOKING INVARIANT ────────────────────────────────
-- Ensures that if booking_id is provided, the referenced booking belongs to the exact same order_id.
CREATE OR REPLACE FUNCTION public.fn_validate_order_payable_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_booking_order_id UUID;
BEGIN
  -- Service charge type requires booking_id
  IF NEW.charge_type = 'service' AND NEW.booking_id IS NULL THEN
    RAISE EXCEPTION 'SERVICE_PAYABLE_REQUIRES_BOOKING: charge_type service requires booking_id'
      USING ERRCODE = '22023';
  END IF;

  -- If booking_id is provided, verify it belongs to the same order_id
  IF NEW.booking_id IS NOT NULL THEN
    SELECT b.order_id
    INTO v_booking_order_id
    FROM public.bookings b
    WHERE b.id = NEW.booking_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'PAYABLE_BOOKING_NOT_FOUND: booking % not found', NEW.booking_id
        USING ERRCODE = '23503';
    END IF;

    IF v_booking_order_id IS DISTINCT FROM NEW.order_id THEN
      RAISE EXCEPTION 'CROSS_ORDER_BOOKING_MISMATCH: booking % belongs to order %, not %',
        NEW.booking_id, v_booking_order_id, NEW.order_id
        USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_order_payable_item ON public.order_payable_items;
CREATE TRIGGER trg_validate_order_payable_item
  BEFORE INSERT OR UPDATE ON public.order_payable_items
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_validate_order_payable_item();


-- ─── 3. TABLE: financial_order_allocations ────────────────────────────────────
-- Connects actual received financial movement value from CF2 ledger to booking orders and items.
-- Two-tier model:
--   Tier 1 (Order-level): payable_item_id IS NULL. Applies movement to the whole order.
--   Tier 2 (Item-level):  payable_item_id IS NOT NULL. Explicitly settles a specific payable item.
CREATE TABLE IF NOT EXISTS public.financial_order_allocations (
  id                            UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_account_movement_id UUID            NOT NULL REFERENCES public.financial_account_movements(id) ON DELETE RESTRICT,
  order_id                      UUID            NOT NULL REFERENCES public.booking_orders(id) ON DELETE RESTRICT,
  payable_item_id               UUID            REFERENCES public.order_payable_items(id) ON DELETE RESTRICT,
  amount                        NUMERIC(12,2)   NOT NULL,
  created_at                    TIMESTAMPTZ     NOT NULL DEFAULT now(),
  created_by                    UUID            REFERENCES public.staff(id) ON DELETE RESTRICT,

  -- Positive allocation invariant
  CONSTRAINT financial_order_allocations_amount_check
    CHECK (amount > 0)
);

COMMENT ON TABLE public.financial_order_allocations IS
  'Two-tier allocations connecting financial movement value to customer orders (order-level default or item-level split).';
COMMENT ON COLUMN public.financial_order_allocations.financial_account_movement_id IS
  'Source monetary movement from CF2 ledger.';
COMMENT ON COLUMN public.financial_order_allocations.payable_item_id IS
  'Target payable item for Tier 2 split payments. NULL for Tier 1 default order-level allocation.';
COMMENT ON COLUMN public.financial_order_allocations.amount IS
  'Satisfied payable value in PHP. Must be strictly positive (> 0).';


-- ─── 4. TRIGGER: ALLOCATION INVARIANTS & INTEGRITY ────────────────────────────
-- Enforces:
--   1. Movement exists and represents positive inflow (customer payment).
--   2. Order exists and matches movement account branch (if account is branch-scoped).
--   3. If payable_item_id is specified, it must belong to the exact same order_id.
--   4. Total allocations for a single movement cannot exceed the source movement amount.
CREATE OR REPLACE FUNCTION public.fn_validate_financial_order_allocation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_movement_amount     NUMERIC(12,2);
  v_movement_branch_id  UUID;
  v_total_allocated     NUMERIC(12,2);
  v_order_branch_id     UUID;
  v_item_order_id       UUID;
BEGIN
  -- 1. Validate movement exists and has positive amount (customer payment inflow)
  SELECT fam.amount, fa.branch_id
  INTO v_movement_amount, v_movement_branch_id
  FROM public.financial_account_movements fam
  JOIN public.financial_accounts fa ON fa.id = fam.financial_account_id
  WHERE fam.id = NEW.financial_account_movement_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ALLOCATION_INVALID_MOVEMENT: movement % not found', NEW.financial_account_movement_id
      USING ERRCODE = '23503';
  END IF;

  IF v_movement_amount <= 0 THEN
    RAISE EXCEPTION 'ALLOCATION_INVALID_MOVEMENT_AMOUNT: cannot allocate non-positive movement (amount: %)', v_movement_amount
      USING ERRCODE = '22023';
  END IF;

  -- 2. Validate order exists
  SELECT bo.branch_id
  INTO v_order_branch_id
  FROM public.booking_orders bo
  WHERE bo.id = NEW.order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ALLOCATION_INVALID_ORDER: order % not found', NEW.order_id
      USING ERRCODE = '23503';
  END IF;

  -- 3. If movement account is branch-scoped, ensure branch matches order branch
  IF v_movement_branch_id IS NOT NULL AND v_movement_branch_id <> v_order_branch_id THEN
    RAISE EXCEPTION 'ALLOCATION_BRANCH_MISMATCH: movement branch % does not match order branch %',
      v_movement_branch_id, v_order_branch_id
      USING ERRCODE = '22023';
  END IF;

  -- 4. If payable_item_id is specified, ensure it belongs to the same order_id
  IF NEW.payable_item_id IS NOT NULL THEN
    SELECT opi.order_id
    INTO v_item_order_id
    FROM public.order_payable_items opi
    WHERE opi.id = NEW.payable_item_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'ALLOCATION_INVALID_PAYABLE_ITEM: payable item % not found', NEW.payable_item_id
        USING ERRCODE = '23503';
    END IF;

    IF v_item_order_id <> NEW.order_id THEN
      RAISE EXCEPTION 'CROSS_ORDER_ITEM_MISMATCH: payable item % belongs to order %, not %',
        NEW.payable_item_id, v_item_order_id, NEW.order_id
        USING ERRCODE = '22023';
    END IF;
  END IF;

  -- 5. Validate that total allocations for this movement do not exceed movement.amount
  SELECT coalesce(SUM(amount), 0)
  INTO v_total_allocated
  FROM public.financial_order_allocations
  WHERE financial_account_movement_id = NEW.financial_account_movement_id
    AND id <> coalesce(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  IF (v_total_allocated + NEW.amount) > v_movement_amount THEN
    RAISE EXCEPTION 'ALLOCATION_EXCEEDS_MOVEMENT: total allocation % exceeds movement amount %',
      (v_total_allocated + NEW.amount), v_movement_amount
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_financial_order_allocation ON public.financial_order_allocations;
CREATE TRIGGER trg_validate_financial_order_allocation
  BEFORE INSERT OR UPDATE ON public.financial_order_allocations
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_validate_financial_order_allocation();


-- ─── 5. IMMUTABILITY SAFEGUARDS (APPEND-ONLY ALLOCATIONS) ─────────────────────
-- Prohibits destructive update or deletion of committed financial allocations.
CREATE OR REPLACE FUNCTION public.enforce_financial_allocation_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_setting('cradlehub.allow_financial_mutation', true) = 'true' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'FINANCIAL_ALLOCATION_IMMUTABILITY_VIOLATION: Committed financial order allocations are append-only. Destructive % is prohibited.', TG_OP
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_financial_order_allocations_immutability ON public.financial_order_allocations;
CREATE TRIGGER trg_protect_financial_order_allocations_immutability
  BEFORE UPDATE OR DELETE ON public.financial_order_allocations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_financial_allocation_immutability();


-- ─── 6. DERIVED PAYMENT STATE FUNCTION ────────────────────────────────────────
-- Implements CF1-D07 strictly derived payment state logic:
--   unpaid:                  net_allocated = 0 AND total_payable > 0
--   partial:                 0 < net_allocated < total_payable
--   paid:                    net_allocated = total_payable (including legitimate promotional total_payable = 0)
--   overpaid:                net_allocated > total_payable
--   invalid_negative_payable: total_payable < 0
CREATE OR REPLACE FUNCTION public.derive_order_payment_state(
  p_total_payable NUMERIC(12,2),
  p_net_allocated NUMERIC(12,2)
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_total_payable < 0 THEN
    RETURN 'invalid_negative_payable';
  END IF;

  IF p_net_allocated > p_total_payable THEN
    RETURN 'overpaid';
  ELSIF p_net_allocated = p_total_payable THEN
    RETURN 'paid';
  ELSIF p_net_allocated > 0 AND p_net_allocated < p_total_payable THEN
    RETURN 'partial';
  ELSE
    RETURN 'unpaid';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.derive_order_payment_state(NUMERIC, NUMERIC) IS
  'CF1-D07 derived order payment state: unpaid, partial, paid, overpaid, invalid_negative_payable.';


-- ─── 7. VIEW: v_booking_order_financial_summaries ─────────────────────────────
-- Read model aggregating total payable, net allocated, remaining balance, and derived payment state.
-- Defined WITH (security_invoker = true) so caller RLS on booking_orders is strictly enforced.
CREATE OR REPLACE VIEW public.v_booking_order_financial_summaries
WITH (security_invoker = true)
AS
WITH payables AS (
  SELECT
    order_id,
    coalesce(SUM(amount), 0)::NUMERIC(12,2) AS total_payable,
    count(*)::INT AS payable_item_count
  FROM public.order_payable_items
  GROUP BY order_id
),
allocations AS (
  SELECT
    order_id,
    coalesce(SUM(amount), 0)::NUMERIC(12,2) AS net_allocated,
    count(*)::INT AS allocation_count
  FROM public.financial_order_allocations
  GROUP BY order_id
)
SELECT
  bo.id AS order_id,
  bo.branch_id,
  bo.currency,
  coalesce(p.total_payable, 0.00)::NUMERIC(12,2) AS total_payable,
  coalesce(a.net_allocated, 0.00)::NUMERIC(12,2) AS net_allocated,
  (coalesce(p.total_payable, 0.00) - coalesce(a.net_allocated, 0.00))::NUMERIC(12,2) AS remaining_balance,
  public.derive_order_payment_state(
    coalesce(p.total_payable, 0.00),
    coalesce(a.net_allocated, 0.00)
  ) AS payment_state,
  coalesce(p.payable_item_count, 0)::INT AS payable_item_count,
  coalesce(a.allocation_count, 0)::INT AS allocation_count
FROM public.booking_orders bo
LEFT JOIN payables p ON p.order_id = bo.id
LEFT JOIN allocations a ON a.order_id = bo.id;

COMMENT ON VIEW public.v_booking_order_financial_summaries IS
  'Security-invoker derived financial view computing order payable, allocated, remaining balance, and payment state.';


-- ─── 8. PERFORMANCE & INTEGRITY INDEXES ───────────────────────────────────────
-- Indexes on order_payable_items
CREATE INDEX IF NOT EXISTS idx_order_payable_items_order_id
  ON public.order_payable_items (order_id);

CREATE INDEX IF NOT EXISTS idx_order_payable_items_booking_id
  ON public.order_payable_items (booking_id)
  WHERE booking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_order_payable_items_charge_type
  ON public.order_payable_items (charge_type);

CREATE INDEX IF NOT EXISTS idx_order_payable_items_order_seq
  ON public.order_payable_items (order_id, sequence);

-- Indexes on financial_order_allocations
CREATE INDEX IF NOT EXISTS idx_financial_allocations_order_id
  ON public.financial_order_allocations (order_id);

CREATE INDEX IF NOT EXISTS idx_financial_allocations_movement_id
  ON public.financial_order_allocations (financial_account_movement_id);

CREATE INDEX IF NOT EXISTS idx_financial_allocations_payable_item_id
  ON public.financial_order_allocations (payable_item_id)
  WHERE payable_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_financial_allocations_created_at
  ON public.financial_order_allocations (created_at DESC);


-- ─── 9. ROW LEVEL SECURITY (RLS) POLICIES ─────────────────────────────────────
ALTER TABLE public.order_payable_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_order_allocations ENABLE ROW LEVEL SECURITY;

-- ─── A. order_payable_items Policies ───
-- Owner & Finance: Full cross-branch read access
DROP POLICY IF EXISTS "order_payable_items_owner_read_all" ON public.order_payable_items;
CREATE POLICY "order_payable_items_owner_read_all"
  ON public.order_payable_items FOR SELECT
  TO authenticated
  USING (public.get_auth_role() IN ('owner', 'finance'));

-- Branch Staff & Management: Read payables for orders belonging to own branch
DROP POLICY IF EXISTS "order_payable_items_branch_read" ON public.order_payable_items;
CREATE POLICY "order_payable_items_branch_read"
  ON public.order_payable_items FOR SELECT
  TO authenticated
  USING (
    public.get_auth_role() IN ('manager', 'assistant_manager', 'store_manager', 'crm', 'csr', 'csr_head', 'csr_staff')
    AND EXISTS (
      SELECT 1 FROM public.booking_orders bo
      WHERE bo.id = order_payable_items.order_id
        AND bo.branch_id = public.get_auth_branch_id()
    )
  );

-- Service Role: Full access for backend operations
DROP POLICY IF EXISTS "order_payable_items_service_role_all" ON public.order_payable_items;
CREATE POLICY "order_payable_items_service_role_all"
  ON public.order_payable_items FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ─── B. financial_order_allocations Policies ───
-- Owner & Finance: Full cross-branch read access
DROP POLICY IF EXISTS "financial_allocations_owner_read_all" ON public.financial_order_allocations;
CREATE POLICY "financial_allocations_owner_read_all"
  ON public.financial_order_allocations FOR SELECT
  TO authenticated
  USING (public.get_auth_role() IN ('owner', 'finance'));

-- Branch Staff & Management: Read allocations for orders belonging to own branch
DROP POLICY IF EXISTS "financial_allocations_branch_read" ON public.financial_order_allocations;
CREATE POLICY "financial_allocations_branch_read"
  ON public.financial_order_allocations FOR SELECT
  TO authenticated
  USING (
    public.get_auth_role() IN ('manager', 'assistant_manager', 'store_manager', 'crm', 'csr', 'csr_head', 'csr_staff')
    AND EXISTS (
      SELECT 1 FROM public.booking_orders bo
      WHERE bo.id = financial_order_allocations.order_id
        AND bo.branch_id = public.get_auth_branch_id()
    )
  );

-- Service Role: Full access for backend operations
DROP POLICY IF EXISTS "financial_allocations_service_role_all" ON public.financial_order_allocations;
CREATE POLICY "financial_allocations_service_role_all"
  ON public.financial_order_allocations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ─── 10. EXPLICIT GRANTS & REVOKES ───────────────────────────────────────────
-- Fail-closed privilege model:
--   anon: Zero access
--   authenticated: SELECT only (direct writes blocked by lack of INSERT/UPDATE/DELETE grants and RLS)
--   service_role: ALL
REVOKE ALL ON TABLE public.order_payable_items FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.order_payable_items TO authenticated;
GRANT ALL ON TABLE public.order_payable_items TO service_role;

REVOKE ALL ON TABLE public.financial_order_allocations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.financial_order_allocations TO authenticated;
GRANT ALL ON TABLE public.financial_order_allocations TO service_role;

REVOKE ALL ON TABLE public.v_booking_order_financial_summaries FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.v_booking_order_financial_summaries TO authenticated, service_role;

COMMIT;
