# CradleHub Web — PERF-4 CRM Schedule + Attendance Tactical Lifecycle

**Date:** 2026-10-17<br/>
**Target:** CradleHub Web — CRM Schedule and CRM Attendance only<br/>
**Stage:** Web CONTROLLED STABILIZATION — PERF-4 correction + verification pass<br/>
**Branch:** `stage/web-perf-4-schedule-attendance`<br/>
**Accepted Base / main:** `cb11e390bdc1d432c43c992e965ce6765c91ca06`<br/>
**Starting branch HEAD at handoff:** `9d102f9c0c1733a96c34a3843ec760910d303b57`<br/>
**Draft PR:** #34<br/>
**Status:** READY FOR INDEPENDENT REVIEW — **DO NOT MERGE**

---

## A. Owner authorization and frozen scope

Owner authorization for PERF-4 was received on 2026-10-17.

The accepted PERF-4 scope is deliberately narrow:

- CRM Schedule retained-state lifecycle normalization;
- CRM Attendance retained-state lifecycle normalization;
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
- `/api/crm/schedule` remains the aggregate canonical refresh endpoint and resolves the authorized CRM branch using server context (`getCrmApiContext()`).
- Realtime events are tactical UI signals, not an authorization or source-of-truth replacement.

### Attendance

Canonical authority remains server-side:

- `getAttendanceWorkspaceData(...)` remains the aggregate CRM Attendance read model.
- Existing attendance correction, scan, exception, device, and policy services remain unchanged.
- The existing `mergeAttendanceWorkspaceCheckin(...)` pure merge is reused for a complete same-branch/same-business-date check-in row.
- Any incomplete or complex attendance change falls back to authoritative background reconciliation.

No client-side patch is allowed to invent schedule-resolution, service/customer joins, conflict results, pricing, financial values, or attendance policy results.

---

## C. Before-state diagnostics

### CRM Schedule

Before PERF-4:

- The retained Schedule shell already existed;
- `useLiveDailySchedule` used ordinary SWR;
- `useScheduleRealtime` subscribed to bookings, staff, resources, staff schedules, overrides, blocked time, and shift check-ins;
- Every realtime event called one broad Schedule refresh;
- Global `staff_schedules`, `schedule_overrides`, and `blocked_times` subscriptions could invalidate the selected branch even when the changed staff/date was unrelated;
- Ordinary SWR reconnect behavior remained enabled for Schedule.

### CRM Attendance

Before PERF-4:

- The retained Attendance shell already existed;
- Ordinary SWR owned canonical refresh;
- Complete shift-checkin rows could already patch Attendance locally;
- Exceptions, corrections, devices, bookings, and incomplete check-in events called a direct broad refresh;
- The lifecycle was not using the PERF-1 generation scheduler.

These are repository-inspected facts, not production observations.

---

## D. PERF-4 implementation

### 1. Generation-aware Schedule reconciliation

`useLiveDailySchedule` now uses:

`useGenerationAwareWorkspaceSWR("crm-schedule", requestKey, ...)`

Consequences:

- No SWR mount/focus/reconnect auto-fetch path;
- Hidden retained data remains available;
- Generation invalidation determines authoritative refresh;
- Stale responses cannot validate a newer generation;
- Request identity remains date-specific;
- Manual refresh remains explicit.

### 2. Tactical Schedule booking patches

A pure merge layer:

`src/lib/schedule/schedule-workspace-realtime-merge.ts`

immediately patches only deterministic fields for an already-known booking:

- Staff assignment;
- Start/end time;
- Status;
- Type/delivery type;
- Payment status/method/amount fields already present on the schedule row (with safe numeric string parsing);
- Resource assignment when the resource exists in the already-authoritative branch resource set;
- Removal when an existing booking is deleted, moved to another date, or explicitly unassigned.

Safety boundaries:

- New booking INSERTs are **not** fabricated because service/customer/resource display data is joined server data;
- Service-ID changes are not locally patched because the new service label/metadata must come from the server;
- Resource IDs not already present in the authoritative branch resource set are not guessed;
- KPIs/stats are not locally recomputed;
- All relevant changes still invalidate `crm-schedule` for canonical background reconciliation.

### 3. Tactical Schedule attendance-presence patch

A complete same-branch/same-date shift-checkin event patches only the affected staff member's `attendance_presence`.

Delete/void/incomplete cases remain server-authoritative because removing one row can expose another historical attendance row.

Events belonging to a different selected business date are ignored unless they reference the exact check-in currently displayed.

### 4. Schedule realtime scope reduction

Existing realtime subscriptions are preserved.

For tables that already expose branch filtering in the existing hook, branch filters remain.

For `staff_schedules`, `schedule_overrides`, and `blocked_times`, PERF-4 applies client-side relevance checks:

- A known `staff_id` outside the visible branch roster does not invalidate the active Schedule;
- An override outside the selected date does not invalidate it;
- A blocked-time row outside the selected date does not invalidate it;
- Ambiguous rows remain conservative and trigger canonical reconciliation rather than being silently discarded.

This reduces cross-branch/date invalidation without changing database publication or schema contracts.

### 5. Generation-aware CRM Attendance

`CrmAttendanceWorkspace` now uses:

`useGenerationAwareWorkspaceSWR("crm-attendance", "/crm/attendance", ...)`

A complete check-in row:

1. Reuses the existing deterministic `mergeAttendanceWorkspaceCheckin`;
2. Patches the affected record/staff summary immediately;
3. Invalidates `crm-attendance`;
4. Lets the generation scheduler reconcile server truth in the background.

Other realtime tables now mark Attendance dirty rather than directly launching an independent broad refresh.

Manual refresh remains explicit and clears tactical overlay state before canonical reconciliation.

Background failure retains the last validated workspace and shows a visible refresh error.

---

## E. Demonstrated failures & corrections during verification pass

During the PERF-4 verification pass, four exact defects were identified and corrected:

1. **`amount_paid` string parsing type safety in Schedule merge:**
   - *Demonstrated failure:* Supabase realtime JSON payloads may deliver `amount_paid` as a numeric string (e.g., `"750.50"`), whereas `DailyScheduleBooking.amount_paid` expects `number | null | undefined`. Passing a raw string caused type-safety and calculation discrepancies.
   - *Root cause:* `amount_paid` from `BookingRealtimeRow` was passed directly without numeric conversion.
   - *Fix:* Safely parsed `Number(nextRow.amount_paid)` when finite in `src/lib/schedule/schedule-workspace-realtime-merge.ts`.
   - *Regression test:* Added test case `"safely parses numeric string amount_paid values from realtime payloads"` to `tests/lib/schedule/schedule-workspace-realtime-merge.test.ts`.

2. **Attendance checkin test helper type error:**
   - *Demonstrated failure:* `pnpm type-check` failed on `tests/lib/attendance/attendance-workspace-realtime-merge.test.ts` where `checkin({ checked_in_at: null })` was flagged because `Partial<AttendanceCheckinRealtimeRow>` typed `checked_in_at` as `string`.
   - *Root cause:* The test helper signature was restricted to `Partial<AttendanceCheckinRealtimeRow>`, rejecting tests intentionally testing invalid/null payload fields.
   - *Fix:* Typed `overrides: Record<string, unknown> = {}` in `checkin` helper.

3. **React 19 render-state pattern in CRM Attendance Workspace:**
   - *Demonstrated failure:* `pnpm eslint` failed with rule `react-hooks/set-state-in-effect` on `setTacticalWorkspace(null)` inside a `useEffect([authoritativeWorkspace])` in `crm-attendance-workspace.tsx`.
   - *Root cause:* Calling `setState` inside an effect triggered by prop/state change causes extra render passes.
   - *Fix:* Adopted the React 19 recommended state adjustment during render using `prevAuthoritativeWorkspace !== authoritativeWorkspace`.

4. **React 19 render-state pattern and unused hook in Schedule Workspace Shell:**
   - *Demonstrated failure:* `pnpm eslint` flagged `react-hooks/set-state-in-effect` on `setTacticalScheduleData(null)` in `schedule-workspace-shell.tsx`, and `@typescript-eslint/no-unused-vars` on `refreshRetainedSchedule = useWorkspaceReactivationRefresh(...)`.
   - *Root cause:* `setTacticalScheduleData(null)` was called inside a `useEffect` responding to `[authoritativeScheduleData, branchId, date]`; `useWorkspaceReactivationRefresh` was superseded by generation-aware SWR and was dead code.
   - *Fix:* Replaced effect with render-time state adjustment `prevScheduleScope`; removed the unused `useWorkspaceReactivationRefresh` import and hook instance.

---

## F. Retained/hidden behavior

PERF-4 relies on the already-accepted React Activity retained-workspace architecture.

Current official React Activity documentation states that hidden Activity content preserves DOM/state while its Effects are cleaned up while hidden and recreated when visible. This matches the accepted CradleHub rule that hidden operational modules should not maintain unnecessary realtime side effects.

Reference:
- https://react.dev/reference/react/Activity

Same-browser domain events can still invalidate hidden modules through the retained workspace generation store. On reactivation, retained data is shown and dirty/stale state is reconciled.

---

## G. Supabase Realtime contract

The implementation preserves the existing Supabase Postgres Changes subscription pattern.

Current Supabase documentation describes Postgres Changes payloads with event type plus new/old row data. PERF-4 treats those payloads only as tactical UI signals and never as authorization authority.

References:
- https://supabase.com/docs/guides/realtime/postgres-changes
- https://supabase.com/docs/reference/javascript/subscribe

Realtime publication/RLS behavior in a deployed production database was **NOT verified in this pass**.

---

## H. Changed files

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

Documentation/Evidence:

10. `docs/reports/WEB-PERF-4-SCHEDULE-ATTENDANCE-2026-10-17.md`

No migrations, SQL, RLS policies, generated DB types, or production-operation scripts were changed.

---

## I. Regression cases encoded in tests

The test suite covers:

- Retained Schedule data visible while hidden;
- Zero hidden Schedule network requests from focus/online invalidation;
- Dirty Schedule reactivation causing one authoritative read;
- Stale Schedule response discarded after a newer invalidation;
- Booking move between staff slots;
- Booking move away from selected date;
- Explicit booking unassignment;
- Unknown booking INSERT staying server-authoritative;
- Service/resource joined data staying server-authoritative;
- Unrelated booking date ignored;
- Complete Attendance presence patch on Schedule;
- Unrelated Attendance business date ignored;
- Attendance delete/void semantics staying server-authoritative;
- Schedule realtime callback updates without resubscription;
- Cross-branch/out-of-date schedule structure changes ignored;
- Attendance workspace check-in row merge;
- Cross-branch/date/test/incomplete Attendance rows ignored.

---

## J. Executed quality gates

All quality gates were directly executed in the repository environment:

### 1. Focused PERF-4 Quality Gate

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
```

- **Test Files:** 10 passed (10)
- **Tests:** 55 passed (55)
- **Failures:** 0
- **Skipped:** 0

### 2. Type-Check Gate

```bash
pnpm type-check
```

- **Command:** `tsc --noEmit`
- **Result:** PASSED (exit code 0, 0 errors)

### 3. Changed-File Lint Gate

```bash
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
```

- **Result:** PASSED (exit code 0, 0 errors, 0 warnings)

### 4. Build Gate

```bash
pnpm build
```

- **Command:** `next build`
- **Result:** PASSED (exit code 0)
- **Compilation:** Turbopack compiled 153/153 static and dynamic routes in 39.2s
- **TypeScript Check in Build:** Passed in 48s

### 5. Git Diff Check

```bash
git diff --check
```

- **Result:** PASSED (clean, 0 whitespace errors)

### 6. Broader Regression Gate (PERF-1A, PERF-1B, PERF-2, PERF-3)

```bash
pnpm vitest run \
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
  tests/lib/crm/quick-booking-customer-prefill-scope.test.ts
```

- **Test Files:** 17 passed (17)
- **Tests:** 127 passed (127)
- **Failures:** 0
- **Skipped:** 0

### 7. Full Repository Vitest Suite

```bash
pnpm exec vitest run --maxWorkers=4
```

- **Test Files:** 369 passed | 1 failed | 2 skipped (372 files total)
- **Tests:** 2959 passed | 1 failed | 2 skipped (2962 tests total)
- **Sole Failure:** `tests/components/bookings/c03-mobile-booking-wizard.test.tsx`
  - Error: `BookingConfirmationModal > renders order confirmation details`
  - Failure Classification: **ACCEPTED-MAIN BASELINE**
  - Verification: Checked out and executed on accepted `origin/main` commit `cb11e390bdc1d432c43c992e965ce6765c91ca06`. The failure is byte-for-byte identical on `main` and completely unrelated to PERF-4 CRM Schedule / Attendance.
- **PERF-4 Introduced Failures:** 0

---

## K. Security, authorization, and data integrity

Unchanged:

- CRM branch resolution remains server-authoritative (`getCrmApiContext()`).
- Schedule API uses authorized CRM server context.
- Attendance action context remains server-side.
- No service-role credential was moved client-side.
- No RLS bypass was introduced.
- No client input became authorization authority.
- No pricing/financial formulas moved client-side.
- No schedule conflict resolution moved client-side.
- No attendance policy or correction logic moved client-side.

---

## L. Performance evidence

- **MEASURED:**
  - Zero hidden Schedule network reads during focus or reconnect events (verified by Vitest lifecycle tests).
  - Retained schedule state preserves valid UI during background reconciliation.
  - Exactly one canonical reconciliation on reactivation when marked dirty.
  - Stale responses from prior generations are rejected and cannot overwrite newer generation data.
  - Realtime booking updates patch existing rows immediately without network roundtrip when deterministic.
  - Out-of-branch and out-of-date schedule overrides and blocked times are filtered out client-side without triggering Schedule invalidation.
- **REPOSITORY-VERIFIED:**
  - SWR auto-revalidation disabled for Schedule and Attendance workspaces.
  - Generation store coordinates background reconciliation.
- **TARGET:**
  - Warm retained operational reveal <100ms.
- **NOT VERIFIED:**
  - `AUTHENTICATED BROWSER PERFORMANCE VERIFICATION: NOT PERFORMED`
  - `<100ms: TARGET ONLY`

---

## M. Database and production impact

- Migration created: **NO**
- Migration applied locally: **NO**
- Migration applied remotely: **NO**
- Database schema changed: **NO**
- Production data mutated: **NO**
- Production operational workflow executed: **NO**
- Authenticated browser verification: **NOT PERFORMED**
- Live production Realtime verification: **NOT PERFORMED**

---

## N. Rollback

Because PERF-4 changes only Web TypeScript/React code and tests:

Rollback by reverting the complete PERF-4 PR/commit range or by closing PR #34 without merging. Do not treat the final correction commit alone as the complete PERF-4 rollback.

No database rollback is required because PERF-4 contains no migrations or production data changes.

---

## O. Review decision

**PERF-4 is ready for independent review. DO NOT MERGE pending independent PASS and explicit owner merge authorization.**
