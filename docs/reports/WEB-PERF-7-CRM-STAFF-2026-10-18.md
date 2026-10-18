# CradleHub Web — PERF-7 CRM Staff Retention & Reconciliation

**Date:** 2026-10-18  
**Target:** CradleHub Web — CRM Staff only  
**Program:** Web CONTROLLED STABILIZATION  
**Accepted Base / main:** `f0a6922367cba61c21dfd5935afa53f6bfd80029`  
**Implementation Branch:** `stage/web-perf-7-crm-staff`  
**Quality-gate candidate implementation HEAD before this report update:** `4926dbdb6edf56ff237f8cb3ef95d3fa740899ed`  
**Draft PR:** #37  
**Status:** IMPLEMENTATION COMPLETE — QUALITY GATE EXECUTION REQUIRED — **DO NOT MERGE**

---

## A. Authorization and frozen scope

The Owner authorized implementation after the PERF-7 CRM Staff scope freeze.

PERF-7 targets only:

`/crm/staff`

Cash Flow is explicitly deferred to a separate checkpoint because it owns financial/ledger/cash-session integrity.

No Owner Staff, Manager Staff redesign, Staff PWA, schema, migration, RLS, or production operation is authorized by PERF-7.

---

## B. Current-system truth preserved

Before PERF-7, CRM Staff:

- was not registered as a retained workspace module;
- loaded the complete Staff aggregate on every cold visit;
- already switched top-level Staff tabs through native browser history;
- held useful local interaction state in Staff Management;
- used local patches after Staff profile/service/status edits;
- used privileged server reads for onboarding;
- used privileged/server-authoritative branch-correction diagnostics;
- called `window.location.reload()` after successful CRM onboarding approve/reject.

PERF-7 preserves the existing aggregate data ownership model.

No per-tab query decomposition is introduced.

---

## C. Implementation

### 1. Retained module registration

Added `crm-staff` to the CRM retained policy:

- route: `/crm/staff`
- exact route match
- stable search state: `tab`
- stale classification: 60 seconds
- retention cost: high

CRM retention remains count-limited by the existing provider policy.

### 2. Shared canonical Staff data contract

Added:

`src/components/features/crm/staff/crm-staff-workspace-data.ts`

The contract preserves the existing aggregate Staff payload:

- branch identity/name
- reviewer role/branch
- onboarding permission
- active staff
- pending staff
- branches
- active assignable services
- provider staff
- service assignments
- service assignment error state
- onboarding requests
- branch-correction requests

### 3. Shared server-authoritative loader

Added:

`src/lib/queries/crm-staff-workspace.ts`

The loader preserves the existing read sequence and authorization boundaries.

It still resolves:

- authenticated CRM Staff page context
- active Front Desk branch
- role/capability context
- staff/pending staff
- branches
- assignable services
- provider assignments
- permission-gated onboarding requests
- branch-correction issues/diagnostics

Privileged onboarding reads remain server-only.

Non-owner onboarding reads remain scoped to the active branch.

Branch-correction diagnostics remain server-authoritative.

### 4. Server refresh action

Added:

`src/lib/actions/crm-staff-data-actions.ts`

The refresh action accepts no authoritative branch/user/role input.

It calls the shared server loader and fails closed when the Staff session/context is unavailable.

### 5. Generation-aware Staff reconciliation

Added:

`src/components/features/crm/staff/use-live-crm-staff-data.ts`

Uses:

`useGenerationAwareWorkspaceSWR("crm-staff", "/crm/staff", ...)`

The canonical request key is intentionally constant.

Changing:

- Applications
- Branch Corrections
- Staff Management
- Service Assignments
- Status

does not change the canonical Staff request key and therefore does not itself trigger a Staff refetch.

Expected lifecycle:

- initial SSR fallback: zero duplicate canonical fetch;
- hidden dirty Staff: zero network reads;
- focus/reconnect while hidden: zero network reads;
- dirty retained Staff becoming active: one canonical reconciliation;
- stale response: cannot overwrite newer generation;
- failed refresh: last validated Staff payload remains visible;
- manual retry remains available.

### 6. Stale retained reactivation

Because PERF-7 intentionally does not add a new global `staff.changed` domain event, the Staff hook performs one bounded canonical reconciliation when a clean retained Staff module is reactivated after its 60-second stale classification.

An activation token prevents repeated refreshes during the same retained reveal.

Hidden stale Staff does not fetch.

This is a Staff-only compatibility layer; the global generation framework is unchanged.

### 7. Staff workspace local-state preservation

`CrmStaffWorkspace` now consumes canonical SWR data while retaining its existing local interaction state.

Local Staff changes are represented as overlays on the current canonical payload:

- staff row patches;
- service-assignment overrides;
- locally resolved onboarding request IDs;
- locally resolved branch-correction issue patches.

The overlay is considered valid only while it belongs to the current canonical payload. When SWR publishes a new authoritative payload, prior overlays are ignored immediately without synchronously copying props into state.

This avoids effect-driven derived-state synchronization and preserves the server payload as the canonical base.

Existing Staff Management interaction state remains owned by the existing mounted components, including:

- search/filter state;
- selected staff preview;
- expanded groups;
- modal/sheet state where the existing component permits it.

### 8. CRM onboarding retained completion

CRM Applications previously called:

`window.location.reload()`

after successful approve/reject.

That destroys the retained workspace.

PERF-7 adds an optional `onRequestResolved` callback to the existing onboarding review component.

CRM Staff supplies the callback and removes the resolved submitted request locally.

After confirmed success, CRM Staff also invalidates the `crm-staff` generation so the whole aggregate Staff payload reconciles canonical membership/status changes.

Failed onboarding does not call the retained success callback and therefore does not invalidate `crm-staff`.

Other consumers that do not supply the callback preserve the existing browser reload fallback.

No onboarding authorization, role assignment, branch policy, database mutation, or approval rule is changed.

### 9. Confirmed Staff mutation reconciliation

PERF-7 preserves immediate local UI feedback, but confirmed mutations that can change canonical Staff membership, branch, status, or service capability now invalidate only the retained `crm-staff` generation after server success.

Confirmed-success paths include:

- onboarding approve/reject;
- branch-correction resolution;
- staff profile edit;
- active/inactive toggle;
- service capability save.

Optimistic Staff status patches do **not** invalidate before server confirmation.

Failed mutations do not invalidate `crm-staff`.

### 10. Duplicate self-route revalidation removal

Once confirmed mutations reconcile through the generation store, a simultaneous `revalidatePath("/crm/staff")` would create a second CRM Staff refresh path.

PERF-7 therefore removes only the direct `/crm/staff` revalidation from the mutation services that now reconcile through the retained module.

Preserved downstream effects include, as applicable:

- Owner Staff revalidation;
- Manager Staff revalidation;
- CRM Schedule / Today / Services / Setup revalidation;
- public booking/service surfaces;
- Attendance and branch-correction surfaces;
- CRM/Manager cache-tag invalidation.

This is a targeted retained-module compatibility correction, not broad revalidation cleanup.

---

## D. Authorization boundaries preserved

1. Branch identity remains server-derived.
2. Client refresh accepts no branch override.
3. Privileged onboarding reads remain server-only.
4. Non-owner onboarding reads remain branch-scoped.
5. Branch-correction reads/resolution remain server-authoritative.
6. Staff mutation role/branch protections are unchanged.
7. Service capability mutation authorization is unchanged.
8. Sensitive-role protections are unchanged.
9. No service-role credential is exposed to the browser.
10. No RLS bypass is introduced.

---

## E. Changed files

Implementation:

1. `src/app/(dashboard)/crm/staff/actions.ts`
2. `src/app/(dashboard)/crm/staff/page.tsx`
3. `src/app/(dashboard)/owner/staff/actions.ts`
4. `src/components/features/crm/staff/crm-staff-applications-tab.tsx`
5. `src/components/features/crm/staff/crm-staff-management-tab.tsx`
6. `src/components/features/crm/staff/crm-staff-workspace-data.ts`
7. `src/components/features/crm/staff/crm-staff-workspace.tsx`
8. `src/components/features/crm/staff/use-live-crm-staff-data.ts`
9. `src/components/features/dashboard/workspace-retention-policy.ts`
10. `src/components/features/staff-onboarding/onboarding-review-list.tsx`
11. `src/lib/actions/crm-staff-data-actions.ts`
12. `src/lib/actions/crm-staff-services.ts`
13. `src/lib/queries/crm-staff-workspace.ts`
14. `src/lib/staff/staff-onboarding-service.ts`

Tests:

15. `tests/components/crm/staff-confirmed-mutation-reconciliation.test.tsx`
16. `tests/components/crm/staff-generation-swr.test.tsx`
17. `tests/components/crm/staff-onboarding-retained-completion.test.tsx`
18. `tests/components/crm/staff-stale-reactivation.test.tsx`
19. `tests/lib/crm/crm-staff-data-action.test.ts`
20. `tests/lib/crm/crm-staff-retained-mutation-contract.test.ts`
21. `tests/lib/crm/crm-staff-workspace.test.ts`
22. `tests/lib/navigation/workspace-retention-policy-staff.test.ts`

Evidence:

23. `docs/reports/WEB-PERF-7-CRM-STAFF-2026-10-18.md`

No Cash Flow, Owner UI, Manager UI, Desktop, SQL, migration, RLS, generated DB type, or production-operation file is changed. Shared Owner/Staff action files are touched only to remove the retained CRM Staff self-route revalidation; their Owner/Manager authorization and revalidation paths remain intact.

---

## F. New regression contracts

The new tests encode:

- initial Staff fallback produces zero duplicate fetch;
- hidden Staff invalidation produces zero network reads;
- focus/reconnect while hidden produces zero reads;
- dirty Staff reactivation reconciles once;
- stale Staff response cannot overwrite newer generation;
- stale retained Staff reconciles once per activation;
- stale hidden Staff does not fetch;
- `/crm/staff` retention policy preserves only stable `tab`;
- refresh action accepts no authoritative client branch;
- unavailable Staff server context fails closed;
- privileged onboarding reads do not run without review permission;
- permitted non-owner onboarding reads remain branch-scoped;
- branch-correction payload remains part of the aggregate canonical data;
- successful CRM onboarding can complete through retained callback;
- failed onboarding does not remove the request;
- confirmed onboarding/branch/profile/status/service mutation callbacks invalidate `crm-staff` exactly once;
- direct `revalidatePath("/crm/staff")` is absent from retained Staff mutation paths;
- non-CRM Staff/Schedule/Services/Attendance revalidation side effects remain present.

Existing Staff tests remain required for:

- Staff Management interaction-state retention;
- onboarding approval branch safety;
- service assignment replacement;
- service-provider exclusions;
- branch-correction rendering/resolution;
- staff mutation authorization;
- onboarding services/roles;
- schedule/attendance safety.

---

## G. Required focused verification

The following quality gates have **not** been executed by this GitHub-only implementation agent.

Run:

```bash
pnpm exec vitest run \
  tests/components/crm/staff-confirmed-mutation-reconciliation.test.tsx \
  tests/components/crm/staff-generation-swr.test.tsx \
  tests/components/crm/staff-stale-reactivation.test.tsx \
  tests/components/crm/staff-onboarding-retained-completion.test.tsx \
  tests/lib/crm/crm-staff-data-action.test.ts \
  tests/lib/crm/crm-staff-retained-mutation-contract.test.ts \
  tests/lib/crm/crm-staff-workspace.test.ts \
  tests/lib/navigation/workspace-retention-policy-staff.test.ts \
  tests/components/crm/staff-management-retention.test.tsx \
  tests/components/crm/crm-staff-branch-corrections-tab.test.tsx \
  tests/lib/staff/approval-branch-safety.test.ts \
  tests/lib/staff/service-assignment-state.test.ts \
  tests/lib/staff/service-providers.test.ts \
  tests/lib/staff/operational-staff.test.ts \
  tests/lib/staff/staff-mutation-service.test.ts \
  tests/lib/staff/staff-onboarding-service.test.ts \
  tests/lib/staff/branch-correction-policy.test.ts \
  tests/lib/staff/branch-correction-resolution-contract.test.ts
```

Record exact file/test counts and failures.

Then:

```bash
pnpm type-check
```

Changed-file lint:

```bash
pnpm eslint \
  "src/app/(dashboard)/crm/staff/actions.ts" \
  "src/app/(dashboard)/crm/staff/page.tsx" \
  "src/app/(dashboard)/owner/staff/actions.ts" \
  src/components/features/crm/staff/crm-staff-applications-tab.tsx \
  src/components/features/crm/staff/crm-staff-management-tab.tsx \
  src/components/features/crm/staff/crm-staff-workspace-data.ts \
  src/components/features/crm/staff/crm-staff-workspace.tsx \
  src/components/features/crm/staff/use-live-crm-staff-data.ts \
  src/components/features/dashboard/workspace-retention-policy.ts \
  src/components/features/staff-onboarding/onboarding-review-list.tsx \
  src/lib/actions/crm-staff-data-actions.ts \
  src/lib/actions/crm-staff-services.ts \
  src/lib/queries/crm-staff-workspace.ts \
  src/lib/staff/staff-onboarding-service.ts \
  tests/components/crm/staff-confirmed-mutation-reconciliation.test.tsx \
  tests/components/crm/staff-generation-swr.test.tsx \
  tests/components/crm/staff-onboarding-retained-completion.test.tsx \
  tests/components/crm/staff-stale-reactivation.test.tsx \
  tests/lib/crm/crm-staff-data-action.test.ts \
  tests/lib/crm/crm-staff-retained-mutation-contract.test.ts \
  tests/lib/crm/crm-staff-workspace.test.ts \
  tests/lib/navigation/workspace-retention-policy-staff.test.ts
```

Then:

```bash
pnpm build
git diff --check
```

After focused gates pass:

1. rerun accepted PERF-1 through PERF-6 regression suites;
2. run the full repository Vitest suite;
3. compare every failure with accepted main `f0a6922367cba61c21dfd5935afa53f6bfd80029`;
4. do not classify failures as baseline without evidence.

---

## H. Repository-recorded deployment evidence

A Vercel preview/check may run for PR #37.

Any such status is:

**REPOSITORY-RECORDED PRODUCTION EVIDENCE ONLY — NOT LIVE PRODUCTION VERIFICATION**

It does not prove authenticated CRM Staff behavior, operational mutations, or production query latency.

---

## I. Database / production impact

- Migration created: **NO**
- Migration applied: **NO**
- Database schema changed: **NO**
- RLS changed: **NO**
- Production data mutated: **NO**
- Production Staff/onboarding mutation executed: **NO**
- Authenticated deployed browser verification: **NOT PERFORMED**

---

## J. Performance evidence classification

### REPOSITORY-VERIFIED BY IMPLEMENTATION

- CRM Staff is now registered in retained workspace policy.
- Staff canonical refresh uses the generation-aware adapter.
- tab changes use the existing native-history behavior and do not change the canonical Staff request key.
- hidden generation behavior is encoded in focused tests.
- server refresh accepts no authoritative branch input.
- CRM onboarding can complete without mandatory full browser reload.
- confirmed Staff mutations trigger one retained generation invalidation after success.
- retained Staff mutation actions no longer directly revalidate `/crm/staff`; cross-module revalidation remains preserved.
- local optimistic/presentation state is derived as overlays over the current canonical payload rather than copied from props in an effect.

### TARGET

- warm retained Staff reveal: operationally near-instant;
- zero hidden Staff canonical reads;
- one dirty/stale reconciliation when active.

### NOT VERIFIED

- authenticated browser timings;
- deployed production query latency;
- actual memory/heap cost of retaining Staff;
- production onboarding/branch-correction mutation behavior.

---

## K. Deferred work

Not part of PERF-7:

- per-tab lazy Staff reads;
- duplicated auth/context query removal;
- new `staff.changed` global domain event;
- broad Staff revalidation cleanup;
- Cash Flow optimization.

These require separate review after PERF-7 is accepted.

---

## L. Rollback

PERF-7 is Web-code only.

Rollback options:

- close PR #37 without merging; or
- revert the complete PERF-7 PR after merge if later authorized.

No database rollback is expected.

---

## M. Gate

**TEST EXECUTION REQUIRED — DO NOT MERGE PR #37**

Do not begin Cash Flow optimization.

Do not begin Owner conversions.

Do not begin PERF-8.

PERF-7 may move to independent review only after the required quality gates are executed and the evidence report is updated with actual results.
