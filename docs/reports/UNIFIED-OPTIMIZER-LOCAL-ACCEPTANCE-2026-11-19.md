# CradleHub Unified Optimization Engine — Local Acceptance Verification & Remediation Report

- **Date:** 2026-11-19
- **Repository:** `techwithmpg/Cradlehub`
- **Active Verification Worktree:** `C:\Users\eleur\.gemini\antigravity\worktrees\cradlehub\unified_optimization_engine` (`unified_optimization_engine`)
- **Primary Workspace:** `E:\cradlehub` (`main` + `origin/main`)
- **Release Readiness Verdict:** **LOCAL ACCEPTANCE PASSED (0 P0 / 0 P1 REMAINING ON `unified_optimization_engine` REMEDIATION COMMIT; PRODUCTION CUTOVER GATES OPEN — DO NOT DEPLOY OR ACTIVATE PRODUCTION FLAGS YET)**

---

## 1. Verified Base/Head SHAs, Divergence Reconciliation & Changed Files

### Verified Git Topology
| Role / Ref | Verified SHA | Notes |
| --- | --- | --- |
| Original fork baseline (`main` pre-optimization) | `63bc45e309fc399f231c40dd3c18d345e6776c7f` | Prior local/remote main before optimization and PR #108 |
| Optimization implementation commit | `1e675fa97f530d90329ee7c2cd19f630c10f3330` | `feat(optimization): integrate unified on-site/home-service optimization engine and hardened O4 dispatch` |
| Reported local Web `main` merge | `fba665cb06b45a70bf251d10846ef427301dec16` | `merge: integrate unified optimization engine locally` |
| Remote `origin/main` PR #108 merge | `74669209f12a79ad1e5d62657fa8eb625c784da9` | Adds single file `src/app/(dashboard)/staff/enable-notifications/page.tsx` (+253 lines across `86fe91eb`, `24544905`, `b218718d`) |
| Reconciled base on `E:\cradlehub` | `d9c5a0229277dda7ef851799d71e252eb1e33ec0` | `merge: reconcile remote main PR #108 into local main` |
| Reconciled base on `unified_optimization_engine` | `e27fc67ebaeeb818f4b95f49a36d3cfab05b3912` | `chore: reconcile origin/main PR #108 for local acceptance` (`git diff d9c5a022 e27fc67e` empty) |
| External commit observed on `E:\cradlehub` (`main` & `origin/main`) | `55d08256f36efecd7ee91478381ba607966e9cd8` | `feat(crm): rebrand Cradle Intake, add dual-PC station bar, shift handover & day-close wizards, smart lock, and 2-tier booking cards/modal` (`139` files vs `d9c5a022`, `0` overlap with `74669209..e27fc67e`, `0` dirty working-tree files remaining in `E:\cradlehub`) |

### Changed Files Verified
- **Reconciliation (`fba665cb..e27fc67e`) & PR #108 (`63bc45e3..74669209`)**:
  - `src/app/(dashboard)/staff/enable-notifications/page.tsx` (`A`) — zero path overlap and zero auth/proxy/push conflict with optimization or O4 contracts.
- **Reconciled Optimization & O4 Baseline (`74669209..e27fc67e`, 50 files)**:
  - Docs/Governance (3): `AI_CONTEXT.md`, `docs/11-DECISION-LOG.md`, `docs/reports/UNIFIED-OPTIMIZATION-ENGINE-2026-11-18.md`
  - Android Driver (5): `DriverNavigationController.java`, `NativeDriverBackend.kt`, `NativeDriverModel.kt`, `NativeTripsPolicy.kt`, `O4TripPlansParserTest.kt`
  - Python OR-Tools Service (8): `services/driver-optimizer/app/{main.py,onsite_models.py,onsite_solver.py,unified_engine.py,unified_models.py}`, `benchmarks/run_benchmarks.py`, `tests/{test_onsite_solver.py,test_unified_engine.py}`
  - Web Application & Domain Logic (27): `src/app/api/optimization/evaluate/route.ts`, `src/app/api/booking/crm-availability/route.ts`, `src/app/api/staff/driver/journeys/route.ts`, `src/app/(dashboard)/crm/schedule/page.tsx`, `src/components/features/dispatch/{dispatch-flow-tab.tsx,dispatch-workspace.tsx}`, `src/components/features/optimization/crm-optimization-assistant-panel.tsx`, `src/lib/actions/{optimization-actions.ts,optimizer-dispatch-actions.ts}`, `src/lib/attendance/queries.ts`, `src/lib/bookings/session-extension-actions.ts`, `src/lib/dispatch/{crm-live-map-model.ts,optimizer-bridge.ts}`, `src/lib/driver/{collection-ready.ts,dispatch.ts,journey.ts,server.ts,trip-plans.ts}`, `src/lib/engine/{availability.ts,resource-availability.ts}`, `src/lib/optimization/{client.ts,crm-operations-assistant.ts,dynamic-buffer.ts,fallback-evaluator.ts,onsite-availability-adapter.ts,snapshot-loader.ts,types.ts}`
  - SQL Operations (1): `supabase/operations/driver-o4-journeys.sql`
  - Automated Tests (6): `tests/database/{driver-o4-integration-local-test.mjs,driver-o4-live-optimizer-e2e.mjs,unified-optimization-local-test.mjs}`, `tests/lib/dispatch/o4-optimizer-e2e-integration.test.ts`, `tests/lib/driver/o4-arrival-collection-flows.test.ts`, `tests/lib/optimization/unified-engine.test.ts`
- **Local Acceptance P1 Remediation Delta (7 files on top of `e27fc67e`)**:
  - `supabase/operations/driver-o4-journeys.sql`
  - `src/lib/optimization/snapshot-loader.ts`
  - `src/lib/actions/optimization-actions.ts`
  - `src/lib/bookings/session-extension-actions.ts`
  - `src/components/features/optimization/crm-optimization-assistant-panel.tsx`
  - `tests/database/driver-o4-integration-local-test.mjs`
  - `tests/lib/optimization/unified-engine.test.ts`

---

## 2. Exact Services and Databases Used (Zero Production Mutations)

All acceptance, synthetic, and browser runs targeted isolated ephemeral local infrastructure ONLY. Production Supabase (`lsrbwqhvzjfpiabeolkv`), remote GitHub `origin/main` push, and Vercel Production settings were never mutated.

- **Database Engine**: Ephemeral local **PostgreSQL 17.11** clusters (`@embedded-postgres/windows-x64` binary) on loopback ports (`127.0.0.1:49958` in the final full-stack acceptance run `task-1708`), initialized cleanly with repository schema migrations (`supabase/migrations/*` including `20261016001208_therapist_assignment_provenance.sql`, `20261015105000_crm_mb1_attendee_line_resources.sql`, `20261103015926_confirm_online_booking_capacity_atomic.sql`, `20261116094630_attendance_v2_automation.sql`, etc.), `supabase/operations/driver-unified-journeys.sql`, and `supabase/operations/driver-o4-journeys.sql`, plus `pg_notify('cradlehub_rt', ...)` triggers and complete teardown (`rmSync .tmp`) after execution.
- **Seeded Topologies**:
  - **Main Spa**: 8 active room resources (4 multi-guest suites capacity 2 + 4 solo rooms capacity 1), 6 therapists (including 1 overnight shift `18:00:00 -> 02:00:00 ends_next_day = true`), 3 drivers, open cash session.
  - **SM Branch**: 0 registered `branch_resources` (`allow_service_without_room`), 3 therapists, 1 driver, intentionally configured 30m vs 60m buffer drift to test conflict detection.
- **Local Supabase Gateway**: Ephemeral PG 17.11-backed HTTP + WebSocket gateway (`local_supabase_gateway.mjs` on `127.0.0.1:57793`) implementing GoTrue (`/auth/v1/*`), PostgREST (`/rest/v1/*` with FK embeds and `SET LOCAL ROLE` / JWT claim RLS enforcement), and Phoenix `vsn=2.0.0` `/realtime/v1/websocket`.
- **Python Optimizer Service**: `services/driver-optimizer/.venv/Scripts/python.exe -m uvicorn app.main:app` on `127.0.0.1:57794` (`ortools`, `fastapi`, `uvicorn`, `pydantic`).
- **Next.js Application Server**: Production-compiled Next.js `16.2.4` Turbopack (`next build` compiling `161/161` app routes + `next start` on `127.0.0.1:57795` with `CRADLEHUB_OPTIMIZER_URL` and `CRADLEHUB_DRIVER_JOURNEYS_ENABLED=true`; plus an isolated baseline `next build` + `next start` probe with `CRADLEHUB_OPTIMIZER_URL=""` and `CRADLEHUB_DRIVER_JOURNEYS_ENABLED="false"`).
- **Browser Automation**: Headless Chromium (`chrome-win64/chrome.exe` via CDP, `1440x900`) with two isolated `Target.createBrowserContext` sessions (`CRM Main A` and `CRM Main B`).

---

## 3. Real Browser Acceptance Evidence

Executed end-to-end post-P1 fixes in `task-1708` across dual isolated Chromium contexts (`0` uncaught JS exceptions on `Page A` and `Page B`):

1. **Login & PR #108 Push Activation Route**:
   - Browser A (`crm@cradlehub.local`) and Browser B (`crm2@cradlehub.local`) authenticated through `/login` form submission and redirected to `/select-workspace`.
   - Navigated Browser A to `/staff/enable-notifications`; page rendered cleanly (`"Enable CradleHub alerts..."`) with zero middleware/auth/proxy conflicts.
2. **CRM On-Site Walk-In Booking (`/crm/bookings/new`)**:
   - Filled customer `"Carlos BrowserWalkin"` (`+639179990001`), selected `"Cradle Swedish Massage"`, date `+1d`, time `11:00`, clicked `"Save Booking"` (`1433.02 ms` end-to-end).
   - PostgreSQL confirmed row persisted: `status = "confirmed"`, `start_time = "11:00:00"`, `end_time = "12:15:00"`, `staff_id = Ana`, `resource_id = Suite A`.
3. **CRM Home-Service Dispatch & Live Map (`/crm/dispatch`)**:
   - Triggered `"Optimize Routes"` (`482 ms`), UI displayed `"Route Plan Ready (feasible) · 2 driver(s), 2 pooled route(s), 35 driving min · Travel matrix: haversine-fallback-v1"`, clicked `"Apply Optimized Plan"` confirming `"Applied optimized route plan"`.
   - `driver_unified_private.journeys` persisted `3` committed journeys; `/api/staff/driver/journeys` returned `200` with `driverTripPlansCount = 1`.
   - Switched to `"Full Map"` tab rendering `"Therapist transport and collection"` (`Collect therapist at branch`) and `"Live Home-Service Map"`.
   - Guard checks: `/api/staff/driver/native-itinerary` missing `bookingId` returned `400`; legacy native itinerary call for enrolled home-service booking with `CRADLEHUB_DRIVER_JOURNEYS_ENABLED=true` returned `409`; `auto_due` service completion kept `autoDueServiceReadiness = "UNKNOWN"`; explicit `driver_o4_set_collection_decision('required', ...)` transitioned `stage = "pickup_pending"`, `revision = 2`, preserving `sessionCompletionSource = "auto_due"`.
4. **CRM Operations Assistant, Fix Execution & Reoptimization (`/crm/schedule`)**:
   - Clicked `"Run Check"` (`338.34 ms`), syncing `3` `workflow_tasks` in PG and surfacing `HIGH` driver ripple, `HIGH` home-service-to-in-spa 5m overlap, `HIGH` Room 6 overlapping allocations, `WARNING` past-due active session, and `Quiet opportunity` earlier slot.
   - Clicked `"Apply Verified Fix"` in Chromium UI for the Room 6 overlap (`roomChangedByUiFix = true`: `e1000000-...-06` -> `e1000000-...-01`).
   - Verified post-P1 protections under real PG `set_booking_therapist_provenance()` trigger (`customerRequestedSwapNeedsApproval = true`) and historical pre-O4 `completed` home-service isolation (`historicalCompletedLeaked = false`).
   - Verified authoritative DB rejection of overlapping booking extension (`extensionGuardErr = "BOOKING_RESOURCE_TIME_CONFLICT"`), valid extension ripple flagging (`driver_route_ripple`, `home_service_to_onsite_collision`, `room_capacity_bottleneck`, `earlier_slot_opportunity`), and clean cancellation conflict clearing (`reoptAfterCancelMs = 90.5 ms`, `conflictClearedOnCancel = true`).
5. **Group, Cross-Midnight, Branch Isolation & Concurrent Race Server Checks**:
   - **Group booking**: 2-guest `create_inhouse_order_with_payment_atomic` succeeded (`85.44 ms`, `payment_state = "paid"`, `total_payable = 1500`); online over-capacity confirmation failed atomically with `BOOKING_ROOM_CAPACITY_UNAVAILABLE` and left all lines `pending_crm_confirmation` with `resource_id = NULL`.
   - **Cross-midnight**: Night therapist (`18:00:00 -> 02:00:00`, `ends_next_day = true`) resolved exact-time availability at `21:30` (`overtimeMinutes = 0`, `operationalStartsBeforeShift = false`), `22:00` slot available, and `23:00` single-day 60-min slot blocked (`available = false`) by PG `BOOKING_END_TIME_MUST_BE_AFTER_START_TIME` constraint; `/api/optimization/evaluate` returned `200` (`engineSource = "python_ortools"`).
   - **Branch isolation**: Main Spa operator denied (`403`) on SM Branch `/api/booking/crm-availability` and `/api/optimization/evaluate`; SM Branch operator succeeded on 0-room availability (`available = true`, `roomSummary.enforced = false`) and detected `["rule_drift_or_cross_branch_gap"]` (`engineSource = "python_ortools"`).
   - **Concurrent booking race**: 4 parallel `create_inhouse_order_with_payment_atomic` calls targeting identical therapist/room/slot yielded `1` commit and `3` `BOOKING_STAFF_TIME_CONFLICT` rejections.
6. **Cross-Computer Realtime Sync (Isolated Browser A <-> Browser B)**:
   - Browser B sitting on `/crm/schedule` (`CRM-B`, `0` unread notifications) received 5 sequential PostgreSQL `INSERT` events in `public.workspace_notifications` over WebSocket in `p50 = 171.52 ms` / `p95 = 171.96 ms`, updating bell badge `0 -> 5` and rendering live toast alert with `0` console/page exceptions.

*(Screenshots visually inspected on `2026-11-19`: `01-crm-bookings-new.png`, `02-crm-dispatch-optimized.png`, `02b-crm-dispatch-map.png`, `03-crm-schedule-assistant.png`, `04-crm-browser-b-realtime-notif.png` in conversation scratch artifacts.)*

---

## 4. Synthetic Test and Performance Results

### Regression & Build Suites Executed
| Suite / Check | Result | Timing / Currency | Notes |
| --- | --- | --- | --- |
| `services/driver-optimizer` `pytest` | **58 passed, 0 failed** (`3.26s`) | Post-final-edit (`task-1689`) | Covers solver, capacity, collections, fairness, time windows, onsite CP-SAT, unified evaluator, API |
| Python `benchmarks/run_benchmarks.py` | **Passed** | `e27fc67e` (`task-1441`; Python code unchanged since) | Main Spa 8-room peak simulation: naive `4 orders / 4 guests` -> optimized `7 orders / 10 guests` (**+3 orders / +6 guests**, `safety_buffers_compressed: false`) |
| `pnpm exec tsc --noEmit` | **0 errors** | Post-final-edit (`task-1689`) | Full TypeScript check on `unified_optimization_engine` worktree |
| Scoped ESLint (changed `.ts`/`.tsx`/`.mjs`) | **0 errors** (1 warning) | Post-final-edit (`task-1689`) | Preexisting unused `TIER_ORDER` at `src/lib/engine/availability.ts:1187` |
| Targeted Optimization/Dispatch/Driver/Engine Vitest | **8/8 files, 36/36 passed** (`1.96s`) | Post-final-edit (`task-1689`) | Includes new `loadUnifiedOperationalSnapshot` stripped-provenance regression test |
| Broad 6-directory Vitest sweep (`task-1550`) | **70/82 files, 470/513 passed** | Pre-P1 edit (`e27fc67e`) | 12 failed legacy `bookings`/`notifications` files verified untouched by `74669209..e27fc67e` (only `session-extension-actions.ts` changed in `src/lib/bookings/`, outside those 12 tests) |
| Local PG `17.11` E2E (`driver-o4-integration-local-test.mjs`) | **PASSED** (`ALL_O4_SQL_TESTS_PASSED`) | Post-final-edit (`task-1689`) | Includes 3 new SQL P1 regression assertions (`histUnenrolledId`, `todayUnenrolledDoneId`, `reviewProtectedId`) |
| Local PG `17.11` + Live Python E2E (`driver-o4-live-optimizer-e2e.mjs`) | **PASSED** (`LIVE_PYTHON_O1_POSTGRES_O4_E2E_PASSED`) | Post-final-edit (`task-1689`) | Full PG -> Python VRPPD -> SQL commit cycle |
| Local PG `17.11` + Python Unified E2E (`unified-optimization-local-test.mjs`) | **PASSED** (`UNIFIED_LOCAL_POSTGRES_AND_SOLVER_PASSED`) | Post-final-edit (`task-1689`) | On-site + Home-Service unified evaluation & snapshot pipeline |
| Next.js `next build` + live full-stack acceptance (`task-1708`) | **161/161 routes built; exit 0** | Post-final-edit (`task-1708`) | All 9 live browser/PG/optimizer scenarios passed |
| Android Gradle `:app:testDebugUnitTest --rerun-tasks` | **73 tests, 0 failures, 0 skipped** (`1m 26s`) | `e27fc67e` (`task-1589`; 0 Android files modified in P1 fixes) | Ran with Android SDK & JBR |

### Performance Measurements — Baseline vs Optimized (`p50` / `p95`)
| Dimension | Baseline / Pre-Optimizer (`task-1590` & `run_benchmarks.py`) | Optimized (`task-1708` & `run_benchmarks.py`) | Samples / Context |
| --- | --- | --- | --- |
| 1. Booking availability (`/api/booking/crm-availability`) | `p50 = 60.74 ms`, `p95 = 285.75 ms` (`CRADLEHUB_OPTIMIZER_URL=""` fallback) | `p50 = 60.59 ms`, `p95 = 177.39 ms` (`python_ortools`) | `n = 12` authenticated HTTP POSTs against live PG `17.11` |
| 2. CRM booking submission | Sequential UI/RPC baseline n/a (UI first-save `1433.02 ms` on `/crm/bookings/new`) | Atomic PG RPC `p50 = 8.81 ms`, `p95 = 38.16 ms`; Real browser save `1433.02 ms` | `n = 6` `create_inhouse_order_with_payment_atomic` + 1 Chromium UI flow |
| 3. Group booking feasibility | `p50 = 40.91 ms`, `p95 = 54.01 ms` (`CRADLEHUB_OPTIMIZER_URL=""`); Greedy 8-room peak = `4 orders / 4 guests` | `p50 = 59.29 ms`, `p95 = 89.96 ms` (`python_ortools`); CP-SAT 8-room peak = `7 orders / 10 guests` (**+3 orders / +6 guests**, `85.44 ms` 2-guest RPC) | `n = 8` multi-line group HTTP calls + peak simulation |
| 4. Therapist & room allocation (`/v1/onsite/solve`) | Greedy sequential matching (failed couples packing at peak) | Direct HTTP `p50 = 34.34 ms`, `p95 = 52.79 ms` (`n = 10`); 8-rm/10-th couples `p50 = 57.43 ms`, `p95 = 81.69 ms` (`n = 20`); SM 0-rm `p50 = 13.76 ms` (`n = 20`) | Direct Python CP-SAT solver benchmarks |
| 5. Driver routing & pooling (`/v1/optimize` & `/v1/simulate`) | `mixed`: `82.0 min` drive; `pooled`: `2` served / `38.0 min`; `split`: `109.0 min` | `mixed`: `62.0 min` (`-20m`), `p50 = 40.5 ms`, `p95 = 67.1 ms` (`n = 8` HTTP); `pooled`: `3` served (`+1`) / `18.0 min` (`-20m`); `split`: `51.0 min` (`-58m`); CRM Dispatch UI `482 ms` | Canonical O1 fixtures + CRM `/crm/dispatch` flow |
| 6. Optimization evaluation (`/api/optimization/evaluate`) | `p50 = 22.62 ms`, `p95 = 34.76 ms` (`ts_deterministic_fallback`, `n = 10`) | `p50 = 23.05 ms`, `p95 = 40.39 ms` (`python_ortools`, `n = 10`); Python `/v1/unified/evaluate` `p50 = 19.81 ms`, `p95 = 23.02 ms` (`n = 20`) | Full snapshot load + conflict/action generation |
| 7. Reoptimization after operational changes | Manual rescan | `p50 = 52.81 ms`, `p95 = 90.5 ms` (`n = 6` post-extension/cancel `syncAlerts = true` cache bypass) | `conflictClearedOnCancel = true` |
| 8. Notifications & cross-computer sync | Polling/refresh | `p50 = 171.52 ms`, `p95 = 171.96 ms` (`n = 5`, PG `INSERT` -> `LISTEN/NOTIFY` -> WS -> Browser B bell) | Dual isolated Chromium contexts on `/crm/schedule` |

---

## 5. Confirmed Defects and Corrections

1. **[P1 — FIXED & VERIFIED] Un-enrolled Completed Historical Booking Leakage & Dropped `review` Guard (`supabase/operations/driver-o4-journeys.sql`)**
   - **Root Cause**: `driver_unified_private.snapshot()` omitted the `j.booking_id is null` eligibility guard (`b.status in ('confirmed','in_progress') and b.booking_progress_status = 'not_started' and b.booking_date between today and today + 7`) present in `driver-unified-journeys.sql:103-105`, causing historical/pre-O4 `completed` home-service bookings without `journeys` rows to surface as active `collection_pending` trips. Additionally, `event()` lacked `legacy_trip_requires_review` for un-enrolled completed/in-progress rows, `project()` mapped un-enrolled `auto_due`/`not_required` completed rows to `collection_pending`, and `collection_ready()` omitted the `j.stage = 'review'` guard.
   - **Correction**: Restored the un-enrolled `snapshot()` window/status predicate (`lines 278-294`), added `auto_due`/`not_required` branching in `project()` (`lines 118-139`), restored `legacy_trip_requires_review` in `event()` (`lines 350-355`), and restored `j.stage = 'review' or (j.therapist_id is not null and j.therapist_id is distinct from b.staff_id)` guard raising `journey_assignment_changed` in `collection_ready()` (`lines 818-820`). Verified via SQL E2E (`ALL_O4_SQL_TESTS_PASSED`) and full-stack HTTP (`historicalCompletedLeaked = false`).

2. **[P1 — FIXED & VERIFIED] Customer-Selected Therapist Provenance Ignored on Real PostgreSQL Rows (`snapshot-loader.ts`, `optimization-actions.ts`, `session-extension-actions.ts`, `crm-optimization-assistant-panel.tsx`)**
   - **Root Cause**: Trigger `set_booking_therapist_provenance()` (`20261016001208_therapist_assignment_provenance.sql:28-33`) strips `_therapist_provenance` from `bookings.metadata` into top-level `therapist_selection_source` and `requested_staff_id` columns on `INSERT`. Reader paths inspected only `metadata._therapist_provenance`, causing `customer_selected` guards to fail silently on real PostgreSQL rows.
   - **Correction**: Updated `snapshot-loader.ts` to select and prioritize top-level `therapist_selection_source` / `requested_staff_id`; updated `applyRecommendedFixAction` in `optimization-actions.ts` to select and enforce `therapist_selection_source === "customer_selected"`; updated `session-extension-actions.ts` (`previewSessionExtensionAction`, `domino_auto_swap`, and `rollbackSwap`) to read and restore `therapist_selection_source`; updated `crm-optimization-assistant-panel.tsx` to display a `"Guest approval required"` badge alongside withholding one-click apply. Verified via Vitest (`unified-engine.test.ts`), real PG trigger acceptance (`customerRequestedSwapNeedsApproval = true`), and TS/ESLint checks.

3. **[Environmental/Test Harness Bugs Fixed During Acceptance Verification]**
   - `local_supabase_gateway.mjs`: Added Phoenix `vsn=2.0.0` JSON array WebSocket framing, `realtime.broadcast_changes` payload compatibility, `event: "*"` filter support, PG client error handlers, and async Next build spawning.
   - `cdp_helper.mjs` & `run_local_acceptance.mjs`: Added bounded CDP command/navigation timeouts, matching `OnsiteSolveRequest` strict fields (`extra="forbid"`), and corrected `tripPlan.passengers[].service` readiness field lookup.

4. **[Non-Blocking Observations — Left Deliberately Outside P0/P1 Patch Scope]**
   - Cross-midnight boundary: PG constraint `BOOKING_END_TIME_MUST_BE_AFTER_START_TIME` intentionally rejects single-day bookings wrapping past `24:00` (e.g., `23:00` 60-min slot) even for `18:00 -> 02:00` closing staff.
   - `src/lib/dispatch/optimizer-bridge.ts:23` (`OPTIMIZER_DEFAULT_URL = "http://127.0.0.1:8100"`) falls back safely when unreachable (`fallbackAllowed: true`), whereas `client.ts` skips HTTP entirely when `CRADLEHUB_OPTIMIZER_URL` is unset.
   - `src/lib/engine/resource-availability.ts:30,35` and `src/lib/optimization/onsite-availability-adapter.ts:254-256` fail open on `scheduling_rules` read errors while DB overlap triggers remain authoritative; preexisting unused `TIER_ORDER` ESLint warning remains at `src/lib/engine/availability.ts:1187`.

---

## 6. Unresolved Dependencies & Open Cutover Blockers

1. **Git Publication & `main` Reconciliation**: Commit the 7 verified P1 remediation files from `unified_optimization_engine` (`e27fc67e`) and reconcile cleanly onto `main` (`55d08256` currently ahead on `E:\cradlehub` + `origin/main` with unrelated CRM intake/boutique changes) before any deployment. Do not push remote `origin/main` without separate owner authorization.
2. **Production Database Functions & Feature Controls**: `supabase/operations/driver-unified-journeys.sql` and `supabase/operations/driver-o4-journeys.sql` remain **unapplied** on Production (`lsrbwqhvzjfpiabeolkv`). Production remains fail-closed (`driver_unified_private.control.enabled = false`, `CRADLEHUB_OPTIMIZER_URL` unset, `CRADLEHUB_DRIVER_JOURNEYS_ENABLED` unset/false).
3. **Hosted Python Optimizer Deployment**: `services/driver-optimizer/` FastAPI/OR-Tools worker needs a hosted runtime endpoint + authentication/network policy wired to `CRADLEHUB_OPTIMIZER_URL`.
4. **Live Google Routes / Maps APIs**: Live matrix billing/quota calls with production `GOOGLE_MAPS_SERVER_API_KEY` and browser tile inspection with real `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` remain unexecuted externally (local tests ran with deterministic Haversine fallback).
5. **Physical Android Device & FCM Push QA**: Android emulator/physical-device end-to-end GPS geofence accuracy, voice guidance, background camera/QR, and live FCM `google-services.json` (`CRADLEHUB_DRIVER_NATIVE_PUSH_ENABLED`) acceptance remain open (`73` JVM unit tests verified locally; `.localtest` fixture APKs remain prohibited from distribution).
6. **Clean Build Check on `55d08256`**: `E:\cradlehub` `tsc --noEmit` reported stale `.next/dev/types/validator.ts` parse errors from prior dev cache and requires a clean `.next` build check when integrating the P1 fix onto `main`.

---

## 7. Independent Review Verdict

- **Reviewer**: Independent read-only `research` subagent (`d9e39354-b473-4cdf-90a2-6c5932f7e1bc`, Pro model)
- **Initial Review**: Returned `CORRECTION REQUIRED` after discovering the 2 P1 defects above (`driver-o4-journeys.sql` historical/review guards and stripped `_therapist_provenance` reads).
- **Re-Review Verdict (Post-P1 Fixes)**: **`APPROVED FOR LOCAL ACCEPTANCE / NO P0-P1 DEFECTS IN RECONCILED OPTIMIZATION SCOPE`**, conditioned on committing the 7 verified remediation files cleanly and keeping all production SQL/flag/device cutover gates closed until authorized.

---

## 8. Rollback & Production Integration Considerations

### Rollback Plan
- **Application / Feature Flags (Instant, Zero Downtime)**: Unset or set `CRADLEHUB_OPTIMIZER_URL=""` to revert `/api/booking/crm-availability`, `/api/optimization/evaluate`, and assistant checks cleanly to `ts_deterministic_fallback`. Set `CRADLEHUB_DRIVER_JOURNEYS_ENABLED=false` (and `update driver_unified_private.control set enabled = false`) to immediately revert driver endpoints to legacy paths without dropping tables or history.
- **Git**: Because `55d08256` already sits on top of `d9c5a022` (`fba665cb` + `74669209`) in `origin/main`, keep runtime feature flags **disabled** in Vercel Production until the 7-file P1 remediation commit from `unified_optimization_engine` is cleanly merged and verified via `next build` on `main`. Any source revert uses non-destructive `git revert -m 1` (never `git push --force`).
- **Database**: Snapshot existing function definitions via `pg_get_functiondef()` before applying SQL; restore prior function definitions or execute `driver_unified_private.control` disablement without running `supabase db push` or replaying historical migrations (`GOV-007`).

### Sanctioned Production Cutover Sequence (Future Owner-Authorized Gate Only)
1. Merge the P1 remediation commit from `unified_optimization_engine` into `main` alongside `55d08256`, verify clean `tsc --noEmit`, `vitest`, `eslint`, and `next build`, and deploy with optimization/journey feature flags **disabled**.
2. Deploy `services/driver-optimizer/` privately and verify `/health` latency & auth boundary.
3. Capture PostgreSQL `pg_get_functiondef()` backups, then apply **only** `supabase/operations/driver-unified-journeys.sql` followed by `supabase/operations/driver-o4-journeys.sql` (containing the P1 fixes) via the sanctioned SQL path with `driver_unified_private.control.enabled = false` initially.
4. Configure `CRADLEHUB_OPTIMIZER_URL` in Staging/Production and run read-only `/api/optimization/evaluate` smoke verification before enabling `CRADLEHUB_DRIVER_JOURNEYS_ENABLED=true` + `driver_unified_private.control.enabled = true`, live Google Routes API check, and pilot Android APK device acceptance.
