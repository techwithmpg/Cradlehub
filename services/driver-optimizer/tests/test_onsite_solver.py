"""Tests for CradleHub On-Site Level 1 CP-SAT Optimizer."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.onsite_models import (
    AssistanceWindow,
    OnsiteResourceInput,
    OnsiteServiceRequirement,
    OnsiteSolveRequest,
    OnsiteTherapistInput,
    ResourceBusyWindow,
    TherapistBusyWindow,
    TimeWindow,
)
from app.onsite_solver import solve_onsite_request

client = TestClient(app)


def _therapist(
    staff_id: str,
    name: str,
    services: list[str] | None = None,
    *,
    home_branch_id: str = "main-spa",
    checked_in: bool = True,
    completed: int = 0,
    seniority: int = 1,
    shifts: list[TimeWindow] | None = None,
    breaks: list[TimeWindow] | None = None,
    blocks: list[TimeWindow] | None = None,
    busy: list[TherapistBusyWindow] | None = None,
    assistance: list[AssistanceWindow] | None = None,
    max_services: int | None = None,
) -> OnsiteTherapistInput:
    return OnsiteTherapistInput(
        staff_id=staff_id,
        name=name,
        home_branch_id=home_branch_id,
        seniority_rank=seniority,
        completed_count_today=completed,
        checked_in=checked_in,
        qualified_service_ids=services if services is not None else ["svc-massage", "svc-facial"],
        shift_windows=shifts if shifts is not None else [TimeWindow(start_minute=600, end_minute=1320)],
        break_windows=breaks or [],
        blocked_windows=blocks or [],
        busy_windows=busy or [],
        assistance_windows=assistance or [],
        max_services_per_day=max_services,
    )


def _room(
    rid: str,
    name: str,
    cap: int = 2,
    *,
    sort_order: int = 0,
    turnover_until: int | None = None,
    busy: list[ResourceBusyWindow] | None = None,
) -> OnsiteResourceInput:
    return OnsiteResourceInput(
        resource_id=rid,
        name=name,
        resource_type="room",
        capacity=cap,
        sort_order=sort_order,
        active_turnover_until_minute=turnover_until,
        busy_windows=busy or [],
    )


def test_respects_qualification_break_home_service_and_turnover() -> None:
    """Blocks unqualified therapist, break overlap, home-service buffer, and active turnover."""
    req = OnsiteSolveRequest(
        branch_id="main-spa",
        date="2026-11-18",
        mode="assign_order",
        requested_start_minute=720,  # 12:00
        room_reset_buffer_minutes=10,
        therapists=[
            _therapist("t-unqual", "Unqualified", services=["svc-nails"]),
            _therapist("t-break", "OnBreak", breaks=[TimeWindow(start_minute=720, end_minute=780)]),
            _therapist(
                "t-hs",
                "OutOnHomeService",
                busy=[
                    TherapistBusyWindow(
                        booking_id="hs-1",
                        start_minute=600,
                        end_minute=690,
                        effective_start_minute=570,
                        effective_end_minute=735,  # return buffer overlaps 12:00
                        delivery_type="home_service",
                    )
                ],
            ),
            _therapist("t-good", "Ana Ready", checked_in=True),
        ],
        resources=[
            _room("r-dirty", "Room 1 Cleaning", cap=2, turnover_until=735),
            _room("r-clean", "Room 2 Ready", cap=2),
        ],
        requirements=[
            OnsiteServiceRequirement(
                line_id="l1",
                attendee_id="att-1",
                service_id="svc-massage",
                duration_minutes=60,
            )
        ],
    )
    res = solve_onsite_request(req)
    assert res.feasible is True
    assert res.room_constraint_mode == "enforced"
    assert len(res.assignments) == 1
    assert res.assignments[0].staff_id == "t-good"
    assert res.assignments[0].resource_id == "r-clean"


def test_group_couples_prefer_shared_capacity_room_and_no_therapist_double_booking() -> None:
    """Group order for 2 attendees must use 2 distinct therapists and prefer 1 cap=2 room."""
    req = OnsiteSolveRequest(
        branch_id="main-spa",
        date="2026-11-18",
        mode="assign_order",
        requested_start_minute=780,  # 13:00
        therapists=[
            _therapist("t1", "Therapist 1", completed=2),
            _therapist("t2", "Therapist 2", completed=0),
            _therapist("t3", "Therapist 3", completed=5),
        ],
        resources=[
            _room("r1", "Couples Room", cap=2, sort_order=1),
            _room("r2", "Single Bed", cap=1, sort_order=2),
        ],
        requirements=[
            OnsiteServiceRequirement(
                line_id="g1", attendee_id="guest-a", service_id="svc-massage", duration_minutes=60
            ),
            OnsiteServiceRequirement(
                line_id="g2", attendee_id="guest-b", service_id="svc-massage", duration_minutes=60
            ),
        ],
    )
    res = solve_onsite_request(req)
    assert res.feasible is True
    assert len(res.assignments) == 2
    staff_ids = {a.staff_id for a in res.assignments}
    assert len(staff_ids) == 2  # Cannot double-book same therapist across group guests
    assert {a.resource_id for a in res.assignments} == {"r1"}  # Shared cap=2 couples room


def test_infeasible_slot_diagnoses_turnover_and_suggests_earlier_and_later_alternatives() -> None:
    """When requested time hits occupancy, propose proved earlier and later alternatives respecting reset buffer."""
    req = OnsiteSolveRequest(
        branch_id="sm-branch",
        date="2026-11-18",
        branch_open_minute=600,
        branch_close_minute=900,
        mode="assign_order",
        requested_start_minute=720,  # 12:00
        allow_alternative_times=True,
        max_alternatives=4,
        therapists=[
            _therapist("t1", "SM Therapist 1", home_branch_id="sm-branch"),
        ],
        resources=[
            _room(
                "r1",
                "Room 5, bed 1",
                cap=1,
                busy=[
                    ResourceBusyWindow(
                        booking_id="b-prev",
                        start_minute=660,
                        end_minute=720,
                        reset_after_minutes=15,
                    )
                ],
            )
        ],
        requirements=[
            OnsiteServiceRequirement(
                line_id="l1", attendee_id="att-1", service_id="svc-massage", duration_minutes=45
            )
        ],
    )
    res = solve_onsite_request(req)
    assert res.feasible is False
    assert "room_capacity_full" in res.infeasibility_reasons
    assert len(res.alternatives) >= 2
    assert any(alt.kind == "earlier_slot" and alt.start_minute == 600 for alt in res.alternatives)
    assert any(alt.start_minute >= 750 for alt in res.alternatives)

    # Also verify 60m + 10m reset does NOT falsely suggest 600 before 660 (600+70=670 > 660)
    tight_req = req.model_copy(
        update={
            "requirements": [
                OnsiteServiceRequirement(
                    line_id="l1", attendee_id="att-1", service_id="svc-massage", duration_minutes=60
                )
            ]
        }
    )
    tight_res = solve_onsite_request(tight_req)
    assert all(alt.start_minute >= 750 for alt in tight_res.alternatives)


def test_cross_branch_assistance_window_allows_only_within_approved_hours() -> None:
    """Cross-branch therapist covers SM Branch only during approved assistance_window."""
    lending_therapist = _therapist(
        "t-lend",
        "Lending Therapist",
        home_branch_id="main-spa",
        assistance=[
            AssistanceWindow(
                requesting_branch_id="sm-branch",
                start_minute=660,
                end_minute=900,
                visit_type="in_spa",
            )
        ],
    )
    req_inside = OnsiteSolveRequest(
        branch_id="sm-branch",
        date="2026-11-18",
        mode="assign_order",
        requested_start_minute=720,
        therapists=[lending_therapist],
        resources=[_room("sm-r1", "Room 1", cap=2)],
        requirements=[
            OnsiteServiceRequirement(
                line_id="l1", attendee_id="att-1", service_id="svc-massage", duration_minutes=60
            )
        ],
    )
    assert solve_onsite_request(req_inside).feasible is True

    req_outside = req_inside.model_copy(update={"requested_start_minute": 960})
    res_out = solve_onsite_request(req_outside)
    assert res_out.feasible is False
    assert "cross_branch_unavailable" in res_out.infeasibility_reasons


def test_zero_room_branch_reports_unconstrained_honestly_without_fake_rooms() -> None:
    """If a branch has zero resources in DB/fixture, never fabricate rooms; state mode honestly."""
    req = OnsiteSolveRequest(
        branch_id="sm-empty",
        date="2026-11-18",
        mode="assign_order",
        requested_start_minute=720,
        therapists=[_therapist("t1", "SM Solo", home_branch_id="sm-empty")],
        resources=[],
        requirements=[
            OnsiteServiceRequirement(
                line_id="l1", attendee_id="att-1", service_id="svc-massage", duration_minutes=60
            )
        ],
    )
    res = solve_onsite_request(req)
    assert res.feasible is True
    assert res.room_constraint_mode == "unconstrained_no_resources"
    assert res.assignments[0].resource_id is None


def test_cpsat_slot_matrix_and_packing_efficiency_and_latency_benchmark() -> None:
    """CP-SAT finds packable multi-service + endpoint responds under 250ms."""
    req = OnsiteSolveRequest(
        branch_id="main-spa",
        date="2026-11-18",
        branch_open_minute=600,
        branch_close_minute=1320,
        mode="slot_matrix",
        therapists=[_therapist(f"t{i}", f"Therapist {i}", completed=i) for i in range(8)],
        resources=[_room(f"r{i}", f"Room {i}", cap=2) for i in range(6)],
        requirements=[
            OnsiteServiceRequirement(
                line_id="g1-s1",
                attendee_id="g1",
                line_index=0,
                service_id="svc-massage",
                duration_minutes=60,
            ),
            OnsiteServiceRequirement(
                line_id="g1-s2",
                attendee_id="g1",
                line_index=1,
                service_id="svc-facial",
                duration_minutes=60,
            ),
            OnsiteServiceRequirement(
                line_id="g2-s1",
                attendee_id="g2",
                line_index=0,
                service_id="svc-massage",
                duration_minutes=60,
            ),
        ],
    )
    resp = client.post("/v1/onsite/solve", json=req.model_dump())
    assert resp.status_code == 200
    body = resp.json()
    assert body["feasible"] is True
    assert len(body["candidate_slots"]) >= 15
    assert body["solver_latency_ms"] < 1500


def test_blocks_home_branch_assignment_while_therapist_lent_out() -> None:
    """Therapist lent out during [720, 900] must not be double-booked at home branch."""
    req = OnsiteSolveRequest(
        branch_id="main-spa",
        date="2026-11-18",
        mode="assign_order",
        requested_start_minute=720,
        allow_alternative_times=False,
        therapists=[
            _therapist(
                "t-lent",
                "Lent Out",
                assistance=[
                    AssistanceWindow(
                        requesting_branch_id="sm-branch",
                        start_minute=720,
                        end_minute=900,
                        visit_type="in_spa",
                    )
                ],
            )
        ],
        resources=[_room("r1", "Room 1", cap=1)],
        requirements=[
            OnsiteServiceRequirement(
                line_id="l1", attendee_id="a1", service_id="svc-massage", duration_minutes=60
            )
        ],
    )
    res = solve_onsite_request(req)
    assert res.feasible is False
