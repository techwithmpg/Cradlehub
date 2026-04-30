-- =============================================================================
-- CradleHub - Migration 009: Demo Org + Booking Workflow Seed
-- =============================================================================
-- Purpose:
--   Seed realistic, NON-PRODUCTION demo data for:
--   - branch + service catalogs
--   - org structure (system_role + staff_type + is_head)
--   - staff service capability mapping (staff_services)
--   - recurring schedules + overrides + blocked times
--   - customers + bookings (online, walk-in, home service, status mix)
--
-- Safety / idempotency:
--   - Stable UUIDs for deterministic reruns
--   - INSERT ... ON CONFLICT DO UPDATE / DO NOTHING
--   - No wholesale deletes
--   - Demo marker in booking metadata and customer notes
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Branches
-- -----------------------------------------------------------------------------
INSERT INTO public.branches (
  id,
  name,
  address,
  phone,
  email,
  maps_embed_url,
  fb_page,
  messenger_link,
  slot_interval_minutes,
  is_active
)
VALUES
  (
    'c1000000-0000-0000-0000-000000000001',
    'Cradle Spa - Main Branch',
    'Demo Address: Lacson St, Bacolod City, Negros Occidental',
    '+63 34 700 1001',
    'main.branch@example.test',
    'https://maps.google.com/?q=10.6765,122.9511&output=embed',
    'https://facebook.com/cradle.main.demo',
    'https://m.me/cradle.main.demo',
    30,
    TRUE
  ),
  (
    'c1000000-0000-0000-0000-000000000002',
    'Cradle Spa - SM Branch',
    'Demo Address: Araneta Ave, Bacolod City, Negros Occidental',
    '+63 34 700 1002',
    'sm.branch@example.test',
    'https://maps.google.com/?q=10.6840,122.9568&output=embed',
    'https://facebook.com/cradle.sm.demo',
    'https://m.me/cradle.sm.demo',
    30,
    TRUE
  )
ON CONFLICT (id) DO UPDATE
SET
  name                  = EXCLUDED.name,
  address               = EXCLUDED.address,
  phone                 = EXCLUDED.phone,
  email                 = EXCLUDED.email,
  maps_embed_url        = EXCLUDED.maps_embed_url,
  fb_page               = EXCLUDED.fb_page,
  messenger_link        = EXCLUDED.messenger_link,
  slot_interval_minutes = EXCLUDED.slot_interval_minutes,
  is_active             = EXCLUDED.is_active;

-- -----------------------------------------------------------------------------
-- 2) Service categories
-- -----------------------------------------------------------------------------
INSERT INTO public.service_categories (id, name, display_order, is_active)
VALUES
  ('d1000000-0000-0000-0000-000000000001', 'Massage Therapy', 1, TRUE),
  ('d1000000-0000-0000-0000-000000000002', 'Facial & Aesthetics', 2, TRUE),
  ('d1000000-0000-0000-0000-000000000003', 'Nails', 3, TRUE),
  ('d1000000-0000-0000-0000-000000000004', 'Salon', 4, TRUE),
  ('d1000000-0000-0000-0000-000000000005', 'Home Service', 5, TRUE)
ON CONFLICT (id) DO UPDATE
SET
  name          = EXCLUDED.name,
  display_order = EXCLUDED.display_order,
  is_active     = EXCLUDED.is_active;

-- -----------------------------------------------------------------------------
-- 3) Services
-- -----------------------------------------------------------------------------
INSERT INTO public.services (
  id,
  category_id,
  name,
  description,
  duration_minutes,
  price,
  buffer_before,
  buffer_after,
  is_active
)
VALUES
  -- Massage Therapy
  (
    'e1000000-0000-0000-0000-000000000001',
    'd1000000-0000-0000-0000-000000000001',
    'Signature Massage',
    'Full-body signature massage for deep relaxation and stress relief.',
    60,
    950.00,
    0,
    10,
    TRUE
  ),
  (
    'e1000000-0000-0000-0000-000000000002',
    'd1000000-0000-0000-0000-000000000001',
    'Swedish Massage',
    'Classic gentle-pressure massage to improve circulation and ease tension.',
    60,
    850.00,
    0,
    10,
    TRUE
  ),
  (
    'e1000000-0000-0000-0000-000000000003',
    'd1000000-0000-0000-0000-000000000001',
    'Deep Tissue Massage',
    'Targeted firm-pressure massage focused on deeper muscle layers.',
    60,
    1050.00,
    0,
    10,
    TRUE
  ),
  (
    'e1000000-0000-0000-0000-000000000004',
    'd1000000-0000-0000-0000-000000000001',
    'Hot Stone Therapy',
    'Heated-stone therapy combined with massage for deep muscle release.',
    90,
    1350.00,
    10,
    15,
    TRUE
  ),
  (
    'e1000000-0000-0000-0000-000000000005',
    'd1000000-0000-0000-0000-000000000001',
    'Couple Massage',
    'Side-by-side massage session for two guests.',
    90,
    2400.00,
    0,
    10,
    TRUE
  ),
  (
    'e1000000-0000-0000-0000-000000000006',
    'd1000000-0000-0000-0000-000000000005',
    'Home Service Massage',
    'At-home massage service with mobile therapist dispatch.',
    90,
    1600.00,
    0,
    10,
    TRUE
  ),

  -- Facial & Aesthetics
  (
    'e1000000-0000-0000-0000-000000000007',
    'd1000000-0000-0000-0000-000000000002',
    'Signature Facial',
    'Personalized facial protocol for hydration and skin balance.',
    75,
    1200.00,
    0,
    10,
    TRUE
  ),
  (
    'e1000000-0000-0000-0000-000000000008',
    'd1000000-0000-0000-0000-000000000002',
    'Deep Cleansing Facial',
    'Deep pore-cleansing facial treatment for oily and acne-prone skin.',
    60,
    1000.00,
    0,
    10,
    TRUE
  ),
  (
    'e1000000-0000-0000-0000-000000000009',
    'd1000000-0000-0000-0000-000000000002',
    'Whitening Facial',
    'Brightening facial focused on tone-evening and glow restoration.',
    75,
    1300.00,
    0,
    10,
    TRUE
  ),

  -- Nails
  (
    'e1000000-0000-0000-0000-000000000010',
    'd1000000-0000-0000-0000-000000000003',
    'Manicure',
    'Nail care, shaping, and polish for hands.',
    45,
    500.00,
    0,
    10,
    TRUE
  ),
  (
    'e1000000-0000-0000-0000-000000000011',
    'd1000000-0000-0000-0000-000000000003',
    'Pedicure',
    'Complete foot and nail care treatment.',
    60,
    650.00,
    0,
    10,
    TRUE
  ),
  (
    'e1000000-0000-0000-0000-000000000012',
    'd1000000-0000-0000-0000-000000000003',
    'Gel Polish',
    'Long-lasting gel polish application.',
    60,
    800.00,
    0,
    10,
    TRUE
  ),

  -- Salon
  (
    'e1000000-0000-0000-0000-000000000013',
    'd1000000-0000-0000-0000-000000000004',
    'Haircut',
    'Professional cut and styling consultation.',
    45,
    450.00,
    0,
    10,
    TRUE
  ),
  (
    'e1000000-0000-0000-0000-000000000014',
    'd1000000-0000-0000-0000-000000000004',
    'Hair Spa',
    'Deep-conditioning hair and scalp treatment.',
    75,
    1200.00,
    0,
    10,
    TRUE
  ),
  (
    'e1000000-0000-0000-0000-000000000015',
    'd1000000-0000-0000-0000-000000000004',
    'Hair Color',
    'Professional full-color application.',
    120,
    2200.00,
    0,
    10,
    TRUE
  )
ON CONFLICT (id) DO UPDATE
SET
  category_id      = EXCLUDED.category_id,
  name             = EXCLUDED.name,
  description      = EXCLUDED.description,
  duration_minutes = EXCLUDED.duration_minutes,
  price            = EXCLUDED.price,
  buffer_before    = EXCLUDED.buffer_before,
  buffer_after     = EXCLUDED.buffer_after,
  is_active        = EXCLUDED.is_active;

-- -----------------------------------------------------------------------------
-- 4) Branch service availability + branch pricing
-- -----------------------------------------------------------------------------
INSERT INTO public.branch_services (
  branch_id,
  service_id,
  custom_price,
  is_active
)
VALUES
  -- Main branch: massage + facial + nails + salon + home service
  ('c1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 950.00, TRUE),
  ('c1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000002', 850.00, TRUE),
  ('c1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000003', 1050.00, TRUE),
  ('c1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000004', 1350.00, TRUE),
  ('c1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000005', 2400.00, TRUE),
  ('c1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000006', 1600.00, TRUE),
  ('c1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000007', 1200.00, TRUE),
  ('c1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000008', 1000.00, TRUE),
  ('c1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000009', 1300.00, TRUE),
  ('c1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000010', 500.00, TRUE),
  ('c1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000011', 650.00, TRUE),
  ('c1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000012', 800.00, TRUE),
  ('c1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000013', 450.00, TRUE),
  ('c1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000014', 1200.00, TRUE),
  ('c1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000015', 2200.00, TRUE),

  -- SM branch: massage + facial + nails (with some price differences)
  ('c1000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000001', 980.00, TRUE),
  ('c1000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000002', 880.00, TRUE),
  ('c1000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000003', 1080.00, TRUE),
  ('c1000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000004', 1380.00, TRUE),
  ('c1000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000005', 2450.00, TRUE),
  ('c1000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000007', 1250.00, TRUE),
  ('c1000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000008', 1020.00, TRUE),
  ('c1000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000009', 1320.00, TRUE),
  ('c1000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000010', 520.00, TRUE),
  ('c1000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000011', 680.00, TRUE),
  ('c1000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000012', 840.00, TRUE)
ON CONFLICT (branch_id, service_id) DO UPDATE
SET
  custom_price = EXCLUDED.custom_price,
  is_active    = EXCLUDED.is_active;

-- -----------------------------------------------------------------------------
-- 5) Staff (org structure model)
-- -----------------------------------------------------------------------------
INSERT INTO public.staff (
  id,
  branch_id,
  auth_user_id,
  full_name,
  phone,
  tier,
  system_role,
  staff_type,
  is_head,
  is_active
)
VALUES
  -- Main branch
  ('f1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', NULL, 'Arielle Ramos',    '+63 990 100 0001', 'senior', 'owner',   'managerial', TRUE,  TRUE), -- Owner / GM
  ('f1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', NULL, 'Noel Martinez',    '+63 990 100 0002', 'senior', 'manager', 'managerial', TRUE,  TRUE), -- Manager
  ('f1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', NULL, 'Jessa Villanueva', '+63 990 100 0003', 'mid',    'manager', 'managerial', TRUE,  TRUE), -- Assistant Manager
  ('f1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000001', NULL, 'Carlo Bautista',   '+63 990 100 0004', 'mid',    'crm',     'csr',        TRUE,  TRUE), -- CSR Head
  ('f1000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000001', NULL, 'Mae Cordova',      '+63 990 100 0005', 'junior', 'crm',     'csr',        FALSE, TRUE), -- CSR Staff
  ('f1000000-0000-0000-0000-000000000006', 'c1000000-0000-0000-0000-000000000001', NULL, 'Ian Rosales',      '+63 990 100 0006', 'junior', 'crm',     'csr',        FALSE, TRUE), -- CSR Staff
  ('f1000000-0000-0000-0000-000000000007', 'c1000000-0000-0000-0000-000000000001', NULL, 'Lara Estrella',    '+63 990 100 0007', 'senior', 'staff',   'salon_head', TRUE,  TRUE), -- Salon Head
  ('f1000000-0000-0000-0000-000000000008', 'c1000000-0000-0000-0000-000000000001', NULL, 'Rico Flores',      '+63 990 100 0008', 'senior', 'staff',   'therapist',  FALSE, TRUE), -- Therapist
  ('f1000000-0000-0000-0000-000000000009', 'c1000000-0000-0000-0000-000000000001', NULL, 'Tina Ledesma',     '+63 990 100 0009', 'mid',    'staff',   'therapist',  FALSE, TRUE), -- Therapist
  ('f1000000-0000-0000-0000-000000000010', 'c1000000-0000-0000-0000-000000000001', NULL, 'Marco Dizon',      '+63 990 100 0010', 'junior', 'staff',   'therapist',  FALSE, TRUE), -- Therapist
  ('f1000000-0000-0000-0000-000000000011', 'c1000000-0000-0000-0000-000000000001', NULL, 'Nina Alcoriza',    '+63 990 100 0011', 'mid',    'staff',   'nail_tech',  FALSE, TRUE), -- Nail Tech
  ('f1000000-0000-0000-0000-000000000012', 'c1000000-0000-0000-0000-000000000001', NULL, 'Cleo Varela',      '+63 990 100 0012', 'junior', 'staff',   'nail_tech',  FALSE, TRUE), -- Nail Tech
  ('f1000000-0000-0000-0000-000000000013', 'c1000000-0000-0000-0000-000000000001', NULL, 'Paula Mangubat',   '+63 990 100 0013', 'mid',    'staff',   'aesthetician', FALSE, TRUE), -- Aesthetician
  ('f1000000-0000-0000-0000-000000000014', 'c1000000-0000-0000-0000-000000000001', NULL, 'Joel Acebedo',     '+63 990 100 0014', 'junior', 'staff',   'driver',     FALSE, TRUE), -- Driver
  ('f1000000-0000-0000-0000-000000000015', 'c1000000-0000-0000-0000-000000000001', NULL, 'Nash Dionela',     '+63 990 100 0015', 'junior', 'staff',   'driver',     FALSE, TRUE), -- Driver
  ('f1000000-0000-0000-0000-000000000016', 'c1000000-0000-0000-0000-000000000001', NULL, 'Mia Relucio',      '+63 990 100 0016', 'junior', 'staff',   'utility',    FALSE, TRUE), -- Utility

  -- SM branch
  ('f1000000-0000-0000-0000-000000000017', 'c1000000-0000-0000-0000-000000000002', NULL, 'Andre Galvez',     '+63 990 100 0017', 'senior', 'manager', 'managerial', TRUE,  TRUE), -- Store Manager
  ('f1000000-0000-0000-0000-000000000018', 'c1000000-0000-0000-0000-000000000002', NULL, 'Jin Amparo',       '+63 990 100 0018', 'junior', 'crm',     'csr',        FALSE, TRUE), -- CSR Staff
  ('f1000000-0000-0000-0000-000000000019', 'c1000000-0000-0000-0000-000000000002', NULL, 'Sheila Quinto',    '+63 990 100 0019', 'junior', 'crm',     'csr',        FALSE, TRUE), -- CSR Staff
  ('f1000000-0000-0000-0000-000000000020', 'c1000000-0000-0000-0000-000000000002', NULL, 'Drew Coscolluela', '+63 990 100 0020', 'mid',    'staff',   'therapist',  FALSE, TRUE), -- Therapist
  ('f1000000-0000-0000-0000-000000000021', 'c1000000-0000-0000-0000-000000000002', NULL, 'Ayen Condez',      '+63 990 100 0021', 'junior', 'staff',   'therapist',  FALSE, TRUE), -- Therapist
  ('f1000000-0000-0000-0000-000000000022', 'c1000000-0000-0000-0000-000000000002', NULL, 'Grace Palma',      '+63 990 100 0022', 'mid',    'staff',   'nail_tech',  FALSE, TRUE), -- Nail Tech
  ('f1000000-0000-0000-0000-000000000023', 'c1000000-0000-0000-0000-000000000002', NULL, 'Lea Cusi',         '+63 990 100 0023', 'junior', 'staff',   'nail_tech',  FALSE, TRUE), -- Nail Tech
  ('f1000000-0000-0000-0000-000000000024', 'c1000000-0000-0000-0000-000000000002', NULL, 'Yna Nunez',        '+63 990 100 0024', 'mid',    'staff',   'aesthetician', FALSE, TRUE), -- Aesthetician
  ('f1000000-0000-0000-0000-000000000025', 'c1000000-0000-0000-0000-000000000002', NULL, 'Ben Arevalo',      '+63 990 100 0025', 'junior', 'staff',   'utility',    FALSE, TRUE)  -- Utility
ON CONFLICT (id) DO UPDATE
SET
  branch_id    = EXCLUDED.branch_id,
  auth_user_id = EXCLUDED.auth_user_id,
  full_name    = EXCLUDED.full_name,
  phone        = EXCLUDED.phone,
  tier         = EXCLUDED.tier,
  system_role  = EXCLUDED.system_role,
  staff_type   = EXCLUDED.staff_type,
  is_head      = EXCLUDED.is_head,
  is_active    = EXCLUDED.is_active;

-- -----------------------------------------------------------------------------
-- 6) Staff service capabilities
-- -----------------------------------------------------------------------------
-- Therapists -> massage services (new demo set + legacy massage/reflexology set)
INSERT INTO public.staff_services (staff_id, service_id)
SELECT s.id, v.service_id
FROM public.staff s
CROSS JOIN (
  VALUES
    ('e1000000-0000-0000-0000-000000000001'::UUID),
    ('e1000000-0000-0000-0000-000000000002'::UUID),
    ('e1000000-0000-0000-0000-000000000003'::UUID),
    ('e1000000-0000-0000-0000-000000000004'::UUID),
    ('e1000000-0000-0000-0000-000000000005'::UUID),
    ('e1000000-0000-0000-0000-000000000006'::UUID),
    ('b1000000-0000-0000-0000-000000000001'::UUID),
    ('b1000000-0000-0000-0000-000000000002'::UUID),
    ('b1000000-0000-0000-0000-000000000003'::UUID),
    ('b1000000-0000-0000-0000-000000000004'::UUID),
    ('b1000000-0000-0000-0000-000000000005'::UUID),
    ('b1000000-0000-0000-0000-000000000006'::UUID),
    ('b1000000-0000-0000-0000-000000000007'::UUID),
    ('b1000000-0000-0000-0000-000000000008'::UUID)
) AS v(service_id)
WHERE s.staff_type = 'therapist'
  AND s.id IN (
    'f1000000-0000-0000-0000-000000000008',
    'f1000000-0000-0000-0000-000000000009',
    'f1000000-0000-0000-0000-000000000010',
    'f1000000-0000-0000-0000-000000000020',
    'f1000000-0000-0000-0000-000000000021'
  )
  AND EXISTS (SELECT 1 FROM public.services svc WHERE svc.id = v.service_id)
ON CONFLICT (staff_id, service_id) DO NOTHING;

-- Aestheticians -> facial/aesthetic services
INSERT INTO public.staff_services (staff_id, service_id)
SELECT s.id, v.service_id
FROM public.staff s
CROSS JOIN (
  VALUES
    ('e1000000-0000-0000-0000-000000000007'::UUID),
    ('e1000000-0000-0000-0000-000000000008'::UUID),
    ('e1000000-0000-0000-0000-000000000009'::UUID)
) AS v(service_id)
WHERE s.staff_type = 'aesthetician'
  AND s.id IN (
    'f1000000-0000-0000-0000-000000000013',
    'f1000000-0000-0000-0000-000000000024'
  )
ON CONFLICT (staff_id, service_id) DO NOTHING;

-- Nail techs -> nail services
INSERT INTO public.staff_services (staff_id, service_id)
SELECT s.id, v.service_id
FROM public.staff s
CROSS JOIN (
  VALUES
    ('e1000000-0000-0000-0000-000000000010'::UUID),
    ('e1000000-0000-0000-0000-000000000011'::UUID),
    ('e1000000-0000-0000-0000-000000000012'::UUID)
) AS v(service_id)
WHERE s.staff_type = 'nail_tech'
  AND s.id IN (
    'f1000000-0000-0000-0000-000000000011',
    'f1000000-0000-0000-0000-000000000012',
    'f1000000-0000-0000-0000-000000000022',
    'f1000000-0000-0000-0000-000000000023'
  )
ON CONFLICT (staff_id, service_id) DO NOTHING;

-- Salon head -> salon services
INSERT INTO public.staff_services (staff_id, service_id)
SELECT 'f1000000-0000-0000-0000-000000000007', v.service_id
FROM (
  VALUES
    ('e1000000-0000-0000-0000-000000000013'::UUID),
    ('e1000000-0000-0000-0000-000000000014'::UUID),
    ('e1000000-0000-0000-0000-000000000015'::UUID)
) AS v(service_id)
ON CONFLICT (staff_id, service_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 7) Staff schedules (weekly recurring)
-- -----------------------------------------------------------------------------
WITH workdays AS (
  SELECT day_of_week::SMALLINT
  FROM generate_series(0, 6) AS g(day_of_week) -- Sunday to Saturday
),
schedule_seed AS (
  SELECT
    s.id AS staff_id,
    wd.day_of_week,
    CASE
      WHEN s.staff_type = 'therapist'     THEN TIME '10:00'
      WHEN s.staff_type = 'nail_tech'     THEN TIME '10:00'
      WHEN s.staff_type = 'aesthetician'  THEN TIME '11:00'
      WHEN s.staff_type = 'salon_head'    THEN TIME '10:00'
      WHEN s.staff_type = 'csr'           THEN TIME '09:00'
      WHEN s.staff_type = 'driver'        THEN TIME '10:00'
      WHEN s.staff_type = 'utility'       THEN TIME '09:00'
      WHEN s.staff_type = 'managerial'    THEN TIME '09:00'
      ELSE TIME '09:00'
    END AS start_time,
    CASE
      WHEN s.staff_type = 'therapist'     THEN TIME '20:00'
      WHEN s.staff_type = 'nail_tech'     THEN TIME '19:00'
      WHEN s.staff_type = 'aesthetician'  THEN TIME '20:00'
      WHEN s.staff_type = 'salon_head'    THEN TIME '18:00'
      WHEN s.staff_type = 'csr'           THEN TIME '21:00'
      WHEN s.staff_type = 'driver'        THEN TIME '21:00'
      WHEN s.staff_type = 'utility'       THEN TIME '19:00'
      WHEN s.staff_type = 'managerial'    THEN TIME '18:00'
      ELSE TIME '18:00'
    END AS end_time
  FROM public.staff s
  JOIN workdays wd ON TRUE
  WHERE s.id IN (
    'f1000000-0000-0000-0000-000000000001',
    'f1000000-0000-0000-0000-000000000002',
    'f1000000-0000-0000-0000-000000000003',
    'f1000000-0000-0000-0000-000000000004',
    'f1000000-0000-0000-0000-000000000005',
    'f1000000-0000-0000-0000-000000000006',
    'f1000000-0000-0000-0000-000000000007',
    'f1000000-0000-0000-0000-000000000008',
    'f1000000-0000-0000-0000-000000000009',
    'f1000000-0000-0000-0000-000000000010',
    'f1000000-0000-0000-0000-000000000011',
    'f1000000-0000-0000-0000-000000000012',
    'f1000000-0000-0000-0000-000000000013',
    'f1000000-0000-0000-0000-000000000014',
    'f1000000-0000-0000-0000-000000000015',
    'f1000000-0000-0000-0000-000000000016',
    'f1000000-0000-0000-0000-000000000017',
    'f1000000-0000-0000-0000-000000000018',
    'f1000000-0000-0000-0000-000000000019',
    'f1000000-0000-0000-0000-000000000020',
    'f1000000-0000-0000-0000-000000000021',
    'f1000000-0000-0000-0000-000000000022',
    'f1000000-0000-0000-0000-000000000023',
    'f1000000-0000-0000-0000-000000000024',
    'f1000000-0000-0000-0000-000000000025'
  )
)
INSERT INTO public.staff_schedules (
  staff_id,
  day_of_week,
  start_time,
  end_time,
  is_active
)
SELECT
  staff_id,
  day_of_week,
  start_time,
  end_time,
  TRUE
FROM schedule_seed
ON CONFLICT (staff_id, day_of_week) DO UPDATE
SET
  start_time = EXCLUDED.start_time,
  end_time   = EXCLUDED.end_time,
  is_active  = TRUE;

-- -----------------------------------------------------------------------------
-- 8) Overrides + blocked times
-- -----------------------------------------------------------------------------
-- One therapist day off tomorrow
INSERT INTO public.schedule_overrides (
  staff_id,
  override_date,
  start_time,
  end_time,
  is_day_off,
  reason,
  created_by
)
VALUES
  (
    'f1000000-0000-0000-0000-000000000008',
    CURRENT_DATE + 1,
    NULL,
    NULL,
    TRUE,
    'Demo seed: day off',
    'f1000000-0000-0000-0000-000000000002'
  ),
  -- One staff shortened schedule tomorrow
  (
    'f1000000-0000-0000-0000-000000000013',
    CURRENT_DATE + 1,
    TIME '12:00',
    TIME '18:00',
    FALSE,
    'Demo seed: shortened hours',
    'f1000000-0000-0000-0000-000000000002'
  )
ON CONFLICT (staff_id, override_date) DO UPDATE
SET
  start_time = EXCLUDED.start_time,
  end_time   = EXCLUDED.end_time,
  is_day_off = EXCLUDED.is_day_off,
  reason     = EXCLUDED.reason,
  created_by = EXCLUDED.created_by;

-- One therapist lunch block + one nail tech 2-hour unavailability
INSERT INTO public.blocked_times (
  id,
  staff_id,
  block_date,
  start_time,
  end_time,
  reason,
  created_by
)
VALUES
  (
    'f2000000-0000-0000-0000-000000000001',
    'f1000000-0000-0000-0000-000000000009',
    CURRENT_DATE + 1,
    TIME '12:00',
    TIME '13:00',
    'break',
    'f1000000-0000-0000-0000-000000000002'
  ),
  (
    'f2000000-0000-0000-0000-000000000002',
    'f1000000-0000-0000-0000-000000000011',
    CURRENT_DATE + 1,
    TIME '14:00',
    TIME '16:00',
    'training',
    'f1000000-0000-0000-0000-000000000002'
  )
ON CONFLICT (id) DO UPDATE
SET
  staff_id    = EXCLUDED.staff_id,
  block_date  = EXCLUDED.block_date,
  start_time  = EXCLUDED.start_time,
  end_time    = EXCLUDED.end_time,
  reason      = EXCLUDED.reason,
  created_by  = EXCLUDED.created_by;

-- -----------------------------------------------------------------------------
-- 9) Customers (demo markers in notes)
-- -----------------------------------------------------------------------------
INSERT INTO public.customers (
  id,
  full_name,
  phone,
  email,
  preferred_staff_id,
  notes
)
VALUES
  ('f3000000-0000-0000-0000-000000000001', 'Sofia Villareal', '+63 999 100 1001', 'sofia.v@example.test', 'f1000000-0000-0000-0000-000000000009', 'Demo seed data - prefers mid-pressure massage'),
  ('f3000000-0000-0000-0000-000000000002', 'Jared Montano',   '+63 999 100 1002', 'jared.m@example.test', 'f1000000-0000-0000-0000-000000000008', 'Demo seed data - prefers senior therapist'),
  ('f3000000-0000-0000-0000-000000000003', 'Mika Delgado',    '+63 999 100 1003', 'mika.d@example.test',  NULL,                                      'Demo seed data'),
  ('f3000000-0000-0000-0000-000000000004', 'Trina Javier',    '+63 999 100 1004', 'trina.j@example.test', 'f1000000-0000-0000-0000-000000000013', 'Demo seed data - sensitive skin'),
  ('f3000000-0000-0000-0000-000000000005', 'Paolo Lim',       '+63 999 100 1005', 'paolo.l@example.test', NULL,                                      'Demo seed data'),
  ('f3000000-0000-0000-0000-000000000006', 'Celine Uy',       '+63 999 100 1006', 'celine.u@example.test', 'f1000000-0000-0000-0000-000000000011', 'Demo seed data - nail color preference'),
  ('f3000000-0000-0000-0000-000000000007', 'Vince Alonzo',    '+63 999 100 1007', 'vince.a@example.test', NULL,                                      'Demo seed data'),
  ('f3000000-0000-0000-0000-000000000008', 'Kaye Torrente',   '+63 999 100 1008', 'kaye.t@example.test',  'f1000000-0000-0000-0000-000000000024', 'Demo seed data - facial follow-up'),
  ('f3000000-0000-0000-0000-000000000009', 'Nico Rosas',      '+63 999 100 1009', 'nico.r@example.test',  NULL,                                      'Demo seed data'),
  ('f3000000-0000-0000-0000-000000000010', 'Alyssa Cruz',     '+63 999 100 1010', 'alyssa.c@example.test', 'f1000000-0000-0000-0000-000000000020', 'Demo seed data - prefers evening schedule')
ON CONFLICT (phone) DO UPDATE
SET
  full_name          = EXCLUDED.full_name,
  email              = EXCLUDED.email,
  preferred_staff_id = EXCLUDED.preferred_staff_id,
  notes              = EXCLUDED.notes;

-- -----------------------------------------------------------------------------
-- 10) Bookings (status mix + branch/staff/service coverage)
-- -----------------------------------------------------------------------------
INSERT INTO public.bookings (
  id,
  branch_id,
  service_id,
  staff_id,
  customer_id,
  booking_date,
  start_time,
  end_time,
  type,
  status,
  travel_buffer_mins,
  metadata
)
VALUES
  -- Confirmed booking today (therapist)
  (
    'f4000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000001',
    'f1000000-0000-0000-0000-000000000009',
    'f3000000-0000-0000-0000-000000000001',
    CURRENT_DATE,
    TIME '10:00',
    compute_booking_end_time(TIME '10:00', 'e1000000-0000-0000-0000-000000000001'),
    'online',
    'confirmed',
    NULL,
    jsonb_build_object(
      'seed', 'demo',
      'source', 'cradlehub_seed',
      'price_paid', 950,
      'service_name', 'Signature Massage',
      'duration_minutes', 60,
      'customer_notes', 'Demo seed data'
    )
  ),

  -- Completed booking yesterday
  (
    'f4000000-0000-0000-0000-000000000002',
    'c1000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000003',
    'f1000000-0000-0000-0000-000000000008',
    'f3000000-0000-0000-0000-000000000002',
    CURRENT_DATE - 1,
    TIME '14:00',
    compute_booking_end_time(TIME '14:00', 'e1000000-0000-0000-0000-000000000003'),
    'walkin',
    'completed',
    NULL,
    jsonb_build_object(
      'seed', 'demo',
      'source', 'cradlehub_seed',
      'price_paid', 1050,
      'service_name', 'Deep Tissue Massage',
      'duration_minutes', 60,
      'customer_notes', 'Demo walk-in completed'
    )
  ),

  -- Home service booking tomorrow
  (
    'f4000000-0000-0000-0000-000000000003',
    'c1000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000006',
    'f1000000-0000-0000-0000-000000000010',
    'f3000000-0000-0000-0000-000000000003',
    CURRENT_DATE + 1,
    TIME '16:00',
    compute_booking_end_time(TIME '16:00', 'e1000000-0000-0000-0000-000000000006'),
    'home_service',
    'confirmed',
    30,
    jsonb_build_object(
      'seed', 'demo',
      'source', 'cradlehub_seed',
      'price_paid', 1600,
      'service_name', 'Home Service Massage',
      'duration_minutes', 90,
      'customer_notes', 'Demo home service booking'
    )
  ),

  -- No-show example
  (
    'f4000000-0000-0000-0000-000000000004',
    'c1000000-0000-0000-0000-000000000002',
    'e1000000-0000-0000-0000-000000000010',
    'f1000000-0000-0000-0000-000000000022',
    'f3000000-0000-0000-0000-000000000006',
    CURRENT_DATE,
    TIME '13:00',
    compute_booking_end_time(TIME '13:00', 'e1000000-0000-0000-0000-000000000010'),
    'online',
    'no_show',
    NULL,
    jsonb_build_object(
      'seed', 'demo',
      'source', 'cradlehub_seed',
      'price_paid', 520,
      'service_name', 'Manicure',
      'duration_minutes', 45,
      'customer_notes', 'Demo no-show'
    )
  ),

  -- Cancelled example
  (
    'f4000000-0000-0000-0000-000000000005',
    'c1000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000008',
    'f1000000-0000-0000-0000-000000000013',
    'f3000000-0000-0000-0000-000000000004',
    CURRENT_DATE,
    TIME '15:00',
    compute_booking_end_time(TIME '15:00', 'e1000000-0000-0000-0000-000000000008'),
    'walkin',
    'cancelled',
    NULL,
    jsonb_build_object(
      'seed', 'demo',
      'source', 'cradlehub_seed',
      'price_paid', 1000,
      'service_name', 'Deep Cleansing Facial',
      'duration_minutes', 60,
      'customer_notes', 'Demo cancelled by customer'
    )
  ),

  -- Future booking (salon service)
  (
    'f4000000-0000-0000-0000-000000000006',
    'c1000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000013',
    'f1000000-0000-0000-0000-000000000007',
    'f3000000-0000-0000-0000-000000000005',
    CURRENT_DATE + 7,
    TIME '11:00',
    compute_booking_end_time(TIME '11:00', 'e1000000-0000-0000-0000-000000000013'),
    'online',
    'confirmed',
    NULL,
    jsonb_build_object(
      'seed', 'demo',
      'source', 'cradlehub_seed',
      'price_paid', 450,
      'service_name', 'Haircut',
      'duration_minutes', 45,
      'customer_notes', 'Demo future booking'
    )
  ),

  -- Facial booking at SM branch
  (
    'f4000000-0000-0000-0000-000000000007',
    'c1000000-0000-0000-0000-000000000002',
    'e1000000-0000-0000-0000-000000000007',
    'f1000000-0000-0000-0000-000000000024',
    'f3000000-0000-0000-0000-000000000008',
    CURRENT_DATE + 1,
    TIME '12:00',
    compute_booking_end_time(TIME '12:00', 'e1000000-0000-0000-0000-000000000007'),
    'online',
    'confirmed',
    NULL,
    jsonb_build_object(
      'seed', 'demo',
      'source', 'cradlehub_seed',
      'price_paid', 1250,
      'service_name', 'Signature Facial',
      'duration_minutes', 75,
      'customer_notes', 'Demo facial appointment'
    )
  ),

  -- Completed nail service yesterday
  (
    'f4000000-0000-0000-0000-000000000008',
    'c1000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000012',
    'f1000000-0000-0000-0000-000000000011',
    'f3000000-0000-0000-0000-000000000006',
    CURRENT_DATE - 1,
    TIME '10:00',
    compute_booking_end_time(TIME '10:00', 'e1000000-0000-0000-0000-000000000012'),
    'walkin',
    'completed',
    NULL,
    jsonb_build_object(
      'seed', 'demo',
      'source', 'cradlehub_seed',
      'price_paid', 800,
      'service_name', 'Gel Polish',
      'duration_minutes', 60,
      'customer_notes', 'Demo completed nail booking'
    )
  ),

  -- In-progress example
  (
    'f4000000-0000-0000-0000-000000000009',
    'c1000000-0000-0000-0000-000000000002',
    'e1000000-0000-0000-0000-000000000002',
    'f1000000-0000-0000-0000-000000000020',
    'f3000000-0000-0000-0000-000000000010',
    CURRENT_DATE,
    TIME '17:00',
    compute_booking_end_time(TIME '17:00', 'e1000000-0000-0000-0000-000000000002'),
    'online',
    'in_progress',
    NULL,
    jsonb_build_object(
      'seed', 'demo',
      'source', 'cradlehub_seed',
      'price_paid', 880,
      'service_name', 'Swedish Massage',
      'duration_minutes', 60,
      'customer_notes', 'Demo in-progress session'
    )
  ),

  -- Future confirmed booking (nails)
  (
    'f4000000-0000-0000-0000-000000000010',
    'c1000000-0000-0000-0000-000000000002',
    'e1000000-0000-0000-0000-000000000011',
    'f1000000-0000-0000-0000-000000000023',
    'f3000000-0000-0000-0000-000000000009',
    CURRENT_DATE + 3,
    TIME '11:00',
    compute_booking_end_time(TIME '11:00', 'e1000000-0000-0000-0000-000000000011'),
    'walkin',
    'confirmed',
    NULL,
    jsonb_build_object(
      'seed', 'demo',
      'source', 'cradlehub_seed',
      'price_paid', 680,
      'service_name', 'Pedicure',
      'duration_minutes', 60,
      'customer_notes', 'Demo future nails booking'
    )
  )
ON CONFLICT (id) DO UPDATE
SET
  branch_id          = EXCLUDED.branch_id,
  service_id         = EXCLUDED.service_id,
  staff_id           = EXCLUDED.staff_id,
  customer_id        = EXCLUDED.customer_id,
  booking_date       = EXCLUDED.booking_date,
  start_time         = EXCLUDED.start_time,
  end_time           = EXCLUDED.end_time,
  type               = EXCLUDED.type,
  status             = EXCLUDED.status,
  travel_buffer_mins = EXCLUDED.travel_buffer_mins,
  metadata           = EXCLUDED.metadata;

-- Rebuild CRM visit counters so completed-history dashboards are deterministic
UPDATE public.customers c
SET
  total_bookings = stats.completed_count,
  first_booking_date = stats.first_completed_date,
  last_booking_date = stats.last_completed_date,
  updated_at = NOW()
FROM (
  SELECT
    b.customer_id,
    COUNT(*) FILTER (WHERE b.status = 'completed')::INT AS completed_count,
    MIN(b.booking_date) FILTER (WHERE b.status = 'completed') AS first_completed_date,
    MAX(b.booking_date) FILTER (WHERE b.status = 'completed') AS last_completed_date
  FROM public.bookings b
  WHERE b.id IN (
    'f4000000-0000-0000-0000-000000000001',
    'f4000000-0000-0000-0000-000000000002',
    'f4000000-0000-0000-0000-000000000003',
    'f4000000-0000-0000-0000-000000000004',
    'f4000000-0000-0000-0000-000000000005',
    'f4000000-0000-0000-0000-000000000006',
    'f4000000-0000-0000-0000-000000000007',
    'f4000000-0000-0000-0000-000000000008',
    'f4000000-0000-0000-0000-000000000009',
    'f4000000-0000-0000-0000-000000000010'
  )
  GROUP BY b.customer_id
) AS stats
WHERE c.id = stats.customer_id;



