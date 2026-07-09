-- CradleHub — editable branch location settings
--
-- Stores the Google Places origin selected for a branch so CRM Home Service
-- distance quotes can use branch latitude/longitude as the origin.

alter table public.branches
  add column if not exists place_id text,
  add column if not exists city text,
  add column if not exists barangay text,
  add column if not exists location_metadata jsonb not null default '{}'::jsonb;

comment on column public.branches.place_id is
  'Google Places place id for the branch service origin.';
comment on column public.branches.city is
  'City or municipality derived from the selected Google Places address.';
comment on column public.branches.barangay is
  'Barangay or area derived from the selected Google Places address when available.';
comment on column public.branches.location_metadata is
  'Structured branch location metadata such as formatted address, map URL, source, and address components.';
