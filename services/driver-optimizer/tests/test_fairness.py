"""Normalized driver workload fairness tests (Test C, Test J, and shift-duration scaling)."""

from __future__ import annotations

from app.models import (
    DriverInput,
    LocationNode,
    OptimizationConfig,
    OptimizeRequest,
    ReturnArrangement,
    TherapistInput,
    TherapistScheduleWindow,
    TimeWindow,
    TransportObligationInput,
    TravelInfo,
)
from app.solver import optimize_dispatch, run_simulation_comparison


def _multi_driver_request(fairness_weight: float) -> OptimizeRequest:
    locations = [
        LocationNode(location_id="branch", label="Branch", lat=10.6765, lng=122.9509, location_type="branch"),
        LocationNode(location_id="hub_a", label="Driver A Staging", lat=10.6780, lng=122.9515, location_type="driver_start"),
        LocationNode(location_id="hub_b", label="Driver B Staging", lat=10.6740, lng=122.9500, location_type="driver_start"),
        LocationNode(location_id="c1", label="Cust 1", lat=10.6900, lng=122.9620),
        LocationNode(location_id="c2", label="Cust 2", lat=10.6650, lng=122.9700),
        LocationNode(location_id="c3", label="Cust 3", lat=10.6840, lng=122.9420),
        LocationNode(location_id="c4", label="Cust 4", lat=10.6590, lng=122.9550),
    ]
    # Driver A is slightly closer (2 min) to branch than Driver B (5 min),
    # BUT Driver A is on a 4-hour shift (240 min) with 90 min committed,
    # whereas Driver B is on an 8-hour shift (480 min) with 0 min committed.
    travel = TravelInfo(
        locations=locations,
        travel_time_minutes=[
            [0, 2, 5, 14, 15, 12, 16],
            [2, 0, 7, 15, 16, 13, 17],
            [5, 7, 0, 17, 18, 15, 19],
            [14, 15, 17, 0, 22, 16, 24],
            [15, 16, 18, 22, 0, 25, 14],
            [12, 13, 15, 16, 25, 0, 20],
            [16, 17, 19, 24, 14, 20, 0],
        ],
        travel_distance_km=[
            [0.0, 0.8, 1.8, 5.0, 5.4, 4.2, 5.8],
            [0.8, 0.0, 2.5, 5.4, 5.8, 4.6, 6.2],
            [1.8, 2.5, 0.0, 6.0, 6.4, 5.3, 6.8],
            [5.0, 5.4, 6.0, 0.0, 7.8, 5.6, 8.4],
            [5.4, 5.8, 6.4, 7.8, 0.0, 8.8, 5.0],
            [4.2, 4.6, 5.3, 5.6, 8.8, 0.0, 7.0],
            [5.8, 6.2, 6.8, 8.4, 5.0, 7.0, 0.0],
        ],
    )
    obligations = [
        TransportObligationInput(
            obligation_id="ob-1",
            booking_id="bk-1",
            therapist_id="th-1",
            leg_type="delivery",
            pickup_location_id="branch",
            dropoff_location_id="c1",
            pickup_window=TimeWindow(earliest_minute=500, latest_minute=530),
            dropoff_window=TimeWindow(earliest_minute=510, latest_minute=560),
        ),
        TransportObligationInput(
            obligation_id="ob-2",
            booking_id="bk-2",
            therapist_id="th-2",
            leg_type="delivery",
            pickup_location_id="branch",
            dropoff_location_id="c2",
            pickup_window=TimeWindow(earliest_minute=560, latest_minute=590),
            dropoff_window=TimeWindow(earliest_minute=570, latest_minute=620),
        ),
        TransportObligationInput(
            obligation_id="ob-3",
            booking_id="bk-3",
            therapist_id="th-3",
            leg_type="delivery",
            pickup_location_id="branch",
            dropoff_location_id="c3",
            pickup_window=TimeWindow(earliest_minute=620, latest_minute=650),
            dropoff_window=TimeWindow(earliest_minute=630, latest_minute=680),
        ),
        TransportObligationInput(
            obligation_id="ob-4",
            booking_id="bk-4",
            therapist_id="th-4",
            leg_type="delivery",
            pickup_location_id="branch",
            dropoff_location_id="c4",
            pickup_window=TimeWindow(earliest_minute=680, latest_minute=710),
            dropoff_window=TimeWindow(earliest_minute=690, latest_minute=740),
        ),
    ]
    return OptimizeRequest(
        snapshot_id="test-fairness",
        drivers=[
            DriverInput(
                driver_id="drv-half-committed",
                name="Half Shift Committed",
                start_location_id="hub_a",
                shift_start_minute=480,
                shift_end_minute=760,
                available_from_minute=480,
                available_until_minute=760,  # 280 min shift
                existing_committed_workload_minutes=90.0,
                vehicle_capacity=2,
            ),
            DriverInput(
                driver_id="drv-full-fresh",
                name="Full Shift Fresh",
                start_location_id="hub_b",
                shift_start_minute=480,
                shift_end_minute=960,  # 480 min shift
                existing_committed_workload_minutes=0.0,
                vehicle_capacity=2,
            ),
        ],
        transport_obligations=obligations,
        travel_info=travel,
        config=OptimizationConfig(fairness_weight=fairness_weight),
    )


def test_c_multiple_drivers_balance_by_committed_and_shift_capacity() -> None:
    """Test C: Multiple drivers with different existing workloads allocate new trips fairly."""
    res = optimize_dispatch(_multi_driver_request(fairness_weight=2.0))

    assert res.feasibility_status == "feasible"
    assert res.constraint_violations == []
    assert res.metrics.served_obligation_count == 4

    route_half = next(r for r in res.routes if r.driver_id == "drv-half-committed")
    route_full = next(r for r in res.routes if r.driver_id == "drv-full-fresh")

    # Full-shift fresh driver should take at least as many (typically more) new obligations
    assert len(route_full.assigned_obligation_ids) >= len(route_half.assigned_obligation_ids)
    assert len(route_full.assigned_obligation_ids) >= 2


def test_j_fairness_vs_efficiency_tradeoff_measurable() -> None:
    """Test J: Compare fairness_weight=0 (distance-only) vs fairness_weight=2.5 (balanced)."""
    req_balanced = _multi_driver_request(fairness_weight=2.5)
    sim = run_simulation_comparison(req_balanced, "fairness-vs-efficiency", compare_fairness=True)

    opt_fair = sim.optimized_result
    opt_eff = sim.fairness_off_result
    assert opt_eff is not None
    assert opt_fair.feasibility_status == "feasible"
    assert opt_eff.feasibility_status == "feasible"
    assert opt_fair.metrics.served_obligation_count == opt_eff.metrics.served_obligation_count == 4

    # Efficiency-only piles onto closer Driver A, creating much higher utilization spread
    assert opt_fair.metrics.workload_utilization_spread < opt_eff.metrics.workload_utilization_spread
    # Measure additional travel cost explicitly (must remain bounded and reasonable)
    travel_overhead = opt_fair.metrics.total_driving_minutes - opt_eff.metrics.total_driving_minutes
    assert travel_overhead >= 0.0
    assert travel_overhead <= 15.0
    assert len(sim.fairness_vs_efficiency_notes) == 1


def test_three_driver_shift_normalization_balances_4h_vs_8h_shifts() -> None:
    """Section 9 & 13: 3 drivers (one 4h shift, two 8h shifts) normalize workload against shift length."""
    locations = [
        LocationNode(location_id="branch", label="Branch", lat=10.6765, lng=122.9509, location_type="branch"),
        LocationNode(location_id="c1", label="Cust 1", lat=10.6900, lng=122.9600),
        LocationNode(location_id="c2", label="Cust 2", lat=10.6720, lng=122.9720),
        LocationNode(location_id="c3", label="Cust 3", lat=10.6580, lng=122.9520),
    ]
    travel = TravelInfo(
        locations=locations,
        travel_time_minutes=[
            [0, 15, 15, 15],
            [15, 0, 28, 28],
            [15, 28, 0, 28],
            [15, 28, 28, 0],
        ],
        travel_distance_km=[
            [0.0, 5.0, 5.0, 5.0],
            [5.0, 0.0, 9.0, 9.0],
            [5.0, 9.0, 0.0, 9.0],
            [5.0, 9.0, 9.0, 0.0],
        ],
    )
    req = OptimizeRequest(
        snapshot_id="test-3-driver-normalization",
        drivers=[
            DriverInput(
                driver_id="drv-4h",
                start_location_id="branch",
                return_to_location_id="branch",
                shift_start_minute=480,
                shift_end_minute=720,  # 240 min
                existing_committed_workload_minutes=30.0,
                vehicle_capacity=2,
            ),
            DriverInput(
                driver_id="drv-8h-1",
                start_location_id="branch",
                return_to_location_id="branch",
                shift_start_minute=480,
                shift_end_minute=960,  # 480 min
                existing_committed_workload_minutes=0.0,
                vehicle_capacity=2,
            ),
            DriverInput(
                driver_id="drv-8h-2",
                start_location_id="branch",
                return_to_location_id="branch",
                shift_start_minute=480,
                shift_end_minute=960,  # 480 min
                existing_committed_workload_minutes=0.0,
                vehicle_capacity=2,
            ),
        ],
        transport_obligations=[
            TransportObligationInput(
                obligation_id=f"ob-{i}",
                booking_id=f"bk-{i}",
                therapist_id=f"th-{i}",
                leg_type="delivery",
                pickup_location_id="branch",
                dropoff_location_id=f"c{i}",
                pickup_window=TimeWindow(earliest_minute=500, latest_minute=530),
                dropoff_window=TimeWindow(earliest_minute=510, latest_minute=555),
            )
            for i in range(1, 4)
        ],
        travel_info=travel,
        config=OptimizationConfig(fairness_weight=3.0),
    )

    res = optimize_dispatch(req)
    assert res.feasibility_status == "feasible"
    assert res.constraint_violations == []
    assert res.metrics.served_obligation_count == 3
    # Utilization spread across all 3 drivers stays tight
    assert res.metrics.workload_utilization_spread <= 0.20


def test_cond_10_excluded_collections_contribute_zero_workload_or_stop_counts() -> None:
    """Req 7.10: Excluded not_required return trips must not add fictitious driving, stops, or workload."""
    locations = [
        LocationNode(location_id="branch", label="Branch", lat=10.6765, lng=122.9509, location_type="branch"),
        LocationNode(location_id="c1", label="Cust 1", lat=10.6900, lng=122.9600),
        LocationNode(location_id="c2", label="Cust 2", lat=10.6720, lng=122.9720),
    ]
    travel = TravelInfo(
        locations=locations,
        travel_time_minutes=[[0, 15, 15], [15, 0, 25], [15, 25, 0]],
        travel_distance_km=[[0.0, 5.0, 5.0], [5.0, 0.0, 9.0], [5.0, 9.0, 0.0]],
    )
    drivers = [
        DriverInput(
            driver_id="drv-1",
            start_location_id="branch",
            shift_start_minute=480,
            shift_end_minute=960,
            vehicle_capacity=2,
        ),
        DriverInput(
            driver_id="drv-2",
            start_location_id="branch",
            shift_start_minute=480,
            shift_end_minute=960,
            vehicle_capacity=2,
        ),
    ]
    req = OptimizeRequest(
        snapshot_id="cond-10-fairness-excludes-not-required",
        drivers=drivers,
        therapists=[
            TherapistInput(
                therapist_id="th-1",
                booking_id="bk-1",
                pickup_location_id="branch",
                customer_location_id="c1",
                required_arrival_minute=540,
                estimated_service_end_minute=600,
                shift_window=TherapistScheduleWindow(shift_start_minute=480, shift_end_minute=600),
                is_final_appointment=True,
                return_arrangement=ReturnArrangement(
                    disposition="not_required",
                    independent_departure_approved=True,
                ),
            ),
            TherapistInput(
                therapist_id="th-2",
                booking_id="bk-2",
                pickup_location_id="branch",
                customer_location_id="c2",
                required_arrival_minute=540,
                estimated_service_end_minute=600,
                shift_window=TherapistScheduleWindow(shift_start_minute=480, shift_end_minute=600),
                is_final_appointment=True,
                return_arrangement=ReturnArrangement(
                    disposition="required",
                    return_to_branch_required=True,
                ),
            ),
        ],
        travel_info=travel,
        config=OptimizationConfig(fairness_weight=2.0),
    )

    res = optimize_dispatch(req)
    assert res.feasibility_status == "feasible"
    assert res.collection_plan_safe is True
    # Only th-1 delivery (15m + 2*3m handling + 2*4m stop complexity = 29m),
    # th-2 delivery (29m) + th-2 collection (29m)!
    # Total driving must equal 15 + 15 + 15 = 45m (NOT 60m with a phantom th-1 return!).
    assert res.metrics.total_driving_minutes == 45.0
    assert res.metrics.served_obligation_count == 3
    total_service_stops = sum(
        sum(1 for s in r.stops if s.stop_type in ("pickup", "dropoff"))
        for r in res.routes
    )
    assert total_service_stops == 6
    # Fairness uses actual workload: drv serving th-1 delivery (1 leg = 29m) vs drv serving th-2 del+col (2 legs = 58m)
    # Wait: even better, drv-1 can deliver th-2 and drv-2 deliver th-1 and collect th-2, or drv-1 takes th-1+th-2 del?
    # Regardless, total new workload across fleet = exactly 3 legs (87m), zero phantom return workload!
    assert round(sum(r.new_workload_minutes for r in res.routes), 2) == 87.0

