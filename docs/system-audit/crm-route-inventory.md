# CRM Route Inventory

Captured: 2026-07-10

## Scope

This inventory covers the operational CRM routes named in the stabilization prompt. It records current source of truth files, server loaders, client shells, action surfaces, and permission gates.

## Route Matrix

| Route | Page file | Primary loaders | Client shell | Mutations/actions | Permission/context |
| --- | --- | --- | --- | --- | --- |
| `/crm/today` | `src/app/(dashboard)/crm/today/page.tsx` | `getFrontDeskContext`, `getTodaysSchedule`, `getCrmPendingBookingQueue`, `getCrmTodaySnapshot`, `getCrmReadinessCached`, driver/location/tracking helpers, attendance scan feed | `CrmTodayShell` -> `WorkQueueDashboard` | `updateWorkQueueBookingStatusAction`, manager payment action, driver assignment, tracking link action | `getFrontDeskContext` provides branch/role |
| `/crm/bookings` | `src/app/(dashboard)/crm/bookings/page.tsx` | `getFrontDeskContext`, `getCrmBookingsCommandCenterRows`, `getDailyPaymentSummary`, waitlist, optional booking-date lookup | `CrmBookingsView` -> `BookingsWorkspace` | `src/app/(dashboard)/crm/bookings/actions.ts`, manager payment action | `getFrontDeskContext`; actions use `canAccessCrmWorkspace` and branch checks |
| `/crm/schedule` | `src/app/(dashboard)/crm/schedule/page.tsx` | `getFrontDeskContext`, `getDailySchedule`, `getStaffWithAvailability`, `getManagerDashboardStats`, active resources, readiness, scheduling rules | `ScheduleWorkspaceShell` | `src/app/(dashboard)/crm/schedule/actions.ts` | `getFrontDeskContext` |
| `/crm/attendance` | `src/app/(dashboard)/crm/attendance/page.tsx` | `getFrontDeskContext`, request origin, `getAttendanceWorkspaceData`, record filter parser | `AttendanceWorkspace` | `src/app/(dashboard)/crm/attendance/actions.ts` | `getFrontDeskContext`; attendance actions resolve their own action context |
| `/crm/customers` | `src/app/(dashboard)/crm/customers/page.tsx` | `getCrmContext`, tab-specific customer queries, waitlist, `getCrmStats` | `CustomersWorkspace` | customer profile/update actions in `src/app/(dashboard)/crm/actions.ts`; waitlist actions | `getCrmContext` |
| `/crm/dispatch` | `src/app/(dashboard)/crm/dispatch/page.tsx` | `getFrontDeskContext`, `getDispatchData`, branch business date | `HomeServiceDispatchWorkspace` plus `CrmTabNav` | dispatch preparation via booking actions, driver assignment action, assignment recommendations | `getFrontDeskContext`; page is `force-dynamic` |
| `/crm/staff` | `src/app/(dashboard)/crm/staff/page.tsx` | custom staff context, staff roster, pending staff, branches, services, provider assignments, onboarding requests, branch correction inbox | `CrmStaffWorkspace` | `src/app/(dashboard)/crm/staff/actions.ts` and staff/service actions | `canAccessCrmWorkspace`, `canReviewStaffOnboarding`, branch scoped |
| `/crm/staff-availability` | `src/app/(dashboard)/crm/staff-availability/page.tsx` | `getFrontDeskContext`, owner branch switcher, staff availability, schedule setup overview | `ScheduleSetupWorkspace` plus health/import panels | `src/app/(dashboard)/crm/staff-availability/actions.ts` | owner may switch branch; others use assigned branch |
| `/crm/setup` | `src/app/(dashboard)/crm/setup/page.tsx` | custom setup context, setup health, services, branch detail, booking rules, today's bookings, provider assignments | `CrmSetupWorkspace` | setup/services/resources actions in related modules | `canManageCrmSetup`, `canManageResources` |
| `/crm/reconciliation` | `src/app/(dashboard)/crm/reconciliation/page.tsx` | custom CRM staff context, daily payment summary, reconciliation history | `ReconciliationForm` plus inline history panel | `src/app/(dashboard)/crm/reconciliation/actions.ts` | `canAccessCrmWorkspace`, branch scoped |

## Adjacent CRM Routes

The tree also contains route files for `/crm`, `/crm/[customerId]`, `/crm/lapsed`, `/crm/repeats`, `/crm/services`, `/crm/control`, `/crm/availability`, `/crm/live-operations`, `/crm/staff-applications`, `/crm/waitlist`, `/crm/bookings/new`, `/crm/spaces-rules`, and `/crm/notifications`. They were not aligned in this pass.

## Shared Active Components

- Today: `src/components/features/crm/today/*`, especially `CrmTodayShell`, `WorkQueueDashboard`, `CrmPanel`, `CrmMetricCard`, `CrmTodayTabBar`.
- Bookings: `src/components/features/bookings/crm-bookings-view.tsx`, `bookings-workspace.tsx`, `bookings-table.tsx`, follow-up/reschedule/room modals.
- Attendance: `AttendanceWorkspace`, `AttendanceTabs`, overview/records/sessions/recovery/QR/device tabs.
- Dispatch: `dispatch-workspace.tsx`, flow/map/progress tabs, `home-service-dispatch-modal.tsx`.
- CRM shared: `CrmTabNav`, premium table/filter/status/empty/loading/preview rail components.
- Legacy/shared dashboard: `PageHeader` still appears in staff, setup, staff availability, reconciliation, and customer detail routes.

## Current Contract Risks

- Several routes rely on custom context functions instead of one CRM auth/context helper, so permission behavior is correct but unevenly expressed.
- Staff/setup/reconciliation still use older page header and/or inline layout styling while today/bookings/dispatch/attendance use newer operational shells.
- Some operational pages preload data for every tab even when only one tab is visible. That is a performance concern, not a behavior bug.
- Route-level actions are branch scoped, but the enforcement is split between page context, action context, and helper modules.

