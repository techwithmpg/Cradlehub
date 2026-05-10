# HANDOFF — SPACES-RULES-001 Shared Spaces & Rules Workspace

## Date
2026-05-10

## Agent
Kimi

## Summary
Built a shared Spaces & Rules workspace for Owner, Manager, and CRM. Reuses existing `BranchResourcesManager` and `BranchBookingRulesForm` components. New components handle orchestration, KPIs, tabs, conflict detection, and a detail rail. CRM gets a read-only view with the Booking Rules tab hidden.

## Files Changed

### Created:
- `src/components/features/spaces-rules/spaces-rules-workspace.tsx` — shared orchestrator
- `src/components/features/spaces-rules/spaces-rules-utils.ts` — pure utilities and conflict detection
- `src/components/features/spaces-rules/spaces-rules-header.tsx` — context-aware header
- `src/components/features/spaces-rules/spaces-rules-kpi-cards.tsx` — KPI cards (CRM hides Active Rules)
- `src/components/features/spaces-rules/spaces-rules-tabs.tsx` — tab nav (CRM hides Booking Rules)
- `src/components/features/spaces-rules/overview-tab.tsx` — inventory + schedule + alerts
- `src/components/features/spaces-rules/spaces-tab.tsx` — filter bar + BranchResourcesManager
- `src/components/features/spaces-rules/booking-rules-tab.tsx` — rules form + impact preview
- `src/components/features/spaces-rules/rule-impact-preview.tsx` — read-only rule summary
- `src/components/features/spaces-rules/conflicts-tab.tsx` — conflict list with severity badges
- `src/components/features/spaces-rules/space-detail-panel.tsx` — right rail detail panel
- `src/app/(dashboard)/owner/spaces-rules/page.tsx` — owner route (branch selector, full control)
- `src/app/(dashboard)/manager/spaces-rules/page.tsx` — manager route (locked branch, full control)
- `src/app/(dashboard)/crm/spaces-rules/page.tsx` — CRM route (locked branch, read-only)

### Edited:
- `src/components/features/dashboard/nav-config.ts` — nav updates for owner/manager/CRM
- `src/app/(dashboard)/owner/branches/[branchId]/branch-resources-manager.tsx` — `onRowClick` + `readOnly`
- `next.config.ts` — `/manager/resources` → `/manager/spaces-rules` redirect
- `src/app/api/manager/resource-check/route.ts` — role/branch authorization

## Behavior After Change
- Owner can manage spaces and rules across all branches via `/owner/spaces-rules`.
- Manager can manage spaces and rules for their assigned branch via `/manager/spaces-rules`.
- CRM can view spaces, availability, and conflicts for their assigned branch via `/crm/spaces-rules`.
- CRM cannot add, edit, or deactivate spaces. Cannot view/edit booking rules.
- Old `/manager/resources` redirects to the new workspace.
- Resource check API now validates caller role and branch ownership.

## Verification
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing (0 errors, 0 warnings)
- `pnpm build`: ✅ Passing, 69 app routes

## Remaining Notes
- Booking Rules tab is hidden for CRM. If read-only viewing of rules is desired later, add a `readOnly` prop to `BranchBookingRulesForm`.
- Weekly/future conflict detection is not implemented — only today's bookings are checked.
- `BranchResourcesManager` edit button now stops propagation so row clicks and edit clicks don't conflict.
