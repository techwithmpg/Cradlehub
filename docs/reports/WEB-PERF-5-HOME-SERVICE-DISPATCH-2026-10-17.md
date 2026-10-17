# CradleHub Web — PERF-5 CRM Home Service Dispatch Retention

**Date:** 2026-10-17<br/>
**Target:** CradleHub Web — CRM Home Service Operations / Dispatch only<br/>
**Program:** Web CONTROLLED STABILIZATION — final correction pass<br/>
**Branch:** `stage/web-perf-5-home-service-dispatch`<br/>
**Accepted Base / main:** `5e91c18f755316760e95bdfeb10dc1fa6cbce718`<br/>
**Starting reviewed HEAD:** `2d325fd7a06a7357f6e900f461670188f0198841`<br/>
**Quality-gated implementation SHA:** `efb9a0f18bbed529052e606fb2eccbdadc874354`<br/>
**Documentation reconciliation SHA:** Delivered in the subsequent documentation-only commit; the exact delivery HEAD is recorded in PR #35 and resolves with `git rev-parse stage/web-perf-5-home-service-dispatch`.<br/>
**Draft PR:** #35<br/>
**Status:** READY FOR FINAL INDEPENDENT REVIEW — **DO NOT MERGE**

---

## A. Owner authorization and frozen scope

The Owner explicitly authorized PERF-5 after PERF-4 passed independent review and was merged into accepted `main`.

The repository PERF-0 roadmap defines the next remaining-module checkpoint as:

- **Home Service Dispatch SWR retention**

PERF-5 is therefore frozen to CRM Home Service Operations / `/crm/dispatch` only.

Explicitly out of scope:

- Customer segment conversion;
- Staff optimization;
- Cash Flow optimization;
- Owner operational module conversion;
- Manager Dispatch conversion;
- Driver/Staff Portal workflow redesign;
- Home Service booking rules;
- driver assignment rules;
- travel/progress state machine;
- distance/transportation pricing;
- maps/GPS business contracts;
- database schema, migrations, RLS, or production operations;
- PERF-6 or later work.

---

## B. Current-system truth inspected before replacement

### Consumers

`HomeServiceDispatchWorkspace` is consumed by:

- CRM `/crm/dispatch`;
- Manager `/manager/dispatch`;
- Owner `/owner/dispatch`.

PERF-5 changes the lifecycle only for the CRM consumer. Manager and Owner continue using the existing ordinary SWR path.

### Source of truth

Canonical Dispatch data remains server-authoritative:

- `getDispatchData(...)` remains the read model;
- `refreshDispatchDataAction(...)` remains the client-accessible authoritative reconciliation action;
- branch/role context continues to be resolved server-side through the existing attendance/action context;
- exact booking deep-link inclusion still performs the existing authoritative booking-specific read when the booking is outside the ordinary list.

### Existing side effects

Before PERF-5:

- CRM Dispatch was not registered in retained workspace policy;
- ordinary SWR owned the queue lifecycle;
- `BOOKINGS_CHANGED_EVENT` directly called `mutate()`;
- hidden Dispatch was therefore outside the accepted generation-aware retained lifecycle;
- CRM Dispatch map used an unscoped SWR cache key;
- the CRM page keyed the workspace by Today/Upcoming, forcing a workspace remount on that route-state change.

No business mutation logic is replaced by PERF-5.

---

## C. Implementation

### 1. CRM Dispatch becomes a retained module

`crm-dispatch` is added to the CRM retained module policy:

- route: `/crm/dispatch`;
- stable search state: `tab`, `bookingId`;
- stale time: 12 seconds;
- retention cost: high.

The existing CRM retention limit is unchanged.

### 2. CRM page joins the retained host

`/crm/dispatch/page.tsx` now wraps the operational surface in:

`<RetainedWorkspaceModule moduleId="crm-dispatch">`

The destructive page-level Today/Upcoming `key` is removed.

### 3. Generation-aware canonical Dispatch reconciliation

A dedicated CRM hook:

`src/components/features/dispatch/use-live-crm-dispatch-data.ts`

uses:

`useGenerationAwareWorkspaceSWR("crm-dispatch", ...)`

Expected lifecycle:

- retained data remains visible;
- hidden Dispatch performs zero canonical queue reconciliation reads;
- booking invalidation marks the module dirty;
- active dirty Dispatch reconciles server truth in the background;
- reactivation reveals retained UI first, then reconciles;
- stale responses cannot validate a newer generation;
- Today/Upcoming/deep-link request identity is represented in the request key.

### 4. Legacy event compatibility without hidden network work

The existing legacy booking event bridge now marks `crm-dispatch` dirty together with existing CRM booking consumers.

CRM Dispatch no longer directly calls queue `mutate()` from its local booking-event listener.

The local listener is retained only to:

- preserve existing Manager/Owner direct-refresh behavior, which is outside PERF-5;
- refresh the active map while the CRM map is actually visible.

Because React Activity cleans hidden retained effects, this preserves the zero-hidden-network contract for the local map listener.

### 5. Owner and Manager behavior preserved

Owner and Manager continue through the prior ordinary SWR path.

PERF-5 does not activate Owner retention and does not alter Owner branch authority.

### 6. CRM map cache scope

The CRM active-map SWR key is now prefixed by the authenticated CRM workspace scope through `useWorkspaceSWRKey`.

The underlying active-map server query and authorization remain unchanged.

---

## D. Demonstrated failures and corrections during verification pass

During quality gate execution, three defects were demonstrated, diagnosed, and corrected:

1. **`use-live-crm-dispatch-data-generation.test.tsx` alert property and display name errors:**
   - *Demonstrated failure:* Vitest failed with `expected undefined to be 'retained'`; `pnpm type-check` reported `TS2339: Property 'message' does not exist on type 'DispatchAlert'`; `pnpm eslint` reported `Component definition is missing display name react/display-name`.
   - *Root cause:* The test payload helper created alerts with `title: label` and `description: label`, but test assertions checked `alerts[0]?.message`. In addition, the factory-returned wrapper component lacked an explicit `displayName`.
   - *Exact fix:* Corrected assertions to check `alerts[0]?.title`, and assigned `Wrapper.displayName = "DispatchGenerationTestWrapper"`.
   - *Regression test:* [use-live-crm-dispatch-data-generation.test.tsx](file:///e:/cradlehub/tests/components/dispatch/use-live-crm-dispatch-data-generation.test.tsx).

2. **`dispatch-workspace.tsx` ESLint hook dependency warning:**
   - *Demonstrated failure:* `pnpm eslint` reported `React Hook useEffect has a missing dependency: 'legacyDispatch'. Either include it or remove the dependency array react-hooks/exhaustive-deps`.
   - *Root cause:* The effect referenced `legacyDispatch.mutate()` inside the closure while having `legacyDispatch.mutate` in the dependency array without destructuring `mutate` directly.
   - *Exact fix:* Destructured `const { mutate: mutateLegacyDispatch } = legacyDispatch;` and included `mutateLegacyDispatch` in the dependency array.
   - *Regression test:* Verified via `pnpm eslint`.

3. **`crm-dispatch-deep-link.test.ts` wrapper hierarchy inspection failure:**
   - *Demonstrated failure:* Vitest failed with `expected undefined to be 'future-1'` on line 76.
   - *Root cause:* Prior to PERF-5, `CrmDispatchPage` returned `<CrmOperationalPageShell><HomeServiceDispatchWorkspace ... /></CrmOperationalPageShell>`. PERF-5 introduced `<RetainedWorkspaceModule moduleId="crm-dispatch">` as the outer host wrapper, shifting the workspace to `page.props.children?.props?.children`.
   - *Exact fix:* Updated test assertion in [crm-dispatch-deep-link.test.ts](file:///e:/cradlehub/tests/lib/bookings/crm-dispatch-deep-link.test.ts#L76) to safely unwrap the retained module: `const workspace = page.props.children?.props?.children ?? page.props.children; expect(workspace.props.selectedBookingId).toBe("future-1");`.
   - *Regression test:* [crm-dispatch-deep-link.test.ts](file:///e:/cradlehub/tests/lib/bookings/crm-dispatch-deep-link.test.ts).

4. **Retained Dispatch Today link queryless navigation defect:**
   - *Defect:* Retained Dispatch's queryless Today link (`href="/crm/dispatch"`) could be rewritten by the retained workspace provider to the previous retained tab or deep-link booking ID state (`tab=upcoming` or `bookingId=future-1`).
   - *Root cause:* Today used `href="/crm/dispatch"`. The retained workspace provider intentionally restores prior stable search state for retained modules when an internal link contains no query string (`!url.search`). If a user visited `/crm/dispatch?tab=upcoming&bookingId=future-1` and subsequently clicked Today, the provider restored `tab=upcoming` and `bookingId=future-1`, violating the intended `Today → Upcoming → Today` navigation flow.
   - *Fix:* In `src/components/features/dispatch/dispatch-workspace.tsx`, changed the Today navigation target from `href="/crm/dispatch"` to explicit `href="/crm/dispatch?tab=today"`. Because `?tab=today` contains an explicit search query, the provider does not rewrite it. The server already evaluates only `tab === "upcoming"` as Upcoming, so `?tab=today` continues resolving to the Today dataset without changing server rules.
   - *Result:* Choosing Today explicitly clears `tab=upcoming` and any retained `bookingId`.
   - *Regression evidence:* Added regression test suite in [home-service-nav-cleanup.test.tsx](file:///e:/cradlehub/tests/components/dispatch/home-service-nav-cleanup.test.tsx):
     - `A. Today -> Upcoming -> Today`: starting at `/crm/dispatch?tab=today`, clicking Upcoming targets `/crm/dispatch?tab=upcoming`, then clicking Today targets `/crm/dispatch?tab=today` and does not become upcoming;
     - `B. Deep link -> Today clears booking ID`: from retained state `/crm/dispatch?tab=upcoming&bookingId=future-1`, clicking Today targets `/crm/dispatch?tab=today`, does not contain `bookingId=future-1`, and does not restore `tab=upcoming` (while confirming a queryless `/crm/dispatch` link would have triggered restoration);
     - `C. Active state`: on `?tab=today`, Today renders `aria-current="page"` and Upcoming does not; on `?tab=upcoming`, Upcoming renders `aria-current="page"` and Today does not.

---

## E. Changed files

Implementation:

1. `src/app/(dashboard)/crm/dispatch/page.tsx`
2. `src/components/features/dashboard/workspace-domain-events.ts`
3. `src/components/features/dashboard/workspace-retention-policy.ts`
4. `src/components/features/dispatch/dispatch-workspace.tsx`
5. `src/components/features/dispatch/use-live-crm-dispatch-data.ts`

Tests:

6. `tests/components/dispatch/use-live-crm-dispatch-data-generation.test.tsx`
7. `tests/lib/navigation/workspace-retention-policy-dispatch.test.ts`
8. `tests/lib/bookings/crm-dispatch-deep-link.test.ts` (directly dependent preservation test)
9. `tests/components/dispatch/home-service-nav-cleanup.test.tsx` (navigation & retention safety regression tests)

Evidence:

10. `docs/reports/WEB-PERF-5-HOME-SERVICE-DISPATCH-2026-10-17.md`

No migrations, SQL, RLS, generated DB types, or production-operation files were changed.

---

## F. Executed quality gates

### 1. Focused PERF-5 Quality Gate

```bash
pnpm exec vitest run \
  tests/components/dispatch/use-live-crm-dispatch-data-generation.test.tsx \
  tests/lib/navigation/workspace-retention-policy-dispatch.test.ts \
  tests/components/dispatch/home-service-nav-cleanup.test.tsx \
  tests/lib/bookings/crm-dispatch-deep-link.test.ts \
  tests/lib/bookings/upcoming-dispatch.test.ts \
  tests/lib/home-service/active-map-query.test.ts \
  tests/lib/home-service/active-map.test.ts \
  tests/components/dashboard/retained-workspace-provider.test.tsx \
  tests/components/dashboard/workspace-generation-swr.test.tsx \
  tests/lib/navigation/workspace-generation.test.ts
```

- **Test Files:** 10 passed (10)
- **Tests:** 53 passed (53)
- **Failures:** 0
- **Skipped:** 0

### 2. Type-Check Gate

```bash
pnpm type-check
```

- **Command:** `tsc --noEmit`
- **Result:** PASSED (exit code 0, 0 errors)

### 3. Changed-File ESLint Gate

```bash
pnpm eslint \
  "src/app/(dashboard)/crm/dispatch/page.tsx" \
  src/components/features/dashboard/workspace-domain-events.ts \
  src/components/features/dashboard/workspace-retention-policy.ts \
  src/components/features/dispatch/dispatch-workspace.tsx \
  src/components/features/dispatch/use-live-crm-dispatch-data.ts \
  tests/components/dispatch/use-live-crm-dispatch-data-generation.test.tsx \
  tests/components/dispatch/home-service-nav-cleanup.test.tsx \
  tests/lib/navigation/workspace-retention-policy-dispatch.test.ts \
  tests/lib/bookings/crm-dispatch-deep-link.test.ts
```

- **Result:** PASSED (exit code 0, 0 errors, 0 warnings)

### 4. Build Gate

```bash
pnpm build
```

- **Result:** PASSED (exit code 0)
- **Compilation:** Turbopack compiled 153/153 static and dynamic routes in 33.4s
- **TypeScript Check in Build:** Passed in 46s
- **Static Generation:** 153/153 pages generated in 1028ms

### 5. Git Diff Check Gate

```bash
git diff --check
```

- **Result:** PASSED (clean, 0 whitespace errors)

### 6. PERF-1 Through PERF-4 Regression Gate

```bash
pnpm exec vitest run \
  tests/lib/navigation/workspace-generation.test.ts \
  tests/lib/navigation/workspace-module-registry.test.ts \
  tests/components/dashboard/owner-runtime-scope.test.tsx \
  tests/lib/owner/operational-scope.test.ts \
  tests/lib/owner/operational-scope-server.test.ts \
  tests/components/crm/today-generation-swr.test.tsx \
  tests/lib/crm/crm-today-operational.test.ts \
  tests/app/crm/today-parallel-reads.test.tsx \
  tests/components/crm/bookings-generation-swr.test.tsx \
  tests/lib/crm/crm-bookings-operational.test.ts \
  tests/lib/bookings/crm-bookings-page.test.tsx \
  tests/lib/bookings/crm-bookings-api.test.ts \
  tests/app/crm/quick-booking-customer-callers.test.tsx \
  tests/components/crm/quick-booking-customer-autocomplete.test.tsx \
  tests/components/crm/quick-booking-deferred-options.test.tsx \
  tests/components/crm/quick-booking-service-duration-dropdown.test.tsx \
  tests/lib/crm/quick-booking-customer-prefill-scope.test.ts \
  tests/lib/schedule/use-schedule-realtime.test.tsx \
  tests/lib/schedule/use-live-daily-schedule-generation.test.tsx \
  tests/lib/schedule/schedule-workspace-realtime-merge.test.ts \
  tests/lib/attendance/attendance-workspace-realtime-merge.test.ts \
  tests/lib/attendance/attendance-realtime-resilience-contract.test.ts
```

- **Test Files:** 22 passed (22)
- **Tests:** 148 passed (148)
- **Failures:** 0
- **Skipped:** 0

### 7. Full Repository Vitest Suite

```bash
pnpm exec vitest run --maxWorkers=4
```

- **Test Files:** 371 passed | 1 failed | 2 skipped (374 total)
- **Tests:** 2967 passed | 1 failed | 2 skipped (2970 total)
- **Sole Failure:** `tests/components/bookings/c03-mobile-booking-wizard.test.tsx > C-03: Mobile New Booking Wizard Responsive Layout > renders all core booking controls reachable and readable on mobile`
- **Failure Classification:** **ACCEPTED-MAIN BASELINE**
  - Verified by checking against accepted `origin/main` commit `5e91c18f755316760e95bdfeb10dc1fa6cbce718`. The test file and component `quick-booking-form.tsx` have 0 diff against `main`, and the failure is byte-for-byte identical on `main` and completely unrelated to CRM Dispatch.
- **PERF-5 Introduced Failures:** 0

---

## G. Security and data integrity

Repository-inspected boundaries preserved:

- CRM branch identity remains server-authoritative (`getAttendanceActionContext()`);
- Dispatch reads still flow through existing server context;
- no service-role credential is introduced client-side;
- no RLS bypass is introduced;
- no client event becomes authorization authority;
- no pricing or transportation formula is moved client-side;
- no driver/travel/booking mutation contract is changed;
- tactical business-data fabrication is not introduced.

---

## H. Database and production impact

- Migration created: **NO**
- Migration applied locally: **NO**
- Migration applied remotely: **NO**
- Database schema changed: **NO**
- Production data mutated: **NO**
- Production operational workflow executed: **NO**
- Authenticated browser performance verification: **NOT PERFORMED**
- Live production Dispatch/Realtime verification: **NOT PERFORMED**

Any deployment/check status associated with this branch is **REPOSITORY-RECORDED PRODUCTION EVIDENCE ONLY** and is not authenticated live-production verification.

---

## I. Performance evidence classification

### MEASURED
- Zero hidden canonical reads on focus or reconnect events (verified by Vitest hook tests);
- Exactly one canonical reconciliation on reactivation when dirty;
- Stale responses from prior generations are rejected and cannot overwrite newer generation data;
- Deep-linked bookings perform exactly one authoritative inclusion read when absent from the initial queue.

### REPOSITORY-VERIFIED
- CRM Dispatch participates in retained workspace policy with stable `tab` and `bookingId` search state;
- Canonical queue reconciliation uses generation-aware adapter;
- Destructive page-level remount key on Today/Upcoming tab change removed;
- CRM map cache identity is authenticated-workspace scoped;
- Owner and Manager legacy paths remain separate.

### TARGET ONLY
- Warm retained operational reveal: <100ms.

### NOT VERIFIED
- `AUTHENTICATED BROWSER PERFORMANCE VERIFICATION: NOT PERFORMED`
- `<100ms: TARGET ONLY`

---

## J. Rollback

Rollback by reverting the complete PERF-5 PR/commit range or by closing PR #35 without merging. Do not treat the final correction commit alone as the complete PERF-5 rollback.

No database rollback is required because PERF-5 contains no migrations or production data changes.

---

## K. Gate decision

**PERF-5 is ready for final independent review. DO NOT MERGE pending independent PASS and explicit owner merge authorization.**
