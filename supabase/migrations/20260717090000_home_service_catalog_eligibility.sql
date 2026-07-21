-- =============================================================================
-- CradleHub - Authoritative Home Service Catalog Eligibility
-- =============================================================================
-- The public and CRM booking wizards already filter branch_services by
-- available_home_service. This migration makes the supplied 60-service menu the
-- authoritative Home Service catalog across all branches.
--
-- Intentional behavior:
--   1. Only services in this approved catalog remain Home Service eligible.
--   2. Eligibility is changed only on existing branch_services rows.
--   3. In-spa eligibility, price, duration, visibility, active state, staff
--      capability mappings, and every other service field are preserved.
--   4. The migration is idempotent.
-- =============================================================================

CREATE TEMP TABLE approved_home_service_catalog (
  category_name text NOT NULL,
  service_name  text NOT NULL,
  PRIMARY KEY (category_name, service_name)
) ON COMMIT DROP;

INSERT INTO approved_home_service_catalog (category_name, service_name)
VALUES
  ('Massage Services', 'Volcanic Hot Stone Massage'),
  ('Massage Services', 'Pre Natal Massage'),
  ('Massage Services', 'Post Natal Massage'),
  ('Massage Services', 'Sports Massage'),
  ('Massage Services', 'Hawaiian Lomi Lomi Massage'),
  ('Massage Services', 'Moxa Ventosa w/ Pinoy Ginhawa'),
  ('Massage Services', 'Himalayan Hot Stone Massage'),
  ('Massage Services', 'Herbal Ball'),
  ('Massage Services', 'Eco Sculpt Massage'),
  ('Massage Services', 'Mandara Massage'),
  ('Salon Services', 'Hair Cut'),
  ('Salon Services', 'Hair Cut with Shampoo'),
  ('Salon Services', 'Shampoo with Blowdry'),
  ('Salon Services', 'Shampoo Only'),
  ('Salon Services', 'Blowdry Only'),
  ('Salon Services', 'Blowdry with Style'),
  ('Salon Services', 'Hair Iron'),
  ('Salon Services', 'Hair Style'),
  ('Salon Services', 'Hair Rebond'),
  ('Salon Services', 'Highlights'),
  ('Salon Services', 'Ombre'),
  ('Salon Services', 'Balayage'),
  ('Salon Services', 'Kerabond'),
  ('Salon Services', 'Hair Color Rootings / Short Hair'),
  ('Salon Services', 'Hair Color Medium Hair'),
  ('Salon Services', 'Hair Color Long Hair'),
  ('Salon Services', 'Hair Color Labor'),
  ('Salon Services', 'Hair Treatment Labor'),
  ('Salon Services', 'Gel Manicure ORLY'),
  ('Salon Services', 'Gel Pedicure ORLY'),
  ('Salon Services', 'Gel Polish Removal Hands/Feet'),
  ('Salon Services', 'Manicure & Pedicure'),
  ('Salon Services', 'Mani-Pedi w/ Foot Spell Spa Package'),
  ('Salon Services', 'Mani-Pedi w/ Foot Scrub Package'),
  ('Salon Services', 'Foot Scrub'),
  ('Salon Services', 'Foot Spa'),
  ('Salon Services', 'Eyelash Extensions Natural Look'),
  ('Salon Services', 'Eyelash Extensions Cat Eye'),
  ('Salon Services', 'Eyelash Extensions Open Eye'),
  ('Salon Services', 'Eyelash Extensions Mardi Gras Look'),
  ('Salon Services', 'Eyelash Extensions Cradle Signature Lash'),
  ('Salon Services', 'Eyelash Perm'),
  ('Salon Services', 'Eyebrow Threading'),
  ('Salon Services', 'Ear Candling'),
  ('Salon Services', 'Waxing Underarm'),
  ('Salon Services', 'Waxing Legs Calf'),
  ('Salon Services', 'Waxing Thighs'),
  ('Salon Services', 'Waxing Bikini'),
  ('Salon Services', 'Waxing Hollywood / Brazilian'),
  ('Salon Services', 'Waxing Facial / Eyebrows / Beard / Nape'),
  ('Salon Services', 'Full Hair & Make Up'),
  ('Salon Services', 'Eye Make Up'),
  ('Salon Services', 'Hair Style without Makeup'),
  ('Salon Services', 'Make Up Home Service'),
  ('Skin Care Services', 'Facial Cleansing with Mask'),
  ('Skin Care Services', 'Organic Facial Cleansing with Mask'),
  ('Skin Care Services', 'Cradle Celebrity Facial Package'),
  ('Skin Care Services', 'Filipino Coffee Body Scrub'),
  ('Skin Care Services', 'Lemon Body Scrub'),
  ('Skin Care Services', 'Lux Body Scrub');

DO $$
DECLARE
  approved_count integer;
  catalog_mismatches text;
BEGIN
  SELECT count(*) INTO approved_count
  FROM approved_home_service_catalog;

  IF approved_count <> 60 THEN
    RAISE EXCEPTION
      'Expected 60 approved Home Service services, but migration contains %.',
      approved_count;
  END IF;

  SELECT string_agg(
           format('%s / %s (catalog matches: %s)', category_name, service_name, match_count),
           E'\n'
         )
  INTO catalog_mismatches
  FROM (
    SELECT
      approved.category_name,
      approved.service_name,
      count(services.id) AS match_count
    FROM approved_home_service_catalog approved
    LEFT JOIN public.service_categories categories
      ON lower(btrim(categories.name)) = lower(btrim(approved.category_name))
    LEFT JOIN public.services services
      ON services.category_id = categories.id
     AND lower(btrim(services.name)) = lower(btrim(approved.service_name))
    GROUP BY approved.category_name, approved.service_name
    HAVING count(services.id) <> 1
  ) mismatches;

  IF catalog_mismatches IS NOT NULL THEN
    RAISE EXCEPTION
      'Home Service catalog validation failed. Fix these service records before retrying:%',
      E'\n' || catalog_mismatches;
  END IF;
END
$$;

-- Strictly enforce the supplied list: anything outside it becomes ineligible
-- for Home Service. This does not affect in-spa booking.
UPDATE public.branch_services branch_service
SET available_home_service = false
WHERE branch_service.available_home_service IS DISTINCT FROM false
  AND NOT EXISTS (
    SELECT 1
    FROM public.services service
    JOIN public.service_categories category
      ON category.id = service.category_id
    JOIN approved_home_service_catalog approved
      ON lower(btrim(approved.category_name)) = lower(btrim(category.name))
     AND lower(btrim(approved.service_name)) = lower(btrim(service.name))
    WHERE service.id = branch_service.service_id
  );

-- Enable Home Service only where the service is already assigned to the branch.
-- No new branch-service assignment is created here.
UPDATE public.branch_services branch_service
SET available_home_service = true
FROM public.services service
JOIN public.service_categories category
  ON category.id = service.category_id
JOIN approved_home_service_catalog approved
  ON lower(btrim(approved.category_name)) = lower(btrim(category.name))
 AND lower(btrim(approved.service_name)) = lower(btrim(service.name))
WHERE branch_service.service_id = service.id
  AND branch_service.available_home_service IS DISTINCT FROM true;

DO $$
DECLARE
  enabled_branch_rows integer;
  enabled_unique_services integer;
BEGIN
  SELECT count(*), count(DISTINCT branch_service.service_id)
  INTO enabled_branch_rows, enabled_unique_services
  FROM public.branch_services branch_service
  WHERE branch_service.available_home_service = true;

  RAISE NOTICE
    'Home Service catalog applied: % branch-service rows enabled across % unique services.',
    enabled_branch_rows,
    enabled_unique_services;
END
$$;