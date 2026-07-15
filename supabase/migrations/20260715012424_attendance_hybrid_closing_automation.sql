-- Attendance hybrid closing automation
--
-- Closing deadlines continue to be snapshotted when the Attendance record is
-- inserted. This migration replaces the legacy all-stages worker with one
-- bounded stage processor intended for four direct pg_cron calls per day.
-- Intervention, notification, task, correction, and exception writes occur only
-- when an open live CRM/CSR closing record is actually due.

create index if not exists staff_shift_checkins_crm_closing_reminder_due_idx
  on public.staff_shift_checkins (clock_out_reminder_at)
  where status = 'checked_in'
    and checked_out_at is null
    and attendance_policy_source = 'crm_closing'
    and clock_out_reminder_at is not null
    and provisional_auto_closed_at is null
    and is_test = false;

create index if not exists staff_shift_checkins_crm_closing_escalation_due_idx
  on public.staff_shift_checkins (manager_escalation_at)
  where status = 'checked_in'
    and checked_out_at is null
    and attendance_policy_source = 'crm_closing'
    and manager_escalation_at is not null
    and provisional_auto_closed_at is null
    and is_test = false;

create index if not exists staff_shift_checkins_crm_closing_auto_close_due_idx
  on public.staff_shift_checkins (provisional_clock_out_at)
  where status = 'checked_in'
    and checked_out_at is null
    and attendance_policy_source = 'crm_closing'
    and provisional_clock_out_at is not null
    and provisional_auto_closed_at is null
    and is_test = false;

create or replace function public.process_due_attendance_closing_interventions(
  p_stage text,
  p_processed_at timestamptz default now(),
  p_batch_size integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_stage text := lower(trim(coalesce(p_stage, '')));
  v_processed_at timestamptz := coalesce(p_processed_at, now());
  v_batch_size integer := greatest(1, least(coalesce(p_batch_size, 50), 200));
  v_due_query text;
  v_record record;
  v_intervention public.attendance_closing_interventions%rowtype;
  v_exception_id uuid;
  v_staff_name text;
  v_dedupe_key text;
  v_exception_dedupe_key text;
  v_notification_key text;
  v_task_key text;
  v_signal_stage text;
  v_title text;
  v_body text;
  v_target_workspace text;
  v_target_role text;
  v_recipient_staff_id uuid;
  v_notification_type text;
  v_priority text;
  v_requires_action boolean;
  v_task_required boolean;
  v_active_service boolean;
  v_notification_ready boolean;
  v_task_ready boolean;
  v_did_apply boolean;
  v_row_count integer;
  v_worked_minutes integer;
  v_examined integer := 0;
  v_applied integer := 0;
  v_skipped integer := 0;
  v_failed integer := 0;
  v_auto_closed integer := 0;
  v_active_service_blocks integer := 0;
  v_reminder_summary jsonb;
  v_escalation_summary jsonb;
  v_auto_close_summary jsonb;
begin
  if v_stage not in ('reminder', 'manager_escalation', 'auto_close', 'catch_up') then
    raise exception using
      errcode = '22023',
      message = 'Unsupported Attendance closing intervention stage.';
  end if;

  if v_stage = 'catch_up' then
    v_reminder_summary := public.process_due_attendance_closing_interventions(
      'reminder', v_processed_at, v_batch_size
    );
    v_escalation_summary := public.process_due_attendance_closing_interventions(
      'manager_escalation', v_processed_at, v_batch_size
    );
    v_auto_close_summary := public.process_due_attendance_closing_interventions(
      'auto_close', v_processed_at, v_batch_size
    );

    return jsonb_build_object(
      'stage', 'catch_up',
      'processedAt', v_processed_at,
      'batchSize', v_batch_size,
      'examined', coalesce((v_reminder_summary->>'examined')::integer, 0)
        + coalesce((v_escalation_summary->>'examined')::integer, 0)
        + coalesce((v_auto_close_summary->>'examined')::integer, 0),
      'applied', coalesce((v_reminder_summary->>'applied')::integer, 0)
        + coalesce((v_escalation_summary->>'applied')::integer, 0)
        + coalesce((v_auto_close_summary->>'applied')::integer, 0),
      'skipped', coalesce((v_reminder_summary->>'skipped')::integer, 0)
        + coalesce((v_escalation_summary->>'skipped')::integer, 0)
        + coalesce((v_auto_close_summary->>'skipped')::integer, 0),
      'failed', coalesce((v_reminder_summary->>'failed')::integer, 0)
        + coalesce((v_escalation_summary->>'failed')::integer, 0)
        + coalesce((v_auto_close_summary->>'failed')::integer, 0),
      'autoClosed', coalesce((v_auto_close_summary->>'autoClosed')::integer, 0),
      'activeServiceBlocks', coalesce((v_auto_close_summary->>'activeServiceBlocks')::integer, 0),
      'stages', jsonb_build_array(
        v_reminder_summary, v_escalation_summary, v_auto_close_summary
      )
    );
  end if;

  if v_stage = 'reminder' then
    v_due_query := $query$
      select checkin.id,
             checkin.branch_id,
             checkin.staff_id,
             checkin.attendance_business_date,
             checkin.shift_date,
             checkin.attendance_policy_snapshot,
             checkin.clock_out_reminder_at as due_at
      from public.staff_shift_checkins as checkin
      where checkin.status = 'checked_in'
        and checkin.checked_out_at is null
        and checkin.attendance_policy_source = 'crm_closing'
        and checkin.clock_out_reminder_at is not null
        and checkin.clock_out_reminder_at <= $1
        and checkin.provisional_auto_closed_at is null
        and checkin.is_test = false
        and exists (
          select 1 from public.branches as branch
          where branch.id = checkin.branch_id and branch.is_active = true
        )
      order by checkin.clock_out_reminder_at, checkin.id
      for update of checkin skip locked
      limit $2
    $query$;
  elsif v_stage = 'manager_escalation' then
    v_due_query := $query$
      select checkin.id,
             checkin.branch_id,
             checkin.staff_id,
             checkin.attendance_business_date,
             checkin.shift_date,
             checkin.attendance_policy_snapshot,
             checkin.manager_escalation_at as due_at
      from public.staff_shift_checkins as checkin
      where checkin.status = 'checked_in'
        and checkin.checked_out_at is null
        and checkin.attendance_policy_source = 'crm_closing'
        and checkin.manager_escalation_at is not null
        and checkin.manager_escalation_at <= $1
        and checkin.provisional_auto_closed_at is null
        and checkin.is_test = false
        and exists (
          select 1 from public.branches as branch
          where branch.id = checkin.branch_id and branch.is_active = true
        )
      order by checkin.manager_escalation_at, checkin.id
      for update of checkin skip locked
      limit $2
    $query$;
  else
    v_due_query := $query$
      select checkin.id,
             checkin.branch_id,
             checkin.staff_id,
             checkin.attendance_business_date,
             checkin.shift_date,
             checkin.checked_in_at,
             checkin.provisional_clock_out_at,
             checkin.hard_cutoff_at as due_at,
             checkin.late_minutes,
             checkin.attendance_policy_snapshot
      from public.staff_shift_checkins as checkin
      where checkin.status = 'checked_in'
        and checkin.checked_out_at is null
        and checkin.attendance_policy_source = 'crm_closing'
        and checkin.provisional_clock_out_at is not null
        and checkin.provisional_clock_out_at <= $1
        and checkin.hard_cutoff_at is not null
        and checkin.hard_cutoff_at <= $1
        and checkin.provisional_auto_closed_at is null
        and checkin.is_test = false
        and exists (
          select 1 from public.branches as branch
          where branch.id = checkin.branch_id and branch.is_active = true
        )
      order by checkin.provisional_clock_out_at, checkin.id
      for update of checkin skip locked
      limit $2
    $query$;
  end if;

  for v_record in execute v_due_query using v_processed_at, v_batch_size
  loop
    v_examined := v_examined + 1;
    v_did_apply := false;
    v_intervention := null;
    v_exception_id := null;

    begin
      if v_stage = 'auto_close' then
        select exists (
          select 1
          from public.bookings as booking
          where booking.branch_id = v_record.branch_id
            and booking.staff_id = v_record.staff_id
            and booking.status = 'in_progress'
            and booking.booking_progress_status = 'session_started'
            and booking.session_completed_at is null
        ) and coalesce(
          (v_record.attendance_policy_snapshot->>'activeServiceBlocksClockOut')::boolean,
          true
        )
        into v_active_service;

        if v_active_service then
          v_signal_stage := 'active_service_blocked';
          v_dedupe_key := concat_ws(
            ':', 'crm-closing', v_record.branch_id, v_record.staff_id,
            coalesce(v_record.attendance_business_date, v_record.shift_date),
            'active-service-blocked'
          );

          insert into public.attendance_closing_interventions (
            branch_id, staff_id, checkin_id, attendance_business_date, stage,
            dedupe_key, due_at, policy_snapshot, applied_at
          ) values (
            v_record.branch_id, v_record.staff_id, v_record.id,
            coalesce(v_record.attendance_business_date, v_record.shift_date),
            v_signal_stage, v_dedupe_key, v_record.due_at,
            v_record.attendance_policy_snapshot, v_processed_at
          )
          on conflict (checkin_id, stage) do nothing
          returning * into v_intervention;

          if v_intervention.id is null then
            select * into v_intervention
            from public.attendance_closing_interventions
            where checkin_id = v_record.id and stage = v_signal_stage;
          else
            v_did_apply := true;
          end if;

          v_exception_dedupe_key := concat_ws(
            '|', v_record.staff_id, v_record.id,
            'active_service_at_closing_cutoff', 'live'
          );
          select exception_row.id into v_exception_id
          from public.attendance_exceptions as exception_row
          where exception_row.branch_id = v_record.branch_id
            and exception_row.dedupe_key = v_exception_dedupe_key
            and exception_row.status = 'open'
          limit 1
          for update;

          if v_exception_id is null then
            insert into public.attendance_exceptions (
              branch_id, staff_id, checkin_id, exception_type, severity, message,
              metadata, dedupe_key, recommended_action, priority,
              staff_response_required, related_checkin_ids, is_test
            ) values (
              v_record.branch_id, v_record.staff_id, v_record.id,
              'active_service', 'warning',
              'Active service prevented the CRM closing attendance auto-close.',
              jsonb_build_object(
                'internalExceptionType', 'active_service_at_closing_cutoff',
                'policySnapshot', v_record.attendance_policy_snapshot
              ),
              v_exception_dedupe_key, 'review_active_service', 'high', false,
              array[v_record.id], false
            );
            v_did_apply := true;
          end if;

          v_active_service_blocks := v_active_service_blocks + 1;
        else
          v_signal_stage := 'auto_close';
          v_dedupe_key := concat_ws(
            ':', 'crm-closing', v_record.branch_id, v_record.staff_id,
            coalesce(v_record.attendance_business_date, v_record.shift_date),
            'auto-close'
          );
          v_worked_minutes := greatest(
            0,
            round(extract(epoch from (
              v_record.provisional_clock_out_at - v_record.checked_in_at
            )) / 60.0)::integer
          );

          update public.staff_shift_checkins
          set checked_out_at = provisional_clock_out_at,
              status = 'checked_out',
              clock_out_method = 'system_auto_close',
              clock_out_scan_event_id = null,
              worked_minutes = v_worked_minutes,
              early_leave_minutes = 0,
              overtime_minutes = 0,
              attendance_status = case when late_minutes > 0 then 'late' else 'present' end,
              exception_state = 'open',
              provisional_auto_closed_at = v_processed_at,
              clock_out_confirmation_required = true,
              notes = format(
                'Auto-closed at %s · Confirmation required',
                to_char(
                  v_record.provisional_clock_out_at at time zone coalesce(
                    v_record.attendance_policy_snapshot->>'timezone', 'Asia/Manila'
                  ),
                  'FMHH12:MI AM'
                )
              ),
              updated_at = v_processed_at
          where id = v_record.id
            and status = 'checked_in'
            and checked_out_at is null
            and provisional_auto_closed_at is null;
          get diagnostics v_row_count = row_count;

          if v_row_count = 0 then
            v_skipped := v_skipped + 1;
            continue;
          end if;

          v_exception_dedupe_key := concat_ws(
            '|', v_record.staff_id, v_record.id, 'missing_clock_out', 'live'
          );
          select exception_row.id into v_exception_id
          from public.attendance_exceptions as exception_row
          where exception_row.branch_id = v_record.branch_id
            and exception_row.dedupe_key = v_exception_dedupe_key
            and exception_row.status = 'open'
          limit 1
          for update;

          if v_exception_id is null then
            insert into public.attendance_exceptions (
              branch_id, staff_id, checkin_id, exception_type, severity, message,
              metadata, dedupe_key, recommended_action, priority,
              staff_response_required, related_checkin_ids, is_test
            ) values (
              v_record.branch_id, v_record.staff_id, v_record.id,
              'missed_checkout', 'warning',
              format(
                'Auto-closed at %s · Confirmation required',
                to_char(
                  v_record.provisional_clock_out_at at time zone coalesce(
                    v_record.attendance_policy_snapshot->>'timezone', 'Asia/Manila'
                  ),
                  'FMHH12:MI AM'
                )
              ),
              jsonb_build_object(
                'internalExceptionType', 'missing_clock_out',
                'provisionalClockOutAt', v_record.provisional_clock_out_at,
                'autoClosedAt', v_processed_at,
                'policySnapshot', v_record.attendance_policy_snapshot
              ),
              v_exception_dedupe_key, 'confirm_actual_clock_out', 'high', true,
              array[v_record.id], false
            ) returning id into v_exception_id;
          end if;

          insert into public.attendance_corrections (
            branch_id, staff_id, checkin_id, exception_id, attendance_date,
            correction_type, action_type, previous_values, new_values, reason,
            status, applied_at, corrected_at, is_test
          )
          select
            v_record.branch_id, v_record.staff_id, v_record.id, v_exception_id,
            coalesce(v_record.attendance_business_date, v_record.shift_date),
            'system_auto_close', 'system_auto_close',
            jsonb_build_object(
              'checkedOutAt', null,
              'status', 'checked_in',
              'clockOutMethod', null,
              'confirmationRequired', false
            ),
            jsonb_build_object(
              'checkedOutAt', v_record.provisional_clock_out_at,
              'clockOutMethod', 'system_auto_close',
              'confirmationRequired', true
            ),
            'CRM closing hard cutoff reached without a real clock-out scan.',
            'applied', v_processed_at, v_processed_at, false
          where not exists (
            select 1 from public.attendance_corrections as correction
            where correction.checkin_id = v_record.id
              and correction.correction_type = 'system_auto_close'
              and correction.is_test = false
          );

          insert into public.attendance_closing_interventions (
            branch_id, staff_id, checkin_id, attendance_business_date, stage,
            dedupe_key, due_at, policy_snapshot, applied_at
          ) values (
            v_record.branch_id, v_record.staff_id, v_record.id,
            coalesce(v_record.attendance_business_date, v_record.shift_date),
            v_signal_stage, v_dedupe_key, v_record.due_at,
            v_record.attendance_policy_snapshot, v_processed_at
          )
          on conflict (checkin_id, stage) do nothing
          returning * into v_intervention;

          if v_intervention.id is null then
            select * into v_intervention
            from public.attendance_closing_interventions
            where checkin_id = v_record.id and stage = v_signal_stage;
          end if;

          v_did_apply := true;
          v_auto_closed := v_auto_closed + 1;
        end if;
      else
        v_signal_stage := v_stage;
        v_dedupe_key := concat_ws(
          ':', 'crm-closing', v_record.branch_id, v_record.staff_id,
          coalesce(v_record.attendance_business_date, v_record.shift_date),
          case when v_stage = 'manager_escalation'
            then 'manager-escalation' else 'reminder' end
        );

        insert into public.attendance_closing_interventions (
          branch_id, staff_id, checkin_id, attendance_business_date, stage,
          dedupe_key, due_at, policy_snapshot, applied_at
        ) values (
          v_record.branch_id, v_record.staff_id, v_record.id,
          coalesce(v_record.attendance_business_date, v_record.shift_date),
          v_signal_stage, v_dedupe_key, v_record.due_at,
          v_record.attendance_policy_snapshot, v_processed_at
        )
        on conflict (checkin_id, stage) do nothing
        returning * into v_intervention;

        if v_intervention.id is null then
          select * into v_intervention
          from public.attendance_closing_interventions
          where checkin_id = v_record.id and stage = v_signal_stage;
        else
          v_did_apply := true;
        end if;
      end if;

      if v_intervention.id is null then
        raise exception 'Attendance closing intervention could not be claimed.';
      end if;

      v_notification_key := v_intervention.dedupe_key || ':notification';
      v_task_key := v_intervention.dedupe_key || ':task';
      v_notification_ready := v_intervention.notification_sent_at is not null;
      v_task_ready := v_intervention.workflow_task_sent_at is not null;

      if v_signal_stage = 'reminder' then
        v_target_workspace := 'crm';
        v_target_role := 'crm';
        v_recipient_staff_id := v_record.staff_id;
        v_notification_type := 'attendance_clock_out_reminder';
        v_title := 'Closing shift clock-out reminder';
        v_body := 'Your closing shift is still open. Please scan to clock out.';
        v_priority := 'normal';
        v_requires_action := false;
        v_task_required := false;
      elsif v_signal_stage = 'auto_close' then
        v_target_workspace := 'crm';
        v_target_role := 'crm';
        v_recipient_staff_id := v_record.staff_id;
        v_notification_type := 'attendance_provisional_auto_close';
        v_title := 'Clock-out confirmation required';
        v_body := 'Attendance was provisionally auto-closed at the latest normal clock-out time. A real QR scan will replace it automatically.';
        v_priority := 'high';
        v_requires_action := true;
        v_task_required := true;
      else
        select coalesce(nullif(trim(staff.full_name), ''), 'CRM staff member')
        into v_staff_name
        from public.staff as staff
        where staff.id = v_record.staff_id;
        v_staff_name := coalesce(v_staff_name, 'CRM staff member');
        v_target_workspace := 'manager';
        v_target_role := 'manager';
        v_recipient_staff_id := null;
        v_notification_type := 'attendance_closing_escalation';
        v_title := case when v_signal_stage = 'active_service_blocked'
          then 'Active service blocked closing auto-close'
          else 'Closing shift still open' end;
        v_body := case when v_signal_stage = 'active_service_blocked'
          then format('%s still has an active service at the hard cutoff. Attendance was left open for review.', v_staff_name)
          else format(
            'CRM closing attendance is still open for %s. Expected clock-out was by %s.',
            v_staff_name,
            to_char(
              coalesce(
                nullif(v_record.attendance_policy_snapshot->>'latestNormalClockOutAt', '')::timestamptz,
                v_record.due_at
              ) at time zone coalesce(
                v_record.attendance_policy_snapshot->>'timezone', 'Asia/Manila'
              ),
              'FMHH12:MI AM'
            )
          ) end;
        v_priority := 'high';
        v_requires_action := true;
        v_task_required := true;
      end if;

      if not v_notification_ready then
        insert into public.workspace_notifications (
          branch_id, target_workspace, target_role, recipient_staff_id,
          type, title, body, entity_type, entity_id, action_href,
          priority, status, requires_action, dedupe_key, metadata, created_at
        ) values (
          v_record.branch_id, v_target_workspace, v_target_role,
          v_recipient_staff_id, v_notification_type, v_title, v_body,
          'attendance_record', v_record.id, '/crm/attendance?tab=exceptions',
          v_priority, 'unread', v_requires_action, v_notification_key,
          jsonb_build_object(
            'intervention_id', v_intervention.id,
            'intervention_stage', v_signal_stage,
            'policy_snapshot', v_record.attendance_policy_snapshot
          ),
          v_processed_at
        ) on conflict do nothing;

        select exists (
          select 1 from public.workspace_notifications as notification
          where notification.dedupe_key = v_notification_key
            and notification.status in ('unread', 'read')
        ) into v_notification_ready;
      end if;

      if v_task_required and not v_task_ready then
        insert into public.workflow_tasks (
          branch_id, workspace_scope, assigned_to_role, task_type,
          title, body, entity_type, entity_id, action_href, priority,
          status, due_at, dedupe_key, metadata
        ) values (
          v_record.branch_id, 'manager', 'manager',
          'attendance.crm_closing.' || v_signal_stage,
          v_title, v_body, 'attendance_record', v_record.id,
          '/crm/attendance?tab=exceptions', 'high', 'open',
          v_intervention.due_at, v_task_key,
          jsonb_build_object(
            'intervention_id', v_intervention.id,
            'intervention_stage', v_signal_stage,
            'staff_id', v_record.staff_id
          )
        ) on conflict do nothing;

        select exists (
          select 1 from public.workflow_tasks as task
          where task.dedupe_key = v_task_key
            and task.status in ('open', 'in_progress')
        ) into v_task_ready;
      end if;

      if not v_notification_ready or (v_task_required and not v_task_ready) then
        raise exception 'Attendance closing signal delivery could not be confirmed.';
      end if;

      update public.attendance_closing_interventions
      set notification_sent_at = coalesce(notification_sent_at, v_processed_at),
          workflow_task_sent_at = case
            when v_task_required then coalesce(workflow_task_sent_at, v_processed_at)
            else workflow_task_sent_at
          end,
          delivery_attempts = delivery_attempts + 1,
          last_delivery_error = null,
          updated_at = v_processed_at
      where id = v_intervention.id
        and (
          notification_sent_at is null
          or (v_task_required and workflow_task_sent_at is null)
        );
      get diagnostics v_row_count = row_count;
      if v_row_count > 0 then
        v_did_apply := true;
      end if;

      if v_did_apply then
        v_applied := v_applied + 1;
      else
        v_skipped := v_skipped + 1;
      end if;
    exception
      when others then
        v_failed := v_failed + 1;
    end;
  end loop;

  update public.attendance_settings
  set closing_intervention_last_run_at = v_processed_at,
      closing_intervention_last_error = case
        when v_failed > 0 then 'One or more due Attendance closing records could not be processed.'
        else null
      end
  where crm_closing_policy_enabled = true;

  return jsonb_build_object(
    'stage', v_stage,
    'processedAt', v_processed_at,
    'batchSize', v_batch_size,
    'examined', v_examined,
    'applied', v_applied,
    'skipped', v_skipped,
    'failed', v_failed,
    'autoClosed', v_auto_closed,
    'activeServiceBlocks', v_active_service_blocks
  );
end;
$$;

-- Compatibility wrapper for older server code and support tooling. All closing
-- behavior now delegates to the authoritative stage processor above.
create or replace function public.process_crm_closing_attendance_interventions(
  p_now timestamptz default now(),
  p_limit integer default 100
)
returns table (
  processed_open_records integer,
  created_interventions integer,
  auto_closed_records integer,
  active_service_blocks integer
)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_summary jsonb;
begin
  v_summary := public.process_due_attendance_closing_interventions(
    'catch_up', coalesce(p_now, now()), coalesce(p_limit, 100)
  );
  return query select
    coalesce((v_summary->>'examined')::integer, 0),
    coalesce((v_summary->>'applied')::integer, 0),
    coalesce((v_summary->>'autoClosed')::integer, 0),
    coalesce((v_summary->>'activeServiceBlocks')::integer, 0);
end;
$$;

revoke all on function public.process_due_attendance_closing_interventions(text, timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.process_due_attendance_closing_interventions(text, timestamptz, integer)
  to service_role;

revoke all on function public.process_crm_closing_attendance_interventions(timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.process_crm_closing_attendance_interventions(timestamptz, integer)
  to service_role;

comment on function public.process_due_attendance_closing_interventions(text, timestamptz, integer) is
  'Authoritative bounded and idempotent CRM/CSR closing processor for reminder, manager_escalation, auto_close, and catch_up stages. Intended for direct pg_cron calls and server-only manual fallback.';

comment on index public.staff_shift_checkins_crm_closing_reminder_due_idx is
  'Small due-time index containing only open live CRM/CSR closing records eligible for reminders.';
comment on index public.staff_shift_checkins_crm_closing_escalation_due_idx is
  'Small due-time index containing only open live CRM/CSR closing records eligible for escalation.';
comment on index public.staff_shift_checkins_crm_closing_auto_close_due_idx is
  'Small due-time index containing only open live CRM/CSR closing records eligible for provisional auto-close.';
