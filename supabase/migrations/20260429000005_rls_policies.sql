-- =============================================================================
-- CradleHub — Migration 005: Row Level Security Policies
-- =============================================================================
-- Access matrix:
--
--  Table               | Public | Staff (own) | Manager (branch) | CRM | Owner
--  --------------------|--------|-------------|------------------|-----|------
--  branches            |  READ  |     —        |       —          |  —  |  ALL
--  staff               |   —    |  READ own   |  READ branch     |  —  |  ALL
--  staff_schedules     |   —    |  READ own   |  ALL branch      |  —  |  ALL
--  schedule_overrides  |   —    |  READ own   |  ALL branch      |  —  |  ALL
--  service_categories  |  READ  |     —        |       —          |  —  |  ALL
--  services            |  READ  |     —        |       —          |  —  |  ALL
--  branch_services     |  READ  |     —        |       —          |  —  |  ALL
--  customers           |   —    |     —        |  ALL branch*     | READ|  ALL
--  bookings            |   —    |  READ own   |  ALL branch      | READ|  ALL
--  booking_events      |   —    |  READ own   |  READ branch     | READ|  ALL
--  blocked_times       |   —    |  READ own   |  ALL branch      |  —  |  ALL
--
-- * Manager INSERT/UPDATE customers is allowed for walk-in entry
-- * Public INSERT on bookings/customers goes through upsert_customer()
--   and a separate API route using service role key
--
-- IMPORTANT: get_available_slots() uses SECURITY DEFINER to bypass RLS.
-- This is intentional — availability must see ALL bookings for a staff member
-- across all branches (handles cross-branch home service bookings).
-- =============================================================================


-- ─── Enable RLS on all tables ─────────────────────────────────────────────────
ALTER TABLE branches           ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff              ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_schedules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE services           ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_services    ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_times      ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- BRANCHES
-- =============================================================================

-- Public: read active branches (booking flow + public website)
CREATE POLICY "branches_public_read"
  ON branches FOR SELECT
  USING (is_active = TRUE);

-- Owner: full CRUD
CREATE POLICY "branches_owner_all"
  ON branches FOR ALL
  TO authenticated
  USING     (get_auth_role() = 'owner')
  WITH CHECK (get_auth_role() = 'owner');


-- =============================================================================
-- STAFF
-- =============================================================================

-- Any authenticated user: read their own staff record (needed for role detection)
CREATE POLICY "staff_read_own"
  ON staff FOR SELECT
  TO authenticated
  USING (auth_user_id = (SELECT auth.uid()));

-- Manager: read all staff in their branch
CREATE POLICY "staff_manager_read_branch"
  ON staff FOR SELECT
  TO authenticated
  USING (
    get_auth_role() = 'manager'
    AND branch_id = get_auth_branch_id()
  );

-- Owner: full CRUD on all staff
CREATE POLICY "staff_owner_all"
  ON staff FOR ALL
  TO authenticated
  USING     (get_auth_role() = 'owner')
  WITH CHECK (get_auth_role() = 'owner');


-- =============================================================================
-- STAFF SCHEDULES
-- =============================================================================

-- Staff: read own schedule
CREATE POLICY "staff_schedules_read_own"
  ON staff_schedules FOR SELECT
  TO authenticated
  USING (staff_id = get_auth_staff_id());

-- Manager: read schedules for staff in own branch
CREATE POLICY "staff_schedules_manager_read"
  ON staff_schedules FOR SELECT
  TO authenticated
  USING (
    get_auth_role() = 'manager'
    AND staff_id IN (
      SELECT id FROM staff WHERE branch_id = get_auth_branch_id()
    )
  );

-- Manager: create/update schedules for staff in own branch
CREATE POLICY "staff_schedules_manager_write"
  ON staff_schedules FOR INSERT
  TO authenticated
  WITH CHECK (
    get_auth_role() = 'manager'
    AND staff_id IN (
      SELECT id FROM staff WHERE branch_id = get_auth_branch_id()
    )
  );

CREATE POLICY "staff_schedules_manager_update"
  ON staff_schedules FOR UPDATE
  TO authenticated
  USING (
    get_auth_role() = 'manager'
    AND staff_id IN (
      SELECT id FROM staff WHERE branch_id = get_auth_branch_id()
    )
  )
  WITH CHECK (
    get_auth_role() = 'manager'
    AND staff_id IN (
      SELECT id FROM staff WHERE branch_id = get_auth_branch_id()
    )
  );

-- Owner: full CRUD
CREATE POLICY "staff_schedules_owner_all"
  ON staff_schedules FOR ALL
  TO authenticated
  USING     (get_auth_role() = 'owner')
  WITH CHECK (get_auth_role() = 'owner');


-- =============================================================================
-- SCHEDULE OVERRIDES
-- =============================================================================

-- Staff: read own overrides
CREATE POLICY "schedule_overrides_read_own"
  ON schedule_overrides FOR SELECT
  TO authenticated
  USING (staff_id = get_auth_staff_id());

-- Manager: full access for staff in own branch
CREATE POLICY "schedule_overrides_manager_all"
  ON schedule_overrides FOR ALL
  TO authenticated
  USING (
    get_auth_role() = 'manager'
    AND staff_id IN (
      SELECT id FROM staff WHERE branch_id = get_auth_branch_id()
    )
  )
  WITH CHECK (
    get_auth_role() = 'manager'
    AND staff_id IN (
      SELECT id FROM staff WHERE branch_id = get_auth_branch_id()
    )
  );

-- Owner: full CRUD
CREATE POLICY "schedule_overrides_owner_all"
  ON schedule_overrides FOR ALL
  TO authenticated
  USING     (get_auth_role() = 'owner')
  WITH CHECK (get_auth_role() = 'owner');


-- =============================================================================
-- SERVICE CATEGORIES, SERVICES, BRANCH SERVICES
-- (Public read — these power the booking flow)
-- =============================================================================

CREATE POLICY "service_categories_public_read"
  ON service_categories FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "service_categories_owner_all"
  ON service_categories FOR ALL
  TO authenticated
  USING     (get_auth_role() = 'owner')
  WITH CHECK (get_auth_role() = 'owner');

-- ---

CREATE POLICY "services_public_read"
  ON services FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "services_owner_all"
  ON services FOR ALL
  TO authenticated
  USING     (get_auth_role() = 'owner')
  WITH CHECK (get_auth_role() = 'owner');

-- ---

CREATE POLICY "branch_services_public_read"
  ON branch_services FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "branch_services_owner_all"
  ON branch_services FOR ALL
  TO authenticated
  USING     (get_auth_role() = 'owner')
  WITH CHECK (get_auth_role() = 'owner');


-- =============================================================================
-- CUSTOMERS
-- (No public read — PII protection)
-- =============================================================================

-- CRM: read all customers across all branches
CREATE POLICY "customers_crm_read_all"
  ON customers FOR SELECT
  TO authenticated
  USING (get_auth_role() = 'crm');

-- Manager: read customers who have visited their branch
CREATE POLICY "customers_manager_read_branch"
  ON customers FOR SELECT
  TO authenticated
  USING (
    get_auth_role() = 'manager'
    AND id IN (
      SELECT customer_id FROM bookings
      WHERE branch_id = get_auth_branch_id()
    )
  );

-- Manager: create customers (walk-in entry, phone lookup)
CREATE POLICY "customers_manager_insert"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (get_auth_role() IN ('manager', 'owner'));

-- Manager: update customer notes / preferences for their customers
CREATE POLICY "customers_manager_update"
  ON customers FOR UPDATE
  TO authenticated
  USING (
    get_auth_role() = 'manager'
    AND id IN (
      SELECT customer_id FROM bookings
      WHERE branch_id = get_auth_branch_id()
    )
  );

-- Owner: full CRUD
CREATE POLICY "customers_owner_all"
  ON customers FOR ALL
  TO authenticated
  USING     (get_auth_role() = 'owner')
  WITH CHECK (get_auth_role() = 'owner');


-- =============================================================================
-- BOOKINGS
-- =============================================================================

-- Staff: read own assigned bookings
CREATE POLICY "bookings_staff_read_own"
  ON bookings FOR SELECT
  TO authenticated
  USING (
    get_auth_role() = 'staff'
    AND staff_id = get_auth_staff_id()
  );

-- Manager: read all bookings at own branch
CREATE POLICY "bookings_manager_read_branch"
  ON bookings FOR SELECT
  TO authenticated
  USING (
    get_auth_role() = 'manager'
    AND branch_id = get_auth_branch_id()
  );

-- Manager: create bookings at own branch (walk-in entry)
CREATE POLICY "bookings_manager_insert"
  ON bookings FOR INSERT
  TO authenticated
  WITH CHECK (
    get_auth_role() = 'manager'
    AND branch_id = get_auth_branch_id()
  );

-- Manager: update bookings at own branch (status changes, reschedule)
CREATE POLICY "bookings_manager_update"
  ON bookings FOR UPDATE
  TO authenticated
  USING (
    get_auth_role() = 'manager'
    AND branch_id = get_auth_branch_id()
  )
  WITH CHECK (
    get_auth_role() = 'manager'
    AND branch_id = get_auth_branch_id()
  );

-- CRM: read-only access to all bookings (cross-branch view)
CREATE POLICY "bookings_crm_read_all"
  ON bookings FOR SELECT
  TO authenticated
  USING (get_auth_role() = 'crm');

-- Owner: full CRUD
CREATE POLICY "bookings_owner_all"
  ON bookings FOR ALL
  TO authenticated
  USING     (get_auth_role() = 'owner')
  WITH CHECK (get_auth_role() = 'owner');


-- =============================================================================
-- BOOKING EVENTS
-- (Read-only for all non-owner roles — written only by triggers)
-- =============================================================================

-- Staff: read events for own bookings
CREATE POLICY "booking_events_staff_read_own"
  ON booking_events FOR SELECT
  TO authenticated
  USING (
    booking_id IN (
      SELECT id FROM bookings WHERE staff_id = get_auth_staff_id()
    )
  );

-- Manager: read events for bookings at own branch
CREATE POLICY "booking_events_manager_read_branch"
  ON booking_events FOR SELECT
  TO authenticated
  USING (
    get_auth_role() IN ('manager', 'crm')
    AND booking_id IN (
      SELECT id FROM bookings WHERE branch_id = get_auth_branch_id()
    )
  );

-- CRM: read all booking events
CREATE POLICY "booking_events_crm_read_all"
  ON booking_events FOR SELECT
  TO authenticated
  USING (get_auth_role() = 'crm');

-- Owner: full access (read + insert allowed for trigger-sourced writes via service role)
CREATE POLICY "booking_events_owner_all"
  ON booking_events FOR ALL
  TO authenticated
  USING     (get_auth_role() = 'owner')
  WITH CHECK (get_auth_role() = 'owner');


-- =============================================================================
-- BLOCKED TIMES
-- =============================================================================

-- Staff: read own blocks
CREATE POLICY "blocked_times_staff_read_own"
  ON blocked_times FOR SELECT
  TO authenticated
  USING (staff_id = get_auth_staff_id());

-- Manager: full CRUD for staff in own branch
CREATE POLICY "blocked_times_manager_all"
  ON blocked_times FOR ALL
  TO authenticated
  USING (
    get_auth_role() = 'manager'
    AND staff_id IN (
      SELECT id FROM staff WHERE branch_id = get_auth_branch_id()
    )
  )
  WITH CHECK (
    get_auth_role() = 'manager'
    AND staff_id IN (
      SELECT id FROM staff WHERE branch_id = get_auth_branch_id()
    )
  );

-- Owner: full CRUD
CREATE POLICY "blocked_times_owner_all"
  ON blocked_times FOR ALL
  TO authenticated
  USING     (get_auth_role() = 'owner')
  WITH CHECK (get_auth_role() = 'owner');
