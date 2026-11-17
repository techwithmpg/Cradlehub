# CradleHub Driver Fleet Optimizer (`O1` Local Foundation)

Isolated Python + Google OR-Tools Vehicle Routing Problem with Pickups and Deliveries (VRPPD) service for CradleHub Home Service fleet dispatch optimization.

> **O1 Scope Boundary:** Local synthetic foundation only. No production database connection, no live Supabase reads/writes, no Google Maps API calls, and no modifications to existing CradleHub Web CRM, Staff PWA, or Android Driver runtime code.

---

## 1. System Requirements

- **OS:** Windows 10/11 (64-bit / x64) or Linux/macOS x86_64/arm64
- **Python:** 64-bit Python `>= 3.11, < 3.14` (verified on Python `3.13.15` AMD64; Python 3.11 is also supported by OR-Tools `>= 9.12`)
- **Runtime Prerequisites (Windows):** Microsoft Visual C++ Redistributable for Visual Studio 2022 (x64)
- **Independent Execution:** Runs standalone without starting Next.js, Supabase, Android Studio, or Docker.

---

## 2. Python Installation & Environment Setup (Windows PowerShell)

### Check installed Python and architecture

```powershell
python --version
python -c "import platform, struct; print(platform.machine(), struct.calcsize('P') * 8)"
```

Confirm 64-bit output (`AMD64 64`).

### Create and activate the isolated `.venv`

```powershell
cd services/driver-optimizer
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### Install pinned dependencies

```powershell
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.lock
```

### Verify OR-Tools and FastAPI imports

```powershell
.\.venv\Scripts\python.exe -c "import ortools, fastapi, uvicorn, pydantic; from ortools.constraint_solver import pywrapcp; print('ortools:', ortools.__version__, 'fastapi:', fastapi.__version__)"
```

---

## 3. Starting the Local FastAPI Server

The service binds strictly to localhost (`127.0.0.1:8100`) to prevent unintended network exposure:

```powershell
cd services/driver-optimizer
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8100
```

Health check:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8100/health" -Method Get
```

Available endpoints:

- `GET /health` — Service status, runtime versions, `live_database_connected: false`.
- `GET /v1/scenarios` — Lists bundled synthetic fixture scenario names.
- `POST /v1/optimize` — Validates a synthetic dispatch snapshot and computes an OR-Tools fleet plan.
- `POST /v1/simulate` — Compares an unpooled greedy nearest-driver baseline against the OR-Tools plan (and optionally fairness-off vs fairness-on).

---

## 4. Running Tests & Scenarios

### Run the full pytest test suite

```powershell
cd services/driver-optimizer
.\.venv\Scripts\python.exe -m pytest -v
```

### Execute built-in synthetic scenarios against the live local API

```powershell
# Simulate pooled 3-therapist dispatch vs unpooled baseline
Invoke-RestMethod -Uri "http://127.0.0.1:8100/v1/simulate" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"scenario_name":"pooled_delivery","compare_fairness":true}'

# Optimize a split delivery & collection fixture directly
$payload = Get-Content -Raw .\fixtures\split_collection.json
Invoke-RestMethod -Uri "http://127.0.0.1:8100/v1/optimize" `
  -Method Post `
  -ContentType "application/json" `
  -Body $payload
```

Bundled fixtures in `fixtures/`:

- `simple_delivery.json` — Single driver, single therapist delivery (final shift appointment with approved independent departure).
- `pooled_delivery.json` — Three therapists pooled into one vehicle without unnecessary branch returns.
- `split_collection.json` — Morning driver delivers two therapists; afternoon driver collects both in a pooled trip.
- `shift_conflict.json` — Shift-end cutoff detects unserviceable obligation cleanly without invalid scheduling.
- `mixed_conditional_collection.json` — Three therapists pooled outbound with mixed return needs: onward booking transfer (`required`), approved independent departure (`not_required`), and mandatory branch return (`required`).

---

## 5. Solver Mathematical Model (`constraints.py` & `solver.py`)

The optimizer uses Google OR-Tools `RoutingIndexManager` + `RoutingModel`:

- **Nodes:** Each active driver gets distinct `driver_start` and `driver_end` nodes; each transport obligation creates distinct `pickup` (`+passenger_count`) and `dropoff` (`-passenger_count`) nodes (or `dropoff`-only for `onboard` passengers).
- **Open-ended vs return-to-branch:** When `driver.return_to_location_id` is `null`, arcs to `driver_end` have zero driving time/cost so drivers do not artificially return to the branch after their final drop-off. When `return_to_location_id` is set, return travel is enforced inside the driver's shift window.
- **Hard constraints:**
  - Vehicle passenger capacity (`Capacity` dimension, initialized with existing `onboard` load).
  - Driver availability and shift boundaries (`Time` dimension, in integer seconds).
  - Pickup and drop-off time windows (`effective_pickup_window` incorporates `max_therapist_wait_minutes`).
  - Pickup-before-dropoff and same-vehicle continuity (`AddPickupAndDelivery` + `VehicleVar` equality).
  - Vehicle branch, type, and equipment/tag eligibility.
  - Locked active assignments (`is_locked`, `en_route_pickup`, `onboard`, `locked_stop_sequence`).
  - Causal delivery-to-collection ordering (`collection_pickup >= delivery_dropoff + estimated_service_duration_minutes`).
- **Post-solve independent verification:** `verify_solution_hard_constraints` independently checks every output route before returning `feasibility_status`. No invalid route is ever returned as feasible.

---

## 6. Objective Hierarchy & Driver Fairness (`fairness.py`)

Optimization prioritizes objectives in strict operational order:

1. **Avoid unserviceable obligations** (`unserved_penalty = 10,000,000` * `priority` per dropped obligation).
2. **Avoid late arrivals & excessive therapist collection waiting** (`lateness_soft_weight`, `therapist_wait_weight` soft upper bounds).
3. **Minimize driving time, distance, and empty deadhead movement** (`travel_time_weight = 1.0`, `travel_distance_weight = 0.5`, scaled at `600` cost units per minute).
4. **Balance shift-normalized workload across eligible drivers** (`fairness_weight`).
5. **Minimize unnecessary reassignment disruption** (`reassignment_penalty = 15.0` min equivalent when changing away from `previous_driver_id`).

### Shift-Normalized Workload Calculation

Raw trip counts are never used alone for fairness. For each driver `v`:

$$\text{utilization}_v = \frac{\text{existing\_committed\_minutes}_v + \sum (\text{driving} + \text{handling} + \text{stop\_complexity})}{\text{available\_shift\_minutes}_v}$$

- Scaled into `0..10,000` basis points (`10,000 = 100%` of authorized shift duration) inside OR-Tools' `Workload` dimension.
- A 4-hour driver (`240 min`) and an 8-hour driver (`480 min`) reach parity when proportional utilization matches, not equal raw trip minutes.
- Uses `SetGlobalSpanCostCoefficient` (min-max peak utilization penalty) plus convex utilization tier soft upper bounds (`15%`, `30%`, `45%`, `60%`, `75%`, `90%`).
- Setting `config.fairness_weight = 0.0` switches to pure efficiency mode for `/v1/simulate` trade-off analysis.

---

## 7. Scheduling-Aware Conditional Therapist Collection (`scheduling.py`)

CradleHub transports therapists when onward transportation is operationally required — **not automatically after every home-service booking**.

Before generating or preserving collection obligations, `app/scheduling.py` classifies each therapist's return requirement into one of three dispositions (`return_decisions`):

- **`required`** — Onward company transportation is needed (next scheduled booking requiring transport, authorized return to branch even after shift end, or confirmed/active collection commitment). Generates/reserves a collection leg directly to the actual next destination (another customer or branch) and allows a different eligible driver to collect.
- **`not_required`** — Authorized independent departure or same-location consecutive service. Generates no collection leg, reserves no driver capacity, and contributes zero fictitious driving minutes or stop counts to fairness/workload metrics. Only unstarted/unlocked/unconfirmed obligations are reconsidered when arrangements change.
- **`undecided`** — Missing, unconfirmed, or conflicting scheduling/approval data (never inferred `not_required` from shift-end time alone). Sets `collection_plan_safe = false` and `operational_commitment_allowed = false`, populates `unresolved_collection_requirements`, and prevents false complete-coverage reporting.

### Collection Timing & Reservation

- Every home-service booking can pair **Leg A (`delivery`)** and **Leg B (`collection`)** as independent `TransportObligationInput` pairs, allowing **Driver A to deliver** and **Driver B to collect** later.
- Service completion is modeled as an anticipated readiness window (`expected_ready_minute` + `pickup_window`), not a completed event.
- When an unstarted delivery has `require_collection_coverage=True` on its linked collection, an iterative collection-coverage cut guarantees an unstarted delivery is **not dispatched without plausible collection coverage**. Unretrievable deliveries are withheld and reported as `collection_coverage_conflict`.

---

## 8. Interpreting Infeasible / Partial Results

- `feasibility_status = "feasible"` — All pending obligations served with `0` constraint violations.
- `feasibility_status = "partial"` — When `allow_partial_service = true`, feasible obligations are scheduled and unserviceable obligations appear in `unassigned_obligations` with structured `reasons` (`no_available_drivers`, `vehicle_overcapacity`, `vehicle_type_restricted`, `vehicle_tag_restricted`, `branch_mismatch`, `pickup_window_unreachable`, `appointment_unreachable`, `shift_window_conflict`, `collection_coverage_conflict`, `fleet_schedule_or_capacity_saturation`).
- `feasibility_status = "infeasible"` — No valid assignment exists (or `allow_partial_service = false` with any dropped obligation, or a locked commitment is infeasible).
- `feasibility_status = "timeout"` — Search exceeded `solver_time_limit_seconds` without finding a solution.
- `diagnostics.solution_guarantee = "heuristic_time_bounded"` — Time-bounded local search metaheuristic; global optimality is never claimed unless proven within solver bounds.

---

## 9. Known Limitations (O1)

- Uses caller-supplied synthetic travel-time and distance matrices (no live Google Routes API calls).
- Does not model mid-shift break windows, refueling, or dynamic traffic speed profiles by time of day.
- Time precision rounds input minutes to integer seconds internally.
- Designed for CradleHub's small home-service fleet (`2–10` drivers, `< 100` daily obligations per branch).

---

## 10. Future Integration Boundaries (Post-O1, Not Authorized in O1)

Inspection of the existing CradleHub codebase identified the exact integration seams for future authorized stages:

- **Travel Matrix Adapter (`src/lib/maps/google-maps.ts`):** Existing `estimateTravelTime` and `calculateDrivingDistanceKm` call Google Routes API (`computeRoutes`) server-side. Future stages should add cached matrix generation (or Routes Matrix API) inside Next.js server boundaries before invoking the optimizer.
- **Booking vs Transport-Leg Gap (`src/lib/home-service/dispatch-operations.ts`, `src/lib/driver/journey.ts`, `src/lib/driver/collection-ready.ts`):** `assignHomeServiceDriver` currently writes a single booking-level `bookings.driver_id`, while the newly merged `DriverJourney` contract (`src/lib/driver/journey.ts`, gated behind `CRADLEHUB_DRIVER_JOURNEYS_ENABLED`) introduces explicit `pickup`, `delivery`, `collection`, and `return` stages and `confirmDriverCollectionReady` readiness confirmation. Supporting split delivery/collection drivers and multi-therapist pooling in production will integrate the optimizer's per-leg proposals with that server-authorized journey/leg model rather than overwriting `bookings.driver_id`.
- **Greedy Policy Coexistence (`src/lib/staff-pwa/driver-dispatch-policy.ts`):** Existing `orderDriverStops` (max 8 stops, `travel_started`-first greedy ordering) remains intact as deterministic fallback.
- **CRM & Native Driver Reads (`src/lib/queries/dispatch-queries.ts`, `src/app/api/staff/driver/native-itinerary/route.ts`):** Existing server queries (`staff_location_snapshots`) and Android companion itinerary endpoints remain authoritative; the Python service acts strictly as a proposal engine whose plans must be validated and committed by CradleHub's Next.js server.
