Task ID: OWNER-DASHBOARD-REDESIGN-001
Description: Redesign the Owner Overview page to match the approved executive dashboard reference using real CradleHub data and the existing system theme.
Agent: Codex
Status: COMPLETE
Last Completed: OWNER-DASHBOARD-REDESIGN-001 - Rebuilt Owner Overview dashboard with real data, partial error states, and focused business-rule tests

Previous active task note:
- OWNER-PAYROLL-UI-001 was in progress before this Owner Overview dashboard request. Its implementation notes are preserved below because the new dashboard consumes the fixed-monthly payroll data produced there.

Pre-implementation audit summary:
- Existing Owner routes found: /owner, /owner/bookings, /owner/branches, /owner/branches/new, /owner/branches/[branchId], /owner/schedule, /owner/dispatch, /owner/marketing, /owner/notifications, /owner/payroll, /owner/reports, /owner/services, /owner/services/new, /owner/services/[serviceId], /owner/spaces-rules, /owner/staff, /owner/staff/new, /owner/staff/invite, /owner/staff/onboarding, /owner/staff/[staffId].
- Missing/broken connections: /owner layout still hard-redirects to /crm from DEC-MVP-001; Owner nav is still marked MVP-hidden; role-to-nav fallback still maps owner/manager roles to CRM; Owner nav includes production Dev Panel link; owner prefetch config includes nonexistent /owner/settings and /dev.
- Working connections already present: workspace-access resolver already grants owner users Owner + CRM access; proxy already allows /owner when the workspace resolver grants owner; login uses getWorkspaceSwitchDestination; database schema/types/constants still include owner; RLS has owner-scoped policies for core operational tables.
- Files likely requiring changes: src/app/(dashboard)/owner/layout.tsx, src/components/features/dashboard/nav-config.ts, src/components/features/workspace/workspace-prefetch-config.ts, src/lib/permissions.ts, tests for workspace mapping/route authorization/nav validity.
- Files explicitly out of scope: CRM workflow pages/actions, Staff Portal workflows, Driver Portal workflows, public booking, scheduling calculations, dispatch/live-map logic, Manager restoration, payroll business implementation.
- Database changes expected: none unless validation proves otherwise.
- Regression risks: changing role fallback could affect header/sidebar labels for owner/manager users; owner route activation can expose stale Owner pages if nav links point to missing routes; tests/build must catch invalid navigation and route typing.

OWNER-DASHBOARD-REDESIGN-001 completion summary:
- `/owner` now renders the approved executive-style Owner Overview inside the existing dashboard shell, preserving sidebar/header/workspace switching/auth guard behavior.
- Added server data loader `getOwnerOverviewDashboardData()` with Owner-only authorization, branch-local date handling, Supabase reads for bookings/branches/staff/schedules/check-ins/notifications/tasks, fixed-monthly payroll reuse, and section-level `DashboardLoad` error states.
- Added pure dashboard business rules in `src/lib/owner/dashboard.ts` for paid revenue, completed sessions, active branches/staff, new staff, branch performance normalization, staff on-shift, payroll totals, action merging, and owner-access checks.
- Added dashboard components under `src/components/features/owner/dashboard/`: hero, attention banner, KPI cards, filtered Today at a Glance, Branch Performance, Revenue Trend, Staff Snapshot, Quick Actions, Payroll Snapshot, and Pending Actions.
- Dashboard metric definitions: today's revenue is paid `bookings.amount_paid` for active bookings scheduled today; completed today requires `session_completed_at` or `completed_at` on today's branch-local date; staff on shift uses schedules while `MVP_CHECKIN_PAUSED` is true.
- No Supabase schema/migration changes were made for this dashboard.
- Validation: `pnpm test tests/lib/owner/dashboard.test.ts` PASS (13 tests); `pnpm type-check` PASS; `pnpm lint` PASS with existing warnings only; `pnpm build` PASS. Full `pnpm test` still has the known unrelated booking progress failures in `tests/lib/bookings/progress.test.ts`.
- Browser smoke: existing `http://localhost:3000/owner` redirected unauthenticated users to `/login` with no local app console errors; authenticated visual QA still needs a logged-in Owner session.

Completion summary:
- /owner no longer hard-redirects to /crm. Owner layout now verifies authenticated Owner workspace access and mounts Owner route prefetching.
- Owner users resolve to the Owner nav/default dashboard again; Manager and management variants remain soft-paused to CRM.
- Owner nav/prefetch no longer expose /dev or nonexistent /owner/settings links.
- Proxy path authorization now uses a shared test-covered helper; CRM, Staff Portal, Driver, Utility, public booking, and Manager soft-pause behavior were not intentionally changed.
- Added Vitest coverage for owner workspace construction, protected path authorization, nav restoration, and Owner prefetch route validity.
- Database/migration changes: none.
- Validation: pnpm type-check PASS; pnpm lint PASS with two existing script warnings; focused Owner tests PASS; pnpm build PASS. Full pnpm test has two unrelated existing booking progress failures in tests/lib/bookings/progress.test.ts.

OWNER-PAYROLL-UI-001 pre-implementation notes:
- The attached directive requires the reference mockup's content hierarchy inside the existing Owner shell only; no recreated sidebar/header, no mock annotations, no Lumina branding, no purple styling.
- Existing `/owner/payroll` uses a purple-accent period generator UI in `src/components/features/payroll/payroll-page-client.tsx`; it does not match the approved fixed-monthly dashboard.
- Existing typed tables available: `staff_pay_profiles`, `payroll_periods`, `payroll_items`, `payroll_adjustments`. These can support monthly pay amounts and historical payroll snapshots.
- Missing durable setting surface: no typed payroll settings table currently exists for payday rule/reminder/weekend/settings toggles, so a small migration may be required.
- Must preserve older complex payroll actions/code if safely isolated; hide unsupported commission/attendance/hourly/weekly/deductions/external integrations from the new Owner UI.
- Must not modify CRM, Staff Portal, Driver Portal, booking workflow, schedule engine, dispatch, public site, auth, workspace switching, or global shell.
