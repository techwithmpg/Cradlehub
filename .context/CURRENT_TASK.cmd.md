# CURRENT TASK: SPACES-RULES-001 — Shared Spaces & Rules Workspace (Complete)

## Overview
Implemented a shared "Spaces & Rules" workspace for Owner, Manager, and CRM roles. The workspace reuses existing `BranchResourcesManager` and `BranchBookingRulesForm` components and adds new orchestration, KPIs, tabs, conflict detection, and a detail rail.

## Exact Files Changed

### Files created:
- `src/components/features/spaces-rules/spaces-rules-workspace.tsx`
- `src/components/features/spaces-rules/spaces-rules-utils.ts`
- `src/components/features/spaces-rules/spaces-rules-header.tsx`
- `src/components/features/spaces-rules/spaces-rules-kpi-cards.tsx`
- `src/components/features/spaces-rules/spaces-rules-tabs.tsx`
- `src/components/features/spaces-rules/overview-tab.tsx`
- `src/components/features/spaces-rules/spaces-tab.tsx`
- `src/components/features/spaces-rules/booking-rules-tab.tsx`
- `src/components/features/spaces-rules/rule-impact-preview.tsx`
- `src/components/features/spaces-rules/conflicts-tab.tsx`
- `src/components/features/spaces-rules/space-detail-panel.tsx`
- `src/app/(dashboard)/owner/spaces-rules/page.tsx`
- `src/app/(dashboard)/manager/spaces-rules/page.tsx`
- `src/app/(dashboard)/crm/spaces-rules/page.tsx`

### Files edited:
- `src/components/features/dashboard/nav-config.ts` — added Spaces & Rules to Owner, renamed Manager Spaces, added Spaces to CRM
- `src/app/(dashboard)/owner/branches/[branchId]/branch-resources-manager.tsx` — added `onRowClick` and `readOnly` props
- `next.config.ts` — redirect `/manager/resources` → `/manager/spaces-rules`
- `src/app/api/manager/resource-check/route.ts` — role/branch authorization guard

### Untouched:
- `src/lib/engine/resource-availability.ts`
- `src/lib/engine/availability.ts`
- Booking creation/confirmation actions
- Public booking flow
- Payment logic
- Auth/middleware (except API guard)
- Owner branch detail page (`/owner/branches/[id]`)
- Schema/migrations

## Behavior by Role

**Owner (`/owner/spaces-rules`):**
- Branch selector dropdown
- Full resource CRUD (add/edit/toggle active)
- Full booking rules editing
- Conflict detection
- Resource detail rail with admin actions

**Manager (`/manager/spaces-rules`):**
- Locked branch pill
- Full resource CRUD for assigned branch
- Full booking rules editing for assigned branch
- Conflict detection
- Resource detail rail with admin actions

**CRM (`/crm/spaces-rules`):**
- Locked branch pill
- Read-only resource list (no add/edit/toggle)
- Booking Rules tab hidden
- Conflict detection (read-only)
- Resource detail rail without admin actions
- KPI cards hide "Active Rules"

## Verification
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing (0 errors, 0 warnings)
- `pnpm build`: ✅ Passing, 69 app routes

## Commit Message
```
feat(spaces-rules): expose shared spaces views by workspace
```
