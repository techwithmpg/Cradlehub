# CradleHub Web — PERF-4 CRM Schedule + Attendance Tactical Lifecycle

**Date:** 2026-10-17  
**Target:** CradleHub Web — CRM Schedule and CRM Attendance only  
**Stage:** Web CONTROLLED STABILIZATION — PERF-4 correction pass  
**Branch:** `stage/web-perf-4-schedule-attendance`  
**Accepted Base / main:** `cb11e390bdc1d432c43c992e965ce6765c91ca06`  
**Reviewed implementation HEAD before this evidence document:** `5d58f4695fa65feaf6a5508e2b4bc39118e6765d`  
**Status:** IMPLEMENTATION COMPLETE — QUALITY GATE EXECUTION REQUIRED — **DO NOT MERGE**

---

## A. Owner authorization and frozen scope

Owner authorization for PERF-4 was received on 2026-10-17.

The accepted PERF-4 scope is deliberately narrow:

- CRM Schedule retained-state lifecycle;
- CRM Attendance retained-state lifecycle;
- preserve existing working realtime subscriptions;
- deterministic tactical patches only where the realtime row is sufficient;
- generation invalidation and background canonical reconciliation;
- preserve schedule conflict, attendance, authorization, booking, payment, and database contracts.

Explicitly out of scope:

- Owner Schedule / Owner Attendance conversion;
- Manager Schedule conversion;
- Desktop;
- new scheduling or attendance features;
- scheduling-rule redesign;
- attendance-rule redesign;
- scan-engine changes;
- database migrations;
- RLS or authorization changes;
- pricing / payment changes;
- production data operations.

---

## B. Source-of-truth and ownership

### Schedule

Canonical authority remains server-side:

- `getDailySchedule(...)` resolves operational staff, bookings, blocked time, overrides, staff schedule windows, attendance presence, and schedule conflict state.
- `/api/crm/schedule` remains the aggregate canonical refresh endpoint and resolves the authorized CRM branch using server context.
- realtime is a tactical signal, not an authorization or source-of-truth replacement.

### Attendance

Canonical authority remains server-side:

- `getAttendanceWorkspaceData(...)` remains the aggregate CRM Attendance read model.
- existing attendance correction, scan, exception, device, and policy services remain unchanged.
- the existing `mergeAttendanceWorkspaceCheckin(...)` pure merge is reused for a complete same-branch/same-business-date check-in row.
- any incomplete or complex attendance change falls back to authoritative reconciliation.

No client-side patch is allowed to invent schedule-resolution, service/customer joins, conflict results, pricing, financial values, or attendance policy results.

---

## C. Before-state diagnostics

### CRM Schedule

Before PERF-4:

- the retained Schedule shell already existed;
- `useLiveDailySchedule` used ordinary SWR;
- `useScheduleRealtime` subscribed to bookings, staff, resources, staff schedules, overrides, blocked time, and shift check-ins;
- every realtime event called one broad Schedule refresh;
- global `staff_schedules`, `schedule_overrides`, and `blocked_times` subscriptions could invalidate the selected branch even when the changed staff/date was unrelated;
- ordinary SWR reconnect behavior remained enabled for Schedule.

### CRM Attendance

Before PERF-4:

- the retained Attendance shell already existed;
- ordinary SWR owned canonical refresh;
- complete shift-checkin rows could already patch Attendance locally;
- exceptions, corrections, devices, bookings, and incomplete check-in events called a direct broad refresh;
- the lifecycle was not using the PERF-1 generation scheduler.

These are repository-inspected facts, not production observations.

---

## D. PERF-4 implementation

### 1. Generation-aware Schedule reconciliation

`useLiveDailySchedule` now uses:

`useGenerationAwareWorkspaceSWR("crm-schedule", requestKey, ...)`

Consequences:

- no SWR mount/focus/reconnect auto-fetch path;
- hidden retained data remains available;
- generation invalidation determines authoritative refresh;
- stale responses cannot validate a newer generation;
- request identity remains date-specific;
- manual refresh remains explicit.

### 2. Tactical Schedule booking patches

A new pure merge layer:

`src/lib/schedule/schedule-workspace-realtime-merge.ts`

can immediately patch only deterministic fields for an already-known booking:

- staff assignment;
- start/end time;
- status;
- type/delivery type;
- payment status/method/amount fields already present on the schedule row;
- resource assignment when the resource exists in the already-authoritative branch resource set;
- removal when an existing booking is deleted, moved to another date, or explicitly unassigned.

Safety boundaries:

- new booking INSERTs are **not** fabricated because service/customer/resource display data is joined server data;
- service-ID changes are not locally patched because the new service label/metadata must come from the server;
- resource IDs not already present in the authoritative branch resource set are not guessed;
- KPIs/stats are not locally recomputed;
- all relevant changes still invalidate `crm-schedule` for canonical background reconciliation.

### 3. Tactical Schedule attendance-presence patch

A complete same-branch/same-date shift-checkin event can patch only the affected staff member's `attendance_presence`.

Delete/void/incomplete cases remain server-authoritative because removing one row can expose another historical attendance row.

Events belonging to a different selected business date are ignored unless they reference the exact check-in currently displayed.

### 4. Schedule realtime scope reduction

Existing realtime subscriptions are preserved.

For tables that already expose branch filtering in the existing hook, branch filters remain.

For `staff_schedules`, `schedule_overrides`, and `blocked_times`, PERF-4 now applies client-side relevance checks:

- a known `staff_id` outside the visible branch roster does not invalidate the active Schedule;
- an override outside the selected date does not invalidate it;
- a blocked-time row outside the selected date does not invalidate it;
- ambiguous rows remain conservative and trigger canonical reconciliation rather than being silently discarded.

This reduces cross-branch/date invalidation without changing database publication or schema contracts.

### 5. Generation-aware CRM Attendance

`CrmAttendanceWorkspace` now uses:

`useGenerationAwareWorkspaceSWR("crm-attendance", "/crm/attendance", ...)`

A complete check-in row:

1. reuses the existing deterministic `mergeAttendanceWorkspaceCheckin`;
2. patches the affected record/staff summary immediately;
3. invalidates `crm-attendance`;
4. lets the generation scheduler reconcile server truth in the background.

Other realtime tables now mark Attendance dirty rather than directly launching an independent broad refresh.

Manual refresh remains explicit and clears tactical overlay state before canonical reconciliation.

Background failure retains the last validated workspace and shows a visible refresh error.

---

## E. Retained/hidden behavior

PERF-4 relies on the already-accepted React Activity retained-workspace architecture.

Current official React Activity documentation states that hidden Activity content preserves DOM/state while its Effects are cleaned up while hidden and recreated when visible. This matches the accepted CradleHub rule that hidden operational modules should not maintain unnecessary realtime side effects.

Reference:
- https://react.dev/reference/react/Activity

Same-browser domain events can still invalidate hidden modules through the retained workspace generation store. On reactivation, retained data is shown and dirty/stale state is reconciled.

Authenticated browser timing remains unmeasured.

---

## F. Supabase Realtime contract

The implementation preserves the existing Supabase Postgres Changes subscription pattern.

Current Supabase documentation describes Postgres Changes payloads with event type plus new/old row data. PERF-4 treats those payloads only as tactical UI signals and never as authorization authority.

References:
- https://supabase.com/docs/guides/realtime/postgres-changes
- https://supabase.com/docs/reference/javascript/subscribe

Realtime publication/RLS behavior in a deployed production database was **NOT verified in this pass**.

---

## G. Changed files

Implementation:

1. `src/components/features/attendance/crm-attendance-workspace.tsx`
2. `src/components/features/schedule/hooks/use-live-daily-schedule.ts`
3. `src/components/features/schedule/hooks/use-schedule-realtime.ts`
4. `src/components/features/schedule/workspace/schedule-workspace-shell.tsx`
5. `src/lib/schedule/schedule-workspace-realtime-merge.ts`

Tests added/updated:

6. `tests/lib/attendance/attendance-workspace-realtime-merge.test.ts`
7. `tests/lib/schedule/schedule-workspace-realtime-merge.test.ts`
8. `tests/lib/schedule/use-live-daily-schedule-generation.test.tsx`
9. `tests/lib/schedule/use-schedule-realtime.test.tsx`

No migrations, SQL, RLS policies, generated DB types, or production-operation scripts were changed.

---

## H. Regression cases encoded in tests

The branch contains tests for:

- retained Schedule data visible while hidden;
- zero hidden Schedule network requests from focus/online invalidation;
- dirty Schedule reactivation causing one authoritative read;
- stale Schedule response discarded after a newer invalidation;
- booking move between staff slots;
- booking move away from selected date;
- explicit booking unassignment;
- unknown booking INSERT staying server-authoritative;
- service/resource joined data staying server-authoritative;
- unrelated booking date ignored;
- complete Attendance presence patch on Schedule;
- unrelated Attendance business date ignored;
- Attendance delete/void semantics staying server-authoritative;
- Schedule realtime callback updates without resubscription;
- cross-branch/out-of-date schedule structure changes ignored;
- Attendance workspace check-in row merge;
- cross-branch/date/test/incomplete Attendance rows ignored.

---

## I. Required quality gates

**IMPORTANT: The following commands are REQUIRED but were NOT executed by this agent environment.**

The execution environment could not resolve `github.com` to obtain a local checkout, and there is no repository test runner exposed through the GitHub connector. Therefore no Vitest/type-check/lint result is fabricated.

Minimum PERF-4 merge gate:

```bash
pnpm exec vitest run \
  tests/lib/schedule/use-schedule-realtime.test.tsx \
  tests/lib/schedule/use-live-daily-schedule.test.ts \
  tests/lib/schedule/use-live-daily-schedule-generation.test.tsx \
  tests/lib/schedule/schedule-workspace-realtime-merge.test.ts \
  tests/lib/schedule/live-schedule-conflicts.test.ts \
  tests/lib/schedule/schedule-conflict-center-dialog.test.tsx \
  tests/lib/attendance/attendance-workspace-realtime-merge.test.ts \
  tests/lib/attendance/attendance-realtime-resilience-contract.test.ts \
  tests/lib/attendance/attendance-state-machine.test.ts \
  tests/lib/attendance/day-model.test.ts

pnpm type-check

pnpm eslint \
  src/components/features/attendance/crm-attendance-workspace.tsx \
  src/components/features/schedule/hooks/use-live-daily-schedule.ts \
  src/components/features/schedule/hooks/use-schedule-realtime.ts \
  src/components/features/schedule/workspace/schedule-workspace-shell.tsx \
  src/lib/schedule/schedule-workspace-realtime-merge.ts \
  tests/lib/attendance/attendance-workspace-realtime-merge.test.ts \
  tests/lib/schedule/schedule-workspace-realtime-merge.test.ts \
  tests/lib/schedule/use-live-daily-schedule-generation.test.tsx \
  tests/lib/schedule/use-schedule-realtime.test.tsx

pnpm build
git diff --check
```

After the focused gate, the repository's accepted broader regression/full-suite gate must also be run and compared with accepted-main baseline behavior before PASS.

---

## J. Current repository/deployment evidence

At implementation HEAD `5d58f4695fa65feaf6a5508e2b4bc39118e6765d`:

- branch was 17 commits ahead / 0 behind accepted `main`;
- merge base was exactly `cb11e390bdc1d432c43c992e965ce6765c91ca06`;
- latest Vercel status was **pending** at the time this report was written.

An earlier intermediate branch head had a successful Vercel status. That does **not** substitute for the final-head test gate and is not live production verification.

Any deployment status in this section is **REPOSITORY-RECORDED PRODUCTION EVIDENCE ONLY — NOT LIVE PRODUCTION VERIFICATION**.

---

## K. Security, authorization, and data integrity

Unchanged:

- CRM branch resolution remains server-authoritative.
- Schedule API uses authorized CRM server context.
- Attendance action context remains server-side.
- No service-role credential was moved client-side.
- No RLS bypass was introduced.
- No client input became authorization authority.
- No pricing/financial formulas moved client-side.
- No schedule conflict resolution moved client-side.
- No attendance policy or correction logic moved client-side.

---

## L. Database and production impact

- Migration created: **NO**
- Migration applied locally: **NO**
- Migration applied remotely: **NO**
- Database schema changed: **NO**
- Production data mutated: **NO**
- Production operational workflow executed: **NO**
- Authenticated browser verification: **NOT PERFORMED**
- Live production Realtime verification: **NOT PERFORMED**

---

## M. Rollback

Because PERF-4 changes only Web TypeScript/React code and tests:

1. revert the PERF-4 branch/PR commits;
2. rerun the accepted-main quality gate;
3. no database rollback is required;
4. no production data repair is required from the changes in this branch.

---

## N. Gate decision

**CORRECTION REQUIRED / TEST EXECUTION REQUIRED**

The implementation is bounded and ready for the required test run, but it is **not merge-authorized evidence yet**.

Do not merge PERF-4 until:

1. focused realtime + conflict tests pass;
2. type-check passes;
3. changed-file lint passes;
4. build passes at the final reviewed HEAD;
5. broader regression/full-suite results are compared with accepted main;
6. independent review returns PASS;
7. owner explicitly authorizes merge.

Do not start PERF-5 from this authorization.
