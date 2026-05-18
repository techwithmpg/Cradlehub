# CURRENT TASK: BOOKING-SERVICES-001 — Premium Image-Card Services Step

## Status
Completed on 2026-05-18.

## Summary
Rewrote `BookingServicePicker` to render each service as a portrait (4/5 aspect ratio) image card instead of a horizontal text row:
- `ServiceImageCard` — `next/image fill` background, dark-to-light gradient overlay, selection ring + +/✓ indicator top-right, name/duration/price pinned to bottom
- `getCategoryImage()` — keyword matching on category name → `SPA_IMAGES` (no per-service image column)
- `CATEGORY_IMAGE_KEYWORDS` — ordered list: couples → hotStone → deepTissue → aromatherapy → reflexology → nail → facial → massage → wellness → fallback
- Loading skeleton: `grid grid-cols-2` with `aspect-ratio: 4/5` matching new card layout
- All business logic (grouping, category sidebar, mobile scroll, toggle, selection summary, totals) unchanged

## Files Modified
- `src/components/public/booking-service-picker.tsx` — full card-layer rewrite; logic untouched

## Verification
- `pnpm type-check`: ✅ Passing (0 errors)
- `pnpm lint`: ✅ Passing (0 errors)
- `pnpm build`: ✅ Passing, 80 routes

---

# Previous Task: BOOKING-PROVIDER-001 — Smart Provider Selection in Public Booking Wizard

## Status
Completed on 2026-05-18.

## Summary
Three-case smart provider selection in the public (and inhouse) booking wizard:
- **0 providers**: existing fallback message ("Any available provider, our team will assign…")
- **1 provider**: auto-assigned silently — booking card shows the provider with "Use any available provider instead" escape hatch
- **2+ providers**: premium 4-column photo grid on desktop (2-column on mobile) with "Any available provider" as recommended option

## Architecture
- **No useEffect**: auto-selection is derived purely in the `selectedStaffForBooking` useMemo — no cascading renders
- **`"prefer-auto"` sentinel**: distinguishes "user explicitly chose any-available" (must respect) from `"auto"` (default with no choice yet, triggers auto-select when 1 provider)
- **Nickname-first display**: `staffAtSlot()` now prefers `lookup.nickname` over `lookup.name` for display, matching public-facing card style
- **Avatar support**: `avatar_url` and `nickname` propagated from API → `StaffLookup` → `StaffOption` → photo card

## Files Modified
- `src/app/api/public/booking-context/route.ts` — Added `nickname` and `avatar_url` to staff select, response map, and fallback guard
- `src/components/public/booking-wizard.tsx` — Types updated; `staffAtSlot` prefers nickname; `selectedStaffForBooking` handles 3-case auto-select; `ProviderPhotoCard` component added; `StepTherapist` redesigned with 3 cases; summary label "Auto-assign" → "Any available provider"

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
