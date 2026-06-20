# Cradle Coach — AI Agent Swarm

> CRM-first, suggest-only, fully audited.

## Overview

Cradle Coach is an AI agent swarm that helps CradleHub users learn the system, complete tasks, and stay on top of operations. The first implementation is a **CRM Coach** for front-desk and CSR users.

## Current Scope

- **Workspace:** CRM (`/crm/*`)
- **Capabilities:**
  - Answer natural-language questions about CRM pages
  - Offer proactive tips when the user is idle for 45 seconds
  - Suggest one-click links to relevant CRM pages
  - Log every interaction for owner review
- **Limitations:**
  - Suggest-only; does not modify data automatically
  - No owner review UI yet; query `agent_audit_logs` in Supabase Studio

## How It Works

1. The CRM layout mounts `AgentCoachProvider`, `CoachBubble`, and `InlineTip`.
2. `AgentCoachProvider` tracks page route and idle state from mouse/keyboard events.
3. `CoachBubble` opens a chat sheet. The first message is a context-aware greeting.
4. `InlineTip` fetches a proactive tip from `/api/agent/coach` when the user is idle.
5. `/api/agent/coach` calls Claude 3.5 Sonnet with a CRM-specific system prompt and returns a structured reply + up to 3 actions.
6. `logAgentInteraction` writes every interaction to `agent_audit_logs`.

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
| `src/app/api/agent/coach/route.ts` | LLM endpoint |
| `src/components/agent/agent-context-provider.tsx` | Context + idle detection |
| `src/components/agent/coach-bubble.tsx` | Chat UI |
| `src/components/agent/inline-tip.tsx` | Proactive tip UI |
| `src/app/(dashboard)/crm/layout.tsx` | CRM mount point |
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
