# CURRENT TASK: CRM-SCHEDULE-PHASE5-001

## Status
IN_PROGRESS

## Task ID
CRM-SERVICES-PHASE4B-001

## Description
Phase 4B — Enable CRM-managed therapist-service assignments with guardrails.
Turns the read-only provider assignments panel into an editable management experience.
No booking logic changes. No DB schema changes.

## Changes Completed
- New server actions: assignProviderToServiceAction, removeProviderFromServiceAction
- Role guard: CRM_SETUP_ROLES (owner, manager, assistant_manager, store_manager, crm, csr_head)
- Branch scope: action branchId must match caller's branch_id
- Staff eligibility: SERVICE_STAFF_TYPES only, HARD_EXCLUDED_SYSTEM_ROLES blocked, must be active
- Idempotency: no duplicate insertions
- Last-provider protection: blocks removal from public active services with 0 remaining valid providers
- Revalidation: /crm/services, /crm/setup, /crm/today after each successful action
- New client component: ProviderAssignmentCard (per-service interactive card)
  - Provider chips with ✕ remove button
  - Assign dropdown (pre-filtered: valid types, not assigned, active only)
  - Inline success/error feedback + router.refresh() on success
- Panel refactored from client to server/client split (server computes rows, client handles actions)
- MVP access notice added to panel
- ServiceRow shared type in types.ts

## New Files
- src/app/(dashboard)/crm/services/actions.ts
- src/components/features/crm/services/provider-assignment-card.tsx
- src/components/features/crm/services/types.ts

## Modified Files
- src/components/features/crm/services/crm-service-therapist-panel.tsx (refactored)
- src/app/(dashboard)/crm/services/page.tsx (pass branchId to panel)

## Agent
Claude Code (main branch, E:/cradlehub)

## Branch
main

## Build Status
- npx tsc --noEmit: ✅ PASS (0 errors)
- eslint (changed files): ✅ PASS (0 warnings)
