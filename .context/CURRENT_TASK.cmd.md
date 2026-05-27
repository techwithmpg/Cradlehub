# CURRENT TASK: CRM Schedule Page Redesign

## Status
COMPLETE — CRM Schedule page redesigned with fixed-height board, density controls, collapsible groups, inline details panel, and PageHeader/SystemReadinessBar.

## Task ID
crm-schedule-redesign-001

## Description
Redesign the CRM Schedule page so the page stays stable and only the schedule board scrolls internally.
The final schedule page feels like a CRM command-center calendar, not a long table.

## What was done

### New Components
- `src/components/features/schedule/schedule-density.tsx` — Density context (comfortable/compact/ultra-compact) + toggle UI
- `src/components/features/schedule/schedule-staff-group.tsx` — Collapsible staff group headers (In Progress, Scheduled Today, Off Today)
- `src/components/features/schedule/crm-schedule-details-panel.tsx` — Inline right-side panel showing staff details + booking details

### Modified Components
- `src/app/(dashboard)/crm/schedule/page.tsx` — Added PageHeader, SystemReadinessBar, consistent section wrapper
- `src/components/features/schedule/schedule-workspace.tsx` — CRM layout uses inline right panel instead of Sheet; added density provider + toggle
- `src/components/features/schedule/schedule-board-panel.tsx` — Added optional `showHeader` prop
- `src/components/features/schedule/daily-schedule-board.tsx` — Fixed-height scrollable container (`maxHeight: calc(100vh - 380px)`), staff grouped by status
- `src/components/features/schedule/schedule-time-header.tsx` — Density-aware header height
- `src/components/features/schedule/schedule-staff-cell.tsx` — Density-aware padding, avatar size, font size
- `src/components/features/schedule/schedule-staff-row.tsx` — Density-aware row height
- `src/lib/utils/schedule-timeline.ts` — Added `getRowHeightPx()` and `getHeaderHeightPx()` density helpers

### Key Behaviors
- **Fixed-height board**: Schedule timeline scrolls internally; page does not grow with staff count
- **Sticky staff column**: Already worked via `position: sticky; left: 0`
- **Sticky time header**: Already worked via `position: sticky; top: 0`
- **Density controls**: Comfortable (76px), Compact (56px, default), Ultra-compact (42px)
- **Collapsible groups**: In Progress (expanded), Scheduled Today (expanded), Off Today (collapsed by default)
- **Inline details panel**: Replaces Sheet for CRM context; shows staff info, today's schedule, assigned bookings, actions
- **Owner/manager schedule unchanged**: Still uses Sheet-based booking details; no density controls

## Acceptance criteria
- [x] CRM Schedule page no longer becomes extremely tall with many staff
- [x] Schedule board has internal scrolling
- [x] Staff column is sticky on horizontal scroll
- [x] Time header is sticky on vertical scroll
- [x] Density controls exist and default to compact
- [x] Staff are grouped into collapsible sections
- [x] Off Today staff defaults collapsed
- [x] Inline right-side details panel for CRM
- [x] Day / Week / Staff view controls still exist
- [x] Existing filters/search still work
- [x] Existing booking/schedule data still renders correctly
- [x] Owner/manager schedule pages untouched
- [x] pnpm type-check passes
- [x] pnpm build passes

## Agent
Kimi (E:/cradlehub)
