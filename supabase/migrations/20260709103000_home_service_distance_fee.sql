-- CradleHub — CRM Home Service distance fee settings
--
-- Adds explicit branch coordinates for branch-to-customer distance calculation
-- and stores the Home Service travel-fee policy on the existing branch rules
-- table. Defaults match the current business rule: first 5 km free, then
-- PHP 100 per started extra km.

alter table public.branches
  add column if not exists latitude numeric(9,6),
  add column if not exists longitude numeric(9,6);

alter table public.branches
  drop constraint if exists branches_latitude_range,
  drop constraint if exists branches_longitude_range;

alter table public.branches
  add constraint branches_latitude_range
    check (latitude is null or (latitude >= -90 and latitude <= 90)),
  add constraint branches_longitude_range
    check (longitude is null or (longitude >= -180 and longitude <= 180));

comment on column public.branches.latitude is
  'Branch latitude used for CRM Home Service distance and travel-fee calculation.';
comment on column public.branches.longitude is
  'Branch longitude used for CRM Home Service distance and travel-fee calculation.';

with parsed as (
  select
    id,
    regexp_match(
      maps_embed_url,
      '[?&]q=(-?[0-9]+(?:\.[0-9]+)?),(-?[0-9]+(?:\.[0-9]+)?)'
    ) as coords
  from public.branches
  where maps_embed_url is not null
)
update public.branches branch
set
  latitude = coalesce(branch.latitude, (parsed.coords)[1]::numeric),
  longitude = coalesce(branch.longitude, (parsed.coords)[2]::numeric)
from parsed
where branch.id = parsed.id
  and parsed.coords is not null;

alter table public.branch_booking_rules
  add column if not exists home_service_free_km numeric(6,2) not null default 5,
  add column if not exists home_service_extra_km_fee numeric(10,2) not null default 100;

alter table public.branch_booking_rules
  drop constraint if exists branch_booking_rules_home_service_free_km_range,
  drop constraint if exists branch_booking_rules_home_service_extra_km_fee_range;

alter table public.branch_booking_rules
  add constraint branch_booking_rules_home_service_free_km_range
    check (home_service_free_km >= 0 and home_service_free_km <= 100),
  add constraint branch_booking_rules_home_service_extra_km_fee_range
    check (home_service_extra_km_fee >= 0 and home_service_extra_km_fee <= 10000);

comment on column public.branch_booking_rules.home_service_free_km is
  'Free branch-to-customer distance allowance for Home Service bookings.';
comment on column public.branch_booking_rules.home_service_extra_km_fee is
  'PHP fee charged per started kilometer after the free Home Service allowance.';
