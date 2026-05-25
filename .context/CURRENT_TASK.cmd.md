# CURRENT TASK: CRM-SCHEDULE-PHASE5B-001

## Status
COMPLETE

## Task ID
CRM-SCHEDULE-PHASE5B-001

## Description
Phase 5B — Import the spa's 2026 manual schedule rules into CradleHub.
Adds "Current Manual Schedule Setup" collapsible wizard to /crm/staff-availability.

## Changes Completed
- Encoded day-off (regular + salon) and opening-duty schedule as typed constants
  in src/lib/schedule/manual-schedule-2026.ts (ALL CAPS names, no staff IDs)
- Server action applyManualScheduleImportAction: CRM role guard, branch scope,
  staff ID verification, 7-row upsert per staff (off=inactive/single,
  opening=active/opening, regular=active/single)
- ManualScheduleImport client component: 3-tab wizard (Preview, Match, Apply)
  - Auto-matches paper names by full_name/nickname/first-name
  - CRM resolves ambiguous/unmatched via dropdown, can skip any name
  - Time inputs (regular start/end, opening start/end) with defaults
  - Conflict detection (opening + off same day)
  - Apply button disabled until all criticals resolved + times valid
  - Inline success/error feedback
- Page updated: ManualScheduleImport rendered between health summary and workspace

## New Files
- src/lib/schedule/manual-schedule-2026.ts
- src/app/(dashboard)/crm/staff-availability/actions.ts
- src/components/features/staff-schedule/manual-schedule-import.tsx

## Modified Files
- src/app/(dashboard)/crm/staff-availability/page.tsx

## Agent
Claude Code (main branch, E:/cradlehub)

## Branch
main

## Build Status
- npx tsc --noEmit: ✅ PASS (0 errors)
- eslint (changed files): ✅ PASS (0 warnings)
- pnpm build: ✅ PASS (85/85 routes)
- Commit: 65e53d9
