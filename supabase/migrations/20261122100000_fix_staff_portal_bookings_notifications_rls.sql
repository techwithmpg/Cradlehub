-- ============================================================================
-- Restore Staff Portal / Native Staff App RLS visibility for service_staff and
-- service_head (dropped in 20261111120000_perf_rls_initplan_and_indexes.sql),
-- restore assigned staff customer name reads, restore manager-family workspace
-- notification visibility, and ensure Realtime publication covers bookings,
-- workspace_notifications, and workflow_tasks.
-- ============================================================================

BEGIN;

-- 1. BOOKINGS: allow staff, service_staff, and service_head to read own assigned bookings,
--    and allow driver/staff-family assigned drivers to read own assigned home-service bookings.
DROP POLICY IF EXISTS "bookings_branch_staff_read" ON public.bookings;

CREATE POLICY "bookings_branch_staff_read" ON public.bookings
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    (
      ((SELECT public.get_auth_role()) = ANY (ARRAY[
        'csr'::text, 'csr_head'::text, 'csr_staff'::text,
        'manager'::text, 'assistant_manager'::text, 'store_manager'::text
      ]))
      AND (branch_id = (SELECT public.get_auth_branch_id()))
    )
    OR (
      ((SELECT public.get_auth_role()) = ANY (ARRAY[
        'staff'::text, 'service_head'::text, 'service_staff'::text
      ]))
      AND (staff_id = (SELECT public.get_auth_staff_id()))
    )
    OR (
      ((SELECT public.get_auth_role()) = ANY (ARRAY[
        'driver'::text, 'staff'::text, 'service_head'::text, 'service_staff'::text
      ]))
      AND (driver_id = (SELECT public.get_auth_staff_id()))
    )
  );

-- 2. WORKSPACE NOTIFICATIONS: allow service_head & service_staff to read and update
--    their own staff-workspace notifications, and restore assistant_manager / store_manager.
DROP POLICY IF EXISTS "notif_Select_unified" ON public.workspace_notifications;
DROP POLICY IF EXISTS "notif_Update_unified" ON public.workspace_notifications;

CREATE POLICY "notif_Select_unified" ON public.workspace_notifications
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    ((SELECT public.get_auth_role()) = 'owner'::text)
    OR (
      ((SELECT public.get_auth_role()) = ANY (ARRAY['crm'::text, 'csr'::text, 'csr_head'::text, 'csr_staff'::text]))
      AND (target_workspace = 'crm'::text)
      AND (branch_id = (SELECT public.get_auth_branch_id()))
    )
    OR (
      ((SELECT public.get_auth_role()) = ANY (ARRAY['manager'::text, 'assistant_manager'::text, 'store_manager'::text]))
      AND (target_workspace = 'manager'::text)
      AND (branch_id = (SELECT public.get_auth_branch_id()))
    )
    OR (
      ((SELECT public.get_auth_role()) = ANY (ARRAY['staff'::text, 'service_head'::text, 'service_staff'::text]))
      AND (target_workspace = 'staff'::text)
      AND (recipient_staff_id = (SELECT public.get_auth_staff_id()))
    )
    OR (
      ((SELECT public.get_auth_role()) = ANY (ARRAY['driver'::text, 'utility'::text]))
      AND (target_workspace = (SELECT public.get_auth_role()))
      AND (recipient_staff_id = (SELECT public.get_auth_staff_id()))
    )
  );

CREATE POLICY "notif_Update_unified" ON public.workspace_notifications
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    ((SELECT public.get_auth_role()) = 'owner'::text)
    OR (
      ((SELECT public.get_auth_role()) = ANY (ARRAY['crm'::text, 'csr'::text, 'csr_head'::text, 'csr_staff'::text]))
      AND (target_workspace = 'crm'::text)
      AND (branch_id = (SELECT public.get_auth_branch_id()))
    )
    OR (
      ((SELECT public.get_auth_role()) = ANY (ARRAY['manager'::text, 'assistant_manager'::text, 'store_manager'::text]))
      AND (target_workspace = 'manager'::text)
      AND (branch_id = (SELECT public.get_auth_branch_id()))
    )
    OR (
      ((SELECT public.get_auth_role()) = ANY (ARRAY['staff'::text, 'service_head'::text, 'service_staff'::text]))
      AND (target_workspace = 'staff'::text)
      AND (recipient_staff_id = (SELECT public.get_auth_staff_id()))
    )
    OR (
      ((SELECT public.get_auth_role()) = ANY (ARRAY['driver'::text, 'utility'::text]))
      AND (target_workspace = (SELECT public.get_auth_role()))
      AND (recipient_staff_id = (SELECT public.get_auth_staff_id()))
    )
  )
  WITH CHECK (
    ((SELECT public.get_auth_role()) = 'owner'::text)
    OR (
      ((SELECT public.get_auth_role()) = ANY (ARRAY['crm'::text, 'csr'::text, 'csr_head'::text, 'csr_staff'::text]))
      AND (target_workspace = 'crm'::text)
      AND (branch_id = (SELECT public.get_auth_branch_id()))
    )
    OR (
      ((SELECT public.get_auth_role()) = ANY (ARRAY['manager'::text, 'assistant_manager'::text, 'store_manager'::text]))
      AND (target_workspace = 'manager'::text)
      AND (branch_id = (SELECT public.get_auth_branch_id()))
    )
    OR (
      ((SELECT public.get_auth_role()) = ANY (ARRAY['staff'::text, 'service_head'::text, 'service_staff'::text]))
      AND (target_workspace = 'staff'::text)
      AND (recipient_staff_id = (SELECT public.get_auth_staff_id()))
    )
    OR (
      ((SELECT public.get_auth_role()) = ANY (ARRAY['driver'::text, 'utility'::text]))
      AND (target_workspace = (SELECT public.get_auth_role()))
      AND (recipient_staff_id = (SELECT public.get_auth_staff_id()))
    )
  );

-- 3. CUSTOMERS: allow assigned staff (staff, service_head, service_staff) and
--    assistant_manager / store_manager to read booking-linked customer rows.
DROP POLICY IF EXISTS "customers_select_unified" ON public.customers;

CREATE POLICY "customers_select_unified" ON public.customers
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    ((SELECT public.get_auth_role()) = 'crm'::text)
    OR (
      ((SELECT public.get_auth_role()) = ANY (ARRAY[
        'csr'::text, 'csr_head'::text, 'csr_staff'::text,
        'manager'::text, 'assistant_manager'::text, 'store_manager'::text
      ]))
      AND (id IN (
        SELECT bookings.customer_id
        FROM public.bookings
        WHERE bookings.branch_id = (SELECT public.get_auth_branch_id())
          AND bookings.customer_id IS NOT NULL
      ))
    )
    OR (
      ((SELECT public.get_auth_role()) = ANY (ARRAY[
        'staff'::text, 'service_head'::text, 'service_staff'::text
      ]))
      AND (id IN (
        SELECT bookings.customer_id
        FROM public.bookings
        WHERE bookings.staff_id = (SELECT public.get_auth_staff_id())
          AND bookings.customer_id IS NOT NULL
      ))
    )
    OR (
      ((SELECT public.get_auth_role()) = ANY (ARRAY['driver'::text, 'staff'::text, 'service_head'::text, 'service_staff'::text]))
      AND (id IN (
        SELECT bookings.customer_id
        FROM public.bookings
        WHERE bookings.driver_id = (SELECT public.get_auth_staff_id())
          AND bookings.customer_id IS NOT NULL
      ))
    )
  );

-- 4. REALTIME PUBLICATION: ensure bookings, workspace_notifications, and workflow_tasks
--    stream live updates to CRM, Therapist, Driver, and Utility portals.
DO $pub$
DECLARE
  v_tbl text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH v_tbl IN ARRAY ARRAY['bookings', 'workspace_notifications', 'workflow_tasks'] LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = v_tbl
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_tbl);
      END IF;
    END LOOP;
  END IF;
END;
$pub$;

COMMIT;
