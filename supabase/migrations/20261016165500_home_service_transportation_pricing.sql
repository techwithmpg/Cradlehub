-- Migration: 20261016165500_home_service_transportation_pricing.sql
-- Home Service transportation pricing policy:
-- 1. Adds home_service_base_fee to branch_booking_rules.
-- 2. Enforces non-negative constraints for base fee, included distance, and extra km fee.
-- 3. Sets defaults: base fee = 100, free km (included) = 1, extra km fee = 40.
-- 4. Updates existing branch_booking_rules records to established policy (100, 1, 40).

alter table public.branch_booking_rules
  add column if not exists home_service_base_fee numeric(10,2) not null default 100;

alter table public.branch_booking_rules
  alter column home_service_base_fee set default 100,
  alter column home_service_free_km set default 1,
  alter column home_service_extra_km_fee set default 40;

alter table public.branch_booking_rules
  drop constraint if exists branch_booking_rules_home_service_base_fee_range,
  drop constraint if exists branch_booking_rules_home_service_free_km_range,
  drop constraint if exists branch_booking_rules_home_service_extra_km_fee_range;

alter table public.branch_booking_rules
  add constraint branch_booking_rules_home_service_base_fee_range
    check (home_service_base_fee >= 0 and home_service_base_fee <= 50000),
  add constraint branch_booking_rules_home_service_free_km_range
    check (home_service_free_km >= 0 and home_service_free_km <= 100),
  add constraint branch_booking_rules_home_service_extra_km_fee_range
    check (home_service_extra_km_fee >= 0 and home_service_extra_km_fee <= 10000);

comment on column public.branch_booking_rules.home_service_base_fee is
  'Base transportation fee in PHP for Home Service bookings, covering the included distance.';
comment on column public.branch_booking_rules.home_service_free_km is
  'Included branch-to-customer driving distance in kilometers covered by the base transportation fee.';
comment on column public.branch_booking_rules.home_service_extra_km_fee is
  'PHP fee charged per kilometer beyond the included distance for Home Service bookings.';

update public.branch_booking_rules
set
  home_service_base_fee = 100,
  home_service_free_km = 1,
  home_service_extra_km_fee = 40;
