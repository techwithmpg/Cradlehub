# PERF-1A — Tactical runtime foundation

## Review status and anchors

**PERF-1A IMPLEMENTATION COMPLETE — INDEPENDENT REVIEW REQUIRED**

- Target: local Web runtime implementation and automated tests; remote feature branch for review.
- Authorization: Owner's PERF-0 acceptance + PERF-1A implementation brief dated 2026-10-17.
- Branch: `stage/web-perf-1a-tactical-runtime`.
- Base / initial HEAD / initial merge-base with `origin/main`: `91c5fcf7de47517313ed881cae8e600712bba636`.
- Initial worktree: clean. Created from synchronized accepted main.
- Final implementation SHA: `0accab7b520e70c1b16ff626e7fb7aa177786f75`. The subsequent documentation-only commit carries this report; its delivery SHA is recorded in the final owner handoff and resolves with `git rev-parse stage/web-perf-1a-tactical-runtime`.
- Runtime merge: NOT PERFORMED. Production verification: NOT PERFORMED.

### PERF-0 checkpoint completed first

- Verified pre-PERF main: `7ae8849c127aeeb8154d31fb64cdd10ab0dd9ad9`.
- Verified diagnostics head: `4eafa46ec8cc4f4858ec22ac2a35093719017714` (2 ahead / 0 behind).
- Only changed file: `docs/reports/WEB-ADMIN-PERFORMANCE-DIAGNOSTICS-2026-10-16.md`.
- [PR #27](https://github.com/techwithmpg/Cradlehub/pull/27) merged normally; merge SHA and resulting main both `91c5fcf7de47517313ed881cae8e600712bba636`.
- The default whitespace check flagged 12 Markdown hard-break lines in the accepted report. `git -c core.whitespace=-blank-at-eol diff --check 7ae8849c127aeeb8154d31fb64cdd10ab0dd9ad9...4eafa46ec8cc4f4858ec22ac2a35093719017714` passed. The exact reviewed report was preserved.
- Diagnostics branch retained. No manual deployment was initiated. Any automatic deployment associated with that authorized documentation merge was not inspected or verified.

## Changed files

All runtime paths below are under `src/components/features/dashboard/`:

| File | Change |
| --- | --- |
| `workspace-domain-events.ts` | New typed events, branch filtering, central dependency map and legacy mapping |
| `workspace-generation.ts` | New scoped store, validation tokens and guarded reconciliation helper |
| `use-workspace-generation.ts` | New subscribed generation hook and opt-in real SWR adapter |
| `retained-workspace-provider.tsx` | Scope-owned generation lifecycle, active module, compatibility bridge and cleanup |
| `workspace-module-registry.ts` | Generation fields and compatibility synchronization |
| `workspace-retention-policy.ts` | Delegate existing booking invalidation mapping to central map |
| `use-workspace-visibility.ts` | Expose generation counters; deduplicate existing refresh callback and skip hidden calls |

Tests and documentation:

- `tests/lib/navigation/workspace-generation.test.ts`
- `tests/components/dashboard/workspace-generation-swr.test.tsx`
- `tests/components/dashboard/retained-workspace-provider.test.tsx`
- `docs/reports/WEB-PERF-1A-TACTICAL-RUNTIME-2026-10-17.md`

## Runtime architecture

The retained provider owns one generation store per authenticated workspace/user/role/branch. Semantic notifications pass through a branch-aware dependency map and increment only affected module counters. The registry mirrors these counters for existing lifecycle consumers. The existing dirty/refreshing interface remains available.

`useWorkspaceGeneration` uses `useSyncExternalStore`. `useGenerationAwareWorkspaceSWR` is an opt-in adapter, with SWR retaining ownership of cache and subscriptions. Its request key includes the existing user/role/branch scope plus module and request identity. A null SWR fetcher prevents independent mount/focus/reconnect fetches; the adapter schedules reconciliation explicitly. This does not replace or fork SWR.

One aggregate authoritative reconciliation is supported per module. Future module conversions must gather related slices in that reconciliation; multiple independent slice hooks sharing one module token are not a supported integration. Fetchers must return data without writing other caches or local state. Consumers must use the provided guard at the actual cache-write boundary.

No operational module adopts the new adapter in this stage. No route, loading UI, mobile administrative UI, query waterfall or broad `router.refresh()` cleanup is included. Retention budgets and rollout flags are unchanged. Owner retention remains disabled under the accepted rollout; no environment flag was changed or enabled.

## Semantic event contract

`WorkspaceDomainEvent` is a discriminated union of `{ name, branchId, payload }`. `branchId` is required. Booking payloads allow optional `bookingId` / `orderId`; attendance and schedule allow `staffId`; room allows `resourceId`; driver allows `driverId`; customer allows `customerId`; branch rules have an empty payload.

Every event is **invalidate-only** in PERF-1A. Identity-only data is insufficient for a deterministic business-state patch. A future reviewed authoritative-result contract can permit patches without copying privileged records into browser events. No new production mutation emitters are introduced here.

The following mapping is the operational scope (prefixes `crm-` / `owner-` omitted in cells):

| Event | CRM modules | Owner modules (inactive rollout) |
| --- | --- | --- |
| `booking.status_changed` | work-queue, bookings | overview, bookings |
| `booking.assignment_changed` | work-queue, bookings, schedule, dispatch | bookings, schedule, dispatch |
| `booking.payment_changed` | work-queue, bookings, cash-flow | bookings, cash-flow, reports |
| `booking.rescheduled` | work-queue, bookings, schedule, dispatch | bookings, schedule, dispatch |
| `booking.created` | work-queue, bookings, schedule, customers | overview, bookings, schedule, customers |
| `booking.cancelled` | work-queue, bookings, schedule, dispatch, cash-flow | overview, bookings, schedule, dispatch, cash-flow |
| `attendance.changed` | attendance, schedule | attendance, schedule |
| `schedule.shift_updated` | schedule | schedule |
| `schedule.assignment_changed` | schedule, work-queue, bookings | schedule, bookings |
| `room.changed` | work-queue, schedule | schedule |
| `driver.changed` | dispatch, work-queue | dispatch |
| `customer.changed` | customers, bookings | customers, bookings |
| `branch_rules.changed` | setup, schedule | schedule, services |

Other-branch and unknown event names produce no affected modules. Workspace selects the dependency set; role remains part of scope identity, never an authorization grant. Future module IDs in this map do not create retention policies or activate those modules. Browser notifications remain untrusted invalidation hints; server authorization, validation, pricing and financial truth remain authoritative.

## Generation and reconciliation contracts

- `isDirty = invalidationGeneration > validatedGeneration`; initial state is clean `0/0`.
- `invalidate` increments once; `invalidateMany` deduplicates module IDs within one event. Distinct rapid events each increment.
- `beginValidation` requires an active module and no pending token. A clean manual/TTL refresh first increments invalidation so failure cannot leave it falsely clean.
- Completion requires the exact token object, request identity, active scope, and captured generation. A forged/reused/stale token cannot advance validation.
- Successful authoritative validation advances `validatedGeneration`; failed validation preserves it and leaves the module dirty. Counters never decrease within a live scope. Scope destruction discards the entire store.
- Hiding cancels token eligibility without starting a request. A request already issued is not transport-aborted, but its late result cannot commit through the new helper.
- Reactivation shows retained data immediately and reconciles dirty state in the background. Request-key replacement cancels the old token and invalidates the module.
- Generation 10 cannot commit or validate generation 11. The SWR adapter rechecks the guard inside the cache updater. Late failures from superseded/hidden requests cannot replace current error state.
- Failed automatic reconciliation does not retry in a loop. Explicit retry, a newer invalidation, or reactivation can trigger another attempt.
- The adapter does not introduce polling or TTL scheduling; future adopters must choose their explicit refresh policy.
- Authenticated scope cleanup still purges the existing SWR cache. Scope changes destroy generation state and listeners, including workspace changes.

## Compatibility bridge and remaining consumers

`BOOKINGS_CHANGED_EVENT` retains its original name, emitter and direct listeners. The retained provider adapts one legacy notification to one generation increment for the exact prior module set: CRM work-queue/bookings/schedule; Owner overview/reports/bookings. Semantic events are not rebroadcast as legacy events, so the bridge itself introduces no duplicate notification.

| Remaining listener | Status / intended later removal |
| --- | --- |
| `dashboard/retained-workspace-provider.tsx` | Compatibility bridge; remove only after all emitters/consumers migrate, PERF-4+ |
| `crm/today/cradle-flow-dashboard.tsx` | Unchanged direct listener; migrate in PERF-2 |
| `bookings/crm-bookings-view.tsx` | Unchanged direct listener; migrate in PERF-3 |
| `bookings/owner-bookings-view.tsx` | Unchanged direct listener; Owner conversion in PERF-4+, after branch safety |
| `dispatch/dispatch-workspace.tsx` | Unchanged direct listener; Dispatch conversion in PERF-4+ |

Paths in this table are relative to `src/components/features/`. The existing `src/lib/bookings/bookings-client-events.ts` emitter and callback props remain unchanged. These are proposed future removal stages, not additional implementation authorization.

The compatibility callback now prevents concurrent duplicate invocations per hook and does not start a hidden refresh. Generation tokens prevent a legacy completion from falsely marking a newer invalidation clean. **Legacy refresh callbacks can still mutate their own SWR data before reporting completion; full data-write stale-response protection applies to the new adapter, not to all existing consumers.** Existing broad refreshes and independent polling are not claimed fixed. Callers must not dual-emit old and new events for the same mutation without a reviewed migration plan.

## Verification

Local tools: Node 24.14.0, Next.js 16.2.4, Vitest 4.1.5. The relevant local Next.js client-component guidance and React performance skill were read before implementation.

### Commands and results

1. `pnpm vitest run --maxWorkers=4 tests/lib/navigation/workspace-generation.test.ts tests/components/dashboard/workspace-generation-swr.test.tsx tests/components/dashboard/retained-workspace-provider.test.tsx tests/lib/navigation/workspace-module-registry.test.ts tests/lib/bookings/bookings-client-events.test.ts`
   - PASS: 5 files, 37 tests.
2. `pnpm vitest run --maxWorkers=4 --reporter=json --outputFile=.playwright-mcp/perf1a-vitest-final.json`
   - PASS: 361 files; 2,854 passed / 2 skipped / 0 failed (2,856 total), exit 0.
3. `pnpm type-check`
   - PASS, exit 0.
4. `pnpm exec eslint src/components/features/dashboard/retained-workspace-provider.tsx src/components/features/dashboard/use-workspace-visibility.ts src/components/features/dashboard/workspace-module-registry.ts src/components/features/dashboard/workspace-retention-policy.ts src/components/features/dashboard/use-workspace-generation.ts src/components/features/dashboard/workspace-domain-events.ts src/components/features/dashboard/workspace-generation.ts tests/components/dashboard/retained-workspace-provider.test.tsx tests/components/dashboard/workspace-generation-swr.test.tsx tests/lib/navigation/workspace-generation.test.ts`
   - PASS, exit 0; all 10 changed source/test files.
5. `pnpm eslint src tests`
   - FAIL: 77 errors / 20 warnings. Every reported file was compared with base and is unchanged. Existing issues include Staff PWA set-state-in-effect and attendance/PWA test explicit-any rules. No unrelated correction was made. The project-wide lint gate remains red.
6. `pnpm build`
   - PASS, exit 0: compiled, TypeScript completed, 153 static pages generated. Process-local `NEXT_PUBLIC_SUPABASE_URL=https://build-only.invalid`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=build-only-placeholder`, `SUPABASE_SERVICE_ROLE_KEY=build-only-placeholder`; no environment file changes. This proves compilation, not a live application/database result.
7. `git diff --check` and staged diff whitespace/scope review
   - PASS for the PERF-1A delta.

An initial unrestricted full-suite run during concurrent build/lint/type work reported 3 attendance failures. An isolated rerun while build was still running reported one explicit 5000 ms test timeout. The affected attendance file is unchanged. The full suite subsequently passed with four workers; test assertions and timeout thresholds were not weakened.

The focused suite emits a nonfatal `TimeoutNaNWarning`. A `NODE_OPTIONS=--trace-warnings` run located it in jsdom's EventListener callback during the synthetic focus event in `workspace-generation-swr.test.tsx`. Assertions, including zero hidden fetches, pass; this is not authenticated browser evidence.

### Owner-required coverage

| Requirement | Evidence |
| --- | --- |
| A/B/C/H increment, clean/dirty, rapid events | Pure generation tests, exact counters and duplicate-ID handling |
| D hidden invalidation | Pure helper, real SWR focus/reconnect/manual-retry test, retained-provider hidden callback test |
| E reactivation retains data | Real SWR delayed response and same-generation reactivation tests; predictive provider reactivation |
| F stale response | Generation 10/11, delayed cache-write guard, key replacement, hide/reactivate and scope destruction |
| G failure | Prior data/validated counter preserved; no automatic retry loop; explicit retry succeeds |
| I targeted dependencies | Status/payment/attendance mappings; other branch rejected; provider bridge test |
| J scope identity | Real SWR user/role/branch/module separation; provider scope reset tests |
| K cleanup | Existing authenticated cache purge test retained and passing; pending token destroyed |
| L legacy compatibility | Existing booking-event tests and provider tests; no new duplicate listener after scope changes |

## Limits, production impact and rollback

**NO USER-PERCEIVED PERFORMANCE CLAIM YET.** No authenticated browser, navigation timing, heap profiling, production or live database verification was performed. The evidence is local unit/component/SWR integration testing and compilation.

PERF-1A production impact = **NONE**: this runtime branch is only committed/pushed for review. No runtime main merge, manual deployment, database command, migration, Supabase write, production data mutation, environment change, or Owner-retention activation was performed. The separate authorized PERF-0 documentation merge is recorded above. Database target classification is not asserted; no database was accessed.

Independent review must account for the existing repository lint failure, the opt-in stale-write boundary, the one-reconciliation-per-module contract and the absence of browser/performance evidence. No P0 or production performance improvement is claimed.

Rollback before merge: leave this feature branch unmerged; accepted main already contains only the PERF-0 documentation checkpoint. If later accepted, revert the PERF-1A implementation commit through normal review; no schema or data rollback is needed. Do not force-push main. Before future consumers adopt the helper, reassess their dependencies when planning a revert.

## Next permitted action

Independent review of this branch. No PERF-1A merge or deployment is authorized here.

Recommended next stage, after separate owner authorization: **PERF-1B**, canonical active Owner branch scope and Main → SM → Main isolation evidence. Owner retention remains OFF until all accepted activation gates pass. **PERF-2** then converts CRM Today using one canonical authoritative reconciliation and reviewed tactical status/assignment patches. Later Bookings and other consumers follow their own checkpoints. None of those stages has been started.
