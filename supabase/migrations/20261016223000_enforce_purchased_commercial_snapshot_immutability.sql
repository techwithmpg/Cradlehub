-- =============================================================================
-- CradleHub — Enforce Purchased Commercial Duration Snapshot Immutability
-- =============================================================================
-- Purchased commercial terms are immutable historical agreements formed at booking
-- creation. This forward migration extends apply_purchased_service_duration_snapshot
-- to trigger on BEFORE UPDATE as well as BEFORE INSERT:
--
-- 1. On INSERT: validates commercial snapshot and sets session_duration_minutes_snapshot.
-- 2. On UPDATE: strictly rejects any alteration or removal of commercial_snapshot.
-- 3. On UPDATE: strictly rejects changing service_id for lines with a commercial snapshot.
-- 4. On UPDATE: preserves session_duration_minutes_snapshot against tampering or timing trigger resets.
-- 5. On UPDATE: permits all operational updates (status, staff, time, payment, other metadata).
-- 6. Historical compatibility: preserves existing rows without commercial_snapshot untouched.
-- =============================================================================

create or replace function public.apply_purchased_service_duration_snapshot()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_snapshot jsonb;
  v_selected text;
begin
  if tg_op = 'INSERT' then
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
  elsif tg_op = 'UPDATE' then
    -- If a commercial snapshot was recorded at purchase, its commercial terms are immutable.
    if old.metadata ? 'commercial_snapshot' then
      -- 1. Metadata commercial snapshot cannot be altered or removed
      if new.metadata->'commercial_snapshot' is distinct from old.metadata->'commercial_snapshot' then
        raise exception 'COMMERCIAL_SNAPSHOT_IMMUTABLE' using errcode = '22023';
      end if;
      -- 2. Service ID cannot be altered on a line with a purchased commercial snapshot
      if new.service_id is distinct from old.service_id then
        raise exception 'COMMERCIAL_SERVICE_IMMUTABLE' using errcode = '22023';
      end if;
      -- 3. Purchased operational treatment duration is immutable; restore it if overwritten by timing triggers
      new.session_duration_minutes_snapshot := old.session_duration_minutes_snapshot;
    else
      -- Historical lines without commercial_snapshot: do not permit retroactive commercial_snapshot injection on update
      if new.metadata ? 'commercial_snapshot' then
        raise exception 'COMMERCIAL_SNAPSHOT_CANNOT_BE_ADDED_ON_UPDATE' using errcode = '22023';
      end if;
    end if;
    return new;
  end if;
  return new;
end;
$$;

-- Drop and recreate trigger so it fires BEFORE INSERT OR UPDATE
drop trigger if exists trg_z_apply_purchased_service_duration_snapshot on public.bookings;
create trigger trg_z_apply_purchased_service_duration_snapshot
before insert or update on public.bookings
for each row execute function public.apply_purchased_service_duration_snapshot();

comment on function public.apply_purchased_service_duration_snapshot() is
  'Initializes session duration on insert from validated purchased line snapshot and strictly enforces commercial snapshot and duration immutability on updates. Preserves historical rows.';
