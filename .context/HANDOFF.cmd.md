# HANDOFF — STAFF-MOTION-001

## Date
2026-05-20

## What Changed

### Motion component library (all new)
**Folder:** `src/components/shared/motion/`

Five small client components added:

| File | Purpose |
|---|---|
| `premium-action-overlay.tsx` | Full-screen cream/blur overlay shown while a staff action awaits server response |
| `premium-success-toast.tsx` | Fixed bottom-centre slide-up toast (success / warning / error variants) |
| `premium-inline-spinner.tsx` | 13px white circular spinner for use inside green primary buttons |
| `live-pulse-indicator.tsx` | Pulsing dot + label for active travel or session states |
| `motion-status-dot.tsx` | Animated stepper dot: done=green, active=gold-pulse, pending=muted, warning=amber |

### BookingProgressActions patch
**File:** `src/components/features/staff-portal/booking-progress-actions.tsx`

- Added `actionFeedback` state (`idle | loading | success | error`) and `getProgressFeedback()` helper mapping each `BookingProgressStatus` to contextual loading/success copy.
- `handleAdvance()` now:
  1. Sets `type: "loading"` → overlay opens.
  2. Awaits server action.
  3. On success: sets `type: "success"` → toast opens → `router.refresh()` → clears after 3 s.
  4. On error: sets `type: "error"` → toast opens (replaces previous `alert()`) → clears after 4 s.
- Primary button: shows `<PremiumInlineSpinner />` + "Updating…" when pending; icon + label otherwise. Added `active:scale-[0.98]` press effect.
- No-show button: same press effect; muted-tone inline spinner when pending.
- Compact stepper dots replaced with `<MotionStatusDot>` (same visual size, now animates).
- `<LivePulseIndicator>` rendered alongside `<TrackingTimer>` for `travel_started` (green) and `session_started` (gold).

### CSS keyframes
**File:** `src/app/globals.css` (append-only, bottom of file)

- `cradle-premium-pulse` — used by `MotionStatusDot` active ring and `LivePulseIndicator` ring.
- `cradle-soft-slide-up` — used by `PremiumSuccessToast` entrance (includes `translateX(-50%)` to stay centred over `left:50%`).
- `cradle-check-pop` — used by the icon in `PremiumSuccessToast`.
- `cradle-card-glow` — ambient glow, not yet wired up; available for future use.

## What Was NOT Changed
- `src/lib/bookings/progress.ts` — lifecycle state machine untouched.
- `src/app/(dashboard)/staff-portal/actions.ts` — server actions untouched.
- All booking cards, layout components, and portal pages — untouched.
- No DB schema changes. No new npm packages.

## Verification
- `pnpm type-check`: ✅ Passing (0 errors)
- `pnpm lint`: ✅ Passing (0 errors, 0 warnings)
- `pnpm build`: ✅ Passing, 80 app routes

## Manual Test Checklist
1. Open `/staff-portal` → find a home-service booking.
2. Click **Start Travel** → button shows spinner, overlay appears, success toast shows, status updates.
3. Click **Mark Arrived** → same feedback.
4. Verify `LivePulseIndicator` (green) appears next to timer in `travel_started` state.
5. Click **Start Session** → verify gold `LivePulseIndicator` appears.
6. Click **Complete** → success toast confirms.
7. Find an in-spa booking → **Check In** → **Start Session** → **Complete** — all with overlay + toast.
8. Test **Mark No Show** — amber warning toast should appear (not an alert dialog).
9. Simulate a network error → error toast appears (no browser alert).
10. Confirm no layout shift or visual redesign anywhere on the portal.
