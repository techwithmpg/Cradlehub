# HANDOFF — Next Agent Session

## Current Task

AGENT-CRM-COACH-002 — CRM Coach now has three one-click tools.

## What Was Done

- Added tool layer in `src/lib/agents/tools.ts`:
  - `create_reminder_task` — creates a CRM workflow task
  - `check_available_slots` — queries availability for a service/date
  - `prefill_walk_in_booking` — opens booking form with pre-filled details
- Added `/api/agent/act` route to execute confirmed tool actions.
- Updated CRM prompt to describe when to use each tool.
- Updated `CoachBubble` to show confirm buttons and display tool results.
- All tool executions are audited in `agent_audit_logs`.
- All checks pass.

## Blockers / Pending

1. Live Supabase migration `20260620140000_agent_audit_logs.sql` not yet applied.
2. `ANTHROPIC_API_KEY` must be in `.env.local` / production env.

## Next Logical Steps

1. Add more tools:
   - Record payment reminder
   - Assign therapist to booking
   - Check booking status
2. Build follow-up/escalation agent that creates tasks when CRM/owner do not act.
3. Expand coach to owner/manager/staff-portal workspaces.
4. Apply pending migration and smoke-test tools in `/crm/today`.

## Files to Know

- `src/lib/agents/tools.ts` — tool implementations
- `src/app/api/agent/act/route.ts` — tool execution endpoint
- `src/app/api/agent/coach/route.ts` — LLM endpoint
- `src/components/agent/coach-bubble.tsx` — chat UI
- `src/lib/agents/crm/prompts.ts` — tool descriptions for the LLM
