-- =============================================================================
-- CradleHub — Migration 001: Core Tables
-- =============================================================================
-- Design principles:
--   ✦ UUID PKs — no collision risk, safe for distributed inserts
--   ✦ TEXT + CHECK constraints instead of ENUM types — easy to extend later
--     by just updating the CHECK. ENUM requires ALTER TYPE which can fail
--     under load and needs careful migration.
--   ✦ JSONB metadata on bookings — forward-compatible extension point.
--     Add new fields to metadata without schema migrations.
--   ✦ is_active soft-delete on operational tables — never hard-delete business
--     records. Toggle is_active instead.
--   ✦ ON DELETE RESTRICT on bookings FKs — you cannot delete a branch, staff,
--     service, or customer that has bookings. Data integrity above convenience.
--   ✦ ON DELETE CASCADE on child schedule/block tables — removing a staff
--     member removes their schedule and blocks (expected behavior).
--   ✦ ON DELETE SET NULL on optional FKs — losing a reference doesn't break
--     the record (preferred_staff, created_by, changed_by).
--   ✦ created_at + updated_at on every mutable table — triggers handle updated_at
--   ✦ Time stored as TIME (not TIMESTAMPTZ) — bookings are local-time business
--     records, not global events. Avoids timezone confusion for a single-region
--     business.
-- =============================================================================


-- ─── BRANCHES ────────────────────────────────────────────────────────────────
-- Physical spa locations. Each branch is an independent scheduling unit.
-- slot_interval_minutes drives the booking grid — 30min default.
-- Future-proof: add metadata JSONB here if branch-specific config grows.

CREATE TABLE IF NOT EXISTS branches (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT        NOT NULL,
  address               TEXT        NOT NULL,
  phone                 TEXT,
  email                 TEXT,
  maps_embed_url        TEXT,
  fb_page               TEXT,
  messenger_link        TEXT,
  slot_interval_minutes INT         NOT NULL DEFAULT 30
                        CHECK (slot_interval_minutes IN (15, 30, 60)),
  is_active             BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  branches                       IS 'Physical spa branch locations. Each branch is an independent scheduling unit.';
COMMENT ON COLUMN branches.slot_interval_minutes IS 'Booking slot granularity: 15, 30, or 60 minutes.';
COMMENT ON COLUMN branches.maps_embed_url        IS 'Google Maps embed URL for public branch pages.';
COMMENT ON COLUMN branches.messenger_link        IS 'Facebook Messenger link for customer contact (preferred over WhatsApp).';


-- ─── STAFF ───────────────────────────────────────────────────────────────────
-- All personnel: therapists, managers, CRM team, and the owner.
-- auth_user_id links to Supabase Auth — NULL = not yet invited / no login needed.
-- tier is a label only — does NOT affect system access or workspace routing.
-- system_role controls which dashboard workspace the user sees on login.

CREATE TABLE IF NOT EXISTS staff (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     UUID        NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  auth_user_id  UUID        UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name     TEXT        NOT NULL,
  phone         TEXT,
  tier          TEXT        NOT NULL DEFAULT 'junior'
                CHECK (tier IN ('senior', 'mid', 'junior')),
  system_role   TEXT        NOT NULL DEFAULT 'staff'
                CHECK (system_role IN ('owner', 'manager', 'crm', 'staff')),
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  staff             IS 'All staff across all branches. system_role controls dashboard workspace access.';
COMMENT ON COLUMN staff.auth_user_id IS 'Links to Supabase Auth. NULL = staff member has no system login yet.';
COMMENT ON COLUMN staff.tier         IS 'Therapist classification (senior/mid/junior). Label only — does not affect access.';
COMMENT ON COLUMN staff.system_role  IS 'owner | manager | crm | staff. Controls workspace routing on login.';
COMMENT ON COLUMN staff.branch_id    IS 'Primary branch assignment. Owner can see all branches regardless.';


-- ─── STAFF SCHEDULES ─────────────────────────────────────────────────────────
-- Recurring weekly schedule per staff member.
-- UNIQUE (staff_id, day_of_week) — one row per day. Update in place.
-- schedule_overrides takes precedence over this table for specific dates.

CREATE TABLE IF NOT EXISTS staff_schedules (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id    UUID        NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  day_of_week SMALLINT    NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday
  start_time  TIME        NOT NULL,
  end_time    TIME        NOT NULL,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT  staff_schedules_time_check CHECK (end_time > start_time),
  UNIQUE (staff_id, day_of_week)
);

COMMENT ON TABLE  staff_schedules             IS 'Recurring weekly work schedule. One row per staff per day of week.';
COMMENT ON COLUMN staff_schedules.day_of_week IS '0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday.';
COMMENT ON COLUMN staff_schedules.is_active   IS 'Set FALSE to temporarily remove a day without deleting the record.';


-- ─── SCHEDULE OVERRIDES ───────────────────────────────────────────────────────
-- Date-specific exceptions to recurring schedules.
-- CRITICAL: The availability engine MUST check this table BEFORE staff_schedules.
-- If a row exists here for a date, it completely replaces the regular schedule.
-- is_day_off = TRUE → staff has zero slots that day (start/end are NULL).
-- is_day_off = FALSE → staff works different hours than usual.

CREATE TABLE IF NOT EXISTS schedule_overrides (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id      UUID        NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  override_date DATE        NOT NULL,
  start_time    TIME,           -- NULL when is_day_off = TRUE
  end_time      TIME,           -- NULL when is_day_off = TRUE
  is_day_off    BOOLEAN     NOT NULL DEFAULT FALSE,
  reason        TEXT,
  created_by    UUID        REFERENCES staff(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT schedule_overrides_time_check CHECK (
    (is_day_off = TRUE)
    OR (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
  ),
  UNIQUE (staff_id, override_date)
);

COMMENT ON TABLE  schedule_overrides              IS 'Date-specific schedule exceptions. Takes FULL precedence over staff_schedules for that date.';
COMMENT ON COLUMN schedule_overrides.is_day_off   IS 'TRUE = staff has no availability that day. start_time/end_time must be NULL.';
COMMENT ON COLUMN schedule_overrides.created_by   IS 'Which staff member (manager/owner) created this override.';


-- ─── SERVICE CATEGORIES ──────────────────────────────────────────────────────
-- Groups services for display on the public website and booking flow.
-- display_order controls sort order on the services page.

CREATE TABLE IF NOT EXISTS service_categories (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL UNIQUE,
  display_order INT         NOT NULL DEFAULT 0,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  service_categories               IS 'Groups services for public display (e.g., Swedish, Hot Stone, Reflexology).';
COMMENT ON COLUMN service_categories.display_order IS 'Lower number = appears first on the public services page.';


-- ─── SERVICES ────────────────────────────────────────────────────────────────
-- Global service catalog. Prices here are the default.
-- Per-branch pricing lives in branch_services.custom_price.
-- buffer_before/buffer_after enable prep and cleanup time without blocking the
-- customer-visible slot duration.

CREATE TABLE IF NOT EXISTS services (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id      UUID         NOT NULL REFERENCES service_categories(id) ON DELETE RESTRICT,
  name             TEXT         NOT NULL,
  description      TEXT,
  duration_minutes INT          NOT NULL CHECK (duration_minutes > 0),
  price            NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  buffer_before    INT          NOT NULL DEFAULT 0 CHECK (buffer_before >= 0),
  buffer_after     INT          NOT NULL DEFAULT 0 CHECK (buffer_after >= 0),
  is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  services               IS 'Global service catalog. Branch-specific pricing overrides live in branch_services.';
COMMENT ON COLUMN services.duration_minutes IS 'Visible service duration shown to customers.';
COMMENT ON COLUMN services.buffer_before    IS 'Hidden prep time in minutes added BEFORE service. Blocks staff schedule.';
COMMENT ON COLUMN services.buffer_after     IS 'Hidden cleanup/turnover time in minutes added AFTER service. Blocks staff schedule.';
COMMENT ON COLUMN services.price            IS 'Default price. Overridden per branch via branch_services.custom_price.';


-- ─── BRANCH SERVICES ─────────────────────────────────────────────────────────
-- Junction table: which services are offered at which branch.
-- custom_price is NULL → use services.price.
-- custom_price is set → use that price for bookings at this branch.
-- is_active = FALSE → service is temporarily removed from a branch without
--   touching the global service record.

CREATE TABLE IF NOT EXISTS branch_services (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id    UUID         NOT NULL REFERENCES branches(id)  ON DELETE CASCADE,
  service_id   UUID         NOT NULL REFERENCES services(id)  ON DELETE CASCADE,
  custom_price NUMERIC(10,2) CHECK (custom_price >= 0),       -- NULL = use services.price
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (branch_id, service_id)
);

COMMENT ON TABLE  branch_services              IS 'Maps services to branches with optional per-branch pricing.';
COMMENT ON COLUMN branch_services.custom_price IS 'If set, overrides services.price for bookings at this branch.';


-- ─── CUSTOMERS ───────────────────────────────────────────────────────────────
-- Guest customers — no Supabase Auth account required.
-- PRIMARY IDENTIFIER: phone number (unique). Same phone = same CRM record.
-- total_bookings and last_booking_date are maintained by trigger on bookings.
-- This table grows automatically as bookings are created — CRM data for free.

CREATE TABLE IF NOT EXISTS customers (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name          TEXT        NOT NULL,
  phone              TEXT        NOT NULL UNIQUE,   -- primary CRM identifier
  email              TEXT,
  preferred_staff_id UUID        REFERENCES staff(id)  ON DELETE SET NULL,
  notes              TEXT,                          -- internal staff notes
  first_booking_date DATE,                          -- auto-maintained by trigger
  last_booking_date  DATE,                          -- auto-maintained by trigger
  total_bookings     INT         NOT NULL DEFAULT 0, -- auto-maintained by trigger
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  customers                    IS 'Guest customers. Upserted by phone — same phone = same CRM record.';
COMMENT ON COLUMN customers.phone              IS 'Unique. Primary CRM identifier. Upsert target for all booking flows.';
COMMENT ON COLUMN customers.preferred_staff_id IS 'Customer preference for a specific therapist (captured during booking).';
COMMENT ON COLUMN customers.total_bookings     IS 'Auto-updated by trigger on booking status → completed.';
COMMENT ON COLUMN customers.last_booking_date  IS 'Auto-updated by trigger. Useful for repeat customer identification.';


-- ─── BOOKINGS ────────────────────────────────────────────────────────────────
-- Central table. Everything connects here.
-- end_time is stored (denormalized) for query performance — it equals:
--   start_time + buffer_before + duration_minutes + buffer_after
--   (all from the services table at time of booking).
-- Storing it avoids expensive joins in the hot availability query path.
-- metadata JSONB is the extensibility escape hatch — add new fields here
--   without schema migrations. Current expected keys: customer_notes.
--   Future keys: payment_ref, promo_code, rating, tip_amount.

CREATE TABLE IF NOT EXISTS bookings (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id          UUID         NOT NULL REFERENCES branches(id)   ON DELETE RESTRICT,
  service_id         UUID         NOT NULL REFERENCES services(id)   ON DELETE RESTRICT,
  staff_id           UUID         NOT NULL REFERENCES staff(id)      ON DELETE RESTRICT,
  customer_id        UUID         NOT NULL REFERENCES customers(id)  ON DELETE RESTRICT,
  booking_date       DATE         NOT NULL,
  start_time         TIME         NOT NULL,
  end_time           TIME         NOT NULL, -- stored: start + buffer_before + duration + buffer_after
  type               TEXT         NOT NULL
                     CHECK (type IN ('online', 'walkin', 'home_service')),
  status             TEXT         NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')),
  travel_buffer_mins INT          CHECK (travel_buffer_mins >= 0),   -- home_service only
  metadata           JSONB        NOT NULL DEFAULT '{}'::JSONB,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT bookings_time_check CHECK (end_time > start_time),
  CONSTRAINT bookings_travel_buffer_check CHECK (
    type = 'home_service' OR travel_buffer_mins IS NULL
  )
);

COMMENT ON TABLE  bookings                  IS 'Central table. All reservations, walk-ins, and home service appointments.';
COMMENT ON COLUMN bookings.end_time         IS 'Stored denormalized for query speed. = start_time + buffer_before + duration + buffer_after.';
COMMENT ON COLUMN bookings.travel_buffer_mins IS 'Additional minutes added to home_service blocks for travel. Null for other types.';
COMMENT ON COLUMN bookings.metadata         IS 'JSONB extension point. Keys: customer_notes. Future: payment_ref, promo_code, rating.';
COMMENT ON COLUMN bookings.type             IS 'online = customer booked via website, walkin = front desk entry, home_service = mobile visit.';


-- ─── BOOKING EVENTS (immutable audit log) ─────────────────────────────────────
-- Append-only status history. Populated ONLY by database triggers.
-- Never written by application code directly.
-- from_status = NULL on booking creation (no previous state).
-- changed_by = NULL when customer creates booking online.
-- Application sets session variable app.current_staff_id before status changes
-- so the trigger can capture WHO made the change.

CREATE TABLE IF NOT EXISTS booking_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID        NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  from_status TEXT        CHECK (from_status IN (
                            'pending','confirmed','in_progress','completed','cancelled','no_show'
                          )),
  to_status   TEXT        NOT NULL CHECK (to_status IN (
                            'pending','confirmed','in_progress','completed','cancelled','no_show'
                          )),
  changed_by  UUID        REFERENCES staff(id) ON DELETE SET NULL, -- NULL = customer online
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  booking_events            IS 'Immutable audit log. Written ONLY by triggers. Never by application code.';
COMMENT ON COLUMN booking_events.from_status IS 'NULL on initial booking creation.';
COMMENT ON COLUMN booking_events.changed_by  IS 'NULL when customer creates booking online. Set via app.current_staff_id session var.';


-- ─── BLOCKED TIMES ───────────────────────────────────────────────────────────
-- Manual time blocks within a working day (break, training, etc.).
-- These are intra-day blocks — for entire day off, use schedule_overrides.
-- The availability engine checks this table alongside bookings.

CREATE TABLE IF NOT EXISTS blocked_times (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id   UUID        NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  block_date DATE        NOT NULL,
  start_time TIME        NOT NULL,
  end_time   TIME        NOT NULL,
  reason     TEXT        NOT NULL
             CHECK (reason IN ('break', 'leave', 'training', 'other')),
  created_by UUID        REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT blocked_times_time_check CHECK (end_time > start_time)
);

COMMENT ON TABLE  blocked_times        IS 'Intra-day manual blocks (breaks, training). For full-day off, use schedule_overrides.';
COMMENT ON COLUMN blocked_times.reason IS 'break | leave | training | other. Extend the CHECK constraint to add new reasons.';
