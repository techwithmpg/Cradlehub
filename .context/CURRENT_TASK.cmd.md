# 🎯 CURRENT TASK

| Field | Value |
|-------|-------|
| **Task ID** | `SCHED-003` |
| **Description** | `Redesign staff schedule management as compact list + detail panel` |
| **Agent** | `Kimi DevCoder` |
| **Status** | `COMPLETE` |

## Changes Summary

### Staff Schedule Management Redesign
- Replaced expanded per-staff cards with compact table/list layout
- New toolbar: search by name/role, 7 status filters, sort by name/tier
- Each row shows: staff name, role/tier, weekly hours summary, override count, block count, status dot, Manage button
- Weekly hours summary helper intelligently summarizes schedules:
  - All 7 days same → "10:00 AM – 8:00 PM daily"
  - Weekdays only → "Weekdays · 9:00 AM – 6:00 PM"
  - Weekends only → "Weekends · 10:00 AM – 5:00 PM"
  - Otherwise → "Custom hours (N days)" or "Not scheduled"
- Click row or Manage → right-side Sheet panel opens
- Detail panel has header (name, role, summary, day dots) + tabs:
  - Weekly Hours — per-day editor (Set/Edit start+end times)
  - Day Overrides — add/remove date-specific overrides
  - Block Time — add/remove blocked time entries
- All existing server actions preserved (setStaffScheduleAction, createScheduleOverrideAction, createBlockedTimeAction, deleteBlockedTimeAction, deleteScheduleOverrideAction)
- Optimistic local state updates in all editors (no Sheet close on save)
- Sheet closes with router.refresh() to update list summaries

## Files Created
- `src/lib/utils/staff-schedule-summary.ts` — weekly hours summary helper
- `src/components/features/staff-schedule/staff-schedule-toolbar.tsx`
- `src/components/features/staff-schedule/staff-schedule-list.tsx`
- `src/components/features/staff-schedule/staff-schedule-row.tsx`
- `src/components/features/staff-schedule/staff-schedule-detail-panel.tsx`
- `src/components/features/staff-schedule/staff-weekly-hours-editor.tsx`
- `src/components/features/staff-schedule/staff-day-overrides-editor.tsx`
- `src/components/features/staff-schedule/staff-block-time-editor.tsx`
- `src/components/features/staff-schedule/staff-schedule-page-client.tsx`

## Files Changed
- `src/app/(dashboard)/manager/staff/page.tsx` — server page now passes data to client component

## Build Status
- `pnpm type-check`: ✅ Passing
- `pnpm build`: ✅ Passing (46 routes)
- `pnpm lint`: ⚠️ 5 pre-existing errors only
