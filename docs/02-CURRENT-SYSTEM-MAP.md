# Current System Map

## Verified repository implementation

The accepted C1 baseline contains 109 App Router `page.tsx` entries and 25 `route.ts` handlers. Route existence proves source presence, not deployed availability, correct permissions, or operational correctness.

| Surface | Routes and primary source ownership |
| --- | --- |
| Public | `/`, `/about`, `/branches`, `/services`, `/products`, `/contact`, local marketing pages, `/book` and booking guide/success paths, `/track/[token]`, `/scan/*`, and public booking/waitlist APIs. Public booking is centered on `src/components/public/booking-wizard.tsx`, `src/lib/actions/online-booking.ts`, availability APIs, and service-catalog modules. |
| CRM / Front Desk | `/crm/today` Work Queue plus bookings, schedule, Attendance, customers, dispatch, live operations, notifications, reconciliation, setup, and staff surfaces. `/crm/availability`, `/crm/services`, `/crm/spaces-rules`, `/crm/waitlist`, and `/crm/staff-availability` are compatibility redirects into consolidated Schedule, Setup, or Customers views. `src/lib/queries/crm-context.ts` supplies branch-scoped context. |
| Owner | `/owner` plus branches, bookings, Attendance, dispatch, marketing, notifications, payroll, reports, schedule, services, spaces/rules, and staff. Owner pages use shared query/action modules and page-level owner checks where required. |
| Manager | `/manager` plus bookings, control, dispatch, live operations, notifications, operations, reports, resources, schedule, services, settings, spaces/rules, staff, today, and related routes. `/manager/today` aliases `/manager`; `/manager/resources` redirects to spaces/rules. Route presence does not resolve the retained source comments describing parts of Manager as soft-paused. |
| Staff portal | `/staff-portal` plus Attendance, dispatch, jobs, map, notifications, profile, schedule, service-progress, stats, today, and week paths. Mode derivation selects basic, therapist/service, or driver-oriented components. |
| Driver | `/driver`, dispatch, jobs, job detail, and map entries backed by staff-portal actions, dispatch queries, location/tracking actions, and role/branch checks. |
| Utility | `/utility` is a repository-backed workspace root with authenticated utility-role gating; no deeper utility route tree exists. |
| Marketing | `/marketing` and `/owner/marketing` use public-site section/asset queries, draft/studio actions, and public-section defaults. |
| Core domains | Bookings, customers, staff, scheduling, Attendance, services, dispatch/home service, payroll, notifications, and marketing/public-site configuration live across `src/lib`, Server Actions, route handlers, typed Supabase clients, and migrations/RPCs. |

`src/proxy.ts` protects workspace prefixes and derives workspace access from authenticated Supabase users and active staff-role data. API routes are excluded from proxy authorization and must enforce their own public/authenticated contract.

## Architectural ownership

- The web repository is a Next.js 16.2.4 / React 19.2.4 application with browser/server components, Server Actions, route handlers, and a proxy.
- Supabase is the repository-backed data/authentication backend. Booking, customer, staff, schedule, attendance, service, notification, and other domain logic is organized in `src/lib`, route actions, APIs, and Supabase migrations/RPCs.
- Scheduling is individual-first in the current architecture. Service catalogue logic has centralized modules under `src/lib/services`.
- CRM and Owner have retained-workspace architecture in the current codebase.
- Attendance is schedule-aware and record-first in the current repository implementation.
- Selected Attendance, schedule, staff-portal, and notification experiences subscribe to Supabase Realtime `postgres_changes` channels.
- Storage usage found in source is the `staff-pictures` bucket for onboarding and staff profile images.

## Requires later authorized verification

- Deployed schema and data truth, including the effect of historical migrations; C1 live database verification was unavailable.
- Actual operational availability and permission behavior for every workspace.
- Current production readiness of each booking, attendance, scheduling, dispatch, payroll, and notification flow.
- Any paused, limited, or role-gated surface beyond what static repository routes prove.
- GitHub branch protection/rulesets and the Vercel project linkage, production branch, and deployed commit.

See [Current-System Truth](03-CURRENT-SYSTEM-TRUTH.md) for the C1 evidence and classifications.
