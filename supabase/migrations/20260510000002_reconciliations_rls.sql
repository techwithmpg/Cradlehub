-- =============================================================================
-- CradleHub — Reconciliation RLS
-- =============================================================================
-- daily_cash_reconciliations was created without RLS. This migration enables
-- it and adds branch-scoped policies for all relevant roles.
-- =============================================================================

ALTER TABLE public.daily_cash_reconciliations ENABLE ROW LEVEL SECURITY;

-- ─── Owner: full CRUD ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "reconciliations_owner_all" ON public.daily_cash_reconciliations;
CREATE POLICY "reconciliations_owner_all"
  ON public.daily_cash_reconciliations FOR ALL
  TO authenticated
  USING     (get_auth_role() = 'owner')
  WITH CHECK (get_auth_role() = 'owner');

-- ─── Manager / CRM / CSR roles: branch-scoped SELECT ────────────────────────

DROP POLICY IF EXISTS "reconciliations_desk_read" ON public.daily_cash_reconciliations;
CREATE POLICY "reconciliations_desk_read"
  ON public.daily_cash_reconciliations FOR SELECT
  TO authenticated
  USING (
    get_auth_role() IN ('manager', 'crm', 'csr', 'csr_head', 'csr_staff')
    AND branch_id = get_auth_branch_id()
  );

-- ─── Manager / CRM / CSR roles: branch-scoped INSERT ────────────────────────

DROP POLICY IF EXISTS "reconciliations_desk_insert" ON public.daily_cash_reconciliations;
CREATE POLICY "reconciliations_desk_insert"
  ON public.daily_cash_reconciliations FOR INSERT
  TO authenticated
  WITH CHECK (
    get_auth_role() IN ('manager', 'crm', 'csr', 'csr_head', 'csr_staff')
    AND branch_id = get_auth_branch_id()
  );

-- ─── Manager / CRM / CSR roles: branch-scoped UPDATE ────────────────────────

DROP POLICY IF EXISTS "reconciliations_desk_update" ON public.daily_cash_reconciliations;
CREATE POLICY "reconciliations_desk_update"
  ON public.daily_cash_reconciliations FOR UPDATE
  TO authenticated
  USING (
    get_auth_role() IN ('manager', 'crm', 'csr', 'csr_head', 'csr_staff')
    AND branch_id = get_auth_branch_id()
  )
  WITH CHECK (
    get_auth_role() IN ('manager', 'crm', 'csr', 'csr_head', 'csr_staff')
    AND branch_id = get_auth_branch_id()
  );

-- ─── Supplementary index on status ───────────────────────────────────────────
-- idx_reconciliations_branch_date already exists from the base migration.
-- Add a status partial index for filtering pending/submitted records.

CREATE INDEX IF NOT EXISTS idx_reconciliations_status
  ON public.daily_cash_reconciliations (branch_id, status)
  WHERE status IN ('draft', 'submitted');
