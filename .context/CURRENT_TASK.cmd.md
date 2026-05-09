# CURRENT TASK: SCHED-DAY-POLISH-001 — Day Mode Timeline Visual Polish (Complete)

## Overview
Polished Day Mode visuals inside the existing shared ScheduleWorkspace without touching Staff Mode, Week Mode, route pages, or workspace plumbing. Five focused visual improvements to the timeline board and its sub-components.

## Exact Files Changed

### Files edited:
- `src/components/features/schedule/schedule-board-panel.tsx`
  - `ScheduleLegend` now renders only when `viewMode === "day"` (hidden in Week/Staff modes)
  - Added "Daily timeline" gold badge subtitle in Day mode header
- `src/components/features/schedule/schedule-staff-cell.tsx`
  - Added initials/avatar circle (34px, green for on-duty, grey for off)
  - Improved `formatStaffLabel`: null tier now shows "Service Staff" instead of "Staff"
  - Off-duty cells now have muted background (`var(--cs-bg)`) and muted text
  - Off-duty status label changed from "Off" to "Off today"
- `src/components/features/schedule/schedule-booking-block.tsx`
  - Added 3px status-colored left border accent for quick visual identification
  - Adjusted padding to accommodate the left border
- `src/components/features/schedule/schedule-blocked-time-block.tsx`
  - Added `formatBlockedLabel` helper: break/lunch → Break, travel → Travel, else Blocked
- `src/components/features/schedule/daily-schedule-board.tsx`
  - Fixed `minWidth` from hardcoded `STAFF_CELL_WIDTH_PX + 600` to `STAFF_CELL_WIDTH_PX + getTimelineTotalWidthPx()`

### Untouched:
- `schedule-workspace.tsx` — no plumbing changes
- `schedule-toolbar.tsx`, `schedule-kpi-cards.tsx`, `schedule-details-panel.tsx`, `schedule-alerts-panel.tsx`
- `schedule-legend.tsx`, `schedule-mode-switcher.tsx`
- All Staff Mode components
- All Week Mode components
- All route pages
- All queries, actions, auth, RBAC, schema, booking engine, public booking

## Completed
- Day Mode legend appears only in Day mode; Week and Staff modes no longer show it.
- Day Mode header shows "Daily timeline" gold badge.
- Staff cells show initials/avatar circles.
- Null staff tier displays "Service Staff".
- Off-duty staff cells are subtly muted.
- Booking blocks have a clear status-colored left accent border.
- Booking click still updates the right details panel.
- No dialog/modal appears from booking blocks.
- Blocked-time labels are friendly: Break, Travel, or Blocked.
- Timeline min-width matches actual content width.
- Current time indicator, off-duty overlays, blocked-time stripes all still work.
- Staff Mode still works.
- Week Mode still works.
- Owner, Manager, and CRM still use the same shared ScheduleWorkspace.

## Verification
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing (0 errors, 0 warnings)
- `pnpm build`: ✅ Passing, 68 app routes

## Status
Complete. Ready to commit as `fix(schedule): polish day timeline visuals`.
