# CRM Performance Optimization Report

Date: 2026-07-11  
Task: CRM-PERFORMANCE-OPTIMIZATION-001

## Decision

COMPLETE for the safe source-level performance pass requested under the frozen CRM UI constraints.

This pass intentionally prioritized render/effect reductions that preserve visible UI, route state, operator workflows, branch/role scoping, mutation refreshes, realtime behavior, and public/server contracts.

## Changes Made

### Today Work Queue Summary

File: `src/components/features/crm/today/work-queue-dashboard.tsx`

- Added a memoized single-pass summary over `queueData`.
- Removed a per-render action array allocation plus a separate filter for `needsActionCount`.
- Kept the displayed summary values and readiness panel behavior unchanged.

### Today Work Queue Panel

File: `src/components/features/crm/today/work-queue-panel.tsx`

- Replaced three separate category count filters with one memoized counter pass.
- Memoized the active filter config and visible row filtering.
- Preserved URL filter behavior, keyboard navigation, row ordering, and action menus.

### Bookings Workspace

File: `src/components/features/bookings/bookings-workspace.tsx`

- Made initial tab derivation lazy so it runs only for initial state.
- Memoized workflow tab counts by `bookings`.
- Memoized the active-tab booking list and secondary-filtered visible list.
- Preserved the workflow tabs, URL updates, filter form, selected booking behavior, and `BookingsTable` props.

### Dispatch Live Map

File: `src/components/features/dispatch/dispatch-live-map-tab.tsx`

- Added a stable `useCallback` handler for map marker selection.
- Prevented `MapCanvas` from rerunning its Google Maps effect solely because selected booking state changed.
- Preserved map search, booking selection, marker click behavior, fallback map state, and route links.

## Verification

| Command | Result |
| --- | --- |
| `pnpm type-check` | PASS |
| `pnpm lint` | PASS |
| `pnpm test -- --run --testTimeout=10000` | PASS, 83 files / 674 tests |
| `pnpm build` | PASS, Next.js 16.2.4, 108 app routes generated |

## Bundle Outcome

The optimization did not reduce bundle size. Final JS chunk bytes increased by 276 bytes because the changes added React hook imports. This was accepted because the evidence-backed wins are in runtime work:

- fewer derived array allocations during Today queue summary renders,
- fewer Work Queue category scans,
- fewer Bookings tab/filter recalculations on local UI state changes,
- fewer Google Maps effect reruns when dispatch selection changes.

## What Was Not Changed

- No schema, migration, RLS, Supabase policy, or index changes.
- No route structure, public API, server-action contract, or business workflow changes.
- No visual redesign, copy changes, status terminology changes, or layout restructuring.
- No caching changes for live operational CRM data.
- No dynamic-import refactor for Bookings/Attendance/Dispatch modals or tab internals.

## Follow-up Candidates

These remain candidates for a later, separately certified performance phase:

- Add a proper bundle analyzer workflow after the UI freeze, then split only routes/components with measured payload wins.
- Certify Bookings in an authenticated browser session before changing its large table/modal boundaries.
- Profile CRM setup/staff-availability manifests, which currently have the largest CRM client reference manifests.
- Review `select("*")` query shapes in staff/setup/schedule modules with DTO-level tests before narrowing columns.
