-- =============================================================================
-- CradleHub — Workspace Notifications
-- =============================================================================
-- Central notification table for all workspaces.
-- All inserts go through the service-role admin client (server-side only).
-- Reads/updates are enforced by RLS per workspace/branch/recipient.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.workspace_notifications (
  id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id           uuid         REFERENCES public.branches(id)  ON DELETE CASCADE,
  target_workspace    text         NOT NULL,
  target_role         text,
  recipient_staff_id  uuid         REFERENCES public.staff(id)     ON DELETE CASCADE,
  actor_staff_id      uuid         REFERENCES public.staff(id)     ON DELETE SET NULL,
  type                text         NOT NULL,
  title               text         NOT NULL,
  body                text,
  entity_type         text,
  entity_id           uuid,
  action_href         text         CHECK (
    action_href IS NULL
    OR action_href ~ '^/(owner|manager|crm|staff-portal|driver|utility)(/|$)'
  ),
  priority            text         NOT NULL DEFAULT 'normal',
  status              text         NOT NULL DEFAULT 'unread',
  requires_action     boolean      NOT NULL DEFAULT false,
  metadata            jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz  NOT NULL DEFAULT now(),
  read_at             timestamptz,
  resolved_at         timestamptz,

  CONSTRAINT workspace_notifications_target_workspace_check
    CHECK (target_workspace IN ('owner','manager','crm','staff','driver','utility')),
  CONSTRAINT workspace_notifications_priority_check
    CHECK (priority IN ('low','normal','high','critical')),
  CONSTRAINT workspace_notifications_status_check
    CHECK (status IN ('unread','read','resolved','dismissed'))
);

COMMENT ON TABLE public.workspace_notifications IS
  'Workspace-scoped notifications. All inserts via service-role admin client. RLS enforces read/update per workspace, branch, and recipient.';

-- ── Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS workspace_notifications_workspace_branch_status_idx
  ON public.workspace_notifications (target_workspace, branch_id, status);

CREATE INDEX IF NOT EXISTS workspace_notifications_recipient_status_idx
  ON public.workspace_notifications (recipient_staff_id, status)
  WHERE recipient_staff_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS workspace_notifications_type_created_idx
  ON public.workspace_notifications (type, created_at DESC);

CREATE INDEX IF NOT EXISTS workspace_notifications_action_status_idx
  ON public.workspace_notifications (requires_action, status)
  WHERE requires_action = true;

CREATE INDEX IF NOT EXISTS workspace_notifications_entity_idx
  ON public.workspace_notifications (entity_type, entity_id)
  WHERE entity_type IS NOT NULL;

-- ── Row Level Security ────────────────────────────────────────────────────

ALTER TABLE public.workspace_notifications ENABLE ROW LEVEL SECURITY;

-- Owner: full read/update on all notifications. Inserts still go through
-- service-role server helpers; deletes are intentionally not exposed.
DROP POLICY IF EXISTS "notif_owner_all" ON public.workspace_notifications;
DROP POLICY IF EXISTS "notif_owner_read" ON public.workspace_notifications;
CREATE POLICY "notif_owner_read"
  ON public.workspace_notifications FOR SELECT
  TO authenticated
  USING (get_auth_role() = 'owner');

DROP POLICY IF EXISTS "notif_owner_update" ON public.workspace_notifications;
CREATE POLICY "notif_owner_update"
  ON public.workspace_notifications FOR UPDATE
  TO authenticated
  USING (get_auth_role() = 'owner')
  WITH CHECK (get_auth_role() = 'owner');

-- Manager: own-branch manager notifications only
DROP POLICY IF EXISTS "notif_manager_branch" ON public.workspace_notifications;
CREATE POLICY "notif_manager_branch"
  ON public.workspace_notifications FOR SELECT
  TO authenticated
  USING (
    get_auth_role() = 'manager'
    AND target_workspace = 'manager'
    AND branch_id = get_auth_branch_id()
  );

DROP POLICY IF EXISTS "notif_manager_branch_update" ON public.workspace_notifications;
CREATE POLICY "notif_manager_branch_update"
  ON public.workspace_notifications FOR UPDATE
  TO authenticated
  USING (
    get_auth_role() = 'manager'
    AND target_workspace = 'manager'
    AND branch_id = get_auth_branch_id()
  )
  WITH CHECK (
    get_auth_role() = 'manager'
    AND target_workspace = 'manager'
    AND branch_id = get_auth_branch_id()
  );

-- CRM / CSR roles: own-branch crm notifications only
DROP POLICY IF EXISTS "notif_crm_branch" ON public.workspace_notifications;
CREATE POLICY "notif_crm_branch"
  ON public.workspace_notifications FOR SELECT
  TO authenticated
  USING (
    get_auth_role() IN ('crm','csr','csr_head','csr_staff')
    AND target_workspace = 'crm'
    AND branch_id = get_auth_branch_id()
  );

DROP POLICY IF EXISTS "notif_crm_branch_update" ON public.workspace_notifications;
CREATE POLICY "notif_crm_branch_update"
  ON public.workspace_notifications FOR UPDATE
  TO authenticated
  USING (
    get_auth_role() IN ('crm','csr','csr_head','csr_staff')
    AND target_workspace = 'crm'
    AND branch_id = get_auth_branch_id()
  )
  WITH CHECK (
    get_auth_role() IN ('crm','csr','csr_head','csr_staff')
    AND target_workspace = 'crm'
    AND branch_id = get_auth_branch_id()
  );

-- Service staff: only their own recipient notifications
DROP POLICY IF EXISTS "notif_staff_own" ON public.workspace_notifications;
CREATE POLICY "notif_staff_own"
  ON public.workspace_notifications FOR SELECT
  TO authenticated
  USING (
    get_auth_role() = 'staff'
    AND target_workspace = 'staff'
    AND recipient_staff_id = get_auth_staff_id()
  );

DROP POLICY IF EXISTS "notif_staff_own_update" ON public.workspace_notifications;
CREATE POLICY "notif_staff_own_update"
  ON public.workspace_notifications FOR UPDATE
  TO authenticated
  USING (
    get_auth_role() = 'staff'
    AND target_workspace = 'staff'
    AND recipient_staff_id = get_auth_staff_id()
  )
  WITH CHECK (
    get_auth_role() = 'staff'
    AND target_workspace = 'staff'
    AND recipient_staff_id = get_auth_staff_id()
  );

-- Driver/utility workspaces, if those roles are enabled later, are still
-- recipient-scoped and cannot see branch/manager/CRM notifications.
DROP POLICY IF EXISTS "notif_driver_utility_own" ON public.workspace_notifications;
CREATE POLICY "notif_driver_utility_own"
  ON public.workspace_notifications FOR SELECT
  TO authenticated
  USING (
    get_auth_role() IN ('driver','utility')
    AND target_workspace = get_auth_role()
    AND recipient_staff_id = get_auth_staff_id()
  );

DROP POLICY IF EXISTS "notif_driver_utility_own_update" ON public.workspace_notifications;
CREATE POLICY "notif_driver_utility_own_update"
  ON public.workspace_notifications FOR UPDATE
  TO authenticated
  USING (
    get_auth_role() IN ('driver','utility')
    AND target_workspace = get_auth_role()
    AND recipient_staff_id = get_auth_staff_id()
  )
  WITH CHECK (
    get_auth_role() IN ('driver','utility')
    AND target_workspace = get_auth_role()
    AND recipient_staff_id = get_auth_staff_id()
  );

-- No INSERT for any authenticated role — only admin/service-role may insert.
-- No DELETE allowed for any role — notifications are append-only from the DB perspective.
-- Soft-delete is handled via status = 'dismissed' or 'resolved'.
