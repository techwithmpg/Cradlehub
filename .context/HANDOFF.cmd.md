# HANDOFF — Service Workflow Fix: COMPLETE

## Status: ✅ Build verified (89 routes · type-check ✅ · lint ✅ · build ✅)

---

## What Was Fixed (2026-06-03)

### Bug: "Complete Service" appeared before service started

**Root cause chain:**

| Layer | Problem | Fix |
|-------|---------|-----|
| `updateBookingStatusAction` | Only set `status = 'in_progress'`, did NOT call the RPC → no `session_started_at` | Replaced with `crmStartServiceAction` which calls the RPC atomically |
| `isServiceActive` in panel | Checked `status === 'in_progress'` without `session_started_at` guard → triggered "active" on stale data | Now requires BOTH status flag AND `Boolean(session_started_at)` |
| `canStartService` in panel | Only matched `checked_in + room` → confirmed bookings got blank actions | Broadened to any confirmed in-spa non-closed non-pending booking |
| `CrmNextActionsPanel` Start Service | Called `statusAction({status:"in_progress"})` → same bug | `wrappedStatusAction` intercepts `in_progress` and routes to RPC |

---

## New Server Actions

### `crmStartServiceAction({ bookingId })` in `crm/bookings/actions.ts`
- Calls `update_booking_progress` RPC with `session_started`
- Atomically sets: `booking_progress_status = 'session_started'`, `session_started_at = now()`, `status = 'in_progress'`
- Idempotent: already-started bookings return `{ success: true }`
- Revalidates CRM + manager + all staff-portal paths

### `crmCompleteServiceAction({ bookingId })` in `crm/bookings/actions.ts`
- Calls `update_booking_progress` RPC with `completed`
- Atomically sets: `booking_progress_status = 'completed'`, `session_completed_at = now()`, `status = 'completed'`
- Idempotent: already-completed bookings return `{ success: true }`
- Revalidates all surfaces

---

## HybridSelectedBookingCard changes

- `onAutoComplete?: () => void` prop added
- `isServiceActive` tightened to require `session_started_at`
- Countdown computation moved to top level for auto-complete detection
- `hasAutoCompletedRef` + `useEffect([isCountdownDue, onAutoComplete])` fires `onAutoComplete` once when timer reaches zero
- `key` prop in parent resets `hasAutoCompletedRef` when a new session starts

---

## Correct state machine (for testing)

| Booking state | What card shows |
|--------------|----------------|
| `confirmed`, no session | Normal view + **Start Service** button |
| `confirmed`, `checked_in`, has room | Normal view + **Start Service** button |
| After CRM or Staff clicks Start Service | RPC sets all 3 fields → card shows **countdown + Complete Service** |
| Countdown hits zero | `autoCompleteDueSessionAction` called → server validates → booking completed |
| `completed` | CrmNextActionsPanel returns null; countdown hidden; card shows no action |
| `cancelled` / `no_show` | No action buttons |
| `home_service` | No countdown; dispatch flow via CrmNextActionsPanel |

---

## Pending

- `supabase db push` for migration `20260603000001_staff_direct_session_start.sql` (still pending from earlier session)
- Authenticated browser click-through verification

---

## Build

`pnpm type-check` ✅ · `pnpm lint` ✅ (0 errors) · `pnpm build` ✅ · 89 routes
