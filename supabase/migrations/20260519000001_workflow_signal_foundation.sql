-- =============================================================================
-- CradleHub -- Premium Workflow Signal Foundation
-- =============================================================================
-- Adds dedupe support to workspace_notifications and introduces workflow_tasks
-- as the action-required layer. Notifications remain useful updates; workflow
-- tasks represent work someone must act on.
-- =============================================================================

ALTER TABLE public.workspace_notifications
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS workspace_notifications_open_dedupe_key_uidx
  ON public.workspace_notifications (dedupe_key)
  WHERE dedupe_key IS NOT NULL
    AND status IN ('unread', 'read');

CREATE TABLE IF NOT EXISTS public.workflow_tasks (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id             UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  workspace_scope       TEXT NOT NULL,
  assigned_to_staff_id  UUID REFERENCES public.staff(id) ON DELETE CASCADE,
  assigned_to_role      TEXT,
  task_type             TEXT NOT NULL,
  title                 TEXT NOT NULL,
  body                  TEXT,
  entity_type           TEXT NOT NULL,
  entity_id             UUID NOT NULL,
  action_href           TEXT CHECK (
    action_href IS NULL
    OR action_href ~ '^/(owner|manager|crm|staff-portal|driver|utility)(/|$)'
  ),
  priority              TEXT NOT NULL DEFAULT 'normal',
  status                TEXT NOT NULL DEFAULT 'open',
  due_at                TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  completed_by_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  dedupe_key            TEXT NOT NULL,
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT workflow_tasks_workspace_scope_check
    CHECK (workspace_scope IN ('owner','manager','crm','staff','driver','utility')),
  CONSTRAINT workflow_tasks_priority_check
    CHECK (priority IN ('low','normal','high','critical')),
  CONSTRAINT workflow_tasks_status_check
    CHECK (status IN ('open','in_progress','completed','cancelled'))
);

COMMENT ON TABLE public.workflow_tasks IS
  'Role-aware action-required work items. One open task per dedupe key.';

CREATE UNIQUE INDEX IF NOT EXISTS workflow_tasks_open_dedupe_key_uidx
  ON public.workflow_tasks (dedupe_key)
  WHERE status IN ('open', 'in_progress');

CREATE INDEX IF NOT EXISTS workflow_tasks_workspace_branch_status_idx
  ON public.workflow_tasks (workspace_scope, branch_id, status);

CREATE INDEX IF NOT EXISTS workflow_tasks_assigned_staff_status_idx
  ON public.workflow_tasks (assigned_to_staff_id, status)
  WHERE assigned_to_staff_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS workflow_tasks_entity_idx
  ON public.workflow_tasks (entity_type, entity_id);

CREATE TRIGGER workflow_tasks_updated_at
  BEFORE UPDATE ON public.workflow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_update_updated_at();

ALTER TABLE public.workflow_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workflow_owner_read" ON public.workflow_tasks;
CREATE POLICY "workflow_owner_read"
  ON public.workflow_tasks FOR SELECT
  TO authenticated
  USING (get_auth_role() = 'owner');

DROP POLICY IF EXISTS "workflow_owner_update" ON public.workflow_tasks;
CREATE POLICY "workflow_owner_update"
  ON public.workflow_tasks FOR UPDATE
  TO authenticated
  USING (get_auth_role() = 'owner')
  WITH CHECK (get_auth_role() = 'owner');

DROP POLICY IF EXISTS "workflow_manager_branch_read" ON public.workflow_tasks;
CREATE POLICY "workflow_manager_branch_read"
  ON public.workflow_tasks FOR SELECT
  TO authenticated
  USING (
    get_auth_role() IN ('manager','assistant_manager','store_manager')
    AND workspace_scope = 'manager'
    AND branch_id = get_auth_branch_id()
  );

DROP POLICY IF EXISTS "workflow_manager_branch_update" ON public.workflow_tasks;
CREATE POLICY "workflow_manager_branch_update"
  ON public.workflow_tasks FOR UPDATE
  TO authenticated
  USING (
    get_auth_role() IN ('manager','assistant_manager','store_manager')
    AND workspace_scope = 'manager'
    AND branch_id = get_auth_branch_id()
  )
  WITH CHECK (
    get_auth_role() IN ('manager','assistant_manager','store_manager')
    AND workspace_scope = 'manager'
    AND branch_id = get_auth_branch_id()
  );

DROP POLICY IF EXISTS "workflow_crm_branch_read" ON public.workflow_tasks;
CREATE POLICY "workflow_crm_branch_read"
  ON public.workflow_tasks FOR SELECT
  TO authenticated
  USING (
    get_auth_role() IN ('crm','csr','csr_head','csr_staff')
    AND workspace_scope = 'crm'
    AND branch_id = get_auth_branch_id()
  );

DROP POLICY IF EXISTS "workflow_crm_branch_update" ON public.workflow_tasks;
CREATE POLICY "workflow_crm_branch_update"
  ON public.workflow_tasks FOR UPDATE
  TO authenticated
  USING (
    get_auth_role() IN ('crm','csr','csr_head','csr_staff')
    AND workspace_scope = 'crm'
    AND branch_id = get_auth_branch_id()
  )
  WITH CHECK (
    get_auth_role() IN ('crm','csr','csr_head','csr_staff')
    AND workspace_scope = 'crm'
    AND branch_id = get_auth_branch_id()
  );

DROP POLICY IF EXISTS "workflow_staff_own_read" ON public.workflow_tasks;
CREATE POLICY "workflow_staff_own_read"
  ON public.workflow_tasks FOR SELECT
  TO authenticated
  USING (
    get_auth_role() IN ('staff','service_head','service_staff')
    AND workspace_scope = 'staff'
    AND assigned_to_staff_id = get_auth_staff_id()
  );

DROP POLICY IF EXISTS "workflow_staff_own_update" ON public.workflow_tasks;
CREATE POLICY "workflow_staff_own_update"
  ON public.workflow_tasks FOR UPDATE
  TO authenticated
  USING (
    get_auth_role() IN ('staff','service_head','service_staff')
    AND workspace_scope = 'staff'
    AND assigned_to_staff_id = get_auth_staff_id()
  )
  WITH CHECK (
    get_auth_role() IN ('staff','service_head','service_staff')
    AND workspace_scope = 'staff'
    AND assigned_to_staff_id = get_auth_staff_id()
  );

DROP POLICY IF EXISTS "workflow_driver_utility_own_read" ON public.workflow_tasks;
CREATE POLICY "workflow_driver_utility_own_read"
  ON public.workflow_tasks FOR SELECT
  TO authenticated
  USING (
    get_auth_role() IN ('driver','utility')
    AND workspace_scope = get_auth_role()
    AND assigned_to_staff_id = get_auth_staff_id()
  );

DROP POLICY IF EXISTS "workflow_driver_utility_own_update" ON public.workflow_tasks;
CREATE POLICY "workflow_driver_utility_own_update"
  ON public.workflow_tasks FOR UPDATE
  TO authenticated
  USING (
    get_auth_role() IN ('driver','utility')
    AND workspace_scope = get_auth_role()
    AND assigned_to_staff_id = get_auth_staff_id()
  )
  WITH CHECK (
    get_auth_role() IN ('driver','utility')
    AND workspace_scope = get_auth_role()
    AND assigned_to_staff_id = get_auth_staff_id()
  );

-- No INSERT or DELETE policy: server-side workflow helpers write with the
-- service role. Users can read/update only the tasks scoped to their work.

NOTIFY pgrst, 'reload schema';
