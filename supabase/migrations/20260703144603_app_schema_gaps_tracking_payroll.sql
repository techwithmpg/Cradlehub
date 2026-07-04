-- =============================================================================
-- CradleHub — App schema gaps for tracking links and payroll snapshots
-- =============================================================================
-- Adds database objects referenced by the current app but missing from the live
-- schema after migration-history drift:
--   1. customer_tracking_links for public token-gated home-service tracking
--   2. staff_pay_profiles and payroll snapshot tables for Owner Payroll
--
-- All DDL is additive/idempotent and keeps sensitive tables off anon.
-- =============================================================================

-- ── Customer tracking links ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.customer_tracking_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  access_count INTEGER NOT NULL DEFAULT 0 CHECK (access_count >= 0),
  last_accessed_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.customer_tracking_links IS
  'Token-gated links for customer-safe home-service tracking pages.';
COMMENT ON COLUMN public.customer_tracking_links.token IS
  'Opaque public token. Treat as bearer authorization for the public tracking page.';

CREATE INDEX IF NOT EXISTS customer_tracking_links_booking_idx
  ON public.customer_tracking_links(booking_id, is_active, expires_at DESC);

CREATE INDEX IF NOT EXISTS customer_tracking_links_branch_created_idx
  ON public.customer_tracking_links(branch_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_customer_tracking_links_updated_at
  ON public.customer_tracking_links;
CREATE TRIGGER trg_customer_tracking_links_updated_at
  BEFORE UPDATE ON public.customer_tracking_links
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at();

ALTER TABLE public.customer_tracking_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_tracking_links_owner_all"
  ON public.customer_tracking_links;
CREATE POLICY "customer_tracking_links_owner_all"
  ON public.customer_tracking_links FOR ALL
  TO authenticated
  USING ((SELECT public.get_auth_role()) = 'owner')
  WITH CHECK ((SELECT public.get_auth_role()) = 'owner');

DROP POLICY IF EXISTS "customer_tracking_links_branch_staff_manage"
  ON public.customer_tracking_links;
CREATE POLICY "customer_tracking_links_branch_staff_manage"
  ON public.customer_tracking_links FOR ALL
  TO authenticated
  USING (
    (SELECT public.get_auth_role()) IN (
      'manager',
      'assistant_manager',
      'store_manager',
      'crm',
      'csr',
      'csr_head',
      'csr_staff'
    )
    AND branch_id = (SELECT public.get_auth_branch_id())
  )
  WITH CHECK (
    (SELECT public.get_auth_role()) IN (
      'manager',
      'assistant_manager',
      'store_manager',
      'crm',
      'csr',
      'csr_head',
      'csr_staff'
    )
    AND branch_id = (SELECT public.get_auth_branch_id())
  );

REVOKE ALL ON TABLE public.customer_tracking_links FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_tracking_links
  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_tracking_links
  TO service_role;

-- ── Staff pay profiles ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.staff_pay_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  base_pay_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (base_pay_amount >= 0),
  base_pay_type TEXT NOT NULL DEFAULT 'none'
    CHECK (base_pay_type IN ('none', 'daily', 'weekly', 'monthly')),
  commission_percent NUMERIC(5,2) NOT NULL DEFAULT 0
    CHECK (commission_percent >= 0 AND commission_percent <= 100),
  per_service_bonus NUMERIC(12,2) NOT NULL DEFAULT 0
    CHECK (per_service_bonus >= 0),
  home_service_allowance NUMERIC(12,2) NOT NULL DEFAULT 0
    CHECK (home_service_allowance >= 0),
  transport_allowance NUMERIC(12,2) NOT NULL DEFAULT 0
    CHECK (transport_allowance >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT staff_pay_profiles_effective_range_check
    CHECK (effective_until IS NULL OR effective_until >= effective_from)
);

CREATE INDEX IF NOT EXISTS staff_pay_profiles_staff_active_idx
  ON public.staff_pay_profiles(staff_id, is_active, effective_from DESC);

CREATE INDEX IF NOT EXISTS staff_pay_profiles_branch_idx
  ON public.staff_pay_profiles(branch_id);

DROP TRIGGER IF EXISTS trg_staff_pay_profiles_updated_at
  ON public.staff_pay_profiles;
CREATE TRIGGER trg_staff_pay_profiles_updated_at
  BEFORE UPDATE ON public.staff_pay_profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at();

ALTER TABLE public.staff_pay_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_pay_profiles_owner_all"
  ON public.staff_pay_profiles;
CREATE POLICY "staff_pay_profiles_owner_all"
  ON public.staff_pay_profiles FOR ALL
  TO authenticated
  USING ((SELECT public.get_auth_role()) = 'owner')
  WITH CHECK ((SELECT public.get_auth_role()) = 'owner');

REVOKE ALL ON TABLE public.staff_pay_profiles FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.staff_pay_profiles
  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.staff_pay_profiles
  TO service_role;

-- ── Payroll periods ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payroll_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'locked', 'approved', 'paid', 'cancelled')),
  created_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT payroll_periods_date_range_check CHECK (period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS payroll_periods_period_idx
  ON public.payroll_periods(period_start DESC, period_end DESC);

CREATE INDEX IF NOT EXISTS payroll_periods_branch_idx
  ON public.payroll_periods(branch_id);

DROP TRIGGER IF EXISTS trg_payroll_periods_updated_at
  ON public.payroll_periods;
CREATE TRIGGER trg_payroll_periods_updated_at
  BEFORE UPDATE ON public.payroll_periods
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at();

ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payroll_periods_owner_all"
  ON public.payroll_periods;
CREATE POLICY "payroll_periods_owner_all"
  ON public.payroll_periods FOR ALL
  TO authenticated
  USING ((SELECT public.get_auth_role()) = 'owner')
  WITH CHECK ((SELECT public.get_auth_role()) = 'owner');

REVOKE ALL ON TABLE public.payroll_periods FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payroll_periods
  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payroll_periods
  TO service_role;

-- ── Payroll items ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payroll_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_period_id UUID NOT NULL REFERENCES public.payroll_periods(id)
    ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  completed_bookings_count INTEGER NOT NULL DEFAULT 0
    CHECK (completed_bookings_count >= 0),
  home_service_bookings_count INTEGER NOT NULL DEFAULT 0
    CHECK (home_service_bookings_count >= 0),
  gross_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  base_pay NUMERIC(12,2) NOT NULL DEFAULT 0,
  commission_pay NUMERIC(12,2) NOT NULL DEFAULT 0,
  bonus_pay NUMERIC(12,2) NOT NULL DEFAULT 0,
  reimbursement_pay NUMERIC(12,2) NOT NULL DEFAULT 0,
  home_service_allowance_pay NUMERIC(12,2) NOT NULL DEFAULT 0,
  deduction_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  salary_advance_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_pay NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'paid', 'voided')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS payroll_items_period_staff_idx
  ON public.payroll_items(payroll_period_id, staff_id);

CREATE INDEX IF NOT EXISTS payroll_items_staff_idx
  ON public.payroll_items(staff_id);

CREATE INDEX IF NOT EXISTS payroll_items_branch_idx
  ON public.payroll_items(branch_id);

DROP TRIGGER IF EXISTS trg_payroll_items_updated_at
  ON public.payroll_items;
CREATE TRIGGER trg_payroll_items_updated_at
  BEFORE UPDATE ON public.payroll_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at();

ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payroll_items_owner_all"
  ON public.payroll_items;
CREATE POLICY "payroll_items_owner_all"
  ON public.payroll_items FOR ALL
  TO authenticated
  USING ((SELECT public.get_auth_role()) = 'owner')
  WITH CHECK ((SELECT public.get_auth_role()) = 'owner');

REVOKE ALL ON TABLE public.payroll_items FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payroll_items
  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payroll_items
  TO service_role;

-- ── Payroll adjustments ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payroll_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_item_id UUID NOT NULL REFERENCES public.payroll_items(id)
    ON DELETE CASCADE,
  adjustment_type TEXT NOT NULL
    CHECK (
      adjustment_type IN (
        'bonus',
        'deduction',
        'reimbursement',
        'salary_advance',
        'correction'
      )
    ),
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  reason TEXT NOT NULL,
  created_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payroll_adjustments_item_idx
  ON public.payroll_adjustments(payroll_item_id, created_at DESC);

ALTER TABLE public.payroll_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payroll_adjustments_owner_all"
  ON public.payroll_adjustments;
CREATE POLICY "payroll_adjustments_owner_all"
  ON public.payroll_adjustments FOR ALL
  TO authenticated
  USING ((SELECT public.get_auth_role()) = 'owner')
  WITH CHECK ((SELECT public.get_auth_role()) = 'owner');

REVOKE ALL ON TABLE public.payroll_adjustments FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payroll_adjustments
  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payroll_adjustments
  TO service_role;

COMMENT ON TABLE public.staff_pay_profiles IS
  'Owner-managed compensation profiles used to generate payroll item snapshots.';
COMMENT ON TABLE public.payroll_periods IS
  'Owner payroll periods for monthly payroll workflow snapshots.';
COMMENT ON TABLE public.payroll_items IS
  'Generated payroll rows per staff member and payroll period.';
COMMENT ON TABLE public.payroll_adjustments IS
  'Manual payroll item adjustments with reason/audit staff reference.';
