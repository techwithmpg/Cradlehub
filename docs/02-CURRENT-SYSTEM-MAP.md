# Current System Map

## Verified current implementation

| Surface | Repository-backed implementation |
| --- | --- |
| Public | Marketing/public pages, branch and service pages, public booking, tracking, waitlist and contact-related routes |
| CRM / Front Desk | Work Queue, bookings, schedule, attendance, customers, availability, services, dispatch, notifications, reconciliation, waitlist, setup, staff, spaces/rules, and live operations routes |
| Owner | Branches, bookings, attendance, dispatch, marketing, notifications, payroll, reports, schedule, services, spaces/rules, and staff routes |
| Manager | Bookings, control, dispatch, live operations, reports, schedule, services, staff, spaces/rules, settings, today, walk-in, and related management routes |
| Staff / Driver / Utility | Staff portal, driver, and utility workspaces; staff/driver job, dispatch, attendance, schedule, profile, map, and service-progress paths where applicable |
| Core domains | Bookings, customers, staff, scheduling, Attendance, services, dispatch/home service, payroll, notifications, and marketing/public-site configuration |

`src/proxy.ts` protects workspace prefixes and derives workspace access from authenticated Supabase users and active staff-role data.

## Architectural ownership

- The web repository is a Next.js application with browser/server components, Server Actions, and route handlers.
- Supabase is the repository-backed data/authentication backend. Booking, customer, staff, schedule, attendance, service, notification, and other domain logic is organized in `src/lib`, route actions, APIs, and Supabase migrations/RPCs.
- Scheduling is individual-first in the current architecture. Service catalogue logic has centralized modules under `src/lib/services`.
- CRM and Owner have retained-workspace architecture in the current codebase.
- Attendance is schedule-aware and record-first in the current repository implementation.

## Requires C1/C2 verification

- Deployed schema and data truth, including the effect of historical migrations.
- Actual operational availability and permission behavior for every workspace.
- Current production readiness of each booking, attendance, scheduling, dispatch, payroll, and notification flow.
- Any paused, limited, or role-gated surface beyond what static repository routes prove.
