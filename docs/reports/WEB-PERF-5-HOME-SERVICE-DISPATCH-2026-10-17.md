# CradleHub Web — PERF-5 CRM Home Service Dispatch Retention

**Date:** 2026-10-17  
**Target:** CradleHub Web — CRM Home Service Operations / Dispatch only  
**Program:** Web CONTROLLED STABILIZATION — performance correction pass  
**Branch:** `stage/web-perf-5-home-service-dispatch`  
**Accepted Base / main:** `5e91c18f755316760e95bdfeb10dc1fa6cbce718`  
**Implementation HEAD before this evidence report:** `3cd39f90ed2a4266488bf036d17f56923b3c849d`  
**Status:** IMPLEMENTATION COMPLETE — QUALITY GATE EXECUTION REQUIRED — **DO NOT MERGE**

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

## D. Changed implementation files

1. `src/app/(dashboard)/crm/dispatch/page.tsx`
2. `src/components/features/dashboard/workspace-domain-events.ts`
3. `src/components/features/dashboard/workspace-retention-policy.ts`
4. `src/components/features/dispatch/dispatch-workspace.tsx`
5. `src/components/features/dispatch/use-live-crm-dispatch-data.ts`

Tests:

6. `tests/components/dispatch/use-live-crm-dispatch-data-generation.test.tsx`
7. `tests/lib/navigation/workspace-retention-policy-dispatch.test.ts`

No migration, SQL, RLS, generated database type, or production-operation file is changed.

---

## E. Regression contracts encoded

The PERF-5 tests encode:

- `/crm/dispatch` resolves to retained module `crm-dispatch`;
- stable Today/Upcoming/deep-link query state is retained;
- legacy booking events include Dispatch in dirty-generation bridging;
- hidden CRM Dispatch performs zero canonical reconciliation reads;
- reactivation performs authoritative reconciliation;
- stale generation responses cannot replace retained data;
- unloaded deep-linked bookings perform one exact authoritative inclusion read.

Existing Home Service navigation, deep-link, upcoming-dispatch, active-map, and retained-workspace tests remain preservation gates.

---

## F. Required quality gates

**The following gates are required and have NOT been executed by this agent environment. Do not convert this report to PASS without actual command output.**

Focused PERF-5 gate:

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

Then:

```bash
pnpm type-check
```

Changed-file lint:

```bash
pnpm eslint \
  src/app/(dashboard)/crm/dispatch/page.tsx \
  src/components/features/dashboard/workspace-domain-events.ts \
  src/components/features/dashboard/workspace-retention-policy.ts \
  src/components/features/dispatch/dispatch-workspace.tsx \
  src/components/features/dispatch/use-live-crm-dispatch-data.ts \
  tests/components/dispatch/use-live-crm-dispatch-data-generation.test.tsx \
  tests/lib/navigation/workspace-retention-policy-dispatch.test.ts
```

Then:

```bash
pnpm build
git diff --check
```

After the focused gate, run the accepted PERF-1 through PERF-4 regression gate and the full repository Vitest suite. Any failure must be compared with accepted `main` before classifying it as baseline.

---

## G. Security and data integrity

Repository-inspected boundaries preserved:

- CRM branch identity remains server-authoritative;
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

### REPOSITORY-VERIFIED BY IMPLEMENTATION

- CRM Dispatch participates in retained workspace policy;
- canonical queue reconciliation uses the accepted generation-aware adapter;
- direct CRM queue `mutate()` on the legacy booking event is removed;
- Owner/Manager legacy path remains separate;
- CRM map cache identity is workspace scoped.

### TEST TARGETS — NOT YET VERIFIED

- zero hidden canonical Dispatch reads;
- one reconciliation when a dirty retained Dispatch becomes active;
- stale response rejection;
- exact unloaded deep-link inclusion behavior.

### TARGET ONLY

- warm retained operational reveal: <100ms.

### NOT VERIFIED

- authenticated browser timing;
- deployed multi-client Home Service realtime behavior;
- production map latency.

---

## J. Rollback

Rollback is Web-code only:

- close the PERF-5 PR without merging, or revert the complete PERF-5 PR/commit range;
- rerun the accepted-main quality gate.

No database rollback or production data repair is expected because PERF-5 contains no database or production-data mutation.

---

## K. Gate decision

**CORRECTION REQUIRED / TEST EXECUTION REQUIRED — DO NOT MERGE**

Implementation is complete enough for the required test pass, but PERF-5 is not accepted evidence yet.

Do not merge until:

1. focused PERF-5 tests pass;
2. type-check passes;
3. changed-file lint passes;
4. build passes;
5. `git diff --check` passes;
6. PERF-1 through PERF-4 regressions remain acceptable;
7. full-suite results are compared with accepted main;
8. independent review returns PASS;
9. Owner explicitly authorizes merge.

Do not start the next performance checkpoint from this authorization.
