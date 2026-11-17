"""Therapist collection planning tests (Tests E, F, K, and collection coverage safety)."""

from __future__ import annotations

import json
from pathlib import Path

from app.models import (
    DriverInput,
    LocationNode,
    NextAssignmentInfo,
    OptimizationConfig,
    OptimizeRequest,
    ReturnArrangement,
    TherapistInput,
    TherapistScheduleWindow,
    TimeWindow,
    TransportObligationInput,
    TravelInfo,
)
from app.solver import optimize_dispatch

FIXTURES_DIR = Path(__file__).resolve().parent.parent / "fixtures"


def _north_corridor_travel() -> TravelInfo:
    return TravelInfo(
        locations=[
            LocationNode(location_id="branch", label="Branch", lat=10.6765, lng=122.9509, location_type="branch"),
            LocationNode(location_id="c1", label="Cust 1", lat=10.7010, lng=122.9610),
            LocationNode(location_id="c2", label="Cust 2", lat=10.7100, lng=122.9650),
            LocationNode(location_id="c3", label="Cust 3", lat=10.7180, lng=122.9690),
        ],
        travel_time_minutes=[
            [0, 14, 18, 22],
            [14, 0, 5, 8],
            [18, 5, 0, 4],
            [22, 8, 4, 0],
        ],
        travel_distance_km=[
            [0.0, 5.0, 6.4, 7.8],
            [5.0, 0.0, 1.8, 2.9],
            [6.4, 1.8, 0.0, 1.5],
            [7.8, 2.9, 1.5, 0.0],
        ],
    )


def test_e_split_delivery_and_collection_drivers() -> None:
    """Test E: Driver A delivers therapists in morning; Driver B collects them later."""
    data = json.loads((FIXTURES_DIR / "split_collection.json").read_text(encoding="utf-8"))
    req = OptimizeRequest.model_validate(data)
    res = optimize_dispatch(req)

    assert res.feasibility_status == "feasible"
    assert res.constraint_violations == []
    assert res.metrics.served_obligation_count == 4
    assert res.metrics.collection_coverage_rate == 1.0

    by_ob = {a.obligation_id: a for a in res.assignments}
    assert by_ob["ob-301-del"].driver_id == "drv-morning"
    assert by_ob["ob-301-col"].driver_id == "drv-afternoon"
    assert by_ob["ob-302-del"].driver_id == "drv-morning"
    assert by_ob["ob-302-col"].driver_id == "drv-afternoon"
    # Causal timing respected: collection pickup >= delivery dropoff + 90m service
    assert by_ob["ob-301-col"].pickup_minute >= by_ob["ob-301-del"].dropoff_minute + 90.0
    assert by_ob["ob-302-col"].pickup_minute >= by_ob["ob-302-del"].dropoff_minute + 90.0
    assert all(c.split_driver_coverage for c in res.collection_coverage)
    assert all(c.coverage_status == "covered_split_driver" for c in res.collection_coverage)


def test_f_multiple_collections_pooled_efficiently() -> None:
    """Test F: Three therapists finish services nearby and are pooled into one collection run."""
    travel = _north_corridor_travel()
    obligations = [
        TransportObligationInput(
            obligation_id=f"ob-col-{i}",
            booking_id=f"bk-{i}",
            therapist_id=f"th-{i}",
            leg_type="collection",
            pickup_location_id=f"c{i}",
            dropoff_location_id="branch",
            pickup_window=TimeWindow(earliest_minute=680 + (i - 1) * 5, latest_minute=730),
            dropoff_window=TimeWindow(earliest_minute=695, latest_minute=790),
            expected_ready_minute=680 + (i - 1) * 5,
            max_therapist_wait_minutes=45,
            operational_state="in_service",
        )
        for i in range(1, 4)
    ]
    req = OptimizeRequest(
        snapshot_id="test-f-pooled-collections",
        drivers=[
            DriverInput(
                driver_id="drv-col",
                start_location_id="branch",
                return_to_location_id="branch",
                shift_start_minute=600,
                shift_end_minute=900,
                vehicle_capacity=4,
            )
        ],
        transport_obligations=obligations,
        travel_info=travel,
    )
    res = optimize_dispatch(req)

    assert res.feasibility_status == "feasible"
    assert res.constraint_violations == []
    assert res.metrics.served_obligation_count == 3
    assert res.metrics.collection_coverage_rate == 1.0
    route = res.routes[0]
    assert route.peak_occupancy == 3
    # Pooled collection picks all 3 before returning to branch: 22+4+5+14=45 vs 3 round trips (108 min)
    assert route.driving_minutes <= 50.0


def test_k_service_completion_delay_replans_collection_to_available_driver() -> None:
    """Test K: Delayed service end shifts readiness past Driver 1's shift, reoptimizing collection to Driver 2."""
    travel = _north_corridor_travel()
    req = OptimizeRequest(
        snapshot_id="test-k-delay",
        drivers=[
            DriverInput(
                driver_id="drv-1",
                start_location_id="branch",
                shift_start_minute=480,
                shift_end_minute=650,  # Ends at 10:50
                vehicle_capacity=3,
            ),
            DriverInput(
                driver_id="drv-2",
                start_location_id="branch",
                shift_start_minute=620,
                shift_end_minute=900,
                vehicle_capacity=3,
            ),
        ],
        transport_obligations=[
            TransportObligationInput(
                obligation_id="ob-delayed-col",
                booking_id="bk-delay",
                therapist_id="th-1",
                leg_type="collection",
                pickup_location_id="c2",
                dropoff_location_id="branch",
                # Delayed from 600 to 640! Driver 1 cannot return by 650 (640 + 3 + 18 = 661 > 650).
                pickup_window=TimeWindow(earliest_minute=640, latest_minute=680),
                dropoff_window=TimeWindow(earliest_minute=655, latest_minute=730),
                expected_ready_minute=640,
                max_therapist_wait_minutes=35,
                operational_state="in_service",
                previous_driver_id="drv-1",
                previous_pickup_minute=600.0,
            )
        ],
        travel_info=travel,
    )
    res = optimize_dispatch(req)

    assert res.feasibility_status == "feasible"
    assert res.constraint_violations == []
    assign = res.assignments[0]
    assert assign.driver_id == "drv-2"
    assert assign.change_type == "reassigned"
    assert assign.pickup_minute >= 640.0
    assert assign.therapist_wait_minutes <= 35.0


def test_unretrievable_delivery_blocked_when_collection_has_no_feasible_coverage() -> None:
    """Section 8: Do not commit a new delivery when no feasible collection capacity exists."""
    travel = _north_corridor_travel()
    req = OptimizeRequest(
        snapshot_id="test-no-collection-coverage",
        drivers=[
            DriverInput(
                driver_id="drv-day-only",
                start_location_id="branch",
                shift_start_minute=480,
                shift_end_minute=660,  # Ends at 11:00; cannot cover 12:00 collection
                vehicle_capacity=3,
            )
        ],
        transport_obligations=[
            TransportObligationInput(
                obligation_id="ob-good-del",
                booking_id="bk-good",
                therapist_id="th-1",
                leg_type="delivery",
                pickup_location_id="branch",
                dropoff_location_id="c1",
                pickup_window=TimeWindow(earliest_minute=500, latest_minute=530),
                dropoff_window=TimeWindow(earliest_minute=510, latest_minute=550),
            ),
            TransportObligationInput(
                obligation_id="ob-good-col",
                booking_id="bk-good",
                therapist_id="th-1",
                leg_type="collection",
                pickup_location_id="c1",
                dropoff_location_id="branch",
                pickup_window=TimeWindow(earliest_minute=600, latest_minute=620),
                dropoff_window=TimeWindow(earliest_minute=610, latest_minute=655),
                expected_ready_minute=600,
                linked_delivery_obligation_id="ob-good-del",
                estimated_service_duration_minutes=60,
                require_collection_coverage=True,
            ),
            TransportObligationInput(
                obligation_id="ob-stranded-del",
                booking_id="bk-stranded",
                therapist_id="th-2",
                leg_type="delivery",
                pickup_location_id="branch",
                dropoff_location_id="c2",
                pickup_window=TimeWindow(earliest_minute=500, latest_minute=540),
                dropoff_window=TimeWindow(earliest_minute=510, latest_minute=560),
            ),
            TransportObligationInput(
                obligation_id="ob-stranded-col",
                booking_id="bk-stranded",
                therapist_id="th-2",
                leg_type="collection",
                pickup_location_id="c2",
                dropoff_location_id="branch",
                pickup_window=TimeWindow(earliest_minute=720, latest_minute=760),
                dropoff_window=TimeWindow(earliest_minute=735, latest_minute=800),
                expected_ready_minute=720,
                linked_delivery_obligation_id="ob-stranded-del",
                estimated_service_duration_minutes=120,
                require_collection_coverage=True,
            ),
        ],
        travel_info=travel,
    )
    res = optimize_dispatch(req)

    assert res.feasibility_status == "partial"
    assert res.constraint_violations == []
    served_ids = {a.obligation_id for a in res.assignments}
    assert served_ids == {"ob-good-del", "ob-good-col"}
    unassigned_by_id = {u.obligation_id: u for u in res.unassigned_obligations}
    assert "ob-stranded-del" in unassigned_by_id
    assert "ob-stranded-col" in unassigned_by_id
    assert "collection_coverage_conflict" in unassigned_by_id["ob-stranded-del"].reasons
    stranded_cov = next(c for c in res.collection_coverage if c.booking_id == "bk-stranded")
    assert stranded_cov.coverage_status == "delivery_blocked_no_collection"


def test_completed_delivery_still_schedules_pending_collection_and_enforces_wait_limit() -> None:
    """Completed delivery allows independent collection scheduling; tight wait limit catches late pickup."""
    travel = _north_corridor_travel()
    req = OptimizeRequest(
        snapshot_id="test-completed-del-wait-limit",
        drivers=[
            DriverInput(
                driver_id="drv-1",
                start_location_id="branch",
                shift_start_minute=600,
                shift_end_minute=800,
                available_from_minute=650,  # Reaches c1 at 650+14=664 -> 64 min wait > max 30 min!
                vehicle_capacity=2,
            )
        ],
        transport_obligations=[
            TransportObligationInput(
                obligation_id="ob-del-done",
                booking_id="bk-done",
                therapist_id="th-1",
                leg_type="delivery",
                pickup_location_id="branch",
                dropoff_location_id="c1",
                pickup_window=TimeWindow(earliest_minute=500, latest_minute=520),
                dropoff_window=TimeWindow(earliest_minute=510, latest_minute=540),
                operational_state="completed",
            ),
            TransportObligationInput(
                obligation_id="ob-col-wait-tight",
                booking_id="bk-done",
                therapist_id="th-1",
                leg_type="collection",
                pickup_location_id="c1",
                dropoff_location_id="branch",
                pickup_window=TimeWindow(earliest_minute=600, latest_minute=680),
                dropoff_window=TimeWindow(earliest_minute=615, latest_minute=720),
                expected_ready_minute=600,
                max_therapist_wait_minutes=30,
                linked_delivery_obligation_id="ob-del-done",
            ),
        ],
        travel_info=travel,
    )
    res_tight = optimize_dispatch(req)
    assert res_tight.feasibility_status == "infeasible"
    assert "pickup_window_unreachable" in res_tight.unassigned_obligations[0].reasons

    # When driver becomes available at 610, reaches c1 at 624 (wait 24m <= 30m) -> feasible!
    req_ok = req.model_copy(
        update={
            "drivers": [
                req.drivers[0].model_copy(update={"available_from_minute": 610})
            ]
        }
    )
    res_ok = optimize_dispatch(req_ok)
    assert res_ok.feasibility_status == "feasible"
    assert res_ok.collection_coverage[0].coverage_status == "collection_only_covered"


def test_cond_1_final_appointment_with_approved_independent_departure_no_collection() -> None:
    """Req 7.1: Final appointment with approved independent departure generates no collection leg."""
    travel = _north_corridor_travel()
    req = OptimizeRequest(
        snapshot_id="cond-1-independent-departure",
        drivers=[
            DriverInput(
                driver_id="drv-1",
                start_location_id="branch",
                shift_start_minute=480,
                shift_end_minute=960,
                vehicle_capacity=3,
            )
        ],
        therapists=[
            TherapistInput(
                therapist_id="th-1",
                booking_id="bk-ind",
                pickup_location_id="branch",
                customer_location_id="c1",
                required_arrival_minute=540,
                estimated_service_end_minute=630,
                shift_window=TherapistScheduleWindow(shift_start_minute=480, shift_end_minute=630),
                is_final_appointment=True,
                return_arrangement=ReturnArrangement(
                    disposition="not_required",
                    independent_departure_approved=True,
                    approval_source="crm_supervisor",
                    approved_by="sup-1",
                ),
            )
        ],
        travel_info=travel,
    )
    res = optimize_dispatch(req)

    assert res.feasibility_status == "feasible"
    assert res.collection_plan_safe is True
    assert res.operational_commitment_allowed is True
    assert res.metrics.served_obligation_count == 1
    assert [a.leg_type for a in res.assignments] == ["delivery"]
    assert res.return_decisions[0].requirement == "not_required"
    assert res.return_decisions[0].approved_by == "sup-1"
    assert res.collection_coverage[0].coverage_status == "not_required_excluded"


def test_cond_2_final_appointment_without_departure_confirmation_remains_undecided() -> None:
    """Req 7.2: Shift-end / final appointment without approval remains unresolved (never inferred not_required)."""
    travel = _north_corridor_travel()
    req = OptimizeRequest(
        snapshot_id="cond-2-unconfirmed-final",
        drivers=[
            DriverInput(
                driver_id="drv-1",
                start_location_id="branch",
                shift_start_minute=480,
                shift_end_minute=960,
                vehicle_capacity=3,
            )
        ],
        therapists=[
            TherapistInput(
                therapist_id="th-1",
                booking_id="bk-unconf",
                pickup_location_id="branch",
                customer_location_id="c1",
                required_arrival_minute=540,
                estimated_service_end_minute=630,
                shift_window=TherapistScheduleWindow(shift_start_minute=480, shift_end_minute=630),
                is_final_appointment=True,
                return_arrangement=None,
            )
        ],
        travel_info=travel,
    )
    res = optimize_dispatch(req)

    assert res.collection_plan_safe is False
    assert res.operational_commitment_allowed is False
    assert res.metrics.collection_coverage_rate < 1.0
    assert len(res.unresolved_collection_requirements) == 1
    assert res.unresolved_collection_requirements[0].requirement == "undecided"
    assert res.unresolved_collection_requirements[0].reason_code == "final_appointment_departure_unconfirmed"
    assert res.collection_coverage[0].coverage_status == "unresolved_collection_undecided"


def test_cond_3_and_4_consecutive_home_services_direct_transfer_without_branch_return() -> None:
    """Req 7.3 & 7.4: Next booking requiring transport generates direct onward transfer c1 -> c2."""
    travel = _north_corridor_travel()
    req = OptimizeRequest(
        snapshot_id="cond-3-4-direct-transfer",
        drivers=[
            DriverInput(
                driver_id="drv-1",
                start_location_id="branch",
                shift_start_minute=480,
                shift_end_minute=960,
                vehicle_capacity=3,
            )
        ],
        therapists=[
            TherapistInput(
                therapist_id="th-1",
                booking_id="bk-seq-1",
                pickup_location_id="branch",
                customer_location_id="c1",
                required_arrival_minute=540,
                estimated_service_end_minute=600,
                shift_window=TherapistScheduleWindow(shift_start_minute=480, shift_end_minute=900),
                is_final_appointment=False,
                next_assignment=NextAssignmentInfo(
                    booking_id="bk-seq-2",
                    assignment_type="home_service",
                    location_id="c2",
                    required_arrival_minute=640,
                    requires_company_transport=True,
                ),
            )
        ],
        travel_info=travel,
    )
    res = optimize_dispatch(req)

    assert res.feasibility_status == "feasible"
    assert res.collection_plan_safe is True
    assert res.operational_commitment_allowed is True
    assert res.metrics.served_obligation_count == 2
    assert res.return_decisions[0].requirement == "required"
    assert res.return_decisions[0].destination_type == "next_customer"
    assert res.return_decisions[0].destination_location_id == "c2"

    # Direct transfer c1 -> c2 (5 min) without returning to branch (14 + 18 = 32 min!)
    route = res.routes[0]
    stop_locs = [s.location_id for s in route.stops]
    assert stop_locs == ["branch", "branch", "c1", "c1", "c2"]
    assert route.driving_minutes == 19.0  # 14 (branch->c1) + 5 (c1->c2)


def test_cond_5_shift_ended_but_collection_required_remains_mandatory() -> None:
    """Req 7.5: Therapist shift ends at service completion, yet required return remains mandatory."""
    travel = _north_corridor_travel()
    req = OptimizeRequest(
        snapshot_id="cond-5-shift-end-return-required",
        drivers=[
            DriverInput(
                driver_id="drv-evening",
                start_location_id="branch",
                shift_start_minute=480,
                shift_end_minute=1020,
                vehicle_capacity=2,
            )
        ],
        therapists=[
            TherapistInput(
                therapist_id="th-1",
                booking_id="bk-late-ret",
                pickup_location_id="branch",
                customer_location_id="c1",
                required_arrival_minute=540,
                estimated_service_end_minute=660,
                shift_window=TherapistScheduleWindow(shift_start_minute=480, shift_end_minute=660),
                is_final_appointment=True,
                return_arrangement=ReturnArrangement(
                    disposition="required",
                    return_to_branch_required=True,
                    approval_source="schedule_policy",
                    reason_code="kit_return_mandatory",
                ),
            )
        ],
        travel_info=travel,
    )
    res = optimize_dispatch(req)

    assert res.feasibility_status == "feasible"
    assert res.collection_plan_safe is True
    assert res.metrics.served_obligation_count == 2
    assert res.return_decisions[0].requirement == "required"
    col_assign = next(a for a in res.assignments if a.leg_type == "collection")
    assert col_assign.pickup_minute >= 660.0


def test_cond_6_mixed_delivery_scenario_only_necessary_collections_generated() -> None:
    """Req 7.6 & Section 5: Pooled delivery of 3 therapists with mixed onward/independent/branch return needs."""
    data = json.loads((FIXTURES_DIR / "mixed_conditional_collection.json").read_text(encoding="utf-8"))
    req = OptimizeRequest.model_validate(data)
    res = optimize_dispatch(req)

    assert res.feasibility_status == "feasible"
    assert res.constraint_violations == []
    assert res.collection_plan_safe is True
    assert res.operational_commitment_allowed is True
    assert res.metrics.collection_coverage_rate == 1.0
    # 3 deliveries + 2 collections (th-a onward to loc-cust-d, th-c return to branch; th-b excluded)
    assert res.metrics.served_obligation_count == 5

    decs = {d.therapist_id: d for d in res.return_decisions}
    assert decs["th-a"].requirement == "required"
    assert decs["th-a"].destination_location_id == "loc-cust-d"
    assert decs["th-b"].requirement == "not_required"
    assert decs["th-b"].collection_obligation_id is None
    assert decs["th-c"].requirement == "required"
    assert decs["th-c"].destination_location_id == "loc-branch"

    # Outbound driver pooled all 3 deliveries; th-b has no collection stop anywhere
    outbound = next(r for r in res.routes if r.driver_id == "drv-outbound")
    assert outbound.peak_occupancy == 3
    all_stop_therapists = [(s.therapist_id, s.leg_type) for r in res.routes for s in r.stops if s.therapist_id]
    assert ("th-b", "collection") not in all_stop_therapists


def test_cond_7_changed_to_not_required_only_reconsiders_unstarted_collections() -> None:
    """Req 7.7: Changing arrangement to not_required cancels unstarted collection but preserves confirmed/en_route commitment."""
    travel = _north_corridor_travel()
    req = OptimizeRequest(
        snapshot_id="cond-7-reconsider-unstarted-only",
        drivers=[
            DriverInput(
                driver_id="drv-1",
                start_location_id="branch",
                shift_start_minute=480,
                shift_end_minute=900,
                vehicle_capacity=3,
            )
        ],
        therapists=[
            TherapistInput(
                therapist_id="th-unstarted",
                booking_id="bk-u",
                pickup_location_id="branch",
                customer_location_id="c1",
                required_arrival_minute=540,
                estimated_service_end_minute=600,
                is_final_appointment=True,
                return_arrangement=ReturnArrangement(
                    disposition="not_required",
                    independent_departure_approved=True,
                    approval_source="crm_supervisor",
                ),
            ),
            TherapistInput(
                therapist_id="th-confirmed",
                booking_id="bk-c",
                pickup_location_id="branch",
                customer_location_id="c2",
                required_arrival_minute=540,
                estimated_service_end_minute=600,
                is_final_appointment=True,
                return_arrangement=ReturnArrangement(
                    disposition="not_required",
                    independent_departure_approved=True,
                    approval_source="crm_supervisor",
                ),
            ),
        ],
        transport_obligations=[
            TransportObligationInput(
                obligation_id="ob-col-unstarted",
                booking_id="bk-u",
                therapist_id="th-unstarted",
                leg_type="collection",
                pickup_location_id="c1",
                dropoff_location_id="branch",
                pickup_window=TimeWindow(earliest_minute=600, latest_minute=640),
                dropoff_window=TimeWindow(earliest_minute=614, latest_minute=700),
                operational_state="unstarted",
                is_locked=False,
            ),
            TransportObligationInput(
                obligation_id="ob-col-locked",
                booking_id="bk-c",
                therapist_id="th-confirmed",
                leg_type="collection",
                pickup_location_id="c2",
                dropoff_location_id="branch",
                pickup_window=TimeWindow(earliest_minute=600, latest_minute=640),
                dropoff_window=TimeWindow(earliest_minute=618, latest_minute=700),
                operational_state="en_route_pickup",
                is_locked=True,
                locked_driver_id="drv-1",
            ),
        ],
        travel_info=travel,
    )
    res = optimize_dispatch(req)

    assert res.feasibility_status == "feasible"
    served_ids = {a.obligation_id for a in res.assignments}
    assert "ob-col-unstarted" not in served_ids
    assert "ob-col-locked" in served_ids
    decs = {d.therapist_id: d for d in res.return_decisions}
    assert decs["th-unstarted"].requirement == "not_required"
    assert decs["th-confirmed"].requirement == "required"
    assert decs["th-confirmed"].confirmed_collection_commitment is True


def test_cond_8_additional_booking_added_after_initial_planning_recalculates_collection() -> None:
    """Req 7.8: Adding a subsequent booking updates transport plan from 1 leg to 2 legs."""
    travel = _north_corridor_travel()
    initial_req = OptimizeRequest(
        snapshot_id="cond-8-step1",
        drivers=[
            DriverInput(
                driver_id="drv-1",
                start_location_id="branch",
                shift_start_minute=480,
                shift_end_minute=900,
                vehicle_capacity=3,
            )
        ],
        therapists=[
            TherapistInput(
                therapist_id="th-1",
                booking_id="bk-1",
                pickup_location_id="branch",
                customer_location_id="c1",
                required_arrival_minute=540,
                estimated_service_end_minute=600,
                is_final_appointment=True,
                return_arrangement=ReturnArrangement(
                    disposition="not_required",
                    independent_departure_approved=True,
                ),
            )
        ],
        travel_info=travel,
    )
    res1 = optimize_dispatch(initial_req)
    assert res1.metrics.served_obligation_count == 1

    # Additional booking arrives for th-1 at c3!
    updated_req = initial_req.model_copy(
        update={
            "snapshot_id": "cond-8-step2",
            "therapists": [
                initial_req.therapists[0].model_copy(
                    update={
                        "is_final_appointment": False,
                        "return_arrangement": None,
                        "next_assignment": NextAssignmentInfo(
                            booking_id="bk-2",
                            assignment_type="home_service",
                            location_id="c3",
                            required_arrival_minute=635,
                            requires_company_transport=True,
                        ),
                    }
                )
            ],
        }
    )
    res2 = optimize_dispatch(updated_req)
    assert res2.feasibility_status == "feasible"
    assert res2.metrics.served_obligation_count == 2
    assert res2.return_decisions[0].requirement == "required"
    assert res2.return_decisions[0].destination_location_id == "c3"


def test_cond_9_driver_shift_conflict_picks_other_driver_or_flags_conflict() -> None:
    """Req 7.9: Required onward collection switches to eligible shift driver or blocks unretrievable delivery."""
    travel = _north_corridor_travel()
    # Part A: Driver 1 shift ends 610 (cannot collect at 630), Driver 2 shift 600..900 covers collection!
    req_covered = OptimizeRequest(
        snapshot_id="cond-9a-other-driver",
        drivers=[
            DriverInput(
                driver_id="drv-1",
                start_location_id="branch",
                shift_start_minute=480,
                shift_end_minute=610,
                vehicle_capacity=2,
            ),
            DriverInput(
                driver_id="drv-2",
                start_location_id="branch",
                shift_start_minute=600,
                shift_end_minute=900,
                vehicle_capacity=2,
            ),
        ],
        therapists=[
            TherapistInput(
                therapist_id="th-1",
                booking_id="bk-shift",
                pickup_location_id="branch",
                customer_location_id="c1",
                required_arrival_minute=540,
                estimated_service_end_minute=630,
                is_final_appointment=True,
                return_arrangement=ReturnArrangement(
                    disposition="required",
                    return_to_branch_required=True,
                ),
            )
        ],
        travel_info=travel,
    )
    res_cov = optimize_dispatch(req_covered)
    assert res_cov.feasibility_status == "feasible"
    assert res_cov.collection_plan_safe is True
    by_leg = {a.leg_type: a.driver_id for a in res_cov.assignments}
    assert by_leg == {"delivery": "drv-1", "collection": "drv-2"}

    # Part B: Remove drv-2 -> collection cannot fit in drv-1's shift -> delivery blocked & conflict reported!
    req_conflict = req_covered.model_copy(update={"drivers": [req_covered.drivers[0]]})
    res_conf = optimize_dispatch(req_conflict)
    assert res_conf.feasibility_status == "infeasible"
    assert res_conf.collection_plan_safe is False
    assert any(
        "collection_coverage_conflict" in u.reasons
        for u in res_conf.unassigned_obligations
        if u.leg_type == "delivery"
    )


def test_cond_11_missing_or_conflicting_scheduling_data_never_declares_collection_safe() -> None:
    """Req 7.11: Missing or conflicting schedule/approval data flags unresolved requirement and blocks safety flag."""
    travel = _north_corridor_travel()
    req_conflict = OptimizeRequest(
        snapshot_id="cond-11-conflicting-data",
        drivers=[
            DriverInput(
                driver_id="drv-1",
                start_location_id="branch",
                shift_start_minute=480,
                shift_end_minute=900,
                vehicle_capacity=2,
            )
        ],
        therapists=[
            TherapistInput(
                therapist_id="th-conflict",
                booking_id="bk-conf",
                pickup_location_id="branch",
                customer_location_id="c1",
                required_arrival_minute=540,
                estimated_service_end_minute=600,
                return_arrangement=ReturnArrangement(
                    independent_departure_approved=True,
                    return_to_branch_required=True,
                ),
            ),
            TherapistInput(
                therapist_id="th-missing",
                booking_id="bk-miss",
                pickup_location_id="branch",
                customer_location_id="c2",
                required_arrival_minute=550,
                estimated_service_end_minute=610,
            ),
        ],
        travel_info=travel,
    )
    res = optimize_dispatch(req_conflict)

    assert res.collection_plan_safe is False
    assert res.operational_commitment_allowed is False
    assert res.metrics.collection_coverage_rate == 0.0
    assert len(res.unresolved_collection_requirements) == 2
    reason_codes = {u.reason_code for u in res.unresolved_collection_requirements}
    assert reason_codes == {"conflicting_return_and_independent_approval", "missing_scheduling_context"}

    # Strict mode with allow_delivery_when_collection_undecided=False also withholds deliveries
    req_strict = req_conflict.model_copy(
        update={"config": OptimizationConfig(allow_delivery_when_collection_undecided=False)}
    )
    res_strict = optimize_dispatch(req_strict)
    assert res_strict.feasibility_status == "infeasible"
    assert res_strict.metrics.served_obligation_count == 0
    assert all("undecided_collection_requirement" in u.reasons for u in res_strict.unassigned_obligations)


def test_reg_p0_coupled_collection_infeasible_resets_assignment_without_crash() -> None:
    """P0 Regression: Pass 2 leaving 0 routed obligations resets stale Pass 1 Assignment cleanly."""
    travel = TravelInfo(
        locations=[
            LocationNode(location_id="branch", label="Branch", lat=10.6765, lng=122.9509, location_type="branch"),
            LocationNode(location_id="c1", label="Cust 1", lat=10.7010, lng=122.9610),
        ],
        travel_time_minutes=[[0, 20], [20, 0]],
        travel_distance_km=[[0.0, 8.0], [8.0, 0.0]],
    )
    req = OptimizeRequest(
        snapshot_id="reg-p0-pass2-empty",
        drivers=[
            DriverInput(
                driver_id="drv-1",
                start_location_id="branch",
                shift_start_minute=480,
                shift_end_minute=600,
                vehicle_capacity=2,
            )
        ],
        transport_obligations=[
            TransportObligationInput(
                obligation_id="ob-del",
                booking_id="bk-1",
                therapist_id="th-1",
                leg_type="delivery",
                pickup_location_id="branch",
                dropoff_location_id="c1",
                pickup_window=TimeWindow(earliest_minute=480, latest_minute=520),
                dropoff_window=TimeWindow(earliest_minute=500, latest_minute=540),
            ),
            TransportObligationInput(
                obligation_id="ob-col",
                booking_id="bk-1",
                therapist_id="th-1",
                leg_type="collection",
                pickup_location_id="c1",
                dropoff_location_id="branch",
                pickup_window=TimeWindow(earliest_minute=560, latest_minute=590),
                dropoff_window=TimeWindow(earliest_minute=580, latest_minute=600),
                linked_delivery_obligation_id="ob-del",
                estimated_service_duration_minutes=80,
                require_collection_coverage=True,
            ),
        ],
        travel_info=travel,
    )
    res = optimize_dispatch(req)

    assert res.feasibility_status == "infeasible"
    assert res.all_obligations_served is False
    assert res.metrics.served_obligation_count == 0
    assert res.assignments == []
    unassigned_by_id = {u.obligation_id: u for u in res.unassigned_obligations}
    assert "collection_coverage_conflict" in unassigned_by_id["ob-del"].reasons


def test_reg_p1_collection_withheld_when_unstarted_delivery_infeasible() -> None:
    """P1 Regression: Unstarted collection must not run when its prerequisite unstarted delivery fails."""
    travel = TravelInfo(
        locations=[
            LocationNode(location_id="branch", label="Branch", lat=10.6765, lng=122.9509, location_type="branch"),
            LocationNode(location_id="c1", label="Cust 1", lat=10.7010, lng=122.9610),
        ],
        travel_time_minutes=[[0, 30], [30, 0]],
        travel_distance_km=[[0.0, 10.0], [10.0, 0.0]],
    )
    for req_cov in (True, False):
        req = OptimizeRequest(
            snapshot_id=f"reg-p1-col-without-del-{req_cov}",
            drivers=[
                DriverInput(
                    driver_id="drv-1",
                    start_location_id="branch",
                    shift_start_minute=480,
                    shift_end_minute=800,
                    vehicle_capacity=2,
                )
            ],
            transport_obligations=[
                TransportObligationInput(
                    obligation_id="ob-del",
                    booking_id="bk-1",
                    therapist_id="th-1",
                    leg_type="delivery",
                    pickup_location_id="branch",
                    dropoff_location_id="c1",
                    pickup_window=TimeWindow(earliest_minute=480, latest_minute=490),
                    dropoff_window=TimeWindow(earliest_minute=480, latest_minute=500),
                    operational_state="unstarted",
                ),
                TransportObligationInput(
                    obligation_id="ob-col",
                    booking_id="bk-1",
                    therapist_id="th-1",
                    leg_type="collection",
                    pickup_location_id="c1",
                    dropoff_location_id="branch",
                    pickup_window=TimeWindow(earliest_minute=600, latest_minute=640),
                    dropoff_window=TimeWindow(earliest_minute=630, latest_minute=700),
                    linked_delivery_obligation_id="ob-del",
                    estimated_service_duration_minutes=60,
                    require_collection_coverage=req_cov,
                    operational_state="unstarted",
                ),
            ],
            travel_info=travel,
        )
        res = optimize_dispatch(req)

        assert res.feasibility_status == "infeasible"
        assert res.assignments == []
        assert res.metrics.served_obligation_count == 0
        unassigned_by_id = {u.obligation_id: u for u in res.unassigned_obligations}
        assert "appointment_unreachable" in unassigned_by_id["ob-del"].reasons
        assert "linked_delivery_infeasible" in unassigned_by_id["ob-col"].reasons


def test_reg_p1_mixed_explicit_obligations_and_therapist_retains_delivery() -> None:
    """P1 Regression: Therapist added only in therapists[] alongside explicit obligations keeps outbound delivery."""
    travel = _north_corridor_travel()
    req = OptimizeRequest(
        snapshot_id="reg-p1-mixed-inputs",
        drivers=[
            DriverInput(
                driver_id="drv-1",
                start_location_id="branch",
                shift_start_minute=480,
                shift_end_minute=960,
                vehicle_capacity=3,
            )
        ],
        therapists=[
            TherapistInput(
                therapist_id="th-1",
                booking_id="bk-1",
                pickup_location_id="branch",
                customer_location_id="c1",
                required_arrival_minute=540,
                estimated_service_end_minute=600,
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
                is_final_appointment=True,
                return_arrangement=ReturnArrangement(
                    disposition="required",
                    return_to_branch_required=True,
                ),
            ),
        ],
        transport_obligations=[
            TransportObligationInput(
                obligation_id="ob-1-del",
                booking_id="bk-1",
                therapist_id="th-1",
                leg_type="delivery",
                pickup_location_id="branch",
                dropoff_location_id="c1",
                pickup_window=TimeWindow(earliest_minute=490, latest_minute=530),
                dropoff_window=TimeWindow(earliest_minute=500, latest_minute=540),
            )
        ],
        travel_info=travel,
    )
    res = optimize_dispatch(req)

    assert res.feasibility_status == "feasible"
    assert res.collection_plan_safe is True
    served_ids = {a.obligation_id for a in res.assignments}
    assert served_ids == {"ob-1-del", "bk-2:th-2:delivery", "bk-2:th-2:collection"}


def test_reg_p1_contradictory_not_required_with_approval_false_is_undecided() -> None:
    """P1 Regression: disposition='not_required' with independent_departure_approved=False resolves to undecided."""
    travel = _north_corridor_travel()
    req = OptimizeRequest(
        snapshot_id="reg-p1-conflicting-approval",
        drivers=[
            DriverInput(
                driver_id="drv-1",
                start_location_id="branch",
                shift_start_minute=480,
                shift_end_minute=960,
                vehicle_capacity=2,
            )
        ],
        therapists=[
            TherapistInput(
                therapist_id="th-1",
                booking_id="bk-1",
                pickup_location_id="branch",
                customer_location_id="c1",
                required_arrival_minute=540,
                estimated_service_end_minute=600,
                is_final_appointment=True,
                return_arrangement=ReturnArrangement(
                    disposition="not_required",
                    independent_departure_approved=False,
                ),
            )
        ],
        travel_info=travel,
    )
    res = optimize_dispatch(req)

    assert res.collection_plan_safe is False
    assert res.operational_commitment_allowed is False
    assert len(res.unresolved_collection_requirements) == 1
    dec = res.unresolved_collection_requirements[0]
    assert dec.requirement == "undecided"
    assert dec.reason_code == "conflicting_disposition_and_independent_approval"



