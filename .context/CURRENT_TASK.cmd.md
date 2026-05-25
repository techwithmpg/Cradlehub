# CURRENT TASK: WORKSPACE-PREFETCH-001

## Status
COMPLETE

## Task ID
WORKSPACE-PREFETCH-001

## Description
Implement workspace route warm-up and smart prefetching for CradleHub CRM/Manager/Owner workspaces.

## Changes
- Created reusable `WorkspaceRoutePrefetcher` client component with connection-aware prefetching
- Created workspace-specific route configs (CRM, Manager, Owner, Staff Portal, Driver)
- Mounted prefetcher in CRM layout, created Manager and Owner layouts for the same
- Added hover prefetch to sidebar NavLink for instant route warming on mouse enter
- Extended cache tags system with workspace-scoped tags and batch invalidation helpers
- Created cached query wrappers for high-traffic workspace data (today snapshot, availability, dispatch, setup health)
- Added cache tag invalidation to key action files:
  - staff-checkins, driver-actions, crm/bookings, manager/bookings, owner/bookings,
    crm/actions, manager/staff, crm/staff-availability, crm/services

## Safety
- Respects Data Saver mode (skips all prefetch)
- Respects slow 2g connections (skips idle prefetch)
- Does not prefetch heavy routes (reports, maps, analytics) automatically
- Does not bypass RBAC or fetch unauthorized routes
- No booking logic changed
- No DB schema changed

## Files Changed
- src/components/features/workspace/workspace-route-prefetcher.tsx (new)
- src/components/features/workspace/workspace-prefetch-config.ts (new)
- src/app/(dashboard)/crm/layout.tsx (add prefetcher)
- src/app/(dashboard)/manager/layout.tsx (new)
- src/app/(dashboard)/owner/layout.tsx (new)
- src/components/features/dashboard/sidebar.tsx (hover prefetch)
- src/lib/cache/cache-tags.ts (workspace tags + helpers)
- src/lib/queries/workspace-cached.ts (new)
- src/lib/actions/staff-checkins.ts
- src/lib/actions/driver-actions.ts
- src/app/(dashboard)/crm/bookings/actions.ts
- src/app/(dashboard)/manager/bookings/actions.ts
- src/app/(dashboard)/owner/bookings/actions.ts
- src/app/(dashboard)/crm/actions.ts
- src/app/(dashboard)/manager/staff/actions.ts
- src/app/(dashboard)/crm/staff-availability/actions.ts
- src/app/(dashboard)/crm/services/actions.ts

## Build Status
- pnpm type-check: ✅ Passing (0 errors)
- pnpm lint: ✅ Passing (0 errors, 1 pre-existing warning)
- pnpm build: ✅ Passing (99 routes)

## Agent
Claude Code (main branch, E:/cradlehub)

## Branch
main
