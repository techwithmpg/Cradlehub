# HANDOFF — Next Agent Session

## Current Task

AGENT-CRM-COACH-001 — CRM AI Coach MVP is code-complete locally.

## What Was Done

- Built a Claude 3.5 Sonnet powered CRM coach:
  - `/api/agent/coach` route with structured output
  - Floating `CoachBubble` chat UI on all `/crm/*` pages
  - Proactive `InlineTip` after 45 seconds of inactivity
  - Audit logging to `agent_audit_logs`
- Added migration `20260620140000_agent_audit_logs.sql`.
- Updated `.env.example` with `ANTHROPIC_API_KEY` and `AGENT_COACH_WORKSPACES`.
- All checks pass: type-check, lint, tests, build.

## Blockers / Pending

1. Live Supabase migration not yet applied (same network/CLI hang issue as previous tasks).
2. `ANTHROPIC_API_KEY` must be added to `.env.local` and production env vars.
3. Owner review UI for audit logs not built.

## Next Logical Steps

1. Apply the migration to live Supabase once CLI connectivity is restored.
2. Add `ANTHROPIC_API_KEY` to environment.
3. Smoke-test the coach in `/crm/today`:
   - Open the chat bubble
   - Ask "How do I create a walk-in booking?"
   - Leave the page idle for 45s and confirm the inline tip appears
4. Expand to owner/manager/staff-portal workspaces.
5. Add safe one-click actions with confirm flow (e.g., pre-fill booking form, create workflow task).

## Files to Know

- `src/lib/agents/` — core agent logic
- `src/app/api/agent/coach/route.ts` — LLM endpoint
- `src/components/agent/` — UI components
- `src/app/(dashboard)/crm/layout.tsx` — CRM mount point
- `supabase/migrations/20260620140000_agent_audit_logs.sql` — pending migration

## Notes

- The coach is suggest-only. It does not mutate data.
- Only the CRM workspace is enabled by default (`AGENT_COACH_WORKSPACES=crm`).
- All agent interactions are logged for owner review.
