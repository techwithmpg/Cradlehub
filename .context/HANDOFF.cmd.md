# 🤝 HANDOFF — Booking Wizard Same-Day Past Slot Fix

## What Was Done

### Root Cause
`isPastSlot` in `src/lib/engine/slot-time.ts` built a slot datetime via
`new Date(y, m-1, d, hh, mm, ss)` — using the **server's local timezone** (UTC
on cloud hosting). Slot times represent **branch local time** (Philippines =
UTC+8). A "13:00" Manila slot was treated as 13:00 UTC = 21:00 Manila, so it
appeared to be hours in the future and was never filtered, even when 2 PM
Manila had already passed.

### Files Changed

| File | What changed |
|------|-------------|
| `src/lib/engine/slot-time.ts` | Added `BRANCH_TIMEZONE = "Asia/Manila"` export. Added private `getBranchTime(now, timezone)` helper using `Intl.DateTimeFormat`. Updated `isPastSlot` and `filterPastSlotsForDate` to accept optional `timezone` — uses branch-local time when provided, server-local time for backward compatibility (existing tests unaffected). |
| `src/lib/engine/availability.ts` | Imports `BRANCH_TIMEZONE`. Passes `timezone: BRANCH_TIMEZONE` to `filterPastSlotsForDate` in `getAvailableSlots`. In `getAvailableSlotsMulti` (2+ services path): stores `filterSlotsForQualifiedProviders` result, then applies `filterPastSlotsForDate` with timezone as a belt-and-suspenders final pass. |
| `src/lib/actions/online-booking.ts` | Imports `isPastSlot` + `BRANCH_TIMEZONE`. In `createOnlineBookingMultiAction`: explicit past-slot guard after the rules check — returns `SLOT_IN_PAST` with "That time is no longer available. Please choose a later time." before attempting staff assignment. |
| `src/components/public/booking-wizard.tsx` | Imports `isPastSlot` + `BRANCH_TIMEZONE`. In `handleSubmit`: checks if selected slot is past in branch timezone before submitting — clears `selectedSlot`, shows "That time has already passed. Please select a later time.", navigates back to the date/time step. |

### Key Design Decisions
- No DB schema changes.
- No new npm dependencies — uses native `Intl.DateTimeFormat`.
- `BRANCH_TIMEZONE` is a single exported constant in `slot-time.ts`; update there when branches get a per-branch timezone column.
- Legacy `isPastSlot` / `filterPastSlotsForDate` callers that don't pass `timezone` keep the server-local-time behavior — all existing tests still pass.
- The UI empty state "No more available slots today. Please choose another date." was already in place (line 1652 of booking-wizard.tsx).

## Build Status
`pnpm type-check` ✅ · `pnpm lint` ✅ (0 errors, 2 pre-existing script warnings) · `pnpm build` ✅ (89/89 routes)

## Recommended Next Steps
1. **Browser verify** — open `/book`, pick today, confirm slots earlier than current Manila time are hidden.
2. **Stale-slot test** — select a slot close to the current minute, wait for it to pass, click Confirm — confirm error appears and slot is cleared.
3. **Home service** — repeat with home-service visit type.
4. **Future date** — pick tomorrow, confirm morning slots are visible normally.
5. When the `branches` table gets a `timezone` column, pass it into `filterPastSlotsForDate` and `isPastSlot` instead of the constant.
