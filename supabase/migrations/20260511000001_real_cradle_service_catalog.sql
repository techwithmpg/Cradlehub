-- =============================================================================
-- CradleHub - Real Cradle Service Catalog
-- =============================================================================
-- Adds the service-menu catalog into the existing service architecture:
--   service_categories -> services -> branch_services
--
-- This migration uses only the current production schema columns.
-- It does not assign the new catalog services to branches.
-- Owners/managers continue to control bookability through branch_services.
-- =============================================================================

INSERT INTO public.service_categories (name, display_order, is_active)
VALUES
  ('Massage Services', 1, TRUE),
  ('Salon Services', 2, TRUE),
  ('Skin Care Services', 3, TRUE),
  ('Divine Renewal Packages', 4, TRUE),
  ('Spa Party Packages', 5, TRUE)
ON CONFLICT (name) DO UPDATE
SET
  display_order = EXCLUDED.display_order,
  is_active = TRUE;

WITH catalog(category_name, service_name, description, duration_minutes, price) AS (
VALUES
  ('Massage Services', 'Angels Massage', 'A straightforward relaxation massage for an easy body reset.', 60, 400.00),
  ('Massage Services', 'Cradle Swedish Massage', 'Classic full-body Swedish massage with gentle, flowing pressure.', 60, 500.00),
  ('Massage Services', 'Shiatsu', 'Pressure-point massage inspired by traditional Japanese bodywork.', 60, 500.00),
  ('Massage Services', 'Head & Foot Massage', 'Focused head and foot care for quick stress and fatigue relief.', 60, 500.00),
  ('Massage Services', 'Balinese Massage', 'A soothing Balinese-inspired massage with rhythmic pressure.', 60, 500.00),
  ('Massage Services', 'Aromatherapy', 'A calming massage experience enhanced with aromatic oils.', 60, 550.00),
  ('Massage Services', 'Filipino Hilot', 'Traditional Filipino bodywork for deep comfort and release.', 60, 700.00),
  ('Massage Services', 'Moxa Ventosa', 'Ventosa-style bodywork with warming moxa-inspired care.', 60, 700.00),
  ('Massage Services', 'Combination Massage', 'A longer session combining multiple massage techniques.', 90, 700.00),
  ('Massage Services', 'Thai Massage', 'Assisted stretching and pressure for mobility-focused relief.', 90, 800.00),
  ('Massage Services', 'Volcanic Hot Stone Massage', 'Warm stone massage for deeper muscle relaxation.', 90, 800.00),
  ('Massage Services', 'Pre Natal Massage', 'Gentle pregnancy-supportive massage for prenatal comfort.', 90, 800.00),
  ('Massage Services', 'Post Natal Massage', 'Gentle postnatal massage for recovery and comfort.', 90, 800.00),
  ('Massage Services', 'Sports Massage', 'Firm recovery-focused massage for active bodies.', 90, 800.00),
  ('Massage Services', 'Hawaiian Lomi Lomi Massage', 'Flowing Lomi Lomi-inspired massage for full-body calm.', 90, 900.00),
  ('Massage Services', 'Moxa Ventosa w/ Pinoy Ginhawa', 'A longer moxa ventosa service with Pinoy Ginhawa bodywork.', 90, 900.00),
  ('Massage Services', 'Himalayan Hot Stone Massage', 'Premium hot stone massage with Himalayan-inspired care.', 90, 900.00),
  ('Massage Services', 'Herbal Ball', 'Massage with warmed herbal compress care.', 90, 1000.00),
  ('Massage Services', 'Eco Sculpt Massage', 'Specialty sculpting massage for a premium body care session.', 90, 1500.00),
  ('Massage Services', 'Mandara Massage', 'A premium Mandara-inspired massage for a full restorative escape.', 90, 2000.00),
  ('Salon Services', 'Hair Cut', 'Professional haircut and shaping.', 45, 300.00),
  ('Salon Services', 'Hair Cut with Shampoo', 'Haircut with shampoo service.', 60, 400.00),
  ('Salon Services', 'Shampoo with Blowdry', 'Shampoo service finished with blowdry styling.', 45, 250.00),
  ('Salon Services', 'Shampoo Only', 'Simple shampoo service.', 30, 150.00),
  ('Salon Services', 'Blowdry Only', 'Blowdry service for a polished finish.', 45, 250.00),
  ('Salon Services', 'Blowdry with Style', 'Blowdry with light styling.', 60, 300.00),
  ('Salon Services', 'Hair Iron', 'Hair iron styling service.', 45, 250.00),
  ('Salon Services', 'Hair Style', 'Salon hairstyling for a finished look.', 60, 500.00),
  ('Salon Services', 'Hair Rebond', 'Hair rebonding service with price depending on hair length.', 180, 2500.00),
  ('Salon Services', 'Highlights', 'Hair highlights service with price depending on hair length and design.', 150, 1500.00),
  ('Salon Services', 'Ombre', 'Ombre hair color service.', 180, 3500.00),
  ('Salon Services', 'Balayage', 'Balayage color service.', 180, 3500.00),
  ('Salon Services', 'Kerabond', 'Kerabond hair treatment with consult-based pricing.', 180, 3500.00),
  ('Salon Services', 'Keratin Treatment Short Hair', 'Keratin treatment for short hair.', 120, 1850.00),
  ('Salon Services', 'Keratin Treatment Medium Hair', 'Keratin treatment for medium hair.', 150, 2500.00),
  ('Salon Services', 'Keratin Treatment Long Hair', 'Keratin treatment for long hair.', 180, 3000.00),
  ('Salon Services', 'Metal Detox Treatment Only', 'Metal detox hair treatment.', 75, 850.00),
  ('Salon Services', 'Metal Detox Package', 'Metal detox package treatment.', 120, 1500.00),
  ('Salon Services', 'Power Dose / Power Mix Short Hair', 'Power Dose or Power Mix treatment for short hair.', 75, 800.00),
  ('Salon Services', 'Power Dose / Power Mix Medium Hair', 'Power Dose or Power Mix treatment for medium hair.', 90, 1600.00),
  ('Salon Services', 'Power Dose / Power Mix Long Hair', 'Power Dose or Power Mix treatment for long hair.', 120, 2400.00),
  ('Salon Services', 'Hair Spa Short Hair', 'Hair spa treatment for short hair.', 75, 600.00),
  ('Salon Services', 'Hair Spa Medium Hair', 'Hair spa treatment for medium hair.', 90, 900.00),
  ('Salon Services', 'Hair Spa Long Hair', 'Hair spa treatment for long hair.', 120, 1200.00),
  ('Salon Services', 'Hair Nourishing / Concentrating Vial Treatment', 'Nourishing vial treatment for hair care.', 60, 500.00),
  ('Salon Services', 'Hair Scrub Shampoo', 'Hair scrub shampoo service.', 45, 500.00),
  ('Salon Services', 'Hair Color Rootings / Short Hair', 'Hair color for roots or short hair.', 120, 1300.00),
  ('Salon Services', 'Hair Color Medium Hair', 'Hair color for medium hair.', 150, 2000.00),
  ('Salon Services', 'Hair Color Long Hair', 'Hair color for long hair.', 180, 2500.00),
  ('Salon Services', 'Hair Color Labor', 'Labor-only hair color service.', 90, 500.00),
  ('Salon Services', 'Hair Treatment Labor', 'Labor-only hair treatment service.', 75, 350.00),
  ('Salon Services', 'Foot Scrub', 'Foot scrub service for smoother, refreshed feet.', 45, 300.00),
  ('Salon Services', 'Foot Spa', 'Relaxing foot spa care.', 60, 350.00),
  ('Salon Services', 'Gel Manicure ORLY', 'ORLY gel manicure service.', 60, 500.00),
  ('Salon Services', 'Gel Pedicure ORLY', 'ORLY gel pedicure service.', 75, 600.00),
  ('Salon Services', 'Gel Polish Removal Hands/Feet', 'Gel polish removal for hands or feet.', 30, 200.00),
  ('Salon Services', 'Manicure & Pedicure', 'Classic manicure and pedicure package.', 90, 500.00),
  ('Salon Services', 'Mani-Pedi w/ Foot Spell Spa Package', 'Manicure and pedicure with Foot Spell Spa.', 120, 850.00),
  ('Salon Services', 'Mani-Pedi w/ Foot Scrub Package', 'Manicure and pedicure with foot scrub.', 105, 600.00),
  ('Salon Services', 'Eyelash Extensions Natural Look', 'Natural-look eyelash extension set.', 90, 700.00),
  ('Salon Services', 'Eyelash Extensions Cat Eye', 'Cat-eye eyelash extension set.', 90, 800.00),
  ('Salon Services', 'Eyelash Extensions Open Eye', 'Open-eye eyelash extension set.', 90, 800.00),
  ('Salon Services', 'Eyelash Extensions Mardi Gras Look', 'Mardi Gras look eyelash extension set.', 90, 800.00),
  ('Salon Services', 'Eyelash Extensions Cradle Signature Lash', 'Cradle signature eyelash extension set.', 90, 900.00),
  ('Salon Services', 'Eyelash Perm', 'Eyelash perm service.', 60, 400.00),
  ('Salon Services', 'Eyebrow Threading', 'Eyebrow threading service.', 30, 150.00),
  ('Salon Services', 'Ear Candling', 'Ear candling wellness service.', 45, 450.00),
  ('Salon Services', 'Waxing Underarm', 'Underarm waxing service.', 45, 350.00),
  ('Salon Services', 'Waxing Legs Calf', 'Calf waxing service.', 60, 800.00),
  ('Salon Services', 'Waxing Thighs', 'Thigh waxing service.', 60, 850.00),
  ('Salon Services', 'Waxing Bikini', 'Bikini waxing service.', 60, 800.00),
  ('Salon Services', 'Waxing Hollywood / Brazilian', 'Hollywood or Brazilian waxing service.', 75, 950.00),
  ('Salon Services', 'Waxing Facial / Eyebrows / Beard / Nape', 'Facial, eyebrow, beard, or nape waxing service.', 45, 300.00),
  ('Salon Services', 'Full Hair & Make Up', 'Full hair and makeup service.', 120, 2000.00),
  ('Salon Services', 'Eye Make Up', 'Eye makeup service.', 45, 500.00),
  ('Salon Services', 'Hair Style without Makeup', 'Hair styling without makeup.', 60, 500.00),
  ('Salon Services', 'Make Up Home Service', 'Makeup service outside the spa location.', 120, 2500.00),
  ('Skin Care Services', 'Facial Cleansing with Mask', 'Facial cleansing with mask treatment.', 60, 350.00),
  ('Skin Care Services', 'Organic Facial Cleansing with Mask', 'Organic facial cleansing with mask treatment.', 60, 800.00),
  ('Skin Care Services', 'Cradle Celebrity Facial Package', 'Cradle celebrity facial package.', 90, 1399.00),
  ('Skin Care Services', 'Filipino Coffee Body Scrub', 'Filipino coffee body scrub treatment.', 90, 1499.00),
  ('Skin Care Services', 'Lemon Body Scrub', 'Lemon body scrub treatment.', 90, 1499.00),
  ('Skin Care Services', 'Lux Body Scrub', 'Lux body scrub treatment.', 90, 1499.00),
  ('Skin Care Services', 'Korean Glass Skin Facial', 'Korean glass skin facial treatment.', 60, 799.00),
  ('Skin Care Services', 'Aqua Facial', 'Aqua facial treatment.', 60, 799.00),
  ('Skin Care Services', 'Hydra Facial', 'Hydra facial treatment.', 75, 1500.00),
  ('Skin Care Services', 'Hydra Facial with PDT Package', 'Hydra facial package with PDT light.', 90, 1800.00),
  ('Skin Care Services', 'Oxy Jet Peel Facial', 'Oxy jet peel facial treatment.', 75, 1500.00),
  ('Skin Care Services', 'Oxy Jet Peel Facial with PDT Light', 'Oxy jet peel facial with PDT light.', 90, 1800.00),
  ('Skin Care Services', 'Hydra Dermabrasion + Oxy Jet', 'Hydra dermabrasion with oxy jet treatment.', 90, 1800.00),
  ('Skin Care Services', 'Hydra Dermabrasion + Oxy Jet with PDT Light', 'Hydra dermabrasion and oxy jet with PDT light.', 105, 2100.00),
  ('Skin Care Services', 'Bio Skin Lift Anti-Aging Treatment', 'Bio skin lift anti-aging facial treatment.', 75, 1500.00),
  ('Skin Care Services', 'Bio Skin Lift with PDT Light', 'Bio skin lift treatment with PDT light.', 90, 1800.00),
  ('Skin Care Services', 'PDT Light', 'PDT light skin care add-on.', 30, 450.00),
  ('Skin Care Services', 'Diode Laser Beard', 'Diode laser service for beard area.', 30, 400.00),
  ('Skin Care Services', 'Diode Laser Mustache', 'Diode laser service for mustache area.', 30, 400.00),
  ('Skin Care Services', 'Diode Laser Underarm', 'Diode laser service for underarm area.', 30, 500.00),
  ('Skin Care Services', 'Diode Laser Whole Face', 'Diode laser service for whole face area.', 45, 800.00),
  ('Skin Care Services', 'Diode Laser Chest', 'Diode laser service for chest area.', 45, 800.00),
  ('Skin Care Services', 'Diode Laser Upper / Lower Lip', 'Diode laser service for upper or lower lip.', 30, 800.00),
  ('Skin Care Services', 'Diode Laser Arm', 'Diode laser service for arm area.', 60, 1000.00),
  ('Skin Care Services', 'Diode Laser Bikini', 'Diode laser service for bikini area.', 60, 1799.00),
  ('Skin Care Services', 'Diode Laser Legs', 'Diode laser service for legs.', 75, 2000.00),
  ('Skin Care Services', 'Diode Laser Brazilian', 'Diode laser service for Brazilian area.', 75, 2000.00),
  ('Skin Care Services', 'Diode Laser Whole Body', 'Diode laser whole body service.', 150, 8000.00),
  ('Skin Care Services', 'Pico + Whitening Underarm Package', 'Pico and whitening underarm package.', 60, 1200.00),
  ('Skin Care Services', 'Carbon Laser Treatment Face Area', 'Carbon laser treatment for face area.', 60, 1399.00),
  ('Skin Care Services', 'Carbon Laser Treatment Face Area with PDT Package', 'Carbon laser face treatment with PDT package.', 75, 1799.00),
  ('Skin Care Services', 'Carbon Laser Treatment Underarm Area', 'Carbon laser treatment for underarm area.', 60, 999.00),
  ('Skin Care Services', 'Tattoo Removal Below 3x3 or 2x4 inches', 'Tattoo removal for small areas.', 90, 3500.00),
  ('Skin Care Services', 'Medium Size Tattoo Removal', 'Tattoo removal for medium-sized areas.', 120, 5000.00),
  ('Skin Care Services', 'Pico Tattoo 2 in 1 Face', 'Pico 2 in 1 treatment for face area.', 60, 1200.00),
  ('Skin Care Services', 'Pico Tattoo 2 in 1 Underarm', 'Pico 2 in 1 treatment for underarm area.', 60, 1000.00),
  ('Skin Care Services', 'Pico Tattoo 2 in 1 Bikini', 'Pico 2 in 1 treatment for bikini area.', 75, 3500.00),
  ('Skin Care Services', 'Pico Tattoo 2 in 1 Legs', 'Pico 2 in 1 treatment for legs.', 75, 2000.00),
  ('Skin Care Services', 'Pico Tattoo 2 in 1 Others', 'Pico 2 in 1 treatment for other areas.', 75, 2000.00),
  ('Divine Renewal Packages', 'Serenity Soles', 'Mani-pedi with Foot Spell Spa package.', 120, 799.00),
  ('Divine Renewal Packages', 'Halo Massage Escape', 'Combination Massage 1.5 hrs plus Organic Facial Cleansing with Mask.', 150, 1299.00),
  ('Divine Renewal Packages', 'Halo Glow Mini', 'Korean Glass Skin Facial plus Mani-Pedi with Foot Scrub Package.', 150, 1349.00),
  ('Divine Renewal Packages', 'Weekday Wind Down', 'Moxa Ventosa with Pinoy Ginhawa plus Mani-Pedi with Foot Spell Spa.', 180, 1499.00),
  ('Divine Renewal Packages', 'Seraphic Beauty Ritual', 'Mani-Pedi with Foot Spell Spa Package plus Cradle Celebrity Facial Package.', 180, 2049.00),
  ('Divine Renewal Packages', 'Tranquil Touch Package', 'Mani-Pedi with Foot Spell Spa, Combination Massage, and Organic Facial Cleansing.', 210, 2199.00),
  ('Divine Renewal Packages', 'Serenity Detox Package', 'Facial cleansing with mask, Mandara Massage, and Ear Candling Service.', 210, 2449.00),
  ('Divine Renewal Packages', 'Celestial Glow Package', 'Celebrity facial, Moxa Ventosa with Pinoy Ginhawa, mani-pedi, and ear candling.', 240, 3049.00),
  ('Divine Renewal Packages', 'Divine Renewal Package', 'Bio Skin Lift with PDT Lighting, Himalayan Hot Stone, mani-pedi, and haircut with shampoo.', 270, 3499.00),
  ('Divine Renewal Packages', 'Heavenly Harmony Couples or Besties Spa', 'Two-person spa package for couples or besties.', 240, 6299.00),
  ('Spa Party Packages', 'Alexandrite Package', 'Spa party package for 10 pax with 4 spa specialists, consumable for 3 hours.', 180, 5000.00),
  ('Spa Party Packages', 'Aquamarine Package', 'Spa party package for 15 pax with 5 spa specialists, consumable for 4 hours.', 240, 8000.00),
  ('Spa Party Packages', 'Peridot Package', 'Spa party package for 20 pax with 7 spa specialists, consumable for 5 hours.', 300, 10000.00)
)
INSERT INTO public.services (category_id, name, description, duration_minutes, price, buffer_before, buffer_after, is_active)
SELECT
  categories.id,
  catalog.service_name,
  catalog.description,
  catalog.duration_minutes,
  catalog.price,
  0,
  10,
  TRUE
FROM catalog
JOIN public.service_categories categories
  ON categories.name = catalog.category_name
WHERE NOT EXISTS (
  SELECT 1
  FROM public.services existing
  WHERE existing.category_id = categories.id
    AND lower(existing.name) = lower(catalog.service_name)
);
