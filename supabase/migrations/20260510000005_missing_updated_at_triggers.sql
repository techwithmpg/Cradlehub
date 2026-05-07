-- =============================================================================
-- CradleHub — Missing updated_at Triggers
-- =============================================================================
-- Three tables were created with an updated_at column but no trigger to
-- auto-advance it on UPDATE: daily_cash_reconciliations, waitlist_requests,
-- and departments.
--
-- fn_update_updated_at() already exists (defined in 20260429000004_triggers.sql
-- and re-declared idempotently in several later migrations). We reuse it here.
-- =============================================================================

-- ─── daily_cash_reconciliations ──────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_daily_cash_reconciliations_updated_at
  ON public.daily_cash_reconciliations;
CREATE TRIGGER trg_daily_cash_reconciliations_updated_at
  BEFORE UPDATE ON public.daily_cash_reconciliations
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at();

-- ─── waitlist_requests ───────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_waitlist_requests_updated_at
  ON public.waitlist_requests;
CREATE TRIGGER trg_waitlist_requests_updated_at
  BEFORE UPDATE ON public.waitlist_requests
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at();

-- ─── departments ─────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_departments_updated_at
  ON public.departments;
CREATE TRIGGER trg_departments_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at();
