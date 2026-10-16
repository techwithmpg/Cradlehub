-- The existing timing trigger initializes session_duration_minutes_snapshot from
-- the catalog base. A purchased extendable line must initialize its operational
-- session duration from the server-resolved commercial snapshot instead. The
-- commercial agreement itself remains immutable in bookings.metadata.
create or replace function public.apply_purchased_service_duration_snapshot()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_snapshot jsonb;
  v_selected text;
begin
  v_snapshot := new.metadata->'commercial_snapshot';
  if v_snapshot is null then
    return new;
  end if;
  v_selected := v_snapshot->>'selected_duration_minutes';
  if jsonb_typeof(v_snapshot) <> 'object'
     or v_snapshot->>'service_id' is distinct from new.service_id::text
     or coalesce(v_snapshot->>'duration_policy_snapshot', '') not in ('fixed', 'extendable')
     or coalesce(v_selected ~ '^[1-9][0-9]{0,3}$', false) = false then
    raise exception 'INVALID_PURCHASED_SERVICE_DURATION' using errcode = '22023';
  end if;
  if v_selected::integer > 1440 then
    raise exception 'INVALID_PURCHASED_SERVICE_DURATION' using errcode = '22023';
  end if;
  new.session_duration_minutes_snapshot := v_selected::integer;
  return new;
end;
$$;

-- PostgreSQL fires same-event triggers alphabetically. This runs after
-- trg_prepare_booking_timing_snapshots and replaces only the treatment minutes.
drop trigger if exists trg_z_apply_purchased_service_duration_snapshot on public.bookings;
create trigger trg_z_apply_purchased_service_duration_snapshot
before insert on public.bookings
for each row execute function public.apply_purchased_service_duration_snapshot();

comment on function public.apply_purchased_service_duration_snapshot() is
  'Initializes the operational session duration from a validated server-resolved purchased line snapshot. Legacy lines retain existing timing behavior.';
