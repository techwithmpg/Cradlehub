# CURRENT TASK: CRM-SERVICES-ASSIGNMENTS-001

## Status
COMPLETE

## Task ID
CRM-SERVICES-ASSIGNMENTS-001

## Description
Add Therapist Assignments tab to /crm/services.

Converted the stacked-section layout into a two-tab workspace:
  Tab 1 — Active Services (existing, unchanged)
  Tab 2 — Therapist Assignments (new desktop-first table layout)

The Therapist Assignments tab includes:
- Intro card explaining the assignment requirement
- Stat cards: Active Services count + Services without therapist count
- Filter row: search, category, service type, missing-only toggle
- Desktop assignment table (Service | Category | Assigned Therapists | Actions)
- Expandable per-row assignment panel (assign + remove inline)
- Right-side help panel: Who can be assigned? / Excluded / Tip
- id="therapist-assignments" anchor on the tab content container
- Readiness links updated to /crm/services?tab=assignments

## Files Changed
- src/app/(dashboard)/crm/services/page.tsx
- src/components/features/crm/services/crm-services-workspace.tsx (NEW)
- src/components/features/crm/services/crm-therapist-assignment-tab.tsx (NEW)
- src/components/features/crm/services/service-assignment-table-row.tsx (NEW)
- src/components/features/crm/services/types.ts (ServiceTableRow added)
- src/components/features/crm/services/crm-service-therapist-panel.tsx (actionHref)
- src/components/features/crm/services/provider-assignment-card.tsx (actionHref)

## Commit
586fb57

## Agent
Claude Code (main branch, E:/cradlehub)

## Branch
main
