-- =============================================================================
-- CradleHub — Waitlist RLS
-- =============================================================================
-- waitlist_requests was created without RLS. This migration enables it and
-- adds branch-scoped policies.
--
-- NOTE: Public waitlist creation remains through /api/public/waitlist which
-- uses the service-role (admin) client — no anon INSERT policy is needed.
-- =============================================================================

ALTER TABLE public.waitlist_requests ENABLE ROW LEVEL SECURITY;

-- ─── Owner: full CRUD ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "waitlist_owner_all" ON public.waitlist_requests;
CREATE POLICY "waitlist_owner_all"
  ON public.waitlist_requests FOR ALL
  TO authenticated
  USING     (get_auth_role() = 'owner')
  WITH CHECK (get_auth_role() = 'owner');

-- ─── Manager / CRM / CSR roles: branch-scoped SELECT ────────────────────────

DROP POLICY IF EXISTS "waitlist_desk_read" ON public.waitlist_requests;
CREATE POLICY "waitlist_desk_read"
  ON public.waitlist_requests FOR SELECT
  TO authenticated
  USING (
    get_auth_role() IN ('manager', 'crm', 'csr', 'csr_head', 'csr_staff')
    AND branch_id = get_auth_branch_id()
  );

-- ─── Manager / CRM / CSR roles: branch-scoped INSERT ────────────────────────
-- Allows dashboard users to add waitlist entries on behalf of walk-in clients.

DROP POLICY IF EXISTS "waitlist_desk_insert" ON public.waitlist_requests;
CREATE POLICY "waitlist_desk_insert"
  ON public.waitlist_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    get_auth_role() IN ('manager', 'crm', 'csr', 'csr_head', 'csr_staff')
    AND branch_id = get_auth_branch_id()
  );

-- ─── Manager / CRM / CSR roles: branch-scoped UPDATE ────────────────────────
-- Allows status workflow: waiting → contacted → converted / expired / cancelled.

DROP POLICY IF EXISTS "waitlist_desk_update" ON public.waitlist_requests;
CREATE POLICY "waitlist_desk_update"
  ON public.waitlist_requests FOR UPDATE
  TO authenticated
  USING (
    get_auth_role() IN ('manager', 'crm', 'csr', 'csr_head', 'csr_staff')
    AND branch_id = get_auth_branch_id()
  )
  WITH CHECK (
    get_auth_role() IN ('manager', 'crm', 'csr', 'csr_head', 'csr_staff')
    AND branch_id = get_auth_branch_id()
  );

-- ─── Supplementary indexes ────────────────────────────────────────────────────
-- idx_waitlist_branch_status already covers (branch_id, status, preferred_date).
-- Add a created_at index for ordering the queue chronologically.

CREATE INDEX IF NOT EXISTS idx_waitlist_created_at
  ON public.waitlist_requests (branch_id, created_at DESC);
