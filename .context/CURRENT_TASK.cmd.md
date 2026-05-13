# CURRENT TASK: CONTROL-001 — Booking Control Console MVP

## Overview
Created a professional operational control page (`/manager/control` and `/crm/control`) that gives manager and CRM users a consolidated view of today's bookings with KPIs, progress tracking, payment actions, and operational warnings.

## What changed
1. **New components:**
   - `control-kpi-strip.tsx` — 7 operational KPIs
   - `control-booking-card.tsx` — Enhanced cards with progress stepper, payment badges, warning banners, inline actions
   - `control-queue.tsx` — Tabbed queue (All, Active, Home, In Spa, Unpaid, Issues)
   - `control-console-page.tsx` — Main layout with left queue + right summary rail

2. **New routes:**
   - `/manager/control` — Manager branch-scoped control console
   - `/crm/control` — CRM/CSR branch-scoped control console

3. **Query enhancements:**
   - `getTodaysSchedule` select variants now include `booking_progress_status` and timestamp fields
   - `TodayScheduleRow` type extended with `MaybeProgressFields`

4. **Navigation:**
   - "Control" added to Manager, CRM, CSR Head, and CSR Staff sidebars

## Files changed
- `src/lib/queries/bookings.ts` — progress fields in select variants
- `src/components/features/dashboard/nav-config.ts` — Control nav items
- `src/components/features/control-console/*` — 5 new files
- `src/app/(dashboard)/manager/control/page.tsx` — CREATED
- `src/app/(dashboard)/crm/control/page.tsx` — CREATED

## Verification
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing (0 errors, 4 pre-existing warnings)
- `pnpm build`: ✅ Passing, 79 app routes.

## Next Phase
Phase 3.1: Owner cross-branch control console (requires cross-branch today's schedule query).
Phase 4: Booking Delivery Type Cleanup (`in_spa` as first-class database type).
