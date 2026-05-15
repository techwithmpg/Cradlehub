# CURRENT TASK: PERF-PHASE4-001 — Offline / Poor Connectivity Resilience

## Status
Completed on 2026-05-15.

## Completed Scope

### Hook
- `src/hooks/use-network-status.ts` — `useNetworkStatus()` hook using `useSyncExternalStore`. Tracks `navigator.onLine` + `online`/`offline` events. Returns `{ isOnline, isOffline, wasOffline, lastChangedAt }`. No hydration mismatch.

### Banner
- `src/components/shared/offline-banner.tsx` — Fixed-position `"use client"` banner. Offline state: dark charcoal + `WifiOff` icon + `aria-live="assertive"`. Back-online state: dark green + `aria-live="polite"`. Disappears while online and connectivity never changed.

### Layout mounts
- `src/app/(dashboard)/layout.tsx` — `<OfflineBanner />` rendered inside outer flex container.
- `src/app/(public)/layout.tsx` — `<OfflineBanner />` rendered before `<SiteHeader>`.

### Protected write paths
1. **Public booking wizard** (`booking-wizard.tsx`) — `handleSubmit` early-returns offline. "Confirm Booking" disabled when `isOffline`. Retry-friendly error on server failures.
2. **CRM inhouse booking** — same `BookingWizard` component in `mode="inhouse"`, covered automatically.
3. **Manager booking status update** (`booking-action-menu.tsx`) — `handleAction` short-circuits offline. Trigger button disabled. Feedback copy includes retry hint.
4. **Staff portal progress actions** (`booking-progress-actions.tsx`) — `handleAdvance` early-returns offline. Both buttons disabled + styled when offline.

### Docs
- `docs/audits/OFFLINE_RESILIENCE_PLAN.md` — Full implementation plan, rationale, exclusions, next steps.

### `public/sw.js`
Confirmed self-unregistering — no changes.

## Verification
- `pnpm type-check`: ✅ Passing (0 errors)
- `pnpm lint`: ✅ Passing (0 errors, 2 pre-existing warnings in `staff-onboarding/onboarding-form.tsx`)
- `pnpm build`: ✅ Passing, 79 routes

## Next Phase Options

### Phase 5 — Background Sync (if needed)
- Service Worker with Workbox Background Sync queue for failed booking submissions.
- Persistent optimistic state in staff portal with rollback on error.

### Phase 3B — Revalidation Follow-up (if cache behavior is unstable)
- Reduce TTL for branch services if stale data is observed.
- Apply the `bookings(branch_id, customer_id)` index from `docs/audits/QUERY_INDEX_RECOMMENDATIONS.md`.
