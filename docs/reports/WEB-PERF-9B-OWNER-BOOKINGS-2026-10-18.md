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

## Local result received and subsequent remote review corrections

### Owner-provided local evidence — candidate `89e21f7a8a286e0c1a80e4ace45a57c82255444e`

The owner shared the result of a focused Windows Vitest run at `E:/cradlehub` on 2026-10-18. The output states **12 selected test files, 11 passed, 1 failed before collection; 73 tests passed; total duration 26.12s**. The single failed suite was `tests/app/owner/owner-bookings-page.test.tsx`: importing the production `server-only` sentinel in the Vitest test harness raised an error before test collection.

**This run is not a PERF-9B PASS.** The interruption prevented TypeScript, ESLint, build and broader regressions in that command sequence. Vitest also emitted a Node `TimeoutNaNWarning`; no source-level cause is established by this warning alone.

### Post-run remote corrections

1. `13f7bd1f717da1d7cbed00cc0fb2a6fa595c7b29` — test-only `vi.mock("server-only", () => ({}))` consistent with the accepted PERF-9A Owner Overview page test convention. It does **not** weaken Next.js's production server-only boundary.
2. `82df29d2fc74f5f1179062a368513ebb69222478` — removed the local `search` term from the Owner Bookings UI subtree mount key. Search filters existing rows and must not remount the entire Bookings workspace or create a different server query.
3. `ef7f3f1522b0f9c16abdc39e4b6684b4b6e6d09f` — added focused regression assertions for search-only instance preservation and for server-reported Owner access/branch loss clearing previously visible rows. Distinguishes **explicit server authorization failure** (must fail closed) from a **thrown transport error** (may retain last validated same-query rows with a retry warning).

The post-run commits have **not** been quality-gated in the user's Windows repository. In accordance with the owner's updated working agreement, routine remote changes are **not synchronized locally**; there will be a **single commit-locked local synchronization and testing checkpoint** after the remote correction/review pass, before any merge decision.

### Remaining mandatory acceptance

- Re-run the previously failed Owner Bookings page suite, then the full PERF-9B focused tests, ensuring the new assertions pass.
- Run TypeScript type-check, changed-file ESLint, Next build, PERF-1B/9A and CRM regression suites, then full Vitest.
- Conduct authenticated local Owner browser inspection and record actual query counts/timings for all-branches/Main/SM/invalid-scope, filter/selection/back-forward, status/payment-side effects in an authorized **test** environment only.
- Treat a successful preview deployment as build/deployment-provider status, **not** evidence of authenticated performance, production operation or complete quality gates.
- Complete independent review and obtain separate, explicit owner approval before merge.

## Subsequent remote-only Owner URL/input correction

**Repository inspection finding:** `src/components/features/bookings/bookings-workspace.tsx` renders Owner's search input with an uncontrolled `defaultValue`. Previous PERF-9B performance correction removed the search term from the entire Bookings workspace mount key. Without an Owner-specific input reconciliation, URL history navigation could display the old uncontrolled text while client-side filtering uses the new URL search parameter.

**Bounded source correction:** For `workspaceContext="owner"` only, the search `<input>` has a React key derived from the current search query. The input alone is reconstructed when the URL search term changes; the rest of the Bookings workspace, selected panel/modal state and CRM rendering behavior are untouched. No caching, mutation, query, shared business calculation, RPC or auth changes.

**New regression (not yet executed):** `tests/components/owner/owner-bookings-search-input.test.tsx` renders the actual shared Owner BookingsWorkspace, simulates unsubmitted draft search text, rerenders with new URL-derived search, and checks that the input updates without remounting the heading/workspace.

**Evidence status:** Source and test are committed remotely, but neither the new test nor the corrected focused/full suites has run in the user's environment. The owner explicitly deferred local synchronization to the later **pre-merge checkpoint**. This is not a quality-gate PASS and does not authorize merge.

## Remote-only governance correction: Owner search scope preservation

**Identified by source inspection (not browser measurements):** The Owner Bookings mobile/compact form in `src/components/features/bookings/bookings-workspace.tsx` contains date, branch and type controls only while its filter panel is expanded. A collapsed filter panel allowed the same GET search form to omit these values, which would reset the query to its default date and **all branches**, contrary to the selected Owner operational scope. The status URL filter had no Owner form control at all and could be lost on a form submit. This is a P1 workflow/scope consistency risk requiring correction before certification; it is not a claim of production reproduction.

**Bounded correction:** Owner-only hidden inputs now preserve `date`, `branch` and `type` while Owner filters are collapsed. The Owner's `status` URL filter remains serialized while expanded or collapsed. Expanded date/branch/type inputs remain the exclusive submitted values; no duplicates are introduced. Other CRM/Manager form behavior is unchanged. Server-side role/branch checks remain authoritative; hidden inputs are not authorization grants.

**New regression:** `tests/components/owner/owner-bookings-search-input.test.tsx` checks `FormData` for Owner branch, date, type and status with filters expanded and collapsed, and checks that changing current branch/date updates hidden values. The test has **not run** in the remote connector environment.

**Quality gate:** No migration, payment/booking mutation writer, RLS, caching infrastructure, env/rollout, or production operation changed. Required local verification still deferred by owner instruction until the controlled pre-merge checkpoint. Remain **CORRECTION REQUIRED / NOT YET CERTIFIED** until tests and authenticated browser review.

## CP-PWA-01 checkpoint

The previously agreed **CP-PWA-01 Member PWA optimization** begins only after current Web administrative PERF-9B, PERF-9C, PERF-9D, PERF-10 and FINAL certification. Do not begin it during PERF-9B.

## Gate

**LOCAL EXECUTION / CORRECTION REQUIRED — DO NOT MERGE.**  
Return the exact local quality-gated implementation SHA and test/browser evidence for independent review. Do not begin PERF-9C or change Owner-retention rollout before owner approval.
