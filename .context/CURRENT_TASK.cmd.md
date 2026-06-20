# Current Task - AGENT-CRM-COACH-001

Status: CODE_COMPLETE_LOCAL / PUSHED_TO_GITHUB / LIVE_DB_BLOCKED
Started: 2026-06-20
Local code completed: 2026-06-20

## Description

Build the first CradleHub AI agent — a CRM Coach that guides CRM/front-desk users through the system, detects idle users, offers proactive inline tips, answers natural-language questions, and suggests one-click actions. All interactions are logged for owner review.

## Implemented

- Installed `ai` and `@ai-sdk/anthropic` for LLM calls.
- Added `ANTHROPIC_API_KEY` and `AGENT_COACH_WORKSPACES` to `.env.example`.
- Created agent core under `src/lib/agents/`:
  - `types.ts` — shared agent types and action keys
  - `config.ts` — feature flags and workspace enablement
  - `audit.ts` — immutable audit logging to `agent_audit_logs`
  - `crm/prompts.ts` — CRM system prompt, suggested actions, proactive greetings
- Created `/api/agent/coach` POST route using Anthropic Claude (`claude-sonnet-4-6`) with structured output (reply + up to 3 actions).
- Created client components:
  - `src/components/agent/agent-context-provider.tsx` — tracks page context and idle state
  - `src/components/agent/coach-bubble.tsx` — floating chat bubble widget with one-click tool confirmation
  - `src/components/agent/inline-tip.tsx` — proactive tip that appears after 45s of inactivity
- Added agent tools under `src/lib/agents/tools.ts`:
  - `create_reminder_task` — creates a CRM workflow task/reminder
  - `check_available_slots` — queries `get_available_slots` for a service/date
  - `prefill_walk_in_booking` — opens `/crm/bookings/new` with pre-filled details
- Added `/api/agent/act` route to execute tool actions with user confirmation and audit logging.
- Mounted coach in `src/app/(dashboard)/crm/layout.tsx` so it appears on every CRM page.
- Added migration `supabase/migrations/20260620140000_agent_audit_logs.sql` with RLS policy for owner review.
- Updated generated `src/types/supabase.ts` with the new `agent_audit_logs` table.

## Verification

- `pnpm type-check`: PASS
- `pnpm lint`: PASS (0 errors, 4 pre-existing warnings)
- `pnpm test -- --run`: PASS, 52 files / 528 tests
- `pnpm build`: PASS, 101 routes

## Blocked / Pending

- The new `agent_audit_logs` migration has not been applied to the live Supabase project from this environment.
- `ANTHROPIC_API_KEY` must be added to `.env.local` (and to production env vars) for the coach to respond.
- Owner review UI for `agent_audit_logs` is not yet built; owners can query via Supabase Studio for now.
- Inline tips fetch once per idle episode; future work can refine frequency and add page-specific triggers.
- Tool execution currently requires the assistant to suggest the tool and the user to tap confirm. Future work can add more tools (e.g., record payment reminder, assign therapist).

## Do Not Disturb

- Existing booking lifecycle, schedule engine, RLS policies, and auth routing were not changed.
- Only the CRM workspace is enabled by default; owner/manager/staff-portal expansion is planned.
