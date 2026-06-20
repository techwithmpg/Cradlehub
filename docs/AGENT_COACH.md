# Cradle Coach — AI Agent Swarm

> CRM-first, suggest-only, fully audited.

## Overview

Cradle Coach is an AI agent swarm that helps CradleHub users learn the system, complete tasks, and stay on top of operations. The first implementation is a **CRM Coach** for front-desk and CSR users.

## Current Scope

- **Workspaces:** CRM (`/crm/*`) and Owner (`/owner/*`)
- **Capabilities:**
  - Answer natural-language questions about CRM pages
  - Offer proactive tips when the user is idle for 45 seconds
  - Suggest one-click links to relevant CRM pages
  - Log every interaction for owner review
- **Limitations:**
  - Suggest-only; does not modify data automatically
  - No owner review UI yet; query `agent_audit_logs` in Supabase Studio

## How It Works

1. The CRM and Owner layouts mount `AgentCoachProvider`, `CoachBubble`, and `InlineTip`.
2. `AgentCoachProvider` tracks page route and idle state from mouse/keyboard events.
3. `CoachBubble` opens a chat sheet. The first message is a context-aware greeting.
4. `InlineTip` fetches a proactive tip from `/api/agent/coach` when the user is idle.
5. `/api/agent/coach` calls Claude with a workspace-specific system prompt and returns a structured reply + up to 3 actions.
6. `/api/agent/act` executes confirmed tool actions (create reminder, check slots, pre-fill booking).
7. `logAgentInteraction` writes every interaction and tool execution to `agent_audit_logs`.

## Configuration

Add to `.env.local` and production environment:

```env
ANTHROPIC_API_KEY=sk-ant-api03-...
AGENT_COACH_WORKSPACES=crm
```

To enable coach on additional workspaces later, add them comma-separated:

```env
AGENT_COACH_WORKSPACES=crm,owner,manager,staff-portal
```

## Files

| Path | Purpose |
|---|---|
| `src/lib/agents/types.ts` | Shared agent types |
| `src/lib/agents/config.ts` | Feature flags |
| `src/lib/agents/audit.ts` | Audit logging |
| `src/lib/agents/crm/prompts.ts` | CRM prompts and actions |
| `src/lib/agents/owner/prompts.ts` | Owner prompts and actions |
| `src/lib/agents/prompts.ts` | Workspace prompt dispatcher |
| `src/app/api/agent/coach/route.ts` | LLM endpoint |
| `src/components/agent/agent-context-provider.tsx` | Context + idle detection |
| `src/components/agent/coach-bubble.tsx` | Chat UI |
| `src/components/agent/inline-tip.tsx` | Proactive tip UI |
| `src/app/(dashboard)/crm/layout.tsx` | CRM mount point |
| `src/app/(dashboard)/owner/layout.tsx` | Owner mount point |
| `supabase/migrations/20260620140000_agent_audit_logs.sql` | Audit table migration |

## Extending to New Workspaces

1. Add workspace-specific prompts under `src/lib/agents/{workspace}/prompts.ts`.
2. Update `AgentWorkspace` in `src/lib/agents/types.ts`.
3. Update the switch in `src/app/api/agent/coach/route.ts`.
4. Mount the coach components in the workspace layout.

## Audit Schema

Table: `public.agent_audit_logs`

| Column | Notes |
|---|---|
| `session_id` | Groups messages in one chat session |
| `type` | `coach_message`, `proactive_nudge`, `action_shown`, `action_clicked` |
| `workspace` | Which workspace the user was in |
| `user_id` | Supabase auth user ID |
| `page` | Route when the interaction happened |
| `role` | User's `system_role` |
| `message` | Full assistant message JSON |
| `action` | Clicked/shown action JSON |
| `metadata` | Extra context |
| `created_at` | Timestamp |

RLS allows only active `owner` role users to read the logs.

## Available Tools

All tools are **suggest-only**. The assistant proposes an action; the user taps to confirm before anything happens.

| Tool | What it does | Example prompt |
|---|---|---|
| `create_reminder_task` | Creates a CRM `workflow_task` with title, body, and due time | "Remind me to call Anna about her booking" |
| `check_available_slots` | Calls `get_available_slots` for a service on a date | "When is Anna free for Swedish massage tomorrow?" |
| `prefill_walk_in_booking` | Opens `/crm/bookings/new` with branch/customer/service/date pre-filled | "Book a walk-in for customer X tomorrow" |

To add a new tool:
1. Add the action key to `AgentActionKey` in `src/lib/agents/types.ts`.
2. Implement the tool in `src/lib/agents/tools.ts`.
3. Describe it in `src/lib/agents/crm/prompts.ts`.
4. Handle any special UI behavior in `src/components/agent/coach-bubble.tsx`.
