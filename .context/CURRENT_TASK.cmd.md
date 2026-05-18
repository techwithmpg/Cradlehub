# CURRENT TASK: UI-WARNING-FRAMEWORK-001 — System-Wide Actionable Warning Framework

## Status
Completed on 2026-05-18.

## Summary
Created a reusable warning system so every warning in CradleHub answers: what is wrong, why it matters, where to fix it, and what happens on click. All warnings are now clickable cards with a unified action dispatch model.

## Architecture
- `ActionableWarning` type with discriminated `WarningActionType`: `scroll | focus | navigate | open-panel | modal | custom`
- Each target type resolves to a concrete behaviour in the click handler (DOM scroll, DOM focus, router.push, or parent onAction callback)
- `warningTargets` factory object covers every known warning context in the app (staff, scheduling, branches, services, bookings, dispatch, notifications, settings)
- Severity palette matches all existing inline warning divs (danger/warning/success/info)

## Files Created
- `src/types/warnings.ts` — `WarningSeverity`, `WarningActionType`, `ActionableWarningTarget`, `ActionableWarning` types
- `src/lib/warnings/scroll-to-target.ts` — `scrollToElement`, `focusElement`, `buildHref` DOM helpers
- `src/lib/warnings/action-targets.ts` — `warningTargets` factory covering all known CradleHub contexts
- `src/components/shared/actionable-warning.tsx` — `ActionableWarning` card component with severity theming and action dispatch
- `src/components/shared/actionable-warning-list.tsx` — `ActionableWarningList` vertical stack component

## Files Modified
- `src/components/features/staff/staff-approval-workspace.tsx` — Replaced all 7 inline warning divs with `ActionableWarning` / framework; added `id="approval-actions"` for scroll targeting; wired `onAction` for service-editor panel

## Verification
- `pnpm type-check`: ✅ Passing (0 errors)
- `pnpm lint`: ✅ Passing (0 errors)
- `pnpm build`: ✅ Passing, 80 routes

---

# Previous Task: UI-STAFF-EDIT-001 — Manager Staff Approval Page Redesign

## Status
Completed on 2026-05-18.

## Summary
Replaced the monolithic `StaffEditForm` (checkbox-heavy, crowded) with a focused two-component design:
1. `StaffApprovalWorkspace` — orchestrator with inline sub-components (header, info card, service summary card, summary panel)
2. `StaffServiceEditorSheet` — Sheet-based service picker with collapsible category rows, search, quick actions, and pagination per category

The main page shows a compact service capability summary (count + up to 6 preview chips + "Edit services" button). Heavy service selection only appears when the manager explicitly opens the sheet.

## Files Changed
- `src/components/features/staff/staff-approval-workspace.tsx` — Full rewrite
- `src/components/features/staff/staff-service-editor-sheet.tsx` — New file
- `src/app/(dashboard)/manager/staff/[staffId]/page.tsx` — Updated to use workspace

## Verification
- `pnpm type-check`: ✅ Passing (0 errors)
- `pnpm lint`: ✅ Passing (0 errors)
- `pnpm build`: ✅ Passing, 80 routes

---

# Previous Task: PERF-PHASE4-001 — Offline / Poor Connectivity Resilience

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
