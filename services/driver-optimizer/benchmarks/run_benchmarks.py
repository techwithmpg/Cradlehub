"""Reproducible benchmark & before-vs-after simulation suite for CradleHub Unified Optimization Engine."""

from __future__ import annotations

import json
import statistics
import sys
import time
from pathlib import Path

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.main import app, load_fixture_request  # noqa: E402
from app.onsite_models import (  # noqa: E402
    OnsiteResourceInput,
    OnsiteServiceRequirement,
    OnsiteSolveRequest,
    OnsiteTherapistInput,
    ResourceBusyWindow,
    TherapistBusyWindow,
    TimeWindow,
)
from app.unified_models import (  # noqa: E402
    CrossBranchAssistanceInput,
    RoomTurnoverTaskInput,
    UnifiedBookingInput,
    UnifiedDriverInput,
    UnifiedEvaluateRequest,
    UnifiedRulesInput,
)

client = TestClient(app)


def _pct(samples_ms: list[float], pct: float) -> float:
    ordered = sorted(samples_ms)
    idx = min(len(ordered) - 1, max(0, round((pct / 100.0) * (len(ordered) - 1))))
    return round(ordered[idx], 2)


def _measure(fn, iterations: int = 20) -> dict[str, float]:
    times: list[float] = []
    # 1 warmup call
    fn()
    for _ in range(iterations):
        t0 = time.perf_counter()
        fn()
        times.append((time.perf_counter() - t0) * 1000.0)
    return {
        "runs": iterations,
        "p50_ms": _pct(times, 50),
        "p95_ms": _pct(times, 95),
        "mean_ms": round(statistics.mean(times), 2),
        "max_ms": round(max(times), 2),
    }


def build_main_spa_resources() -> list[OnsiteResourceInput]:
    # Mirrors live Main Spa reality: 8 rooms (4 cap=2 couples/suites, 4 cap=1 single beds)
    rooms = []
    for i in range(1, 5):
        rooms.append(
            OnsiteResourceInput(
                resource_id=f"suite-{i}",
                name=f"Couple Suite {i}",
                resource_type="couple_suite",
                capacity=2,
                sort_order=i,
            )
        )
    for i in range(5, 9):
        rooms.append(
            OnsiteResourceInput(
                resource_id=f"single-{i}",
                name=f"Treatment Room {i}",
                resource_type="single_room",
                capacity=1,
                sort_order=i,
            )
        )
    return rooms


def build_therapists(branch_id: str, count: int) -> list[OnsiteTherapistInput]:
    return [
        OnsiteTherapistInput(
            staff_id=f"{branch_id}-th-{i}",
            name=f"Therapist {i}",
            home_branch_id=branch_id,
            seniority_rank=i,
            completed_count_today=i % 3,
            checked_in=True,
            qualified_service_ids=["svc-swedish", "svc-stone", "svc-facial"],
            shift_windows=[TimeWindow(start_minute=600, end_minute=1320)],
        )
        for i in range(1, count + 1)
    ]


def simulate_onsite_capacity_packing() -> dict[str, object]:
    """Compare naive alphabetical room-picking (without right-sizing) vs CP-SAT room+therapist packing."""
    therapists_naive = build_therapists("main-spa", 10)
    rooms_naive = build_main_spa_resources()
    # Sort couples suites FIRST to mimic naive fixed-order allocation consuming cap=2 suites on solo guests
    rooms_naive_sorted = sorted(rooms_naive, key=lambda r: r.sort_order)

    # Workload stream at 13:00 (minute 780): 4 solo appointments, followed by 4 couples (2-guest each, total 12 guests)
    orders = [
        *[("solo", i, 1) for i in range(1, 5)],
        *[("couple", i, 2) for i in range(5, 9)],
    ]

    # 1. Naive greedy: picks first free room by sort_order regardless of solo fitting cap=1 room
    naive_served_orders = 0
    naive_served_guests = 0
    for kind, idx, guests in orders:
        picked_room = None
        if guests == 2:
            picked_room = next((r for r in rooms_naive_sorted if r.capacity >= 2 and not r.busy_windows), None)
        else:
            picked_room = next((r for r in rooms_naive_sorted if not r.busy_windows), None)
        free_th = [t for t in therapists_naive if not t.busy_windows]
        if picked_room and len(free_th) >= guests:
            picked_room.busy_windows.append(
                ResourceBusyWindow(booking_id=f"n-{idx}", start_minute=780, end_minute=840, reset_after_minutes=10)
            )
            for g in range(guests):
                free_th[g].busy_windows.append(
                    TherapistBusyWindow(
                        booking_id=f"n-{idx}-{g}",
                        start_minute=780,
                        end_minute=840,
                        effective_start_minute=770,
                        effective_end_minute=850,
                        delivery_type="in_spa",
                        resource_id=picked_room.resource_id,
                    )
                )
            naive_served_orders += 1
            naive_served_guests += guests

    # 2. Unified Engine On-Site CP-SAT Solver: solves solo + couples right-sizing preserving full buffers (10m pre + 10m post/reset)
    therapists_opt = build_therapists("main-spa", 10)
    rooms_opt = build_main_spa_resources()
    opt_served_orders = 0
    opt_served_guests = 0
    for kind, idx, guests in orders:
        reqs = [
            OnsiteServiceRequirement(
                line_id=f"opt-{idx}-{g}",
                attendee_id=f"guest-{idx}-{g}",
                service_id="svc-swedish",
                duration_minutes=60,
                buffer_before_minutes=10,
                buffer_after_minutes=10,
                requires_room=True,
            )
            for g in range(guests)
        ]
        req = OnsiteSolveRequest(
            branch_id="main-spa",
            date="2026-11-18",
            mode="assign_order",
            requested_start_minute=780,
            room_reset_buffer_minutes=10,
            allow_alternative_times=False,
            therapists=therapists_opt,
            resources=rooms_opt,
            requirements=reqs,
        )
        res = client.post("/v1/onsite/solve", json=req.model_dump()).json()
        if res["feasible"]:
            opt_served_orders += 1
            opt_served_guests += guests
            for a in res["assignments"]:
                th = next(t for t in therapists_opt if t.staff_id == a["staff_id"])
                th.busy_windows.append(
                    TherapistBusyWindow(
                        booking_id=a["line_id"],
                        start_minute=a["start_minute"],
                        end_minute=a["end_minute"],
                        effective_start_minute=a["start_minute"] - 10,
                        effective_end_minute=a["end_minute"] + 10,
                        delivery_type="in_spa",
                        resource_id=a["resource_id"],
                    )
                )
            # Mark used capacity on room
            for rid in {a["resource_id"] for a in res["assignments"] if a["resource_id"]}:
                used_guests = sum(1 for a in res["assignments"] if a["resource_id"] == rid)
                rm = next(r for r in rooms_opt if r.resource_id == rid)
                for u in range(used_guests):
                    rm.busy_windows.append(
                        ResourceBusyWindow(
                            booking_id=f"{idx}-{u}",
                            start_minute=780,
                            end_minute=840,
                            reset_after_minutes=10,
                        )
                    )

    return {
        "scenario": "Main Spa 8-room peak concurrent hour (4 solo + 4 couples, mandatory 10m buffers preserved)",
        "naive_served_orders": naive_served_orders,
        "naive_served_guests": naive_served_guests,
        "optimized_served_orders": opt_served_orders,
        "optimized_served_guests": opt_served_guests,
        "additional_orders_reliably_served": opt_served_orders - naive_served_orders,
        "additional_guests_reliably_served": opt_served_guests - naive_served_guests,
        "safety_buffers_compressed": False,
    }


def main() -> None:
    # 1. On-Site CP-SAT latency benchmarks
    req_assign = OnsiteSolveRequest(
        branch_id="main-spa",
        date="2026-11-18",
        mode="assign_order",
        requested_start_minute=780,
        room_reset_buffer_minutes=10,
        therapists=build_therapists("main-spa", 10),
        resources=build_main_spa_resources(),
        requirements=[
            OnsiteServiceRequirement(line_id="c1", attendee_id="g1", service_id="svc-swedish", duration_minutes=60, buffer_before_minutes=10, buffer_after_minutes=10),
            OnsiteServiceRequirement(line_id="c2", attendee_id="g2", service_id="svc-swedish", duration_minutes=60, buffer_before_minutes=10, buffer_after_minutes=10),
        ],
    ).model_dump()
    onsite_assign_lat = _measure(lambda: client.post("/v1/onsite/solve", json=req_assign))

    req_matrix = OnsiteSolveRequest(
        branch_id="main-spa",
        date="2026-11-18",
        mode="slot_matrix",
        candidate_start_minutes=list(range(600, 1200, 30)),  # 20 candidate time slots across the full day
        therapists=build_therapists("main-spa", 10),
        resources=build_main_spa_resources(),
        requirements=[
            OnsiteServiceRequirement(line_id="m1", attendee_id="g1", service_id="svc-swedish", duration_minutes=60, buffer_before_minutes=10, buffer_after_minutes=10),
        ],
    ).model_dump()
    onsite_matrix_lat = _measure(lambda: client.post("/v1/onsite/solve", json=req_matrix))

    req_sm = OnsiteSolveRequest(
        branch_id="sm-branch",
        date="2026-11-18",
        mode="assign_order",
        requested_start_minute=780,
        therapists=build_therapists("sm-branch", 6),
        resources=[],
        requirements=[
            OnsiteServiceRequirement(line_id="sm1", attendee_id="g1", service_id="svc-swedish", duration_minutes=60),
        ],
    ).model_dump()
    sm_lat = _measure(lambda: client.post("/v1/onsite/solve", json=req_sm))

    # 2. Unified Evaluator latency (10 therapists, 8 rooms, 4 drivers, 12 bookings, turnovers, lending)
    therapists_u = build_therapists("main-spa", 10)
    rooms_u = build_main_spa_resources()
    bookings_u = []
    for i in range(1, 13):
        is_hs = i % 3 == 0
        start = 600 + ((i - 1) // 2) * 90
        bookings_u.append(
            UnifiedBookingInput(
                booking_id=f"bk-{i}",
                customer_name=f"Guest {i}",
                service_id="svc-swedish",
                delivery_type="home_service" if is_hs else "in_spa",
                status="in_progress" if i <= 2 else "confirmed",
                therapist_id=therapists_u[(i - 1) % 10].staff_id,
                driver_id="drv-1" if (is_hs and i < 12) else None,
                resource_id=None if is_hs else rooms_u[(i - 1) % 8].resource_id,
                start_minute=start,
                end_minute=start + 60,
                live_eta_minutes=22.0 if is_hs else None,
                has_valid_customer_location=i != 9,
            )
        )
    req_eval = UnifiedEvaluateRequest(
        branch_id="main-spa",
        branch_name="Main Spa",
        date="2026-11-18",
        now_minute=700,
        source_snapshot_version="bench-v1",
        rules=UnifiedRulesInput(travel_buffer_minutes=30, scheduling_home_buffer_minutes=60, room_reset_buffer_minutes=10),
        therapists=therapists_u,
        drivers=[
            UnifiedDriverInput(driver_id=f"drv-{d}", name=f"Driver {d}", home_branch_id="main-spa", shift_windows=[TimeWindow(start_minute=540, end_minute=1320)], checked_in=True, gps_age_seconds=1200 if d == 1 else 15)
            for d in range(1, 5)
        ],
        resources=rooms_u,
        room_turnovers=[RoomTurnoverTaskInput(task_id="turn-1", resource_id="suite-1", resource_name="Couple Suite 1", status="open", started_minute=680, expected_ready_minute=735)],
        assistance_requests=[CrossBranchAssistanceInput(request_id="ast-1", requesting_branch_id="sm-branch", lending_branch_id="main-spa", status="approved_pending_arrival", visit_type="in_spa", start_minute=780, end_minute=960, selected_staff_ids=[therapists_u[2].staff_id])],
        bookings=bookings_u,
    ).model_dump()
    unified_eval_lat = _measure(lambda: client.post("/v1/unified/evaluate", json=req_eval))
    eval_sample = client.post("/v1/unified/evaluate", json=req_eval).json()

    # 3. Home-Service VRPPD before-vs-after & latencies across all 5 O1 fixtures
    fixtures_dir = ROOT / "fixtures"
    fleet_sims = []
    for p in sorted(fixtures_dir.glob("*.json")):
        name = p.stem
        fixture_req = load_fixture_request(name).model_dump(mode="json")
        lat = _measure(lambda q=fixture_req: client.post("/v1/optimize", json=q), iterations=10)
        sim = client.post("/v1/simulate", json={"scenario_name": name, "compare_fairness": True}).json()
        fleet_sims.append({
            "scenario": name,
            "latency": lat,
            "feasibility_status": sim["optimized_result"]["feasibility_status"],
            "baseline_served": sim["baseline_metrics"]["served_obligation_count"],
            "optimized_served": sim["optimized_metrics"]["served_obligation_count"],
            "served_delta": sim["delta_vs_baseline"]["served_obligation_delta"],
            "baseline_drive_min": sim["baseline_metrics"]["total_driving_minutes"],
            "optimized_drive_min": sim["optimized_metrics"]["total_driving_minutes"],
            "drive_min_saved": sim["delta_vs_baseline"]["driving_minutes_saved"],
            "distance_km_saved": sim["delta_vs_baseline"]["distance_km_saved"],
            "collection_coverage_delta": sim["delta_vs_baseline"]["collection_coverage_delta"],
            "workload_spread_reduction": sim["delta_vs_baseline"]["workload_spread_reduction"],
        })

    output = {
        "onsite_capacity_simulation": simulate_onsite_capacity_packing(),
        "latency_benchmarks": {
            "onsite_assign_couples_8rooms_10th": onsite_assign_lat,
            "onsite_slot_matrix_20slots_8rooms_10th": onsite_matrix_lat,
            "onsite_sm_branch_0rooms_6th": sm_lat,
            "unified_evaluate_12bk_10th_8rm_4drv": unified_eval_lat,
        },
        "unified_evaluate_sample_detected_types": sorted({c["issue_type"] for c in eval_sample["conflicts_and_opportunities"]}),
        "home_service_simulations": fleet_sims,
    }
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
