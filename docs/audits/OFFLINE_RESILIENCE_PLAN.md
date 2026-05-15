# Offline / Poor Connectivity Resilience Plan — PERF-PHASE4-001

**Date:** 2026-05-15  
**Status:** Implemented

## Scope

Protect all write-path flows from silent failures when the device has no connectivity. This does not add a service worker, background sync, or persistent caching — `public/sw.js` remains intentionally self-unregistering (unregisters on activate, deletes all caches).

---

## What was implemented

### A — `src/hooks/use-network-status.ts`

Client-only hook. Tracks `navigator.onLine` and listens to `window` `online` / `offline` events.

- Starts with `null` (unresolved) to avoid hydration mismatch. Resolves to `navigator.onLine` on first mount.
- Returns `{ isOnline, isOffline, wasOffline, lastChangedAt }`.
- `wasOffline` stays `true` once set — used to show a "back online" recovery banner.
- No `"use client"` directive in the hook file; callers are client components.

### B — `src/components/shared/offline-banner.tsx`

Fixed-position banner (`z-index: 9999`, top of viewport). Two states:

| State | Visual | `aria-live` |
|---|---|---|
| Offline | Dark charcoal bar, `WifiOff` icon, message about disabled actions | `assertive` |
| Back online (after having been offline) | Dark green bar, "Back online." | `polite` |

When `isOnline && !wasOffline` (no change ever happened) — renders nothing.

### C — Layouts

`OfflineBanner` is mounted in:
- `src/app/(dashboard)/layout.tsx` — inside the outer flex container, rendered first.
- `src/app/(public)/layout.tsx` — before `<SiteHeader>`.

Both are Server Components that render the `OfflineBanner` Client Component as a child. Next.js App Router handles the client boundary automatically.

### D/E — `src/components/public/booking-wizard.tsx` (public + CRM/inhouse)

Both public and inhouse modes use the same `BookingWizard` component.

- `useNetworkStatus()` called at the top of `BookingWizard`.
- `handleSubmit` early-returns with `setFormError("You're offline. Check your connection and try again.")` when `isOffline`.
- "Confirm Booking" button: `disabled={!canProceed || submitting || isOffline}`.
- On server-action failure: if the message contains "fetch", "network", or "failed to", the displayed error becomes "Check your connection and try again." instead of a raw server message.

### F — `src/components/features/dashboard/booking-action-menu.tsx`

Used by: manager today page, bookings table, CRM control console, schedule timeline.

- `useNetworkStatus()` called inside the component.
- `handleAction` short-circuits before `startTransition` when `isOffline`, sets `feedback` to "You're offline — check your connection and try again."
- Trigger button `disabled` extended to include `|| isOffline`.
- On server-action failure: error message appended with "Check your connection and try again."

### G — `src/components/features/staff-portal/booking-progress-actions.tsx`

Staff portal booking progress stepper (advance status + no-show).

- `useNetworkStatus()` called inside the component.
- `handleAdvance` early-returns when `isPending || isOffline`.
- Both action buttons (advance + no-show) have `disabled={isPending || isOffline}` and cursor/opacity updated accordingly.
- Failure `alert` message includes retry hint.

### H — Retry-friendly error copy

All modified components now produce user-readable retry instructions:
- "You're offline. Check your connection and try again." (pre-submit guard)
- "You're offline — check your connection and try again." (action menu, inline feedback)
- "Check your connection and try again." (server-action failure fallback)

### I — `public/sw.js` — No change

Confirmed: the file self-unregisters on `activate` and clears all caches. This is correct — there is no caching strategy to maintain. No changes made.

---

## What was NOT changed

| Area | Reason |
|---|---|
| Service worker strategy | No new SW; existing SW self-unregisters by design |
| Background sync | Out of scope — would require persistent storage and registration |
| Optimistic UI | Not needed; actions are gated at the boundary, not queued |
| Fetch-level retry | Server actions use Next.js RPC — no fetch wrapper to intercept |
| Read-path (data fetching) | Network errors on reads show loading states already; no user write at risk |
| Waitlist, reconciliation, onboarding forms | Lower-risk or less frequent; covered by the banner |

---

## Components NOT protected (low priority)

| Component | Reason |
|---|---|
| `staff-weekly-hours-editor.tsx` | Owner-only, rarely used, low risk |
| `branch-services-panel.tsx` | Owner-only CRUD; banner already visible |
| `reconciliation-form.tsx` | Internal finance tool; banner covers it |
| `waitlist-queue.tsx` | Low-frequency action; banner covers it |
| `onboarding-form.tsx` | One-time use; banner covers it |

---

## Stale-data risk

`useNetworkStatus` tracks connectivity, not server reachability. If the server is down but the device is online, `isOffline` will be `false` — the action will proceed and may show a server error. This is acceptable: the retry-friendly error copy handles it.

---

## Next Steps (if needed)

- If background sync for failed booking submissions is required, implement a service worker with Workbox Background Sync and a persistent queue.
- If optimistic status updates are requested for the staff portal, add local state updates with rollback on error.
