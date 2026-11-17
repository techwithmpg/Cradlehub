"""Capacity, vehicle restrictions, and onboard seat tracking tests (Test G)."""

from __future__ import annotations

from app.models import (
    DriverInput,
    LocationNode,
    OptimizeRequest,
    TimeWindow,
    TransportObligationInput,
    TravelInfo,
)
from app.solver import optimize_dispatch


def _east_corridor_travel() -> TravelInfo:
    return TravelInfo(
        locations=[
            LocationNode(location_id="branch", label="Branch", lat=10.6765, lng=122.9509, location_type="branch"),
            LocationNode(location_id="c1", label="Cust 1", lat=10.6730, lng=122.9680),
            LocationNode(location_id="c2", label="Cust 2", lat=10.6700, lng=122.9735),
            LocationNode(location_id="c3", label="Cust 3", lat=10.6660, lng=122.9780),
            LocationNode(location_id="c4", label="Cust 4", lat=10.6620, lng=122.9820),
        ],
        travel_time_minutes=[
            [0, 10, 12, 14, 16],
            [10, 0, 3, 5, 7],
            [12, 3, 0, 3, 5],
            [14, 5, 3, 0, 3],
            [16, 7, 5, 3, 0],
        ],
        travel_distance_km=[
            [0.0, 3.5, 4.2, 4.9, 5.6],
            [3.5, 0.0, 1.0, 1.8, 2.5],
            [4.2, 1.0, 0.0, 1.0, 1.8],
            [4.9, 1.8, 1.0, 0.0, 1.0],
            [5.6, 2.5, 1.8, 1.0, 0.0],
        ],
    )


def test_g_capacity_enforced_across_pooled_and_multi_driver_fleet() -> None:
    """Test G: 4 therapists at branch, two 2-seat sedans — occupancy never exceeds capacity 2."""
    travel = _east_corridor_travel()
    obligations = [
        TransportObligationInput(
            obligation_id=f"ob-{i}",
            booking_id=f"bk-{i}",
            therapist_id=f"th-{i}",
            leg_type="delivery",
            pickup_location_id="branch",
            dropoff_location_id=f"c{i}",
            pickup_window=TimeWindow(earliest_minute=500, latest_minute=540),
            dropoff_window=TimeWindow(earliest_minute=510, latest_minute=580),
        )
        for i in range(1, 5)
    ]
    req = OptimizeRequest(
        snapshot_id="test-g-capacity-split",
        drivers=[
            DriverInput(
                driver_id="drv-sedan-1",
                start_location_id="branch",
                shift_start_minute=480,
                shift_end_minute=900,
                vehicle_capacity=2,
            ),
            DriverInput(
                driver_id="drv-sedan-2",
                start_location_id="branch",
                shift_start_minute=480,
                shift_end_minute=900,
                vehicle_capacity=2,
            ),
        ],
        transport_obligations=obligations,
        travel_info=travel,
    )
    res = optimize_dispatch(req)

    assert res.feasibility_status == "feasible"
    assert res.constraint_violations == []
    assert res.metrics.served_obligation_count == 4
    for route in res.routes:
        assert route.peak_occupancy <= 2
        for stop in route.stops:
            assert 0 <= stop.occupancy_before <= 2
            assert 0 <= stop.occupancy_after <= 2


def test_g_single_overcapacity_obligation_rejected_not_forced() -> None:
    """Test G: Group of 5 therapists requiring 5 seats cannot board a 3-seat vehicle."""
    travel = _east_corridor_travel()
    req = OptimizeRequest(
        snapshot_id="test-g-overcapacity",
        drivers=[
            DriverInput(
                driver_id="drv-small",
                start_location_id="branch",
                shift_start_minute=480,
                shift_end_minute=900,
                vehicle_capacity=3,
            )
        ],
        transport_obligations=[
            TransportObligationInput(
                obligation_id="ob-group-5",
                booking_id="bk-group",
                therapist_id="th-lead",
                leg_type="delivery",
                pickup_location_id="branch",
                dropoff_location_id="c1",
                pickup_window=TimeWindow(earliest_minute=500, latest_minute=540),
                dropoff_window=TimeWindow(earliest_minute=510, latest_minute=580),
                passenger_count=5,
            )
        ],
        travel_info=travel,
    )
    res = optimize_dispatch(req)

    assert res.feasibility_status == "infeasible"
    assert res.all_obligations_served is False
    assert res.metrics.served_obligation_count == 0
    assert len(res.unassigned_obligations) == 1
    assert "vehicle_overcapacity" in res.unassigned_obligations[0].reasons


def test_vehicle_tags_and_branch_restrictions_enforced() -> None:
    """Equipment/tag restrictions and branch scoping restrict assignment to eligible vehicles only."""
    travel = _east_corridor_travel()
    req = OptimizeRequest(
        snapshot_id="test-restrictions",
        drivers=[
            DriverInput(
                driver_id="drv-moto",
                branch_id="main",
                start_location_id="branch",
                shift_start_minute=480,
                shift_end_minute=900,
                vehicle_capacity=1,
                vehicle_type="motorcycle",
                vehicle_tags=[],
            ),
            DriverInput(
                driver_id="drv-mpv",
                branch_id="main",
                start_location_id="branch",
                shift_start_minute=480,
                shift_end_minute=900,
                vehicle_capacity=4,
                vehicle_type="mpv",
                vehicle_tags=["massage_bed", "ac"],
            ),
            DriverInput(
                driver_id="drv-other-branch",
                branch_id="south_branch",
                start_location_id="branch",
                shift_start_minute=480,
                shift_end_minute=900,
                vehicle_capacity=4,
                vehicle_type="mpv",
                vehicle_tags=["massage_bed", "ac"],
            ),
        ],
        transport_obligations=[
            TransportObligationInput(
                obligation_id="ob-bed-equipment",
                booking_id="bk-eq",
                therapist_id="th-1",
                branch_id="main",
                leg_type="delivery",
                pickup_location_id="branch",
                dropoff_location_id="c1",
                pickup_window=TimeWindow(earliest_minute=500, latest_minute=540),
                dropoff_window=TimeWindow(earliest_minute=510, latest_minute=580),
                required_vehicle_tags=["massage_bed"],
            )
        ],
        travel_info=travel,
    )
    res = optimize_dispatch(req)

    assert res.feasibility_status == "feasible"
    assert res.assignments[0].driver_id == "drv-mpv"
    assert res.constraint_violations == []
