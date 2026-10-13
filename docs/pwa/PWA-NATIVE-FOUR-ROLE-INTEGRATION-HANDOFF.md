# Staff PWA four-role integration review handoff

**Status: CORRECTION REQUIRED before merge.** The actor-aware progress migration is source-only and has not been executed against a classified isolated database. Authenticated role flows, physical-device launch, and performance remain unverified. This branch is a draft review candidate only. Do not merge or deploy from this handoff.

## Baseline and reconciliation

- Accepted `origin/main`: `3f8f4067c4c9e0e3e2122b97d4d0694fac0dbb20` (re-fetched and unchanged).
- Provider: `2d5efae9ee1b3a8e323a53cd7556c85238a78b60` (historical PR #19).
- Utility: `a02881def75362ae4ccda5b9b731b075d66887c6` (historical PR #20).
- Driver: `2585a18fd048311f35f4236e0c805aff171eb525`.
- CRM/general: `8e71d35d2c66ef87dd33bd2f2f54701aad851d2c`.
- Integration branch: `stage/staff-pwa-native-integration`, created directly from exact CRM HEAD. The four role commits are linear descendants of accepted main; no rebase, squash, merge, or history rewrite was needed. Original stacked branches and stashes were preserved.

## Source findings and corrections

1. **Utility P0, corrected:** `markRoomReady()` now requires active Utility staff, same task/resource branch, in-progress state, and the same assigned cleaner at pre-read and atomic update. The update also constrains task scope, type, entity and assignment. Zero-row conflicts re-read status, owner, branch and task identity before returning an idempotent or forbidden result. Same-branch teammate, cross-branch, ownership and branch races, open state, cancellation and own completed retry are covered by tests.
2. **Utility claim hardening:** `startRoomCleaning()` no longer steals a preassigned open task; its atomic claim compares null or existing self ownership plus task identity. Cancelled tasks return their actual terminal state.
3. **Actor-aware progress boundary, source corrected:** the initial Driver-only guard left Provider travel and in-spa check-in/no-show on the old privileged writer after an application pre-read. The shared action now calls `advance_staff_booking_progress` for every non-session progress mutation. Its new service-role-only SQL function locks the active staff row and booking row, checks operational role, branch, assignment/authority, delivery type, lifecycle and exact current transition, then delegates to the existing progress writer. `session_started` and `completed` retain their separate actor-aware session RPCs. The SQL migration is **source only and not applied**; database behavior is **NOT VERIFIED**.
4. **Staff scope:** Driver Today/Map error redirects and a Staff proxy lookup-error redirect now target `/staff/login`, retaining installed-app scope.
5. **Role URL isolation:** tests cover direct canonical paths for Provider, Utility, Driver and CRM, plus excluded owner/manager/assistant_manager/store_manager/digital_marketer. Role resolver and UI profile agree for provider compatibility and CSR aliases.

### Progress authority decision and exact transitions

Accepted C3 service-provider scope freezes the Home Service sequence `not_started → travel_started → arrived → session_started → completed` for assigned Providers. The existing Provider `BookingProgressActions` exposes the travel steps, and the shared action explicitly allowed the assigned therapist. **Decision: assigned Provider travel is intended and is preserved.** Driver travel remains permitted for the assigned Driver only. This is a source/product-contract determination, not a database-runtime result.

| Transition                                             | Locked database authority in the proposed migration                                                                                                       |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home Service `not_started → travel_started`            | Assigned Provider (`staff_id`), assigned Driver (`driver_id`), or existing Manager/Owner oversight. Existing writer additionally checks travel readiness. |
| Home Service `travel_started → arrived`                | Same actor/assignment and branch rules.                                                                                                                   |
| In-spa `not_started → checked_in`                      | Assigned Provider, branch CRM/Front Desk, or existing Manager/Owner oversight.                                                                            |
| In-spa `not_started → no_show`; `checked_in → no_show` | Same actor/assignment and branch rules.                                                                                                                   |

Driver and Utility cannot check in or mark no-show. Utility and untyped general staff cannot advance booking progress through the shared action. Owner oversight retains the existing cross-branch behavior; all other actors require their active staff branch to match the locked booking. Cancelled, completed, no-show and unconfirmed booking lifecycle states fail. The exact state check rejects a reassignment, branch change or competing progress update before the write. The SQL source has these checks, but their execution and concurrency behavior remain unverified without an isolated database.

## Bounded authorization audit

| Staff PWA consumer    | Server authority and observed limit                                                                                                                                                                                                                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider progress     | Shared action performs early checks; proposed locked actor-aware RPC is authoritative for assigned Provider Home Service travel/arrival and in-spa check-in/no-show. Service start/complete continue to use their existing actor-aware session RPCs. Database execution remains unverified.                                                       |
| Utility turnover      | Server action derives authenticated user; service re-fetches active Utility staff, task and resource; branch, task identity, lifecycle and ownership are checked in atomic writes.                                                                                                                                                                |
| Driver travel/arrival | Shared action prechecks active actor, branch, assignment and Home Service. Proposed shared progress RPC repeats these checks under row locks and permits the assigned Driver only `not_started → travel_started → arrived`. Driver cannot call Provider check-in, no-show or completion through this path. Database execution remains unverified. |
| CRM mobile            | Today and Work booking surfaces are read-only. Branch and `canManageBookings()` gate booking detail. Generic staff receive the shell without automatically receiving CRM booking rows.                                                                                                                                                            |
| Notices               | Mark-read uses session-scoped current notice, branch, workspace, recipient/role and unread compare-and-set. Attendance response requires own targeted question and delegates to the existing attendance authority.                                                                                                                                |
| Scanner/attendance    | `/staff/scan` returns only attendance/public-code transport categories. Public-code/activation handlers retain their existing server checks; no customer/room/driver QR business action is introduced.                                                                                                                                            |
| Own profile/device    | Canonical profile and attendance routes reuse existing authenticated self-profile and attendance-device services. No new cross-staff write authority was added in this integration.                                                                                                                                                               |

All four groups use server-derived branch context for Staff PWA reads; browser-supplied branch IDs do not authorize them. Utility, Driver and booking-progress mutations use server-derived actor identity. No Staff PWA screen consumes a payment/finalization component: **STAFF PWA NOT A CONSUMER** of the separate desktop cancelled-booking payment finding. CRM Work may show payment attention as read-only text, without payment actions.

## Navigation, memory, errors and layout

- Provider: Today · Schedule · Scan · Progress · More.
- Utility: Home · Tasks · Scan · Rooms · More.
- Driver: Today · Trips · Scan · Map · More.
- CRM/general: Today · Work · Scan · Notices · More.
- In-memory safe snapshots store only short labels/counts and short presentation preferences. Identity includes user, staff, role/type and branch; reads reject prior identity immediately. No persistent operational cache, PII, token, coordinate or authorization snapshot was introduced.
- Provider load errors, Utility queue/history errors, Driver trip errors, CRM booking/work errors and notices errors remain explicit rather than fabricated zero work.
- **SOURCE-LEVEL VIEWPORT REVIEW:** inspected login, Scan, shared shell/nav and representative Provider, Utility, Driver and CRM source for 360×800, 390×844 and 412×915 constraints. Native shell uses constrained width, bottom-nav clearance and safe-area padding; important controls use 48px minimum. No authenticated rendered viewport or physical device was available to prove visual behavior. Driver Map continues to show existing destination data/external directions, without fabricated route geometry.

## Verification record

- Exact Staff-focused command: `pnpm exec vitest run --exclude '**/.claude/**' tests/lib/pwa src/lib/scanner/__tests__ tests/lib/auth/workspace-access.test.ts tests/lib/auth/auth-redirects.test.ts tests/app/auth/login-actions.test.ts tests/app/auth/login-form.test.tsx tests/lib/bookings/progress.test.ts tests/lib/bookings/payment-gate.test.ts tests/lib/bookings/exact-service-session-lifecycle.test.ts tests/lib/bookings/service-session-migration-contract.test.ts tests/lib/cash-flow/order-payment-eligibility.test.ts tests/lib/staff-portal/attendance.test.ts tests/lib/attendance/scan-resolution.test.ts tests/lib/attendance/scan-error-paths.test.ts tests/lib/attendance/transactional-scan-rpc-migration.test.ts tests/lib/attendance/public-scan-simplification-contract.test.ts tests/lib/attendance/first-scan-continuation-contract.test.ts tests/app/attendance/public-scan-route.test.ts tests/components/attendance/public-scan-processor.test.tsx`.
- Final focused result: **449 passed / 42 test files**. This includes the Provider/Driver/CRM server-action routing and role-denial cases, progress SQL source-contract checks, and the Utility assigned-cleaner/branch/task/resource/CAS/race regression suite. Mocked post-pre-read database rejection tests prove the server action returns failure; they do **not** prove the PostgreSQL locking behavior.
- `pnpm type-check`: PASS.
- Scoped Prettier and `git diff --check`: PASS.
- Strict scoped ESLint including the legacy Utility test: **24 pre-existing `no-explicit-any` errors** in `tests/lib/pwa/utility-room-turnover.test.ts`, plus one pre-existing unused-helper warning in shared actions. Strict scoped ESLint of changed TypeScript files: PASS with the existing warning. Scoped ESLint including Utility with only that legacy rule disabled: PASS with the existing warning. No new lint violation was introduced.
- Optimized `next build` with LOCAL placeholder services: PASS. The Windows sandbox initially denied SWC path canonicalization; the same LOCAL build passed outside the filesystem sandbox. No remote database was queried.
- LOCAL built HTTP: `/staff` 308→`/staff/`; `/staff/` and representative unauthenticated Provider, Utility, Driver and CRM routes 307→`/staff/login`; `/staff/login` and `/manifest-staff.webmanifest` 200. Manifest reports `start_url=/staff/`, `scope=/staff/`, `display=standalone`, four icon entries.

## Remaining release gates

- **AUTHENTICATED TEST/STAGING — NOT VERIFIED.** No deployment SHA, isolated Supabase target, safe account and safe branch/data set were proven. Do not run task mutations against an unknown or production-connected target.
- **DATABASE RUNTIME — NOT VERIFIED.** No isolated TEST/STAGING database with a known baseline was identified. The reviewed forward migration is `supabase/migrations/20261012235226_staff_pwa_progress_actor_guard.sql`, replacing the unapplied Driver-only source migration at the same version. No migration was applied, no historical migration was replayed/repaired, and no production-connected Preview was used. A controlled isolated run must verify function creation, grants, role/branch/assignment races, exact state races, terminal bookings and travel readiness before merge. Production database was not touched.
- **PHYSICAL DEVICE VERIFICATION — NOT VERIFIED** for this integrated candidate. Prior icon evidence belongs to the accepted icon release, not this branch.
- **PERFORMANCE — NOT VERIFIED** without authenticated cold/warm/stale measurements.
- **PRODUCTION — NOT VERIFIED** for this unmerged branch; no production deployment or operational-data mutation occurred.
- **Rollback:** before merge, close the draft PR and leave `main` untouched. After any separately approved release, revert the integration merge and use an approved forward database migration to remove the actor-aware RPC only after application callers no longer use it; never mutate production DB ad hoc.
- **Merge recommendation: CORRECTION REQUIRED / hold.** Obtain independent security review and isolated DB runtime proof for the actor-aware RPC, then authenticated role/branch/device evidence and explicit owner approval. Do not merge Provider #19 or Utility #20 individually.
