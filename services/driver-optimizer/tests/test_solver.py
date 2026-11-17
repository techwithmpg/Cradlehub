"""Core solver tests: single therapist (Test A), pooling (Test B), locked active routes (Test I), and multi-driver fleet benchmarks."""

from __future__ import annotations

import json
from pathlib import Path

from app.models import (
    DriverInput,
    LocationNode,
    LockedStopRef,
    OptimizationConfig,
    OptimizeRequest,
    TimeWindow,
    TransportObligationInput,
    TravelInfo,
)
from app.solver import optimize_dispatch, run_simulation_comparison

FIXTURES_DIR = Path(__file__).resolve().parent.parent / "fixtures"


def _load_fixture(name: str) -> OptimizeRequest:
    data = json.loads((FIXTURES_DIR / f"{name}.json").read_text(encoding="utf-8"))
    return OptimizeRequest.model_validate(data)


def test_a_single_therapist_delivery() -> None:
    """Test A: One driver, one therapist, one customer — verify precedence, capacity, and on-time arrival."""
    req = _load_fixture("simple_delivery")
    res = optimize_dispatch(req)

    assert res.feasibility_status == "feasible"
    assert res.all_obligations_served is True
    assert res.constraint_violations == []
    assert res.diagnostics.verified_hard_constraints is True
    assert res.metrics.served_obligation_count == 1
    assert res.metrics.on_time_arrival_rate == 1.0

    route = res.routes[0]
    assert route.driver_id == "drv-1"
    assert route.peak_occupancy == 1
    assert route.returns_to_branch is False
    assert [s.stop_type for s in route.stops] == ["driver_start", "pickup", "dropoff"]
    pickup_stop, dropoff_stop = route.stops[1], route.stops[2]
    assert pickup_stop.service_start_minute < dropoff_stop.service_start_minute
    assert dropoff_stop.service_start_minute <= 540.0
    assert pickup_stop.occupancy_after == 1
    assert dropoff_stop.occupancy_after == 0


def test_b_three_therapists_pooled_beats_unpooled_baseline() -> None:
    """Test B: Pool 3 therapists in one van without unnecessary branch returns."""
    req = _load_fixture("pooled_delivery")
    sim = run_simulation_comparison(req, "pooled_delivery", compare_fairness=False)
    opt = sim.optimized_result

    assert opt.feasibility_status == "feasible"
    assert opt.all_obligations_served is True
    assert opt.constraint_violations == []
    assert opt.metrics.served_obligation_count == 3
    assert opt.metrics.pooled_route_count == 1
    assert opt.metrics.pooled_leg_count == 3
    assert opt.metrics.total_empty_driving_minutes == 0.0
    assert opt.metrics.total_driving_minutes == 18.0

    route = opt.routes[0]
    assert route.peak_occupancy == 3
    assert route.returns_to_branch is False
    # All 3 pickups occur before dropoffs, zero intermediate branch returns
    stop_types = [s.stop_type for s in route.stops]
    assert stop_types == [
        "driver_start",
        "pickup",
        "pickup",
        "pickup",
        "dropoff",
        "dropoff",
        "dropoff",
    ]
    assert sim.delta_vs_baseline.driving_minutes_saved > 0
    assert sim.delta_vs_baseline.empty_driving_minutes_saved > 0


def test_b_option_c_splits_across_two_drivers_when_tight_windows() -> None:
    """Option C: Two drivers divide transport obligations when one vehicle cannot make tight parallel arrivals."""
    locations = [
        LocationNode(location_id="branch", label="Branch", lat=10.6765, lng=122.9509, location_type="branch"),
        LocationNode(location_id="north", label="North", lat=10.7200, lng=122.9600),
        LocationNode(location_id="south", label="South", lat=10.6200, lng=122.9400),
    ]
    travel = TravelInfo(
        locations=locations,
        travel_time_minutes=[
            [0, 20, 20],
            [20, 0, 40],
            [20, 40, 0],
        ],
        travel_distance_km=[
            [0.0, 8.0, 8.0],
            [8.0, 0.0, 16.0],
            [8.0, 16.0, 0.0],
        ],
    )
    req = OptimizeRequest(
        snapshot_id="test-option-c",
        drivers=[
            DriverInput(
                driver_id="drv-1",
                start_location_id="branch",
                shift_start_minute=480,
                shift_end_minute=960,
                vehicle_capacity=3,
            ),
            DriverInput(
                driver_id="drv-2",
                start_location_id="branch",
                shift_start_minute=480,
                shift_end_minute=960,
                vehicle_capacity=3,
            ),
        ],
        transport_obligations=[
            TransportObligationInput(
                obligation_id="ob-north",
                booking_id="bk-n",
                therapist_id="th-n",
                leg_type="delivery",
                pickup_location_id="branch",
                dropoff_location_id="north",
                pickup_window=TimeWindow(earliest_minute=500, latest_minute=520),
                dropoff_window=TimeWindow(earliest_minute=520, latest_minute=545),
            ),
            TransportObligationInput(
                obligation_id="ob-south",
                booking_id="bk-s",
                therapist_id="th-s",
                leg_type="delivery",
                pickup_location_id="branch",
                dropoff_location_id="south",
                pickup_window=TimeWindow(earliest_minute=500, latest_minute=520),
                dropoff_window=TimeWindow(earliest_minute=520, latest_minute=545),
            ),
        ],
        travel_info=travel,
    )
    res = optimize_dispatch(req)

    assert res.feasibility_status == "feasible"
    assert res.metrics.served_obligation_count == 2
    assert res.metrics.active_driver_count == 2
    assert res.constraint_violations == []


def test_i_locked_active_route_preserves_onboard_and_reoptimizes_idempotently() -> None:
    """Test I: Locked active journey with onboard passenger preserves prefix, respects seat count, tracks changes, and is idempotent."""
    locations = [
        LocationNode(location_id="branch", label="Branch", lat=10.6765, lng=122.9509, location_type="branch"),
        LocationNode(location_id="drv1_pos", label="Driver 1 GPS", lat=10.6800, lng=122.9550, location_type="driver_start"),
        LocationNode(location_id="cust1", label="Customer 1", lat=10.6900, lng=122.9600),
        LocationNode(location_id="cust2", label="Customer 2", lat=10.6650, lng=122.9680),
        LocationNode(location_id="cust3", label="Customer 3", lat=10.6700, lng=122.9740),
    ]
    travel = TravelInfo(
        locations=locations,
        travel_time_minutes=[
            [0, 5, 12, 10, 14],
            [5, 0, 8, 13, 15],
            [12, 8, 0, 18, 16],
            [10, 13, 18, 0, 5],
            [14, 15, 16, 5, 0],
        ],
        travel_distance_km=[
            [0.0, 1.5, 4.0, 3.5, 4.8],
            [1.5, 0.0, 2.8, 4.4, 5.2],
            [4.0, 2.8, 0.0, 6.2, 5.5],
            [3.5, 4.4, 6.2, 0.0, 1.8],
            [4.8, 5.2, 5.5, 1.8, 0.0],
        ],
    )
    req = OptimizeRequest(
        snapshot_id="test-locked-reopt",
        drivers=[
            DriverInput(
                driver_id="drv-1",
                start_location_id="drv1_pos",
                shift_start_minute=480,
                shift_end_minute=960,
                available_from_minute=520,
                vehicle_capacity=2,
                locked_stop_sequence=[
                    LockedStopRef(obligation_id="ob-onboard", stop_type="dropoff"),
                ],
            ),
            DriverInput(
                driver_id="drv-2",
                start_location_id="branch",
                shift_start_minute=480,
                shift_end_minute=960,
                available_from_minute=520,
                vehicle_capacity=3,
            ),
        ],
        transport_obligations=[
            TransportObligationInput(
                obligation_id="ob-onboard",
                booking_id="bk-1",
                therapist_id="th-1",
                leg_type="delivery",
                pickup_location_id="branch",
                dropoff_location_id="cust1",
                pickup_window=TimeWindow(earliest_minute=500, latest_minute=515),
                dropoff_window=TimeWindow(earliest_minute=520, latest_minute=545),
                operational_state="onboard",
                is_locked=True,
                locked_driver_id="drv-1",
                previous_driver_id="drv-1",
                previous_pickup_minute=505.0,
            ),
            TransportObligationInput(
                obligation_id="ob-existing",
                booking_id="bk-2",
                therapist_id="th-2",
                leg_type="delivery",
                pickup_location_id="branch",
                dropoff_location_id="cust2",
                pickup_window=TimeWindow(earliest_minute=525, latest_minute=560),
                dropoff_window=TimeWindow(earliest_minute=535, latest_minute=590),
                operational_state="unstarted",
                previous_driver_id="drv-2",
            ),
            TransportObligationInput(
                obligation_id="ob-new",
                booking_id="bk-3",
                therapist_id="th-3",
                leg_type="delivery",
                pickup_location_id="branch",
                dropoff_location_id="cust3",
                pickup_window=TimeWindow(earliest_minute=525, latest_minute=565),
                dropoff_window=TimeWindow(earliest_minute=540, latest_minute=600),
                operational_state="unstarted",
            ),
        ],
        travel_info=travel,
    )

    res1 = optimize_dispatch(req)
    res2 = optimize_dispatch(req)

    assert res1.feasibility_status == "feasible"
    assert res1.constraint_violations == []
    drv1_route = next(r for r in res1.routes if r.driver_id == "drv-1")
    # Initial onboard occupancy = 1; first service stop must be ob-onboard dropoff
    assert drv1_route.stops[0].occupancy_after == 1
    assert drv1_route.stops[1].obligation_id == "ob-onboard"
    assert drv1_route.stops[1].stop_type == "dropoff"
    assert drv1_route.stops[1].occupancy_after == 0
    assert drv1_route.peak_occupancy <= 2

    # Idempotency on unchanged snapshot
    assert [
        (r.driver_id, [(s.obligation_id, s.stop_type, s.service_start_minute) for s in r.stops])
        for r in res1.routes
    ] == [
        (r.driver_id, [(s.obligation_id, s.stop_type, s.service_start_minute) for s in r.stops])
        for r in res2.routes
    ]

    # Change tracking populated
    changes_by_id = {a.obligation_id: a.change_type for a in res1.assignments}
    assert changes_by_id["ob-new"] == "new"
    assert changes_by_id["ob-existing"] in ("unchanged", "rescheduled", "reassigned")


def test_five_driver_fleet_overlapping_deliveries_and_collections_performance() -> None:
    """Section 13: Representative 5-driver fleet with overlapping deliveries and collections."""
    locations = [
        LocationNode(location_id="branch", label="Main Branch", lat=10.6765, lng=122.9509, location_type="branch"),
        LocationNode(location_id="c1", label="Cust 1", lat=10.6900, lng=122.9600),
        LocationNode(location_id="c2", label="Cust 2", lat=10.6950, lng=122.9640),
        LocationNode(location_id="c3", label="Cust 3", lat=10.6720, lng=122.9720),
        LocationNode(location_id="c4", label="Cust 4", lat=10.6680, lng=122.9760),
        LocationNode(location_id="c5", label="Cust 5", lat=10.6560, lng=122.9480),
        LocationNode(location_id="c6", label="Cust 6", lat=10.6510, lng=122.9440),
    ]
    coords = [(l.lat, l.lng) for l in locations]
    n = len(coords)
    t_mat = [[0.0] * n for _ in range(n)]
    d_mat = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            km = max(1.0, ((coords[i][0] - coords[j][0]) ** 2 + (coords[i][1] - coords[j][1]) ** 2) ** 0.5 * 111.0)
            d_mat[i][j] = round(km, 2)
            t_mat[i][j] = round(km * 2.8, 1)

    drivers = [
        DriverInput(
            driver_id=f"drv-{i}",
            name=f"Driver {i}",
            start_location_id="branch",
            shift_start_minute=480,
            shift_end_minute=1020,
            vehicle_capacity=3,
        )
        for i in range(1, 6)
    ]

    obligations: list[TransportObligationInput] = []
    for k in range(1, 7):
        del_id = f"ob-del-{k}"
        col_id = f"ob-col-{k}"
        cust_loc = f"c{k}"
        arr_target = 540 + (k % 3) * 15
        obligations.append(
            TransportObligationInput(
                obligation_id=del_id,
                booking_id=f"bk-{k}",
                therapist_id=f"th-{k}",
                leg_type="delivery",
                pickup_location_id="branch",
                dropoff_location_id=cust_loc,
                pickup_window=TimeWindow(earliest_minute=490, latest_minute=arr_target - 5),
                dropoff_window=TimeWindow(earliest_minute=500, latest_minute=arr_target + 10),
                target_arrival_minute=arr_target,
            )
        )
        obligations.append(
            TransportObligationInput(
                obligation_id=col_id,
                booking_id=f"bk-{k}",
                therapist_id=f"th-{k}",
                leg_type="collection",
                pickup_location_id=cust_loc,
                dropoff_location_id="branch",
                pickup_window=TimeWindow(earliest_minute=arr_target + 60, latest_minute=arr_target + 105),
                dropoff_window=TimeWindow(earliest_minute=arr_target + 65, latest_minute=arr_target + 160),
                expected_ready_minute=arr_target + 60,
                max_therapist_wait_minutes=45,
                linked_delivery_obligation_id=del_id,
                estimated_service_duration_minutes=60,
            )
        )

    req = OptimizeRequest(
        snapshot_id="fleet-5-drivers-benchmark",
        drivers=drivers,
        transport_obligations=obligations,
        travel_info=TravelInfo(locations=locations, travel_time_minutes=t_mat, travel_distance_km=d_mat),
        config=OptimizationConfig(solver_time_limit_seconds=2.0),
    )

    sim = run_simulation_comparison(req, "fleet-5-drivers-benchmark", compare_fairness=False)
    opt = sim.optimized_result

    assert opt.feasibility_status == "feasible"
    assert opt.constraint_violations == []
    assert opt.metrics.served_obligation_count == 12
    assert opt.metrics.collection_coverage_rate == 1.0
    assert opt.diagnostics.solver_duration_ms < 2500.0
    assert sim.delta_vs_baseline.driving_minutes_saved > 0


def test_reassignment_stability_and_en_route_pickup_lock() -> None:
    """Section 10: Reoptimization preserves en_route_pickup lock and resists unnecessary churn."""
    locations = [
        LocationNode(location_id="branch", label="Branch", lat=10.6765, lng=122.9509, location_type="branch"),
        LocationNode(location_id="c1", label="Cust 1", lat=10.6880, lng=122.9600),
        LocationNode(location_id="c2", label="Cust 2", lat=10.6700, lng=122.9650),
    ]
    travel = TravelInfo(
        locations=locations,
        travel_time_minutes=[[0, 10, 11], [10, 0, 15], [11, 15, 0]],
        travel_distance_km=[[0.0, 3.5, 3.8], [3.5, 0.0, 5.5], [3.8, 5.5, 0.0]],
    )
    req = OptimizeRequest(
        snapshot_id="test-reassignment-stability",
        drivers=[
            DriverInput(
                driver_id="drv-1",
                start_location_id="branch",
                shift_start_minute=480,
                shift_end_minute=960,
                vehicle_capacity=2,
                locked_stop_sequence=[
                    LockedStopRef(obligation_id="ob-enroute", stop_type="pickup"),
                    LockedStopRef(obligation_id="ob-enroute", stop_type="dropoff"),
                ],
            ),
            DriverInput(
                driver_id="drv-2",
                start_location_id="branch",
                shift_start_minute=480,
                shift_end_minute=960,
                vehicle_capacity=2,
            ),
        ],
        transport_obligations=[
            TransportObligationInput(
                obligation_id="ob-enroute",
                booking_id="bk-er",
                therapist_id="th-1",
                leg_type="delivery",
                pickup_location_id="branch",
                dropoff_location_id="c1",
                pickup_window=TimeWindow(earliest_minute=500, latest_minute=520),
                dropoff_window=TimeWindow(earliest_minute=510, latest_minute=540),
                operational_state="en_route_pickup",
                is_locked=True,
                locked_driver_id="drv-1",
                previous_driver_id="drv-1",
            ),
            TransportObligationInput(
                obligation_id="ob-sticky",
                booking_id="bk-st",
                therapist_id="th-2",
                leg_type="delivery",
                pickup_location_id="branch",
                dropoff_location_id="c2",
                pickup_window=TimeWindow(earliest_minute=600, latest_minute=620),
                dropoff_window=TimeWindow(earliest_minute=610, latest_minute=650),
                operational_state="assigned",
                previous_driver_id="drv-2",
                previous_pickup_minute=600.0,
                previous_dropoff_minute=614.0,
            ),
        ],
        travel_info=travel,
        config=OptimizationConfig(fairness_weight=0.5, reassignment_penalty=15.0),
    )
    res = optimize_dispatch(req)

    assert res.feasibility_status == "feasible"
    assert res.constraint_violations == []
    by_ob = {a.obligation_id: a for a in res.assignments}
    assert by_ob["ob-enroute"].driver_id == "drv-1"
    assert by_ob["ob-sticky"].driver_id == "drv-2"
    assert by_ob["ob-sticky"].change_type == "unchanged"
    assert res.metrics.reassigned_count == 0

