# CradleHub Web — PERF-9B Owner Bookings Implementation & Local Verification Handoff

**Date:** 2026-10-18  
**Program:** Web CONTROLLED STABILIZATION  
**Stage:** PERF-9B Owner Bookings  
**Accepted main / verified base:** `cd108714c9f1da2d493825b9b35a680888a34ef1`  
**Implementation branch:** `stage/web-perf-9b-owner-bookings`  
**Executable candidate before this report:** `481bc91a0eab0780a3eeef00762776eba4f8fa2c`  
**Gate:** IMPLEMENTED FOR LOCAL VERIFICATION — **NOT QUALITY-GATED; DO NOT MERGE**

## Authorization and frozen scope

The owner authorized continuation following the PERF-9B scope-freeze handoff, with remote-to-local synchronization and local visual tests before independent review and merge. The original immutable freeze was copied from `stage/web-perf-9b-owner-bookings-scope-freeze` into this implementation branch. It remains an original planning snapshot; implementation authorization occurred subsequently.

This stage changes only Owner `/owner/bookings` reads, the Owner-specific client/view lifecycle, one Owner Bookings retention-policy entry, a pure read/query contract, and targeted regression tests.

Owner retention remains **OFF** under `NEXT_PUBLIC_RETAINED_WORKSPACES=crm`. No Owner Reports, Overview, PWA, shared booking mutation action, payment RPC, database schema, RLS, service-role authorization, analytics formula, payroll formula or deployment flag was changed.

## Inspected source and authority

- `src/app/(dashboard)/owner/bookings/page.tsx` still requires Owner staff role server-side before reads.
- `getOwnerWorkspaceBookingsAction` remains the sole authenticated list fetch path and validates requested `branch` against RLS-visible active branches.
- `getAllBookings` continues its existing date/branch/status/type filters, 500-row cap, compatibility fallback and ordering.
- `ownerUpdateBookingStatusAction` and `ownerUpdateBookingPaymentAction` are **unchanged**, including cross-branch Owner authorization, payments, cache tags and downstream invalidations.
- `OwnerRuntimeScope` preserves user/role/branch identities and destroys stale cross-scope SWR caches.
- Existing `BOOKINGS_CHANGED_EVENT` remains the integration contract; the retained provider maps it to generation invalidation when active.

## Code changes

1. **Explicit server read result.** The Owner page now passes `{status:"ready",bookings}` for a legitimate zero-row day and `{status:"error",message}` for action error or thrown list load. A read failure is no longer converted into an ordinary empty bookings view.
2. **Duplicate branch fail-closed.** Repeated `branch` values in the initial page or client URL are rejected without selecting the first branch or broadening to all.
3. **Query identity.** `ownerBookingsRequestKey` keys only the server data query dimensions: `date, branch, status, type`. Search, tab and booking selection remain UI/deep-link presentation state and must not generate an extra booking list request.
4. **Two rollout modes.** With Owner retention OFF, existing scoped ordinary SWR remains responsible for changed-filter reads and manual/legacy-event refresh. With Owner retention ON in isolated tests, the existing generation-aware adapter owns all retained reconciliation. The Owner-only legacy event listener is disabled in retained mode to prevent a duplicate refresh.
5. **Safe results.** A new filter with no validated data shows loading, then an explicit failure/Retry if transport fails; same-query refresh failure preserves the last validated rows with an error banner. Returned server denial is shown as unavailable, not a zero-row list.
6. **Retention navigation.** The Owner retention policy now includes stable `tab` alongside existing Owner Bookings filters/search/bookingId. Transactional `openRoomAssignment` and one-time `highlight` are **not** retained. The Owner view initializes tab/selection from the current URL and keys its shared presentation subtree by URL-visible state without changing shared BookingsWorkspace/BookingsTable behavior.
7. **No optimistic financial updates.** Owner status/payment/service actions and their established side effects remain untouched; the view only reconciles after the existing success callbacks.

## New regression files

- `tests/lib/owner/owner-bookings-query.test.ts`
- `tests/app/owner/owner-bookings-page.test.tsx`
- `tests/components/owner/owner-bookings-lifecycle.test.tsx`
- `tests/lib/navigation/workspace-retention-policy-owner-bookings.test.ts`

Targets: query identity, ordinary mode startup/refetch, server denial, duplicate branch, filter switching, last-validated same-query fallback, fresh query failure, no hidden retained fetch, single retained event path, stale response rejection, page Owner-role redirect, URL tab/deep-link restoration, CRM-only Owner retention OFF.

These tests have been **authored, not executed** in this remote environment. They do **not** establish a PASS without their actual results.

## Required local verification on Windows

From `E:\cradlehub`, fetch and check out **the exact remote implementation PR HEAD** (use the SHA supplied in the handoff). Ensure a clean tree and accepted `origin/main = cd108714c9f1da2d493825b9b35a680888a34ef1` before checking out. Do not reset, force-push, stash, merge or overwrite uncertain local changes.

### Focused PERF-9B and authority tests

```powershell
pnpm exec vitest run tests/lib/owner/owner-bookings-query.test.ts tests/app/owner/owner-bookings-page.test.tsx tests/components/owner/owner-bookings-lifecycle.test.tsx tests/lib/navigation/workspace-retention-policy-owner-bookings.test.ts tests/components/dashboard/owner-runtime-scope.test.tsx tests/lib/owner/operational-scope.test.ts tests/lib/owner/operational-scope-server.test.ts tests/lib/crm/owner-booking-action-branch.test.ts tests/lib/bookings/bookings-workspace-filters.test.ts tests/lib/bookings/bookings-client-events.test.ts tests/lib/bookings/booking-payment-actions.test.ts tests/lib/bookings/payment-gate.test.ts
```

Record exact files passed/failed, tests passed/failed/skipped, duration and all failures.

### Static gates

```powershell
pnpm type-check
pnpm exec eslint "src/app/(dashboard)/owner/bookings/page.tsx" "src/components/features/bookings/owner-bookings-view.tsx" "src/components/features/dashboard/workspace-retention-policy.ts" "src/lib/owner/owner-bookings-query.ts" "tests/app/owner/owner-bookings-page.test.tsx" "tests/components/owner/owner-bookings-lifecycle.test.tsx" "tests/lib/navigation/workspace-retention-policy-owner-bookings.test.ts" "tests/lib/owner/owner-bookings-query.test.ts"
pnpm build
git diff --check origin/main...HEAD
```

Then run the accepted PERF-1B, PERF-9A and PERF-2–8 regression suites, including CRM Bookings and cash-flow financial safety, followed by:

```powershell
pnpm exec vitest run --maxWorkers=4
```

If any tests fail, compare the exact failed test and behavior to accepted main at `cd108714c9f1da2d493825b9b35a680888a34ef1`; do not classify as baseline solely because a test file is unchanged.

### Authenticated local browser checks

Run `pnpm dev` and inspect Owner `/owner/bookings` on desktop and mobile widths, with authorized test credentials and no production data mutation:

- all branches → Main → SM → all branches; verify no Main rows or selection appear in SM;
- valid/invalid/duplicate branch URLs; unauthorized branch must show error and zero exposed rows;
- apply/clear date, status, type and search; check tab, selection, deep link, back/forward URL;
- legitimate empty day vs failed/denied read;
- failed filter read, Retry, successful same-query refresh and manual Refresh;
- DevTools network counters on cold navigation, filter change, return navigation, hidden state and one controlled successful action **only in an authorized test environment**;
- no duplicate canonical reads from one Owner mutation signal, no optimistic payment/ledger truth, all downstream consumers unchanged;
- Owner retention must be OFF in the local CRM-only rollout. Retained integration can be simulated in isolated automated tests; **do not activate Owner retention in production**.

Record screenshots, request counts, timings, warnings, access limitations, before/after measurements, and whether browser testing used a test database. Never call local preview evidence production verification.

## Production and rollback

- No migrations or database operations were executed.
- No production financial mutations, deployments or Owner-retention activation are authorized.
- Abandon the branch before merge, or perform separately authorized revert after merge.
- Existing Owner retention flag `crm` is a rollout boundary; real activation belongs to PERF-9D.

## Evidence classification

**VERIFIED REPOSITORY FACT:** the changed source and tests exist; Owner business writes remain unchanged; explicit server query error is no longer mapped to an empty list; Owner retention default remains CRM-only.

**REPOSITORY-RECORDED PRODUCTION EVIDENCE:** GitHub/Vercel/Netlify preview statuses, if recorded later; previews do not verify live production behavior.

**NOT VERIFIED:** local tests, TypeScript, ESLint, build, authenticated browser navigation, phone testing, network/performance measurements, server/DB query latency, production, post-merge deployment.

**TARGET, NOT CLAIMED:** no duplicate initial fetch, zero hidden Owner reads after activation, correct filter/branch isolation, one reconciliation per action, faster navigation.

## CP-PWA-01 checkpoint

The previously agreed **CP-PWA-01 Member PWA optimization** begins only after current Web administrative PERF-9B, PERF-9C, PERF-9D, PERF-10 and FINAL certification. Do not begin it during PERF-9B.

## Gate

**LOCAL EXECUTION / CORRECTION REQUIRED — DO NOT MERGE.**  
Return the exact local quality-gated implementation SHA and test/browser evidence for independent review. Do not begin PERF-9C or change Owner-retention rollout before owner approval.
