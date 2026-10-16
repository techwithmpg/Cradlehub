-- Tighten the duration policy check constraint on public.services:
-- extendable services must have extension_price > 0 (zero-price extensions are rejected).

alter table public.services
  drop constraint if exists services_duration_policy_valid;

alter table public.services
  add constraint services_duration_policy_valid check (
    (duration_policy = 'fixed'
      and extension_increment_minutes is null
      and extension_price is null
      and maximum_duration_minutes is null)
    or
    (duration_policy = 'extendable'
      and extension_increment_minutes is not null
      and extension_increment_minutes > 0
      and extension_price is not null
      and extension_price > 0
      and maximum_duration_minutes is not null
      and maximum_duration_minutes > duration_minutes
      and mod(maximum_duration_minutes - duration_minutes, extension_increment_minutes) = 0)
  );

comment on constraint services_duration_policy_valid on public.services is
  'Extendable services require strictly positive extension_price (> 0) and aligned duration increments.';
