-- ============================================================================
-- CRADLEHUB PERFORMANCE STABILIZATION MIGRATION
-- 1. Missing Foreign Key & Hot Lookup Indexes
-- 2. RLS InitPlan Scalar Caching ((SELECT get_auth_*())) on Hot Tables
-- ============================================================================

BEGIN;

-- PART 1: MISSING HIGH-IMPACT INDEXES
CREATE INDEX IF NOT EXISTS idx_staff_services_service_id
  ON public.staff_services USING btree (service_id, staff_id);

CREATE INDEX IF NOT EXISTS idx_bookings_service_id
  ON public.bookings USING btree (service_id);

CREATE INDEX IF NOT EXISTS idx_bookings_requested_staff_id
  ON public.bookings USING btree (requested_staff_id)
  WHERE (requested_staff_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_bookings_branch_date_status_staff
  ON public.bookings USING btree (branch_id, booking_date, status, staff_id);

CREATE INDEX IF NOT EXISTS idx_attendance_exceptions_branch_status_detected
  ON public.attendance_exceptions USING btree (branch_id, status, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_exceptions_checkin_id
  ON public.attendance_exceptions USING btree (checkin_id)
  WHERE (checkin_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_qr_scan_events_branch_created
  ON public.qr_scan_events USING btree (branch_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_qr_scan_events_booking_id
  ON public.qr_scan_events USING btree (booking_id)
  WHERE (booking_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_staff_devices_branch_staff_status
  ON public.staff_devices USING btree (branch_id, staff_id, status);

CREATE INDEX IF NOT EXISTS idx_order_payable_items_order_amount
  ON public.order_payable_items USING btree (order_id) INCLUDE (amount);

CREATE INDEX IF NOT EXISTS idx_financial_allocations_order_amount
  ON public.financial_order_allocations USING btree (order_id) INCLUDE (amount);

CREATE OR REPLACE FUNCTION public.is_service_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE((
    SELECT system_role IN (
      'owner',
      'manager', 'assistant_manager', 'store_manager',
      'crm', 'csr_head'
    )
    FROM public.staff
    WHERE auth_user_id = (SELECT auth.uid())
      AND is_active = true
    LIMIT 1
  ), false);
$function$;

-- PART 2: WRAP RLS HELPER CALLS IN (SELECT ...) ON HOT OPERATIONAL TABLES

-- === A. TABLE: public.staff ===
DROP POLICY IF EXISTS "staff_csr_read_branch" ON public.staff;
DROP POLICY IF EXISTS "staff_driver_read_branch" ON public.staff;
DROP POLICY IF EXISTS "staff_manager_read_branch" ON public.staff;
DROP POLICY IF EXISTS "staff_operational_read_branch" ON public.staff;
DROP POLICY IF EXISTS "staff_read_own" ON public.staff;
DROP POLICY IF EXISTS "staff_owner_all" ON public.staff;

CREATE POLICY "staff_owner_all" ON public.staff
  AS PERMISSIVE FOR ALL TO authenticated
  USING ((SELECT public.get_auth_role()) = 'owner'::text)
  WITH CHECK ((SELECT public.get_auth_role()) = 'owner'::text);

CREATE POLICY "staff_read_own" ON public.staff
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (auth_user_id = (SELECT auth.uid()));

CREATE POLICY "staff_operational_read_branch" ON public.staff
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    ((SELECT public.get_auth_role()) = ANY (ARRAY[
      'manager'::text, 'assistant_manager'::text, 'store_manager'::text,
      'crm'::text, 'csr_head'::text, 'csr_staff'::text, 'csr'::text, 'driver'::text
    ]))
    AND (branch_id = (SELECT public.get_auth_branch_id()))
  );

-- === B. TABLE: public.bookings ===
DROP POLICY IF EXISTS "bookings_crm_operational_insert" ON public.bookings;
DROP POLICY IF EXISTS "bookings_crm_operational_update" ON public.bookings;
DROP POLICY IF EXISTS "bookings_crm_read_all" ON public.bookings;
DROP POLICY IF EXISTS "bookings_csr_insert" ON public.bookings;
DROP POLICY IF EXISTS "bookings_csr_read_branch" ON public.bookings;
DROP POLICY IF EXISTS "bookings_csr_update" ON public.bookings;
DROP POLICY IF EXISTS "bookings_driver_read_own" ON public.bookings;
DROP POLICY IF EXISTS "bookings_manager_insert" ON public.bookings;
DROP POLICY IF EXISTS "bookings_manager_read_branch" ON public.bookings;
DROP POLICY IF EXISTS "bookings_manager_update" ON public.bookings;
DROP POLICY IF EXISTS "bookings_owner_all" ON public.bookings;
DROP POLICY IF EXISTS "bookings_staff_read_own" ON public.bookings;
DROP POLICY IF EXISTS "bookings_branch_staff_read" ON public.bookings;
DROP POLICY IF EXISTS "bookings_branch_operational_insert" ON public.bookings;
DROP POLICY IF EXISTS "bookings_branch_operational_update" ON public.bookings;

CREATE POLICY "bookings_owner_all" ON public.bookings
  AS PERMISSIVE FOR ALL TO authenticated
  USING ((SELECT public.get_auth_role()) = 'owner'::text)
  WITH CHECK ((SELECT public.get_auth_role()) = 'owner'::text);

CREATE POLICY "bookings_crm_read_all" ON public.bookings
  AS PERMISSIVE FOR SELECT TO authenticated
  USING ((SELECT public.get_auth_role()) = 'crm'::text);

CREATE POLICY "bookings_branch_staff_read" ON public.bookings
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    (
      ((SELECT public.get_auth_role()) = ANY (ARRAY['csr'::text, 'csr_head'::text, 'csr_staff'::text, 'manager'::text, 'assistant_manager'::text, 'store_manager'::text]))
      AND (branch_id = (SELECT public.get_auth_branch_id()))
    )
    OR (((SELECT public.get_auth_role()) = 'staff'::text) AND (staff_id = (SELECT public.get_auth_staff_id())))
    OR (((SELECT public.get_auth_role()) = 'driver'::text) AND (driver_id = (SELECT public.get_auth_staff_id())))
  );

CREATE POLICY "bookings_branch_operational_insert" ON public.bookings
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    ((SELECT public.get_auth_role()) = ANY (ARRAY['crm'::text, 'csr'::text, 'csr_head'::text, 'csr_staff'::text, 'manager'::text]))
    AND (branch_id = (SELECT public.get_auth_branch_id()))
  );

CREATE POLICY "bookings_branch_operational_update" ON public.bookings
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    ((SELECT public.get_auth_role()) = ANY (ARRAY['crm'::text, 'csr'::text, 'csr_head'::text, 'csr_staff'::text, 'manager'::text]))
    AND (branch_id = (SELECT public.get_auth_branch_id()))
  )
  WITH CHECK (
    ((SELECT public.get_auth_role()) = ANY (ARRAY['crm'::text, 'csr'::text, 'csr_head'::text, 'csr_staff'::text, 'manager'::text]))
    AND (branch_id = (SELECT public.get_auth_branch_id()))
  );

-- === C. TABLE: public.workspace_notifications ===
DROP POLICY IF EXISTS "notif_crm_branch" ON public.workspace_notifications;
DROP POLICY IF EXISTS "notif_crm_branch_update" ON public.workspace_notifications;
DROP POLICY IF EXISTS "notif_driver_utility_own" ON public.workspace_notifications;
DROP POLICY IF EXISTS "notif_driver_utility_own_update" ON public.workspace_notifications;
DROP POLICY IF EXISTS "notif_manager_branch" ON public.workspace_notifications;
DROP POLICY IF EXISTS "notif_manager_branch_update" ON public.workspace_notifications;
DROP POLICY IF EXISTS "notif_owner_read" ON public.workspace_notifications;
DROP POLICY IF EXISTS "notif_owner_update" ON public.workspace_notifications;
DROP POLICY IF EXISTS "notif_staff_own" ON public.workspace_notifications;
DROP POLICY IF EXISTS "notif_staff_own_update" ON public.workspace_notifications;
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
      ((SELECT public.get_auth_role()) = 'manager'::text)
      AND (target_workspace = 'manager'::text)
      AND (branch_id = (SELECT public.get_auth_branch_id()))
    )
    OR (
      ((SELECT public.get_auth_role()) = 'staff'::text)
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
      ((SELECT public.get_auth_role()) = 'manager'::text)
      AND (target_workspace = 'manager'::text)
      AND (branch_id = (SELECT public.get_auth_branch_id()))
    )
    OR (
      ((SELECT public.get_auth_role()) = 'staff'::text)
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
      ((SELECT public.get_auth_role()) = 'manager'::text)
      AND (target_workspace = 'manager'::text)
      AND (branch_id = (SELECT public.get_auth_branch_id()))
    )
    OR (
      ((SELECT public.get_auth_role()) = 'staff'::text)
      AND (target_workspace = 'staff'::text)
      AND (recipient_staff_id = (SELECT public.get_auth_staff_id()))
    )
    OR (
      ((SELECT public.get_auth_role()) = ANY (ARRAY['driver'::text, 'utility'::text]))
      AND (target_workspace = (SELECT public.get_auth_role()))
      AND (recipient_staff_id = (SELECT public.get_auth_staff_id()))
    )
  );

-- === D. TABLE: public.workflow_tasks ===
DROP POLICY IF EXISTS "workflow_crm_branch_read" ON public.workflow_tasks;
DROP POLICY IF EXISTS "workflow_crm_branch_update" ON public.workflow_tasks;
DROP POLICY IF EXISTS "workflow_driver_utility_own_read" ON public.workflow_tasks;
DROP POLICY IF EXISTS "workflow_driver_utility_own_update" ON public.workflow_tasks;
DROP POLICY IF EXISTS "workflow_manager_branch_read" ON public.workflow_tasks;
DROP POLICY IF EXISTS "workflow_manager_branch_update" ON public.workflow_tasks;
DROP POLICY IF EXISTS "workflow_owner_read" ON public.workflow_tasks;
DROP POLICY IF EXISTS "workflow_owner_update" ON public.workflow_tasks;
DROP POLICY IF EXISTS "workflow_staff_own_read" ON public.workflow_tasks;
DROP POLICY IF EXISTS "workflow_staff_own_update" ON public.workflow_tasks;
DROP POLICY IF EXISTS "workflow_select_unified" ON public.workflow_tasks;
DROP POLICY IF EXISTS "workflow_update_unified" ON public.workflow_tasks;

CREATE POLICY "workflow_select_unified" ON public.workflow_tasks
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    ((SELECT public.get_auth_role()) = 'owner'::text)
    OR (
      ((SELECT public.get_auth_role()) = ANY (ARRAY['crm'::text, 'csr'::text, 'csr_head'::text, 'csr_staff'::text]))
      AND (workspace_scope = 'crm'::text)
      AND (branch_id = (SELECT public.get_auth_branch_id()))
    )
    OR (
      ((SELECT public.get_auth_role()) = ANY (ARRAY['manager'::text, 'assistant_manager'::text, 'store_manager'::text]))
      AND (workspace_scope = 'manager'::text)
      AND (branch_id = (SELECT public.get_auth_branch_id()))
    )
    OR (
      ((SELECT public.get_auth_role()) = ANY (ARRAY['staff'::text, 'service_head'::text, 'service_staff'::text]))
      AND (workspace_scope = 'staff'::text)
      AND (assigned_to_staff_id = (SELECT public.get_auth_staff_id()))
    )
    OR (
      ((SELECT public.get_auth_role()) = ANY (ARRAY['driver'::text, 'utility'::text]))
      AND (workspace_scope = (SELECT public.get_auth_role()))
      AND (assigned_to_staff_id = (SELECT public.get_auth_staff_id()))
    )
  );

CREATE POLICY "workflow_update_unified" ON public.workflow_tasks
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    ((SELECT public.get_auth_role()) = 'owner'::text)
    OR (
      ((SELECT public.get_auth_role()) = ANY (ARRAY['crm'::text, 'csr'::text, 'csr_head'::text, 'csr_staff'::text]))
      AND (workspace_scope = 'crm'::text)
      AND (branch_id = (SELECT public.get_auth_branch_id()))
    )
    OR (
      ((SELECT public.get_auth_role()) = ANY (ARRAY['manager'::text, 'assistant_manager'::text, 'store_manager'::text]))
      AND (workspace_scope = 'manager'::text)
      AND (branch_id = (SELECT public.get_auth_branch_id()))
    )
    OR (
      ((SELECT public.get_auth_role()) = ANY (ARRAY['staff'::text, 'service_head'::text, 'service_staff'::text]))
      AND (workspace_scope = 'staff'::text)
      AND (assigned_to_staff_id = (SELECT public.get_auth_staff_id()))
    )
    OR (
      ((SELECT public.get_auth_role()) = ANY (ARRAY['driver'::text, 'utility'::text]))
      AND (workspace_scope = (SELECT public.get_auth_role()))
      AND (assigned_to_staff_id = (SELECT public.get_auth_staff_id()))
    )
  )
  WITH CHECK (
    ((SELECT public.get_auth_role()) = 'owner'::text)
    OR (
      ((SELECT public.get_auth_role()) = ANY (ARRAY['crm'::text, 'csr'::text, 'csr_head'::text, 'csr_staff'::text]))
      AND (workspace_scope = 'crm'::text)
      AND (branch_id = (SELECT public.get_auth_branch_id()))
    )
    OR (
      ((SELECT public.get_auth_role()) = ANY (ARRAY['manager'::text, 'assistant_manager'::text, 'store_manager'::text]))
      AND (workspace_scope = 'manager'::text)
      AND (branch_id = (SELECT public.get_auth_branch_id()))
    )
    OR (
      ((SELECT public.get_auth_role()) = ANY (ARRAY['staff'::text, 'service_head'::text, 'service_staff'::text]))
      AND (workspace_scope = 'staff'::text)
      AND (assigned_to_staff_id = (SELECT public.get_auth_staff_id()))
    )
    OR (
      ((SELECT public.get_auth_role()) = ANY (ARRAY['driver'::text, 'utility'::text]))
      AND (workspace_scope = (SELECT public.get_auth_role()))
      AND (assigned_to_staff_id = (SELECT public.get_auth_staff_id()))
    )
  );

-- === E. TABLE: public.staff_shift_checkins ===
DROP POLICY IF EXISTS "checkins_csr_branch_read" ON public.staff_shift_checkins;
DROP POLICY IF EXISTS "checkins_manager_branch_read" ON public.staff_shift_checkins;
DROP POLICY IF EXISTS "checkins_owner_read" ON public.staff_shift_checkins;
DROP POLICY IF EXISTS "checkins_staff_read_own" ON public.staff_shift_checkins;
DROP POLICY IF EXISTS "checkins_select_unified" ON public.staff_shift_checkins;

CREATE POLICY "checkins_select_unified" ON public.staff_shift_checkins
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    ((SELECT public.get_auth_role()) = 'owner'::text)
    OR (
      ((SELECT public.get_auth_role()) = ANY (ARRAY['crm'::text, 'csr'::text, 'csr_head'::text, 'csr_staff'::text, 'manager'::text, 'assistant_manager'::text, 'store_manager'::text]))
      AND (branch_id = (SELECT public.get_auth_branch_id()))
    )
    OR (staff_id = (SELECT public.get_auth_staff_id()))
  );

-- === F. TABLE: public.customers ===
DROP POLICY IF EXISTS "customers_crm_read_all" ON public.customers;
DROP POLICY IF EXISTS "customers_crm_update_branch_related" ON public.customers;
DROP POLICY IF EXISTS "customers_csr_insert" ON public.customers;
DROP POLICY IF EXISTS "customers_csr_read_branch" ON public.customers;
DROP POLICY IF EXISTS "customers_csr_update_branch_related" ON public.customers;
DROP POLICY IF EXISTS "customers_driver_read_assigned" ON public.customers;
DROP POLICY IF EXISTS "customers_manager_insert" ON public.customers;
DROP POLICY IF EXISTS "customers_manager_read_branch" ON public.customers;
DROP POLICY IF EXISTS "customers_manager_update" ON public.customers;
DROP POLICY IF EXISTS "customers_owner_all" ON public.customers;
DROP POLICY IF EXISTS "customers_select_unified" ON public.customers;
DROP POLICY IF EXISTS "customers_insert_unified" ON public.customers;
DROP POLICY IF EXISTS "customers_update_unified" ON public.customers;

CREATE POLICY "customers_owner_all" ON public.customers
  AS PERMISSIVE FOR ALL TO authenticated
  USING ((SELECT public.get_auth_role()) = 'owner'::text)
  WITH CHECK ((SELECT public.get_auth_role()) = 'owner'::text);

CREATE POLICY "customers_select_unified" ON public.customers
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    ((SELECT public.get_auth_role()) = 'crm'::text)
    OR (
      ((SELECT public.get_auth_role()) = ANY (ARRAY['csr'::text, 'csr_head'::text, 'csr_staff'::text, 'manager'::text]))
      AND (id IN (SELECT bookings.customer_id FROM public.bookings WHERE bookings.branch_id = (SELECT public.get_auth_branch_id())))
    )
    OR (
      ((SELECT public.get_auth_role()) = 'driver'::text)
      AND (id IN (SELECT bookings.customer_id FROM public.bookings WHERE bookings.driver_id = (SELECT public.get_auth_staff_id())))
    )
  );

CREATE POLICY "customers_insert_unified" ON public.customers
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.get_auth_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'crm'::text, 'csr'::text, 'csr_head'::text, 'csr_staff'::text])
  );

CREATE POLICY "customers_update_unified" ON public.customers
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    ((SELECT public.get_auth_role()) = ANY (ARRAY['crm'::text, 'csr'::text, 'csr_head'::text, 'csr_staff'::text, 'manager'::text]))
    AND (id IN (
      SELECT bookings.customer_id
      FROM public.bookings
      WHERE bookings.branch_id = (SELECT public.get_auth_branch_id())
        AND bookings.customer_id IS NOT NULL
    ))
  )
  WITH CHECK (
    (SELECT public.get_auth_role()) = ANY (ARRAY['crm'::text, 'csr'::text, 'csr_head'::text, 'csr_staff'::text, 'manager'::text])
  );

-- === G. FINANCIAL & ORDER TABLES ===
DROP POLICY IF EXISTS "booking_orders_crm_read_branch" ON public.booking_orders;
DROP POLICY IF EXISTS "booking_orders_management_read_branch" ON public.booking_orders;
DROP POLICY IF EXISTS "booking_orders_owner_read_all" ON public.booking_orders;
DROP POLICY IF EXISTS "booking_orders_select_unified" ON public.booking_orders;

CREATE POLICY "booking_orders_select_unified" ON public.booking_orders
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    ((SELECT public.get_auth_role()) = 'owner'::text)
    OR (
      ((SELECT public.get_auth_role()) = ANY (ARRAY['crm'::text, 'manager'::text, 'assistant_manager'::text, 'store_manager'::text]))
      AND (branch_id = (SELECT public.get_auth_branch_id()))
    )
  );

DROP POLICY IF EXISTS "booking_attendees_crm_read_branch" ON public.booking_attendees;
DROP POLICY IF EXISTS "booking_attendees_management_read_branch" ON public.booking_attendees;
DROP POLICY IF EXISTS "booking_attendees_owner_read_all" ON public.booking_attendees;
DROP POLICY IF EXISTS "booking_attendees_select_unified" ON public.booking_attendees;

CREATE POLICY "booking_attendees_select_unified" ON public.booking_attendees
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    ((SELECT public.get_auth_role()) = 'owner'::text)
    OR (
      ((SELECT public.get_auth_role()) = ANY (ARRAY['crm'::text, 'manager'::text, 'assistant_manager'::text, 'store_manager'::text]))
      AND (EXISTS (
        SELECT 1 FROM public.booking_orders bo
        WHERE bo.id = booking_attendees.booking_order_id
          AND bo.branch_id = (SELECT public.get_auth_branch_id())
      ))
    )
  );

DROP POLICY IF EXISTS "order_payable_items_branch_read" ON public.order_payable_items;
DROP POLICY IF EXISTS "order_payable_items_owner_read_all" ON public.order_payable_items;
DROP POLICY IF EXISTS "order_payable_items_select_unified" ON public.order_payable_items;

CREATE POLICY "order_payable_items_select_unified" ON public.order_payable_items
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    ((SELECT public.get_auth_role()) = 'owner'::text)
    OR (
      ((SELECT public.get_auth_role()) = ANY (ARRAY['crm'::text, 'manager'::text, 'assistant_manager'::text, 'store_manager'::text]))
      AND (EXISTS (
        SELECT 1 FROM public.booking_orders bo
        WHERE bo.id = order_payable_items.order_id
          AND bo.branch_id = (SELECT public.get_auth_branch_id())
      ))
    )
  );

DROP POLICY IF EXISTS "financial_allocations_branch_read" ON public.financial_order_allocations;
DROP POLICY IF EXISTS "financial_allocations_owner_read_all" ON public.financial_order_allocations;
DROP POLICY IF EXISTS "financial_allocations_select_unified" ON public.financial_order_allocations;

CREATE POLICY "financial_allocations_select_unified" ON public.financial_order_allocations
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    ((SELECT public.get_auth_role()) = 'owner'::text)
    OR (
      ((SELECT public.get_auth_role()) = ANY (ARRAY['crm'::text, 'manager'::text, 'assistant_manager'::text, 'store_manager'::text]))
      AND (EXISTS (
        SELECT 1 FROM public.booking_orders bo
        WHERE bo.id = financial_order_allocations.order_id
          AND bo.branch_id = (SELECT public.get_auth_branch_id())
      ))
    )
  );

DROP POLICY IF EXISTS "financial_transactions_branch_read" ON public.financial_transactions;
DROP POLICY IF EXISTS "financial_transactions_owner_read_all" ON public.financial_transactions;
DROP POLICY IF EXISTS "financial_transactions_select_unified" ON public.financial_transactions;

CREATE POLICY "financial_transactions_select_unified" ON public.financial_transactions
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    ((SELECT public.get_auth_role()) = 'owner'::text)
    OR (
      ((SELECT public.get_auth_role()) = ANY (ARRAY['crm'::text, 'manager'::text, 'assistant_manager'::text, 'store_manager'::text]))
      AND (branch_id = (SELECT public.get_auth_branch_id()))
    )
  );

DROP POLICY IF EXISTS "financial_movements_branch_read" ON public.financial_account_movements;
DROP POLICY IF EXISTS "financial_movements_owner_read_all" ON public.financial_account_movements;
DROP POLICY IF EXISTS "financial_movements_select_unified" ON public.financial_account_movements;

CREATE POLICY "financial_movements_select_unified" ON public.financial_account_movements
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    ((SELECT public.get_auth_role()) = 'owner'::text)
    OR (
      ((SELECT public.get_auth_role()) = ANY (ARRAY['crm'::text, 'manager'::text, 'assistant_manager'::text, 'store_manager'::text]))
      AND (EXISTS (
        SELECT 1 FROM public.financial_transactions ft
        WHERE ft.id = financial_account_movements.transaction_id
          AND ft.branch_id = (SELECT public.get_auth_branch_id())
      ))
    )
  );

DROP POLICY IF EXISTS "cash_sessions_branch_read" ON public.cash_sessions;
DROP POLICY IF EXISTS "cash_sessions_owner_finance_read_all" ON public.cash_sessions;
DROP POLICY IF EXISTS "cash_sessions_select_unified" ON public.cash_sessions;

CREATE POLICY "cash_sessions_select_unified" ON public.cash_sessions
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    ((SELECT public.get_auth_role()) = 'owner'::text)
    OR (branch_id = (SELECT public.get_auth_branch_id()))
  );

-- === H. TABLE: public.branch_services ===
DROP POLICY IF EXISTS "branch_services_crm_branch_read" ON public.branch_services;
DROP POLICY IF EXISTS "branch_services_owner_all" ON public.branch_services;
DROP POLICY IF EXISTS "branch_services_service_admin_branch_insert" ON public.branch_services;
DROP POLICY IF EXISTS "branch_services_service_admin_branch_update" ON public.branch_services;
DROP POLICY IF EXISTS "branch_services_service_admin_select" ON public.branch_services;
DROP POLICY IF EXISTS "branch_services_authenticated_read" ON public.branch_services;

CREATE POLICY "branch_services_owner_all" ON public.branch_services
  AS PERMISSIVE FOR ALL TO authenticated
  USING ((SELECT public.get_auth_role()) = 'owner'::text)
  WITH CHECK ((SELECT public.get_auth_role()) = 'owner'::text);

CREATE POLICY "branch_services_authenticated_read" ON public.branch_services
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    (SELECT public.is_service_admin())
    OR (
      ((SELECT public.get_auth_role()) = ANY (ARRAY['crm'::text, 'csr_head'::text, 'csr_staff'::text, 'csr'::text]))
      AND (branch_id = (SELECT public.get_auth_branch_id()))
    )
  );

CREATE POLICY "branch_services_service_admin_branch_insert" ON public.branch_services
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.is_service_admin())
    AND (((SELECT public.get_auth_role()) = 'owner'::text) OR (branch_id = (SELECT public.get_auth_branch_id())))
  );

CREATE POLICY "branch_services_service_admin_branch_update" ON public.branch_services
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    (SELECT public.is_service_admin())
    AND (((SELECT public.get_auth_role()) = 'owner'::text) OR (branch_id = (SELECT public.get_auth_branch_id())))
  )
  WITH CHECK (
    (SELECT public.is_service_admin())
    AND (((SELECT public.get_auth_role()) = 'owner'::text) OR (branch_id = (SELECT public.get_auth_branch_id())))
  );

ANALYZE public.staff;
ANALYZE public.staff_services;
ANALYZE public.branch_services;
ANALYZE public.services;
ANALYZE public.bookings;
ANALYZE public.booking_orders;
ANALYZE public.order_payable_items;
ANALYZE public.financial_order_allocations;
ANALYZE public.workspace_notifications;
ANALYZE public.workflow_tasks;
ANALYZE public.staff_shift_checkins;

COMMIT;
