# CradleHub Unified Optimization Engine & O4 Local Integration — Audit, Architecture, Verification & Release Gates

- **Date:** 2026-11-18 / 2026-11-19
- **Repository:** `techwithmpg/Cradlehub`
- **Accepted Baseline (`main` / `origin/main`):** `63bc45e309fc399f231c40dd3c18d345e6776c7f`
- **Implementation Branch:** `unified_optimization_engine` (worktree `C:\Users\eleur\.gemini\antigravity\worktrees\cradlehub\unified_optimization_engine`)
- **Integration Status:** **LOCAL SOURCE INTEGRATION READY / INDEPENDENTLY APPROVED (0 P0, 0 P1)** — Authorized for local `main` merge for local integrated testing only; **no remote push to `origin/main`, no Production SQL apply, no Vercel Production mutation, and no APK distribution executed**.

---

## 1. Executive Summary & Architectural Mission

This work audits the existing CradleHub home-service VRPPD optimizer (`O1`), CRM live map (`O2`), native Android driver UI (`O3`), unmerged/incomplete O4 dispatch plans (`stage/driver-full-integration-o4-20261117` @ `fdee6193`), and the authoritative TypeScript/PostgreSQL on-site booking engine, and integrates them into a cohesive **Unified Optimization Engine** across six coordinated layers without replacing authoritative booking, payment, attendance, or RLS boundaries:

1. **On-Site Level 1 Optimization:** OR-Tools CP-SAT therapist + treatment-room + concurrent/group assignment and slot search (`services/driver-optimizer/app/onsite_solver.py`, `app/onsite_models.py`) wired behind `src/lib/optimization/onsite-availability-adapter.ts` with deterministic TypeScript parity fallback and preservation of mandatory prep/reset safety buffers.
2. **Home-Service Level 2 Optimization (O1 + Hardened O4):** Preserves the validated O1 VRPPD mathematical model (`constraints.py`, `scheduling.py`, `fairness.py`, `validation.py`, `solver.py`) while completing transactional multi-leg Postgres journey plans (`supabase/operations/driver-o4-journeys.sql`), idempotent server-authoritative plan commit/collection disposition (`src/lib/dispatch/optimizer-bridge.ts`, `src/lib/actions/optimizer-dispatch-actions.ts`), grouped Android `tripPlans` contracts (`src/lib/driver/trip-plans.ts`, `native/driver-android/...`), and CRM Live Map multi-stop/active-driver visualization (`src/lib/dispatch/crm-live-map-model.ts`).
3. **Shared Scheduling Intelligence:** Unifies therapist shift/override windows, on-site service + turnover occupancy, home-service outbound/return travel + session windows, and interbranch assistance transfers in `services/driver-optimizer/app/unified_engine.py`, `src/lib/optimization/snapshot-loader.ts`, and `src/lib/optimization/fallback-evaluator.ts`.
4. **Predictive Conflict Detection & Dynamic Buffers:** Evaluates live branch state across `/api/optimization/evaluate` (`src/lib/optimization/client.ts`), detecting on-site/home-service overlaps, room turnover collisions, session overrun ripples, driver route ripples, delayed/unconfirmed collections, GPS staleness, unfulfilled group resource holds, rule drift, and earlier-slot opportunities with bounded traffic-aware/session-aware dynamic buffers (`src/lib/optimization/dynamic-buffer.ts`).
5. **CRM Operations Assistance:** Translates detected conflicts and recommendations into deterministic staff actions and auditable `workflow_tasks` / `workspace_notifications` records (`src/lib/optimization/crm-operations-assistant.ts`, `src/lib/actions/optimization-actions.ts`), surfaced inside `<CrmOptimizationAssistantPanel />` in `/crm/schedule` and `/crm/dispatch`, with guarded therapist reassignment, room reassignment, collection disposition updates, and failure-safe rollback (`src/lib/bookings/session-extension-actions.ts`).
6. **Branch-Aware Optimization:** Enforces Main Spa room-backed capacity (8 rooms: suites + single rooms) alongside SM Branch zero-room soft-slot behavior (`allow_service_without_room`), cross-branch transfer awareness via `interbranch_assistance_requests`, and strict `branch_id` isolation on reads, RPCs, and writes.

---

## 2. Deliverable A — Existing Optimizer Capability Matrix

Baseline evaluated against accepted `main` (`63bc45e3`) + O1 (`stage/driver-optimizer-o1-foundation-20261117`), O2 (`stage/crm-live-driver-map-o2-20261117`), O3 (`stage/o3-native-driver-trips-ui-20261117`), and O4 (`stage/driver-full-integration-o4-20261117`) artifacts:

| Capability | Baseline / Current Implementation | Evidence | Gap at Baseline (`63bc45e3`) | Implemented Resolution |
| --- | --- | --- | --- | --- |
| 1. Driver availability and shift windows | **IMPLEMENTED AND VERIFIED** (O1 solver + DB snapshot wiring) | `app/validation.py` (`validate_request_integrity`), `app/scheduling.py` (`reconcile_scheduling_and_obligations`), `tests/test_time_windows.py`, `src/lib/dispatch/optimizer-bridge.ts` (`buildDispatchOptimizerSnapshot`) | O1 used synthetic JSON; `63bc45e3` did not query `staff_schedules`/`schedule_overrides` for optimizer dispatch | `optimizer-bridge.ts` builds shift windows from live schedules/overrides/attendance; `driver-o4-live-optimizer-e2e.mjs` verified |
| 2. Vehicle passenger capacity | **IMPLEMENTED AND VERIFIED** | `app/constraints.py` (`build_routing_model`, vehicle capacity dim), `tests/test_capacity.py` | Only synthetic tests exercised pooled seating limits | Preserved O1 capacity dimension + verified in live PG->Python E2E pooling runs |
| 3. Therapist-to-vehicle assignments | **IMPLEMENTED AND VERIFIED** | `app/constraints.py` (`_restrict_vehicles_for_index`, `VehicleVar`), `tests/test_solver.py` | Required server commit back into Postgres journey legs | Preserved O1 assignment logic; persisted via `driver_o4_commit_plan` (`driver-o4-journeys.sql`) |
| 4. Multiple therapist pooling | **IMPLEMENTED AND VERIFIED** | `app/constraints.py` (`build_routing_model`), `app/scheduling.py` (`reconcile_scheduling_and_obligations`), `tests/test_capacity.py`, `fixtures/pooled_delivery.json` | O4 Android & CRM UI needed grouped multi-therapist `vehicle_journey_id` stops | Preserved O1 pooling (+1 served order in benchmark) & wired grouped `tripPlans` (`trip-plans.ts`, `O4TripPlansParserTest.kt`) |
| 5. Multi-stop route optimization | **IMPLEMENTED AND VERIFIED** | `app/constraints.py` (`build_routing_model`, `AddPickupAndDelivery`), `tests/test_solver.py` | Stop ordering existed in O1 JSON response but was unpersisted | Persisted as `driver_o4_vehicle_journeys` + ordered `driver_o4_vehicle_stops` (`driver-o4-journeys.sql`) |
| 6. Driver fairness and utilization | **IMPLEMENTED AND VERIFIED** | `app/fairness.py` (`register_fairness_dimension`, `WORKLOAD_NORMALIZATION_SCALE`, `compute_driver_available_minutes`), `tests/test_fairness.py` | Fairness scores computed per request but depended on current day workload | Preserved O1 fairness math; `optimizer-bridge.ts` feeds completed minutes/trips per driver |
| 7. Pickup-before-drop-off constraints | **IMPLEMENTED AND VERIFIED** | `app/constraints.py` (`AddPickupAndDelivery`), `tests/test_capacity.py`, `tests/test_solver.py` | Needed end-to-end persistence of pickup vs drop-off leg order | Preserved O1 constraint + validated against Postgres stop sequences |
| 8. Customer arrival deadlines | **IMPLEMENTED AND VERIFIED** | `app/validation.py` (`effective_pickup_window`), `app/constraints.py` (`TIME_SCALE_SECONDS`), `tests/test_time_windows.py` | Missing pre-commit detection of tight/missed deadlines on CRM view | Preserved O1 hard time windows + surfaced tight/overdue risk in `unified_engine.py` |
| 9. Travel-time and distance matrices | **IMPLEMENTED AND VERIFIED** | `src/lib/dispatch/optimizer-bridge.ts` (`computeSnapshotTravelMatrix`), `src/app/api/home-service/distance/route.ts`, `tests/lib/dispatch/o4-optimizer-e2e-integration.test.ts` | O1 required caller-supplied matrices; `63bc45e3` only computed 1:1 point ETAs | `computeSnapshotTravelMatrix` builds traffic-aware Routes API matrices with safe haversine fallback & cache |
| 10. Return-to-branch requirements | **IMPLEMENTED AND VERIFIED** | `app/scheduling.py` (`_build_onward_collection_from_therapist`), `app/constraints.py`, `tests/test_collections.py` | Needed enforcement when `collection_disposition` requires return | `driver_unified_private.journeys` tracks return leg & `driver_o4_set_collection_decision` gates release |
| 11. Conditional therapist collection | **IMPLEMENTED AND VERIFIED** | `app/scheduling.py` (`withheld_undecided_deliveries`), `app/solver.py` (`_build_collection_coverage`, `_evaluate_collection_safety`), `tests/test_collections.py` | SQL triggers on `63bc45e3` flipped prematurely on `auto_due` or before collection decision | Preserved O1 collection safety + fixed SQL `booking_changed()` & `collection-ready.ts` / `trip-plans.ts` (`sessionCompletionSource !== "auto_due"`) |
| 12. Different delivery and collection drivers | **IMPLEMENTED AND VERIFIED** | `app/scheduling.py`, `tests/test_collections.py`, `fixtures/split_collection.json`, `supabase/operations/driver-o4-journeys.sql` (`delivery_driver_id`, `collection_driver_id`) | Trigger `one_active_journey` previously blocked leg B when leg A was owned by another driver | Split leg ownership enforced strictly by active `stage` (`delivery` vs `collection`/`return`) & verified in PG E2E |
| 13. Driver reassignment penalties | **IMPLEMENTED AND VERIFIED** | `app/constraints.py` (`reassignment_penalty * COST_UNITS_PER_MINUTE`), `tests/test_solver.py` | Bridge needed to pass `current_driver_id` consistently across snapshots | `optimizer-bridge.ts` forwards active driver IDs & locked states |
| 14. Locked active journeys | **IMPLEMENTED AND VERIFIED** | `app/constraints.py` (`locked_stop_sequence`, `locked_infeasibility_reasons`), `tests/test_solver.py` | SQL commit needed idempotency/version protection if driver advances mid-solve | `driver_o4_commit_plan` validates locks & revisions inside serializable/atomic SQL transaction |
| 15. Infeasible assignment explanations | **IMPLEMENTED AND VERIFIED** | `app/constraints.py` (`locked_infeasibility_reasons`), `app/solver.py` (`_collect_unassigned_obligations`), `app/models.py` (`OptimizationResponse`), `src/components/features/dispatch/dispatch-flow-tab.tsx` | UI needed to block plan commit & explain why when `operational_commitment_allowed == false` | `"Apply Optimized Plan"` disabled + `infeasibility_reasons` surfaced in CRM dispatch UI |
| 16. Independent solution validation | **IMPLEMENTED AND VERIFIED** | `app/validation.py` (`validate_request_integrity`, `check_driver_obligation_compatibility`), `src/lib/dispatch/optimizer-bridge.ts` (`validateProposedPlanAgainstDb`) | O4 commit needed secondary DB state validation before SQL mutation | Dual-layer validation: Python request/solution integrity + TypeScript `validateProposedPlanAgainstDb` |
| 17. Future driver availability | **IMPLEMENTED AND VERIFIED** | `src/lib/dispatch/optimizer-bridge.ts`, `services/driver-optimizer/app/unified_engine.py`, `src/lib/optimization/fallback-evaluator.ts` | O1 planned single dispatch horizon without surfacing projected post-return driver free windows | Unified engine & snapshot loader project driver ETA / free-after timestamps into shared timeline & booking evaluation |
| 18. Rolling reoptimization | **IMPLEMENTED AND VERIFIED** | `app/solver.py` (`optimize_dispatch`), `src/lib/dispatch/optimizer-bridge.ts` (`requestDispatchOptimizationPlan`), `src/lib/actions/optimizer-dispatch-actions.ts` | No triggerable CRM reoptimization action wired end-to-end | Dispatch flow tab + server action re-solves rolling snapshots while preserving locked active legs |
| 19. Live Google Routes Matrix integration | **IMPLEMENTED AND PARTIALLY VERIFIED** *(API key/live quota external)* | `src/lib/dispatch/route-eta.ts` (`shouldRecomputeDriverRoute`, `buildRouteCacheKey`, `decodeEncodedPolyline`), `src/lib/dispatch/optimizer-bridge.ts` (`computeSnapshotTravelMatrix`), `src/app/api/home-service/distance/route.ts` | Matrix endpoint needed multi-origin batching with rate-limit fallback for O1 | Implemented live Routes API lookup with deterministic Haversine fallback; live Google billing/quota test remains an external cutover gate |
| 20. Live driver-position input | **IMPLEMENTED AND VERIFIED** *(mocked/local PG; device GPS hardware external)* | `src/app/api/staff/driver/native-location/route.ts`, `src/lib/dispatch/arrival-events.ts` (`validateArrivalEvent`), `src/lib/dispatch/crm-live-map-model.ts` | Stale/missing GPS created silent optimism in dispatch estimates | Monotonic GPS merge on Live Map + `location_or_gps_degraded` predictive warning + GPS staleness dynamic buffer |
| 21. Server-authoritative journey commits | **IMPLEMENTED AND VERIFIED** | `supabase/operations/driver-o4-journeys.sql` (`driver_o4_commit_plan`, `driver_o4_set_collection_decision`), `src/lib/dispatch/optimizer-bridge.ts` (`commitOptimizedDispatchPlan`), `src/lib/bookings/session-extension-actions.ts` | Not installed or wired on `main` (`63bc45e3`); role/branch checks incomplete on O4 draft | Hardened SQL RPCs + role exclusions + active-leg triggers + `"driver"` workspace notifications; verified on PG 17.11 |
| 22. Android driver synchronization | **IMPLEMENTED AND PARTIALLY VERIFIED** *(73 JVM tests pass; physical device E2E pending cutover)* | `src/app/api/staff/driver/journeys/route.ts`, `src/lib/driver/trip-plans.ts`, `native/driver-android/.../{NativeDriverModel.kt,NativeDriverBackend.kt,NativeTripsPolicy.kt,DriverNavigationController.java}`, `O4TripPlansParserTest.kt` | Native app lacked O4 `tripPlans` stop/passenger schema | Added typed `tripPlans` DTO parser, policy tests (`73/73` JVM pass), and O4 navigation controller integration |
| 23. CRM Live Map integration | **IMPLEMENTED AND PARTIALLY VERIFIED** *(mocked Maps/PG verified; live Google Maps tile QA external)* | `src/lib/dispatch/crm-live-map-model.ts`, `src/components/features/dispatch/dispatch-flow-tab.tsx`, `src/components/features/dispatch/dispatch-workspace.tsx`, `src/components/features/optimization/crm-optimization-assistant-panel.tsx` | Orphaned journeys overwrote grouped stops; O4 plan apply & conflict assistant not integrated | Appends orphaned stops by active driver UUID, surfaces O4 plan + conflicts + one-click CRM actions |

---

## 3. On-Site Scheduling & Live Database Audit Findings

### Authoritative On-Site Subsystems Preserved
- **Availability & Slot Engine:** `src/lib/engine/availability.ts`, `src/lib/engine/exact-crm-booking-time.ts` (`resolveExactCrmBookingTime`), `src/lib/engine/resource-availability.ts`, `src/lib/engine/booking-time.ts`.
- **Authoritative Writers & Rules:** `src/lib/bookings/inhouse-booking-engine.ts` (`executeInhouseBookingCreation`), `src/lib/bookings/booking-rules-config.ts` (`DEFAULT_BRANCH_BOOKING_RULES`), `src/lib/bookings/session-extension-actions.ts`.
- **Therapist Scoring & Room Turnover:** `src/lib/assignments/recommendation-engine.ts` (`scoreTherapistCandidates`, `scoreDriverCandidates`), `src/lib/staff-pwa/utility-turnover.ts` (`triggerUtilityRoomTurnoverOnServiceCompletion`, `startRoomCleaning`, `markRoomReady`, `isResourceInActiveTurnover`).

### Key Audit Gaps Identified & Addressed
1. **Fragmented Sequential Allocation:** `availability.ts` / `resource-availability.ts` assigned rooms greedily per single request and lacked joint combinatorial CP-SAT matching for peak-hour solo + couple/group bookings with mandatory `buffer_before_minutes` / `buffer_after_minutes`. Resolved via `onsite_solver.py` + `onsite-availability-adapter.ts` without replacing `inhouse-booking-engine.ts` as the booking commit authority.
2. **Branch Room Topology Asymmetry:** Main Spa operates 8 room resources (4 multi-guest suites + 4 single rooms in verified fixtures matching Main's 8 recorded rooms), whereas SM Branch has 0 registered `branch_resources` (`allow_service_without_room`). Both `onsite_solver.py` and `unified_engine.py` explicitly honor `allow_service_without_room` and detect `rule_drift_or_cross_branch_gap` when branch rules and scheduling rules diverge (e.g., 30-min vs 60-min buffer configuration drift).
3. **Production Supabase Read-Only Inspection Posture:** Production project `lsrbwqhvzjfpiabeolkv` was **not mutated**. All schema/trigger/RPC execution tests ran against disposable local PostgreSQL `17.11` clusters using production-parity DDL (`driver-o4-journeys.sql` + `driver-unified-journeys.sql` + synthetic fixtures) with clean cluster teardown.

---

## 4. Benchmark & Peak Capacity Simulation Evidence

Measured after final code edits by executing `services/driver-optimizer/.venv/Scripts/python.exe services/driver-optimizer/benchmarks/run_benchmarks.py`:

### On-Site Peak-Hour Capacity Simulation
- **Scenario:** Main Spa 8-room peak concurrent hour (4 solo + 4 couples requests; mandatory 10-minute prep/cleanup buffers preserved — `safety_buffers_compressed: false`):
  - **Naive greedy allocation:** 4 orders / 4 guests reliably served
  - **CP-SAT optimizer:** **7 orders / 10 guests reliably served** (**+3 orders, +6 guests**, zero safety-buffer compression)

### Endpoint Latencies (FastAPI `TestClient`)
- `onsite_assign_couples_8rooms_10th` (20 runs): **p50 = 32.93 ms**, **p95 = 34.73 ms**, max = 36.03 ms
- `onsite_slot_matrix_20slots_8rooms_10th` (20 runs): **p50 = 27.14 ms**, **p95 = 29.73 ms**, max = 63.92 ms
- `onsite_sm_branch_0rooms_6th` (20 runs): **p50 = 9.83 ms**, **p95 = 10.90 ms**, max = 11.16 ms
- `unified_evaluate_12bk_10th_8rm_4drv` (20 runs): **p50 = 13.13 ms**, **p95 = 14.19 ms**, max = 14.22 ms
  - Sample conflict classes emitted: `driver_route_ripple`, `earlier_slot_opportunity`, `location_or_gps_degraded`, `room_turnover_collision`, `rule_drift_or_cross_branch_gap`, `session_overrun_ripple`

### Home-Service `/v1/simulate` (10 runs per fixture)
- `mixed_conditional_collection`: `p50 = 43.06 ms`, `p95 = 46.13 ms`, status `feasible`, served `5 -> 5`, drive min `82.0 -> 62.0` (**-20.0 min**, **-7.0 km**), workload spread reduction **0.1527**
- `pooled_delivery`: `p50 = 12.16 ms`, `p95 = 13.00 ms`, status `feasible`, served `2 -> 3` (**+1 served**), drive min `38.0 -> 18.0` (**-20.0 min**, **-6.5 km**)
- `split_collection`: `p50 = 24.50 ms`, `p95 = 24.98 ms`, status `feasible`, served `4 -> 4`, drive min `109.0 -> 51.0` (**-58.0 min**, **-20.0 km**), workload spread reduction **0.092**
- `simple_delivery`: `p50 = 6.62 ms`, `p95 = 7.45 ms`, status `feasible`, served `1 -> 1`, drive min `12.0 -> 12.0`
- `shift_conflict`: `p50 = 6.76 ms`, `p95 = 7.50 ms`, status `partial`, served `1 -> 1`, drive min `50.0 -> 50.0`

---

## 5. Post-Final-Edit Verification Ledger

Every check below was executed **after the final code and test edits**:

| Verification Suite | Command | Result | Observed Details |
| --- | --- | --- | --- |
| Python Optimizer Tests | `services\driver-optimizer\.venv\Scripts\python.exe -m pytest services\driver-optimizer\tests -q` | **PASS** | **58 passed** (`test_api.py` 12, `test_capacity.py` 3, `test_collections.py` 18, `test_fairness.py` 4, `test_onsite_solver.py` 7, `test_solver.py` 7, `test_time_windows.py` 5, `test_unified_engine.py` 2), 4 FastAPI/SWIG warnings |
| Local PG O4 SQL Integration | `node tests\database\driver-o4-integration-local-test.mjs` | **PASS** | `ALL_O4_SQL_TESTS_PASSED` on disposable PG 17.11 (active-leg `one_active_journey`, `collection_commitment_requires_dispatch_plan`, `auto_due` guard, `o4_internal` clearing, role/branch RLS) |
| Local PG + Live Python O1->O4 E2E | `node tests\database\driver-o4-live-optimizer-e2e.mjs` | **PASS** | `LIVE_PYTHON_O1_POSTGRES_O4_E2E_PASSED` |
| Local PG + Unified Engine E2E | `node tests\database\unified-optimization-local-test.mjs` | **PASS** | `UNIFIED_LOCAL_POSTGRES_AND_SOLVER_PASSED` |
| TypeScript Check | `pnpm exec tsc --noEmit` | **PASS** | Exit code 0 |
| ESLint (Changed TS/TSX/MJS) | `pnpm exec eslint <changed-files>` | **PASS** | Exit code 0 (0 errors; note earlier repo run flagged pre-existing `TIER_ORDER` unused-var warning in `src/lib/engine/availability.ts:1187`) |
| Vitest Focused + Attendance Regression Suites | `pnpm vitest run tests/lib/optimization tests/lib/dispatch tests/lib/driver tests/lib/engine tests/lib/bookings/dispatch-conflict.test.ts tests/lib/attendance` | **PASS** | **69 test files passed, 549 tests passed** (0 failed, 0 skipped) |
| Android Driver Unit Tests | `gradle -p native\driver-android :app:testDebugUnitTest --rerun-tasks --offline --no-daemon` | **PASS** | **73 tests passed** (`DriverSessionStateTest` 9, `NativeDriverPolicyTest` 31, `NativeTripsPolicyTest` 31, `O4TripPlansParserTest` 2; 0 skipped, 0 failed) |
| Next.js Production Build | `pnpm build` (synthetic placeholder Supabase env) | **PASS** | Compiled in 22.9s, TypeScript finished in 95s, **160/160** static routes generated; expected placeholder fetch warnings during prerender cache revalidation |
| HTTP Auth & Optimizer Smoke Probe | `node "...\scratch\smoke_http.mjs"` | **PASS** | `optimizerHealth: "ok"`, `apiOptimizationEvaluateUnauthStatus: 401`, `apiDriverJourneysUnauthStatus: 401`, `apiCrmAvailabilityUnauthStatus: 400`, `crmDispatchRedirectStatus: 307`, `crmScheduleRedirectStatus: 307`, `smokePassed: true` |
| Benchmarks | `python services\driver-optimizer\benchmarks\run_benchmarks.py` | **PASS** | All capacity, latency, and O1 simulation scenarios executed cleanly (Section 4) |

*Note on excluded script:* `tests/database/driver-unified-local-test.mjs` intentionally halts unless given explicit owner manifest approval env vars (`STOP: separate owner approval of the exact LOCAL TEST manifest is required before connecting`) and was left unmodified/unbypassed.

---

## 6. Independent Review Summary

- **Cycle 1 (`c5c91334-e6e3-4e46-acd3-69e55c059e84`):** Audited initial integration; identified 6 P0 and 8 P1 findings across O4 SQL triggers, `o4_internal` scoping, workspace notifications, on-site buffer parity, Map grouping, and UI/action error handling. All fixed and verified.
- **Cycle 2 & Final Cycle 3 (`83000f25-06b0-4e36-8c0c-9fc018e9c312`):** Re-verified all Cycle 2 P1/P2 fixes (`optimizer-bridge.ts` `"driver"` target workspace notifications, active-leg SQL scoping & role exclusions in `driver-o4-journeys.sql`, buffer propagation in `unified_engine.py` and `fallback-evaluator.ts`, orphaned journey merging in `crm-live-map-model.ts`, `operational_commitment_allowed` UI gate in `dispatch-flow-tab.tsx`, `optimization-actions.ts` partial-failure recovery, `session-extension-actions.ts` swap rollback + `branch_id` filter, `trip-plans.ts` `auto_due` guard, and `driver-o4-integration-local-test.mjs` split-driver concurrency fixture). **Final Verdict: `APPROVED` — Zero P0, Zero P1.**

---

## 7. Open Production Cutover Gates & Safety Constraints

Merging `unified_optimization_engine` into **local `main`** for local integrated testing does **not** activate or deploy any of the following production gates, each of which requires separate explicit owner authorization:

1. **No Remote Push / Production Deploy:** Local `main` must not be pushed to `origin/main` without separate owner authorization.
2. **Production SQL Installation Order:** `supabase/operations/driver-o4-journeys.sql` depends on `supabase/operations/driver-unified-journeys.sql` and must not be applied via bulk historical migration replay (`supabase db push` remains blocked under `GOV-007`). Take pre-change backups (`pg_get_functiondef()`) before any sanctioned production SQL install.
3. **Production Runtime Feature Flags & Optimizer URL:** `CRADLEHUB_OPTIMIZER_URL` (pointing to deployed Python FastAPI service) and `CRADLEHUB_DRIVER_JOURNEYS_ENABLED=true` must be explicitly configured when cutting over.
4. **Live External Integrations:** End-to-end QA with live Google Maps/Routes billing keys, real Supabase Realtime events, and physical Android Driver devices remains a runtime cutover gate prior to production activation.
5. **Untouched Local Work in `E:\cradlehub`:** Existing uncommitted changes in `E:\cradlehub` (`login`, `attendance-ui.tsx`, `cash-flow`, `boutique`, `crm/today/`, `public/images/`) remain completely separate and unmodified.
