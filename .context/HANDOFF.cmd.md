# HANDOFF — SCHED-DAY-POLISH-001 Day Mode Timeline Visual Polish

## Date
2026-05-10

## Agent
Kimi

## Summary
Polished Day Mode visuals inside the existing shared ScheduleWorkspace. Five focused improvements to the timeline board: conditional legend, staff avatars, status left borders, friendly blocked labels, and correct scrollable width.

## Files Changed

### Edited:
- `src/components/features/schedule/schedule-board-panel.tsx` — Legend Day-mode-only + "Daily timeline" subtitle
- `src/components/features/schedule/schedule-staff-cell.tsx` — Avatar circle, improved labels, muted off-duty styling
- `src/components/features/schedule/schedule-booking-block.tsx` — Status-colored 3px left border accent
- `src/components/features/schedule/schedule-blocked-time-block.tsx` — Friendly label normalization
- `src/components/features/schedule/daily-schedule-board.tsx` — Fixed minWidth to match actual timeline width

### Untouched:
- `schedule-workspace.tsx` — no plumbing changes
- `schedule-toolbar.tsx`, `schedule-kpi-cards.tsx`, `schedule-details-panel.tsx`, `schedule-alerts-panel.tsx`
- `schedule-legend.tsx`, `schedule-mode-switcher.tsx`
- All Staff Mode components
- All Week Mode components
- All route pages: `owner/schedule/page.tsx`, `manager/schedule/page.tsx`, `crm/schedule/page.tsx`
- All queries, actions, auth, RBAC, schema, booking engine, public booking

## Behavior After Change

- **Day mode** header now shows a "Daily timeline" gold badge and the legend only appears in Day mode.
- **Week mode** and **Staff mode** no longer show the timeline legend in their headers.
- **Staff cells** now display a circular avatar with initials (green for on-duty, grey for off).
- **Staff labels** are friendlier: null tier shows "Service Staff", senior/mid/junior map to "Senior Therapist"/"Therapist"/"Junior Therapist".
- **Off-duty staff** cells have a muted cream background and the status label reads "Off today".
- **Booking blocks** have a 3px left border matching their status color (green for confirmed, violet for in-progress, etc.).
- **Blocked time** labels are normalized: "lunch_break" → "Break", "travel_buffer" → "Travel", anything else → "Blocked".
- **Timeline horizontal scroll** now uses the correct minimum width (2696px instead of 800px), ensuring all content is scrollable.
- Clicking a booking block still updates the same right-side Booking Details panel.
- Current-time gold line, off-duty overlays, and blocked-time stripes all still work.

## Verification

- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing (0 errors, 0 warnings)
- `pnpm build`: ✅ Passing, 68 app routes

## Remaining Notes

- **Week Mode only has real data for the currently loaded date.** The other 6 day cards show placeholders. Weekly data fetching is a future enhancement.
- **Mode resets on date navigation** because `viewMode` is client-only state. A future enhancement could persist `?mode=` in the URL.
- The existing deprecated component `staff-schedule-grid.tsx` remains in the tree but is unused. Safe to delete later if desired.
- To change the default mode, edit `useState<ScheduleViewMode>("staff")` in `schedule-workspace.tsx`.

## Commit Message

```
fix(schedule): polish day timeline visuals
```
