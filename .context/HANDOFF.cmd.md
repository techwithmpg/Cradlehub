# HANDOFF — Hybrid Selected Booking Card: COMPLETE

## Status: ✅ Build verified (89 routes · type-check ✅ · lint ✅ · build ✅)

---

## What Was Done (2026-06-03)

### New: `src/components/features/bookings/hybrid-selected-booking-card.tsx`

`HybridSelectedBookingCard` — a client component that replaces the old separate hero card + `ServiceCountdownChip` in the CRM Bookings right panel.

**Two modes, same component instance:**

| State | What renders |
|-------|-------------|
| Normal (pending / confirmed / checked_in) | Avatar + name + service + room header, detail rows, `Start Service` if eligible |
| Active service (`in_progress` or `session_started` + `session_started_at`) | Same header + live `CountdownZone`, detail rows, `Complete Service` |

**`CountdownZone`** (internal sub-component):
- Big `N min remaining` label + `MM:SS` countdown (or `+MM:SS` overtime)
- `of N min` denominator
- Segmented green progress bar (transitions smoothly via CSS)
- "Started HH:MM · Staff · Room" meta row

**Activation rule:**
```ts
const isServiceActive =
  booking.status === "in_progress" ||
  booking.booking_progress_status === "session_started";

const shouldShowCountdown =
  isServiceActive && Boolean(booking.session_started_at) && tick !== null;
```

---

### Changed: `BookingDetailsPanel` in `bookings-table.tsx`

- `BookingDetailsPanel` now has two `useTransition` hooks (`isStarting`, `isCompleting`) and uses `useRouter` for direct start/complete actions.
- `handleStartService` / `handleCompleteService` call `statusAction` (or `updateBookingStatusAction` fallback), show a Sonner toast, and call `afterServiceMutation()` (revalidates + refreshes).
- Old hero card + `ServiceCountdownChip` replaced by `HybridSelectedBookingCard` with a flat view-model mapped from `WorkspaceBookingRow`.
- `CrmNextActionsPanel` suppressed when `isServiceActive` (it would only show "Complete Service" — handled by the hybrid card). Active for all other states.
- Panel title row: compact "SELECTED BOOKING" + `#ID` + status pills in one row.
- `X` icon import removed (close button now inside hybrid card).

---

## Key decisions

- **`CountdownZone` is a sub-component** (not its own file) because it's only used here and prevents the main file from exceeding 200 lines in logic.
- **`TickState | null`** pattern: both `mountMs` and first `nowMs` set from `setTimeout(..., 0)` callback — never directly in the effect body, satisfying `react-hooks/set-state-in-effect`.
- **No auto-complete in this component** — `Complete Service` is a manual button per the task spec. `autoCompleteDueSessionAction` from the staff-portal actions is available for future wiring if desired.
- **Home service suppression**: `onStartService` and `onCompleteService` are not passed for home-service bookings; `CrmNextActionsPanel` stays visible for dispatch flow.
- **"Edit Booking" is a disabled placeholder** — no edit booking route exists in scope yet.

---

## What's Next

- Apply `supabase db push` for migration `20260603000001_staff_direct_session_start.sql`
- Authenticated browser click-through to verify countdown activates when CRM or staff starts service
- Optional: wire `autoCompleteDueSessionAction` to `HybridSelectedBookingCard` for server-validated auto-complete
- Optional: implement Edit Booking functionality

---

## Build

`pnpm type-check` ✅ · `pnpm lint` ✅ (0 errors) · `pnpm build` ✅ · 89 routes
