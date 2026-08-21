-- =============================================================================
-- CradleHub — Migration: Misc RLS Security Tightening
-- =============================================================================
-- D1: Four internal tables have policies bound to the `public` PostgreSQL role
--     instead of `authenticated`. `public` includes anonymous (`anon`) users,
--     so these policies could theoretically be evaluated for unauthenticated
--     Supabase API calls. Tighten to `authenticated` only.
--
--     Affected tables / policies:
--       schedule_health_checks  — managers_branch_health_read/write, owners_*
--       schedule_suggestions    — managers_branch_suggestions, owners_all_suggestions,
--                                 staff_own_suggestions_read
--       scheduling_rules        — managers_own_branch_scheduling_rules,
--                                 owners_all_scheduling_rules
--       staff_scheduling_preferences — managers_branch_staff_preferences,
--                                      owners_all_staff_preferences,
--                                      staff_own_preferences
--
-- D2: Add csr_staff booking_events read (branch-scoped).
--     csr_staff currently cannot see the booking audit log even for their branch.
--
-- D3: Add crm/csr_head/csr_staff read on staff_onboarding_requests.
--     The CRM Staff Applications page currently bypasses RLS via admin client.
--     Adding a proper read policy lets the page use the standard user client
--     if it is ever migrated away from the admin-client bypass.
--
-- D4: booking_payment_logs — intentionally left broad (any authenticated
--     INSERT/SELECT). This is an audit table; broad authenticated access is
--     the current business decision. A tighter policy can be added when the
--     business defines clear access rules for financial audit data.
-- =============================================================================

-- ─── D1: Tighten public → authenticated ─────────────────────────────────────

ALTER POLICY "managers_branch_health_read"  ON public.schedule_health_checks    TO authenticated;
ALTER POLICY "managers_branch_health_write" ON public.schedule_health_checks    TO authenticated;
ALTER POLICY "owners_all_health_read"       ON public.schedule_health_checks    TO authenticated;
ALTER POLICY "owners_health_write"          ON public.schedule_health_checks    TO authenticated;

ALTER POLICY "managers_branch_suggestions"  ON public.schedule_suggestions      TO authenticated;
ALTER POLICY "owners_all_suggestions"       ON public.schedule_suggestions      TO authenticated;
ALTER POLICY "staff_own_suggestions_read"   ON public.schedule_suggestions      TO authenticated;

ALTER POLICY "managers_own_branch_scheduling_rules" ON public.scheduling_rules  TO authenticated;
ALTER POLICY "owners_all_scheduling_rules"           ON public.scheduling_rules  TO authenticated;

ALTER POLICY "managers_branch_staff_preferences" ON public.staff_scheduling_preferences TO authenticated;
ALTER POLICY "owners_all_staff_preferences"      ON public.staff_scheduling_preferences TO authenticated;
ALTER POLICY "staff_own_preferences"             ON public.staff_scheduling_preferences TO authenticated;

-- ─── D2: csr_staff booking_events branch read ───────────────────────────────
DO $$
BEGIN
  CREATE POLICY "booking_events_csr_read_branch"
    ON public.booking_events
    FOR SELECT
    TO authenticated
    USING (
      public.get_auth_role() = ANY (ARRAY['csr', 'csr_head', 'csr_staff'])
      AND booking_id IN (
        SELECT id
        FROM public.bookings
        WHERE branch_id = public.get_auth_branch_id()
      )
    );
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Policy booking_events_csr_read_branch already exists, skipping.';
END $$;

-- ─── D3: CRM branch read for staff onboarding applications ──────────────────
-- The CRM Staff Applications page currently works via admin-client bypass.
-- This policy adds a formal RLS path so the page can optionally use the user
-- client. Does NOT grant write — approve/reject still goes through the action
-- that uses the admin client with its own role check.
DO $$
BEGIN
  CREATE POLICY "onboarding_crm_branch_read"
    ON public.staff_onboarding_requests
    FOR SELECT
    TO authenticated
    USING (
      public.get_auth_role() = ANY (ARRAY['crm', 'csr_head', 'csr_staff'])
      AND requested_branch_id = public.get_auth_branch_id()
    );
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Policy onboarding_crm_branch_read already exists, skipping.';
END $$;
