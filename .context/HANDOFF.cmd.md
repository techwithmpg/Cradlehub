# HANDOFF — SCHED-LAYOUT-001 Full-Width Schedule Timeline

## Date
2026-05-14

## Agent
Claude Sonnet 4.6

## Summary
The Schedule workspace (shared by Manager, Owner, and CRM) was updated to give the daily timeline grid full available width. The permanent 340px right-side Booking Details panel has been removed from the default layout and replaced with two new interaction patterns:
- **Hover (desktop):** A lightweight fixed-position floating preview card appears near the booking block when the user hovers. It shows core booking info and a "View Details" button.
- **Click (all devices):** Clicking/tapping a booking block opens a right-side Sheet drawer containing the full `ScheduleDetailsPanel` with all existing actions.

## Files Changed

| File | Change |
|------|--------|
| `src/components/features/schedule/schedule-workspace.tsx` | Removed two-column grid; added `isSheetOpen` state, `hoveredPreview` state, `closeTimerRef`; wired Sheet and hover card |
| `src/components/features/schedule/schedule-booking-hover-card.tsx` | **New file** — lightweight floating hover preview |
| `src/components/features/schedule/schedule-board-panel.tsx` | Added `onHoverEnter` / `onHoverLeave` optional props; passes to `DailyScheduleBoard` |
| `src/components/features/schedule/daily-schedule-board.tsx` | Added `onHoverEnter` / `onHoverLeave` optional props; passes to `ScheduleStaffRow` |
| `src/components/features/schedule/schedule-staff-row.tsx` | Added `onHoverEnter` / `onHoverLeave` optional props; passes to `ScheduleBookingBlock` |
| `src/components/features/schedule/schedule-booking-block.tsx` | Added `onHoverEnter` / `onHoverLeave` optional props; fires from existing mouse event handlers |

## How Hover/Click Details Work After Change

### Hover (desktop)
1. User moves pointer over a booking block in the daily timeline.
2. `ScheduleBookingBlock.onMouseEnter` fires → calls `onHoverEnter(bookingId, clientX, clientY)`.
3. Callback bubbles up to `ScheduleWorkspace.handleHoverEnter` → finds the booking + staff in `filteredRows` → sets `hoveredPreview` state.
4. `ScheduleBookingHoverCard` renders at `position: fixed` near the cursor, above the timeline (z-index 9999).
5. User moves pointer away from block → `onMouseLeave` fires → `handleHoverLeave` starts a 200ms timeout to clear `hoveredPreview`.
6. If pointer enters the hover card before timeout fires → `handleHoverCardMouseEnter` clears the timeout; card stays open.
7. Pointer leaves the card → `handleHoverCardMouseLeave` immediately clears `hoveredPreview`.

### Click (all devices)
1. User clicks/taps a booking block → `onClick` fires → `handleBookingClick(bookingId)`.
2. `selectedBookingId` and `isSheetOpen` are set → Sheet opens with `ScheduleDetailsPanel` inside.
3. User closes Sheet via: sheet backdrop click, or the X button in `ScheduleDetailsPanel`, or `handleCloseSheet`.
4. All existing booking actions (Change Status, Take Payment, Cancel Booking, Room/Bed Assignment) work inside the Sheet as before.

## Known Limitations
- Hover card is only wired to the **daily timeline** (day view) through `DailyScheduleBoard` → `ScheduleStaffRow` → `ScheduleBookingBlock`. The staff view and week view booking blocks do not show hover cards; they still open the Sheet on click.
- The hover card reads cursor position at `mouseenter` and does not track cursor movement, so it stays in the initial position until dismissed. This is intentional and prevents jitter.
- On very narrow viewports, the hover card might be partially clipped at the right edge. The `cardX` calculation clamps to `vw - CARD_WIDTH - 16px` to mitigate this.
- The `ScheduleDetailsPanel`'s card-style wrapper (border, borderRadius) appears inside the Sheet, creating a slight visual layering. This is cosmetically acceptable and can be refined later by adding a `variant="sheet"` prop to `ScheduleDetailsPanel`.

## Verification
- `pnpm type-check`: Passing
- `pnpm lint`: Passing with 2 pre-existing warnings in `src/app/staff-onboarding/onboarding-form.tsx`
- `pnpm build`: Passing, 88 app routes

## Next Steps (not part of this task)
- Staff view and week view hover cards, if desired.
- `ScheduleDetailsPanel` sheet variant to remove the inner card border when rendered inside a Sheet.
- Keyboard navigation: booking blocks with `onFocus` / `onBlur` for hover card triggering.
