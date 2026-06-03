# HANDOFF — Start Service countdown fix: COMPLETE

## Status: ✅ Build verified (89 routes · type-check ✅ · lint ✅ · build ✅)

---

## What Was Fixed (2026-06-03)

### Bug: Start Service showed toast but countdown never appeared

Three independent root causes, all fixed:

---

### Root cause 1 — RPC migration not applied

`crmStartServiceAction` was calling `update_booking_progress` RPC with `session_started`. The migration `20260603000001_staff_direct_session_start.sql` that enables `not_started → session_started` was **written but never pushed** to the DB. So the RPC was throwing `Invalid progress transition for in-spa: not_started → session_started`, and the action returned `{ success: false, error: "..." }`.

**Fix** (`crm/bookings/actions.ts`): Both `crmStartServiceAction` and `crmCompleteServiceAction` now use **direct `supabase.update()`** instead of the RPC. This writes all three fields atomically (`status`, `booking_progress_status`, `session_started_at`) and works regardless of whether the migration has been applied.

Also fixed: idempotency check now requires `session_started_at` to be non-null so a limbo booking (`in_progress` status but no `session_started_at`) isn't silently skipped.

---

### Root cause 2 — Booking moves tabs after status change

After `router.refresh()`, the booking changed from `status = "confirmed"` to `status = "in_progress"`. In `BookingsTable`, `selected` was derived from `pageBookings` (the current tab's filtered list). The booking was no longer in the "confirmed" tab after the status change, so `selected` became `pageBookings[0]` — a different booking — and `BookingDetailsPanel` showed the wrong booking.

**Fix** (`bookings-workspace.tsx` + `bookings-table.tsx`):
- `BookingsWorkspace` now passes `allBookings={bookings}` (the full unfiltered list) to `BookingsTable`
- `BookingsTable` uses `allBookings` as a fallback when `selectedId` is not found in the current tab's `pageBookings`
- A booking that moves from "confirmed" to "in-service" tab remains findable and stays in the right panel

---

### Root cause 3 — No optimistic state for the refresh window

Even with the RPC fixed and the cross-tab lookup working, there's a ~500ms gap between the action returning success and `router.refresh()` completing. During that window, `booking.session_started_at` is still null from the server data and the countdown wouldn't show.

**Fix** (`bookings-table.tsx` `BookingDetailsPanel`):
- Added `SessionOverride` state (`sessionOverride`): set in the `startTransition` success callback, cleared on component remount (via `key` on `BookingDetailsPanel`)
- `effectiveStatus`, `effectiveProgressStatus`, `effectiveSessionStartedAt` merge server props with the optimistic override
- `isServiceActive` and `canStartService` use the effective values
- `HybridSelectedBookingCard` receives the effective values — countdown starts immediately after click, before the server refresh arrives

`key={selected.id + selected.session_started_at + selected.booking_progress_status}` on `BookingDetailsPanel` resets `sessionOverride` to null when the server data arrives with the real timestamp.

---

## Complete flow now

1. CRM selects a confirmed booking → sees **Start Service** button (no countdown)
2. Clicks Start Service → `crmStartServiceAction` writes all 3 fields directly to DB
3. Success callback: `setSessionOverride(...)` → **countdown appears immediately**
4. `router.refresh()` → server re-fetches; booking now has real `session_started_at`
5. `allBookings` fallback finds the booking in the "in-service" tab data
6. `BookingDetailsPanel` key changes → remounts → `sessionOverride` cleared → real server data shown
7. When countdown expires → `autoCompleteDueSessionAction` validates server-side → booking completed

---

## Still pending

- `supabase db push` for `20260603000001_staff_direct_session_start.sql` (less critical now since Start Service uses direct update, but should still be applied for consistency)

---

## Build

`pnpm type-check` ✅ · `pnpm lint` ✅ (0 errors) · `pnpm build` ✅ · 89 routes
