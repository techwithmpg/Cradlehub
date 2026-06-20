-- Agent audit logging table for owner review.
-- Every coach message, proactive nudge, and suggested-action click is stored here.

create table if not exists public.agent_audit_logs (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  type text not null check (type in ('coach_message', 'action_shown', 'action_clicked', 'proactive_nudge')),
  workspace text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  page text not null,
  role text not null,
  message jsonb null,
  action jsonb null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Owner/manager review indexes
comment on table public.agent_audit_logs is 'Immutable log of AI agent interactions for auditing and coaching improvement.';
create index if not exists idx_agent_audit_logs_user_id on public.agent_audit_logs(user_id);
create index if not exists idx_agent_audit_logs_workspace on public.agent_audit_logs(workspace);
create index if not exists idx_agent_audit_logs_created_at on public.agent_audit_logs(created_at desc);

-- RLS: only service-role and owners can read; rows are insert-only by service role.
alter table public.agent_audit_logs enable row level security;

create policy "Owners can read agent audit logs"
  on public.agent_audit_logs
  for select
  to authenticated
  using (
    exists (
      select 1 from public.staff
      where staff.auth_user_id = auth.uid()
        and staff.system_role = 'owner'
        and staff.is_active = true
    )
  );
