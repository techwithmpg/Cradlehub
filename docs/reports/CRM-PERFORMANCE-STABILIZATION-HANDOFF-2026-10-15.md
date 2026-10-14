# CRM performance stabilization — bounded handoff (2026-10-15)

## A. Status

**CORRECTION REQUIRED.** This branch contains two low-risk request-ordering corrections. The Owner customer-search branch-scope issue below and authenticated performance verification require separate correction/review before acceptance. No merge or deployment is authorized by this handoff.

## B. Scope and authorization

Owner-authorized controlled CRM stabilization from fetched `origin/main`. This pass inspected the Front Desk path, operational page loads, existing retained navigation, customer search, refreshes, and supporting queries. It changed only the CRM layout identity lookup and the Today request waterfall. Booking creation, confirmation, assignment, payment, attendance, Home Service mutations, Cash Flow mutations, and database objects were left untouched.

The existing dashboard and CRM layouts own the persistent sidebar/header and retained module provider. The prior workspace-navigation-retention branch was inspected; current `main` already contains the provider and scoped SWR cache, so no old branch was merged or copied.

## C. Repository state

- Repository: `techwithmpg/Cradlehub` at `E:\cradlehub`.
- Base branch: fetched `origin/main` at `f60793d205ef9599c891e763a22a7ecd3008561f`.
- Implementation branch: `stage/crm-performance-stabilization`.
- Push: not performed. Merge: not performed. Final HEAD and commit list are recorded in the final task report after commit.

## D. Baseline diagnostics

The table reports **source-traced operations**, not browser network requests or measured latency. Authenticated browser timing was unavailable; request counts, render counts, and timings are **not measured**.

| Interaction                                          | Source-traced request groups before                                                                             | Main blocking behavior before                                                                        | After this pass                                                                               |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Enter CRM                                            | Dashboard layout staff/access/readiness, then CRM Front Desk context and booking options/rules                  | CRM layout repeated an auth/staff identity lookup after dashboard context and before booking options | CRM layout reuses the authorized Front Desk identity; booking options remain layout-blocking  |
| Open Today                                           | Front Desk context, duty, then nine independent initial reads                                                   | Duty read completed before the other nine began                                                      | Duty and the nine initial reads start together                                                |
| Build Today queue                                    | Optional two order-finance reads; then optional resource lookup, tracking lookup, driver names                  | Resource, tracking, and driver-name reads ran in series                                              | Those three independent reads start together; order-dependent reads retain their dependencies |
| Open Bookings                                        | Front Desk context, optional branch-scoped booking date lookup, then bookings/payment summary/waitlist together | No new waterfall correction justified by source inspection                                           | Unchanged                                                                                     |
| Open Customers                                       | Branch context, tab-specific list, then KPI stats                                                               | List and KPI are serial; branch customer IDs are recomputed                                          | Unchanged pending scoped workload evidence                                                    |
| Quick Booking                                        | Layout preload of branch booking options/rules; customer search is debounced                                    | Preload blocks first CRM layout render; search may return all-branch results for Owner               | Unchanged pending branch-scope correction                                                     |
| Cash Flow, Attendance, Home Service, Owner switching | Server page/context loads plus mutation-driven refreshes                                                        | Broad refreshes and multiple business-specific dependencies need focused workload tracing            | Unchanged                                                                                     |

Findings by layer:

- **Routing/navigation:** Next.js nested layouts preserve shell state on CRM child navigation; retained modules and branch/user/role scoped SWR already exist. The CRM layout still awaits booking options before rendering children.
- **React rendering:** Today has a booking change listener that calls `router.refresh()`. A separate retained-workspace listener marks booking modules dirty. The countdown chip has a local interval; no profiler measurement of unrelated renders was performed.
- **Network/server:** Today had the serial duty and queue-enrichment awaits corrected here. Actual HTTP request counts and database latency were not captured.
- **Supabase/database:** Queries remain server-side. No target was classified for live query plans, so database performance is unmeasured and no index or RPC change was made.
- **Realtime:** Attendance feed has its own client hook; booking-change events cause a full Today refresh. No subscription topology or event frequency measurement was available.
- **Cache/revalidation:** The retained workspace cache key includes user, role, and branch. Broad refreshes remain and require mutation-by-mutation correctness review before removal.

### P1 Owner customer-search scope issue

`src/app/api/customers/search/route.ts` sets `branchId` to `null` for Owner. `searchCustomers` applies its branch booking filter only when a branch ID exists. Thus Owner search can return a customer from another branch while the visible CRM uses a selected Front Desk branch. The same endpoint is used by Quick Booking. This is **repository code evidence**, not a production observation. Optimization of this path stopped. Safest correction: resolve the server-authoritative Owner-selected Front Desk branch in the endpoint, enforce that branch in search and customer prefill, then test branch switch, direct API calls, and cross-branch results before resuming caching or search tuning.

## E. Changes and boundaries

| File                                     | Before → after                                                                                                                                               | Authorization, cache, realtime impact                                                                                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/(dashboard)/crm/layout.tsx`     | Called `getLayoutStaffContext` and then `getFrontDeskContext`; now uses the latter's authorized `userId` for coach and retained provider.                    | Front Desk authorization and branch selection remain in `getFrontDeskContext`; no browser authority or cache key changed. No realtime change. |
| `src/app/(dashboard)/crm/today/page.tsx` | Awaited duty before nine independent reads, then awaited resource, tracking, and driver-name lookups serially; now runs each independent group concurrently. | Same arguments, branch IDs, queries, result handling, and authoritative server data. No mutation, cache, or realtime change.                  |
| This handoff                             | Records source baseline, gates, issue, and review limits.                                                                                                    | No runtime effect.                                                                                                                            |

## F. Performance evidence

Static critical-path evidence only: the Today initial read group has one fewer serialized duty stage, and the enrichment group has one parallel stage in place of three serial awaits. Query counts are unchanged. No before/after browser timings, request counts, or production results are claimed. Environment: local source inspection, TypeScript/build, and mocked tests. Authenticated browser timing: **NOT MEASURED**.

## G. Tests

- `pnpm lint 'src/app/(dashboard)/crm/layout.tsx' 'src/app/(dashboard)/crm/today/page.tsx'` — PASS.
- `pnpm lint` — FAIL with 77 errors and 32 warnings in untouched Staff PWA, test, and other files. None were reported in the two changed source files.
- `pnpm type-check` — PASS on serial rerun. First concurrent run reported a tracked file missing; the file was present and the rerun passed.
- `pnpm test --run tests/lib/crm/c01-today-readiness.test.ts tests/lib/crm/work-queue-payment-order.test.ts tests/lib/crm/owner-front-desk-chooser.test.tsx` — PASS, 4 files and 11 tests.
- `pnpm exec vitest run --exclude '**/.claude/**'` — 325 files and 2,582 tests passed; 3 tests failed in untouched `tests/app/crm/booking-actions.test.ts`, which expects `{ success: true }` while the accepted action returns additional booking fields. Two tests skipped.
- `pnpm build` — PASS with Next.js 16.2.4.
- `git diff --check` — PASS.
- Plain `pnpm test --run` discovers the unrelated nested `.claude/worktrees/global-brand-logo` checkout and was stopped after failures in that checkout. The scoped Vitest command above is the main checkout result.

## H. Security and data integrity

RLS, authorization rules, privileged server operations, booking/payment integrity, attendance, and branch isolation were **not changed**. The CRM layout now uses the already authorized Front Desk identity and retains the same user/role/branch scope key. The Owner search issue is an existing P1 branch-scope concern requiring correction before performance work on search.

## I. Database

Migrations created: **no**. Applied locally: **no**. Applied remotely: **no**. Production DB changed: **no**. Database target: **UNKNOWN**; no live database command was run.

## J. Production

**Production verification: NOT PERFORMED.** Any production behavior mentioned in repository documents is **REPOSITORY-RECORDED PRODUCTION EVIDENCE** only.

## K. Remaining issues

- **P1:** Owner customer search is not scoped to the selected Front Desk branch. Correct and test before search optimization.
- **P1:** Authenticated Front Desk performance, branch-switching, and interaction timing are unmeasured.
- **P2:** Booking options still block initial CRM layout rendering; assess safe deferral with Quick Booking and availability consumers.
- **P2:** Today booking-change events still cause broad `router.refresh()`; refine only after mutation/realtime dependency tracing.
- **P2:** Customers list then KPI stats form a serial page waterfall; validate workload before changing.
- **P3:** Three accepted-main booking action test assertions are stale relative to returned fields; reconcile separately.

## L. Rollback

Revert this branch's implementation commit(s), then rerun the same focused tests, type check, lint, and build. No migration, cache schema, or production data rollback is needed.

## M. Recommended next action

Correct the Owner customer-search scope with server-authoritative branch resolution and focused cross-branch tests, then obtain authenticated TEST/STAGING Front Desk traces. Use those traces to choose the next bounded correction to Quick Booking layout blocking or Today broad refresh. Independent review and an applicable owner gate are required before any merge.
