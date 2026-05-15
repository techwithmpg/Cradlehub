# HANDOFF — PERF-PHASE4-001 Offline / Poor Connectivity Resilience

## Date
2026-05-15

## What Changed

### Network status hook
**New file:** `src/hooks/use-network-status.ts`

Uses `useSyncExternalStore` (React 18) — the idiomatic API for subscribing to browser external stores:
```ts
const isOnline = useSyncExternalStore(
  subscribeToNetwork,       // subscribe fn: attaches online/offline listeners
  () => navigator.onLine,  // client snapshot
  () => true               // server snapshot (assume online, no hydration mismatch)
);
```
`wasOffline` and `lastChangedAt` are tracked separately via `useEffect` + event callbacks (not synchronous setState, passes the `react-hooks/set-state-in-effect` lint rule).

### Offline banner
**New file:** `src/components/shared/offline-banner.tsx`

Fixed-position, `z-index: 9999`. No CSS modules or Tailwind — uses inline styles for guaranteed stacking. Two states:
- **Offline:** charcoal `#1C1917` bg, amber text, `WifiOff` icon, `aria-live="assertive"`
- **Back online:** green `#14532D` bg, `aria-live="polite"`
- **Idle (never disconnected):** renders nothing

### Layout mounts
- `src/app/(dashboard)/layout.tsx` — `<OfflineBanner />` first child of outer flex container.
- `src/app/(public)/layout.tsx` — `<OfflineBanner />` before `<SiteHeader>`.

Both layouts are Server Components that render this Client Component child — App Router handles the boundary automatically.

### Write-path protection

#### `src/components/public/booking-wizard.tsx`
- `useNetworkStatus()` destructures `isOffline`.
- `handleSubmit` — early-return guard at the top:
  ```ts
  if (isOffline) {
    setFormError("You're offline. Check your connection and try again.");
    return;
  }
  ```
- "Confirm Booking" button: `disabled={!canProceed || submitting || isOffline}`.
- On server action failure: if message contains "fetch"/"network"/"failed to", shows "Check your connection and try again." instead of raw server message.
- `isOffline` added to `handleSubmit` `useCallback` dependency array.
- Covers both `mode="public"` (public booking wizard) and `mode="inhouse"` (CRM booking).

#### `src/components/features/dashboard/booking-action-menu.tsx`
- `useNetworkStatus()` destructures `isOffline`.
- `handleAction` short-circuits before `startTransition`:
  ```ts
  if (isOffline) {
    setFeedback("You're offline — check your connection and try again.");
    closeFeedbackAfterDelay();
    return;
  }
  ```
- Trigger button: `disabled={isPending || !hasActions || isOffline}`.
- `getTriggerButtonStyle` call: `isPending || !hasActions || isOffline`.
- On action failure: error message = `result.error ?? "Failed to update. Check your connection and try again."`.
- Used by: manager today page, bookings table, CRM control console, schedule timeline details panel.

#### `src/components/features/staff-portal/booking-progress-actions.tsx`
- `useNetworkStatus()` destructures `isOffline`.
- `handleAdvance` early-returns when `isPending || isOffline`.
- Advance button: `disabled={isPending || isOffline}`, cursor/opacity updated.
- No-show button: `disabled={isPending || isOffline}`, cursor/opacity updated.

### `public/sw.js` — Confirmed unchanged
Self-unregisters on `activate`, deletes all caches, notifies clients. No changes made.

## Verification
- `pnpm type-check`: ✅ Passing (0 errors)
- `pnpm lint`: ✅ Passing (0 errors, 2 pre-existing warnings in `staff-onboarding/onboarding-form.tsx`)
- `pnpm build`: ✅ Passing, 79 routes

## What Was Intentionally NOT Changed

| Excluded | Reason |
|---|---|
| `staff-weekly-hours-editor.tsx` | Owner-only, rare action, banner covers it |
| `branch-services-panel.tsx` | Owner-only CRUD, banner covers it |
| `reconciliation-form.tsx` | Internal finance tool, banner covers it |
| `waitlist-queue.tsx` | Low-frequency, banner covers it |
| `onboarding-form.tsx` | One-time use, banner covers it |
| Service worker / background sync | `sw.js` intentionally self-unregisters; no persistent queue |
| Optimistic UI with rollback | Not requested; actions are gated at the boundary |

## Next Phase Options

### Phase 5 — Background Sync (if needed)
- Workbox Background Sync for failed booking submissions.
- Persistent optimistic state in staff portal with rollback on failure.

### Phase 3B — Revalidation follow-up (if cache stale data observed)
- Reduce `branchServices` TTL below 300s.
- Apply `bookings(branch_id, customer_id)` index from `docs/audits/QUERY_INDEX_RECOMMENDATIONS.md`.

## Known Watch Points
- `useNetworkStatus` tracks device connectivity, not server reachability. If the server is down but Wi-Fi is connected, `isOffline` is `false` and actions will proceed to a server error — the retry-friendly copy on action failures handles this gracefully.
- The `wasOffline` "back online" banner does not auto-dismiss. It stays visible until the user navigates away or refreshes. This is intentional — the user should be aware connectivity was restored so they know it's safe to retry.
