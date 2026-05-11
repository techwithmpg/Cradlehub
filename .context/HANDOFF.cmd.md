# HANDOFF — MGR-MOB-001 Mobile Manager Workspace

## Date
2026-05-11

## Agent
Kimi

## Summary
Added a premium mobile-first Manager Workspace that renders only on mobile breakpoints. v2 separated the mobile manager from the desktop workspace shell and tightened spacing across all mobile screens.

## Files Changed

### New:
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
- `src/app/(dashboard)/manager/page.tsx`
- `src/app/(dashboard)/layout.tsx`
- `src/components/features/dashboard/sidebar.tsx`

## Behavior After Change
- Desktop (`md` and up): existing `ManagerTodayWorkspace` with sidebar, KPI cards, timeline, alerts.
- Mobile (below `md`): new `ManagerMobileWorkspace` with bottom nav and 5 tabs:
  - **Today**: greeting, branch label, compact KPI tiles, compact quick actions, today's booking flow, attention-needed cards.
  - **Schedule**: staff list with status badges, filter pills (All / Therapists / Available).
  - **Bookings**: search, Bookings/Issues toggle, status filter pills, booking/issue cards.
  - **Staff**: pending approval banner, Active/Pending/Off Duty tabs, staff cards with badges.
  - **More**: branch summary, alerts, menu links (Notifications, Spaces, Settings, Help, Logout).
- Desktop shell (header "Workspace: X", sidebar hamburger) is hidden on mobile for manager routes.
- Bottom nav uses `env(safe-area-inset-bottom)` so it is not cut off on devices with home indicators.
- Page content has 96px bottom padding so it scrolls above the bottom nav.

## Verification
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing (0 errors, 0 warnings)
- `pnpm build`: ✅ Passing (71/71 app routes)

## Remaining Notes / Future Improvements
- The mobile BookingCard and AttentionCard have disabled Review/Resolve buttons. Wire them to existing server actions when mobile action flows are ready.
- The mobile Schedule screen does not yet filter by "Nail Techs" because `get_daily_schedule` RPC does not return `staff_type`.
- The mobile "Add Walk-in" quick action opens the existing `WalkinDialog`. Test dialog sizing on real mobile viewports.
- Consider adding swipe gestures between tabs for smoother mobile navigation.
- Other workspaces (owner, CRM, staff-portal) on mobile now have no desktop header and no layout padding. They will need their own mobile shells when mobile variants are built.
