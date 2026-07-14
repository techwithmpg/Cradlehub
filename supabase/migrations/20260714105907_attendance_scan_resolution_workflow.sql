-- Guided Attendance Recovery lifecycle and staff conversation history.
alter table public.attendance_exceptions
  add column if not exists safe_error_code text,
  add column if not exists category text,
  add column if not exists resolution_owner text,
  add column if not exists resolution_status text not null default 'open',
  add column if not exists staff_response_required boolean not null default false,
  add column if not exists reviewed_by uuid references public.staff(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists resolution_action text,
  add column if not exists technical_context jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

alter table public.attendance_exceptions
  drop constraint if exists attendance_exceptions_resolution_status_check;
alter table public.attendance_exceptions
  add constraint attendance_exceptions_resolution_status_check check (resolution_status in (
    'open', 'reviewed', 'waiting_for_staff', 'waiting_for_crm',
    'waiting_for_technical_support', 'resolved', 'rejected', 'ignored_as_test'
  ));
alter table public.attendance_exceptions
  drop constraint if exists attendance_exceptions_resolution_owner_check;
alter table public.attendance_exceptions
  add constraint attendance_exceptions_resolution_owner_check check (
    resolution_owner is null or resolution_owner in ('automatic', 'staff', 'crm', 'technical_support')
  );

create index if not exists attendance_exceptions_resolution_queue_idx
  on public.attendance_exceptions(branch_id, resolution_status, last_detected_at desc);

create table if not exists public.attendance_issue_messages (
  id uuid primary key default gen_random_uuid(),
  exception_id uuid not null references public.attendance_exceptions(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  sender_staff_id uuid references public.staff(id) on delete set null,
  sender_workspace text not null check (sender_workspace in ('crm', 'staff')),
  message text not null check (char_length(trim(message)) between 1 and 1000),
  response_choices jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists attendance_issue_messages_exception_created_idx
  on public.attendance_issue_messages(exception_id, created_at);
alter table public.attendance_issue_messages enable row level security;

create policy "attendance_issue_messages_staff_read_own" on public.attendance_issue_messages
  for select to authenticated using (staff_id = get_auth_staff_id());
create policy "attendance_issue_messages_staff_respond_own" on public.attendance_issue_messages
  for insert to authenticated with check (
    sender_workspace = 'staff' and staff_id = get_auth_staff_id() and sender_staff_id = get_auth_staff_id()
    and exists (select 1 from public.attendance_exceptions e where e.id = exception_id
      and e.staff_id = get_auth_staff_id() and e.resolution_status = 'waiting_for_staff')
  );
create policy "attendance_issue_messages_crm_branch_read" on public.attendance_issue_messages
  for select to authenticated using (
    get_auth_role() in ('owner','crm','csr','csr_head','csr_staff')
    and (get_auth_role() = 'owner' or branch_id = get_auth_branch_id())
  );

grant select, insert on table public.attendance_issue_messages to authenticated;
grant all on table public.attendance_issue_messages to service_role;
revoke update, delete on table public.attendance_issue_messages from authenticated;

create trigger attendance_exceptions_resolution_updated_at
  before update on public.attendance_exceptions
  for each row execute function public.fn_update_updated_at();

comment on table public.attendance_issue_messages is
  'Append-only Attendance Recovery conversation reused by Staff Portal notifications and CRM.';

notify pgrst, 'reload schema';
