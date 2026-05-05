-- =============================================================================
-- CradleHub — Migration: Branch Resources & Room Assignment
-- =============================================================================

-- ─── BRANCH RESOURCES ────────────────────────────────────────────────────────
-- Bookable physical spaces or equipment within a branch.
-- Used to prevent physical-space double-booking (e.g. same bed at same time).

CREATE TABLE IF NOT EXISTS branch_resources (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     UUID        NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  type          TEXT        NOT NULL DEFAULT 'room'
                CHECK (type IN ('room', 'bed', 'chair', 'equipment', 'home_service_unit', 'shared_area', 'other')),
  capacity      INTEGER     NOT NULL DEFAULT 1 CHECK (capacity >= 1),
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order    INTEGER     NOT NULL DEFAULT 0,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  branch_resources            IS 'Bookable physical spaces or equipment within a branch.';
COMMENT ON COLUMN branch_resources.type       IS 'room | bed | chair | equipment | home_service_unit | shared_area | other.';
COMMENT ON COLUMN branch_resources.capacity   IS 'How many simultaneous bookings this space can hold (default 1).';


-- ─── LINK BOOKINGS TO RESOURCES ──────────────────────────────────────────────
-- Add resource_id to bookings to track which space is assigned.

ALTER TABLE bookings
ADD COLUMN resource_id UUID REFERENCES branch_resources(id) ON DELETE SET NULL;

COMMENT ON COLUMN bookings.resource_id IS 'Assigned physical space (room/bed/etc) for this booking.';


-- ─── INDEXES ─────────────────────────────────────────────────────────────────

CREATE INDEX idx_branch_resources_branch_id ON branch_resources(branch_id);
CREATE INDEX idx_branch_resources_branch_active ON branch_resources(branch_id, is_active);
CREATE INDEX idx_branch_resources_sort_order ON branch_resources(branch_id, sort_order);
CREATE INDEX idx_bookings_resource_id ON bookings(resource_id);


-- ─── RLS POLICIES ────────────────────────────────────────────────────────────

ALTER TABLE branch_resources ENABLE ROW LEVEL SECURITY;

-- Owner: Full CRUD
CREATE POLICY "branch_resources_owner_all"
  ON branch_resources FOR ALL
  TO authenticated
  USING     (get_auth_role() = 'owner')
  WITH CHECK (get_auth_role() = 'owner');

-- Manager: Full CRUD for their own branch
CREATE POLICY "branch_resources_manager_all"
  ON branch_resources FOR ALL
  TO authenticated
  USING (
    get_auth_role() = 'manager'
    AND branch_id = get_auth_branch_id()
  )
  WITH CHECK (
    get_auth_role() = 'manager'
    AND branch_id = get_auth_branch_id()
  );

-- CRM: Read all active resources (for cross-branch booking assignment)
CREATE POLICY "branch_resources_crm_read"
  ON branch_resources FOR SELECT
  TO authenticated
  USING (
    get_auth_role() IN ('crm', 'csr_head', 'csr_staff')
    AND is_active = TRUE
  );

-- Staff: Read active resources in their branch
CREATE POLICY "branch_resources_staff_read"
  ON branch_resources FOR SELECT
  TO authenticated
  USING (
    get_auth_role() = 'staff'
    AND branch_id = get_auth_branch_id()
    AND is_active = TRUE
  );


-- ─── UPDATE TRIGGER ──────────────────────────────────────────────────────────

CREATE TRIGGER update_branch_resources_modtime
  BEFORE UPDATE ON branch_resources
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();
