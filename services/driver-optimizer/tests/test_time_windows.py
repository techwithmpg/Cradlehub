"""Time window, shift schedule, impossible appointment, and no-feasible-driver tests (Tests D, H, L)."""

from __future__ import annotations

import json
from pathlib import Path

from app.models import (
    DriverInput,
    LocationNode,
    OptimizeRequest,
    TherapistInput,
    TimeWindow,
    TransportObligationInput,
    TravelInfo,
)
from app.solver import optimize_dispatch

FIXTURES_DIR = Path(__file__).resolve().parent.parent / "fixtures"


def _simple_travel(travel_time: float = 45.0) -> TravelInfo:
    return TravelInfo(
        locations=[
            LocationNode(location_id="branch", label="Branch", lat=10.6765, lng=122.9509, location_type="branch"),
            LocationNode(location_id="far", label="Far Customer", lat=10.8000, lng=123.0200),
        ],
        travel_time_minutes=[[0.0, travel_time], [travel_time, 0.0]],
        travel_distance_km=[[0.0, 18.0], [18.0, 0.0]],
    )


def test_d_shift_conflict_fixture_avoids_infeasible_shift_overrun() -> None:
    """Test D: Driver approaching shift end rejects conflicting trip rather than violating shift end."""
    data = json.loads((FIXTURES_DIR / "shift_conflict.json").read_text(encoding="utf-8"))
    req = OptimizeRequest.model_validate(data)
    res = optimize_dispatch(req)

    assert res.feasibility_status == "partial"
    assert res.all_obligations_served is False
    assert res.constraint_violations == []
    assert [a.obligation_id for a in res.assignments] == ["ob-feasible"]
    assert [u.obligation_id for u in res.unassigned_obligations] == ["ob-shift-conflict"]
    assert "shift_window_conflict" in res.unassigned_obligations[0].reasons


def test_d_second_driver_with_later_shift_picks_up_afternoon_trip() -> None:
    """Test D: Shift-restricted Driver 1 skips late job while Driver 2 covers it cleanly."""
    travel = _simple_travel(travel_time=20.0)
    req = OptimizeRequest(
        snapshot_id="test-d-multi-shift",
        drivers=[
            DriverInput(
                driver_id="drv-early",
                start_location_id="branch",
                return_to_location_id="branch",
                shift_start_minute=480,
                shift_end_minute=600,
                vehicle_capacity=2,
            ),
            DriverInput(
                driver_id="drv-late",
                start_location_id="branch",
                return_to_location_id="branch",
                shift_start_minute=570,
                shift_end_minute=900,
                vehicle_capacity=2,
            ),
        ],
        transport_obligations=[
            TransportObligationInput(
                obligation_id="ob-late-trip",
                booking_id="bk-late",
                therapist_id="th-1",
                leg_type="delivery",
                pickup_location_id="branch",
                dropoff_location_id="far",
                pickup_window=TimeWindow(earliest_minute=580, latest_minute=610),
                dropoff_window=TimeWindow(earliest_minute=590, latest_minute=650),
            )
        ],
        travel_info=travel,
    )
    res = optimize_dispatch(req)

    assert res.feasibility_status == "feasible"
    assert res.constraint_violations == []
    assert res.assignments[0].driver_id == "drv-late"


def test_h_impossible_appointment_detected_explicitly() -> None:
    """Test H: Travel time 45 min makes 08:30 arrival impossible when driver starts at 08:00."""
    travel = _simple_travel(travel_time=45.0)
    req = OptimizeRequest(
        snapshot_id="test-h-impossible-appt",
        drivers=[
            DriverInput(
                driver_id="drv-1",
                start_location_id="branch",
                shift_start_minute=480,
                shift_end_minute=900,
                vehicle_capacity=3,
            )
        ],
        transport_obligations=[
            TransportObligationInput(
                obligation_id="ob-unreachable",
                booking_id="bk-imp",
                therapist_id="th-1",
                leg_type="delivery",
                pickup_location_id="branch",
                dropoff_location_id="far",
                pickup_window=TimeWindow(earliest_minute=480, latest_minute=500),
                dropoff_window=TimeWindow(earliest_minute=480, latest_minute=510),
            )
        ],
        travel_info=travel,
    )
    res = optimize_dispatch(req)

    assert res.feasibility_status == "infeasible"
    assert res.all_obligations_served is False
    assert res.routes[0].assigned_obligation_ids == []
    assert len(res.unassigned_obligations) == 1
    assert "appointment_unreachable" in res.unassigned_obligations[0].reasons


def test_l_no_feasible_driver_reports_all_unassigned_cleanly() -> None:
    """Test L: Every driver is blocked by shift, capacity, or unavailability."""
    travel = _simple_travel(travel_time=20.0)
    req = OptimizeRequest(
        snapshot_id="test-l-no-feasible-driver",
        drivers=[
            DriverInput(
                driver_id="drv-unavailable",
                start_location_id="branch",
                shift_start_minute=480,
                shift_end_minute=900,
                is_available=False,
                vehicle_capacity=4,
            ),
            DriverInput(
                driver_id="drv-tiny",
                start_location_id="branch",
                shift_start_minute=480,
                shift_end_minute=900,
                vehicle_capacity=1,
            ),
            DriverInput(
                driver_id="drv-off-shift",
                start_location_id="branch",
                shift_start_minute=480,
                shift_end_minute=520,
                vehicle_capacity=4,
            ),
        ],
        transport_obligations=[
            TransportObligationInput(
                obligation_id="ob-blocked",
                booking_id="bk-blocked",
                therapist_id="th-1",
                leg_type="delivery",
                pickup_location_id="branch",
                dropoff_location_id="far",
                pickup_window=TimeWindow(earliest_minute=550, latest_minute=580),
                dropoff_window=TimeWindow(earliest_minute=570, latest_minute=620),
                passenger_count=2,
            )
        ],
        travel_info=travel,
    )
    res = optimize_dispatch(req)

    assert res.feasibility_status == "infeasible"
    assert res.all_obligations_served is False
    assert res.metrics.served_obligation_count == 0
    assert res.metrics.unassigned_obligation_count == 1
    reasons = set(res.unassigned_obligations[0].reasons)
    assert "vehicle_overcapacity" in reasons
    assert "pickup_window_unreachable" in reasons or "shift_window_conflict" in reasons


def test_therapist_input_auto_derives_delivery_and_collection_when_legs_omitted() -> None:
    """Section 6: Passing Therapists directly without explicit obligations derives Leg A and Leg B."""
    travel = _simple_travel(travel_time=15.0)
    req = OptimizeRequest(
        snapshot_id="test-therapist-expansion",
        drivers=[
            DriverInput(
                driver_id="drv-1",
                start_location_id="branch",
                return_to_location_id="branch",
                shift_start_minute=480,
                shift_end_minute=960,
                vehicle_capacity=3,
            )
        ],
        therapists=[
            TherapistInput(
                therapist_id="th-auto",
                booking_id="bk-auto",
                pickup_location_id="branch",
                customer_location_id="far",
                required_arrival_minute=560,
                estimated_service_end_minute=620,
                collection_window=TimeWindow(earliest_minute=620, latest_minute=660),
                permitted_return_location_id="branch",
            )
        ],
        travel_info=travel,
    )
    res = optimize_dispatch(req)

    assert res.feasibility_status == "feasible"
    assert res.metrics.served_obligation_count == 2
    assert res.metrics.collection_coverage_rate == 1.0
    assert res.constraint_violations == []
