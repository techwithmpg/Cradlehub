# Current Task

## 2026-05-02 — OWNER-001: Owner Reports / Analytics Page

### Objective
Create a premium owner analytics page at `/owner/reports` that exposes existing analytics data through the UI.

### Existing Backend Actions
- `getRevenueByBranchAction(fromDate, toDate)` — in `src/app/(dashboard)/owner/bookings/actions.ts`
- `getStaffProductivityAction(fromDate, toDate)` — in `src/app/(dashboard)/owner/bookings/actions.ts`
- `getBookingTrendAction(days)` — in `src/app/(dashboard)/owner/bookings/actions.ts`

### Scope
- ✅ Add Reports nav link to owner sidebar
- ✅ Create `/owner/reports` page with date range controls
- ✅ KPI summary cards (Total Revenue, Total Bookings, Top Branch, Top Staff)
- ✅ Revenue by Branch section with CSS bar chart
- ✅ Staff Productivity section with ranked list
- ✅ Booking Trend section with CSS bar chart
- ✅ Empty states, loading state, error handling
- ✅ Responsive design (mobile-first)
- ✅ Helper utilities with tests
- ✅ No fake data — use real actions only
- ✅ No new dependencies (Recharts not installed; use CSS charts)

### Files Created/Updated
- `src/app/(dashboard)/owner/reports/page.tsx`
- `src/app/(dashboard)/owner/reports/loading.tsx`
- `src/components/features/owner/reports/owner-reports-page.tsx`
- `src/components/features/owner/reports/report-date-filter.tsx`
- `src/components/features/owner/reports/report-kpi-cards.tsx`
- `src/components/features/owner/reports/revenue-by-branch-card.tsx`
- `src/components/features/owner/reports/staff-productivity-card.tsx`
- `src/components/features/owner/reports/booking-trend-card.tsx`
- `src/components/features/owner/reports/reports-empty-state.tsx`
- `src/lib/owner/reports.ts`
- `src/components/features/dashboard/nav-config.ts`
- `tests/lib/owner/reports.test.ts`

### Status
✅ Completed.
