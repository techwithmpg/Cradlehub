# CURRENT TASK: MGR-MOB-001 — Mobile Manager Workspace (v2 shell separation + spacing polish)

## Overview
Created a mobile-first simplified Manager Workspace that activates only on mobile breakpoints (`< md`). The existing desktop Manager Workspace is preserved exactly.

v2 fixes:
- Desktop workspace header/sidebar hamburger are now hidden on mobile for manager routes.
- Mobile manager no longer shows "Workspace: Owner" or desktop shell elements.
- KPI cards, quick actions, and booking cards are more compact.
- Bottom nav uses safe-area-inset-bottom and page content has enough bottom padding.
- All screens use tighter spacing for better information density.

## Exact Files Changed

### New files:
- `src/components/features/manager/mobile/types.ts`
- `src/components/features/manager/mobile/manager-mobile-workspace.tsx`
- `src/components/features/manager/mobile/manager-bottom-nav.tsx`
- `src/components/features/manager/mobile/manager-today-screen.tsx`
- `src/components/features/manager/mobile/manager-schedule-screen.tsx`
- `src/components/features/manager/mobile/manager-bookings-screen.tsx`
- `src/components/features/manager/mobile/manager-staff-screen.tsx`
- `src/components/features/manager/mobile/manager-approvals-screen.tsx`
- `src/components/features/manager/mobile/manager-more-screen.tsx`

### Modified:
- `src/app/(dashboard)/manager/page.tsx` — responsive wrapper (`hidden md:block` desktop / `block md:hidden` mobile); fetches additional data for mobile
- `src/app/(dashboard)/layout.tsx` — header wrapped in `hidden md:block`; main padding changed to `p-0 md:p-5` so mobile workspaces control their own padding
- `src/components/features/dashboard/sidebar.tsx` — mobile hamburger is hidden on `/manager*` routes since manager has its own mobile shell

## Behavior After Change
- Desktop (`md` and up): existing `ManagerTodayWorkspace` renders unchanged with full sidebar, KPI cards, timeline, alerts, and action center.
- Mobile (below `md`): new `ManagerMobileWorkspace` renders with bottom nav (Today, Schedule, Bookings, Staff, More) and simplified card-based screens.
- Mobile Today screen: greeting, KPI tiles, quick actions, today's booking flow, attention-needed cards.
- Mobile Schedule screen: staff list with status badges, filter pills (All / Therapists / Available).
- Mobile Bookings screen: search, Bookings/Issues toggle, status filter pills, action cards.
- Mobile Staff screen: pending approval banner, Active/Pending/Off Duty tabs, staff cards with badges.
- Mobile Approvals screen: summary strip, approval cards, operations quick tiles.
- Mobile More screen: branch summary, alerts, menu links (Notifications, Spaces, Settings, Help, Logout).

## Verification
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing (0 errors, 0 warnings)
- `pnpm build`: ✅ Passing (71/71 app routes)

## Commit Message
```
feat(manager): add mobile-first manager workspace variant with shell separation
```
