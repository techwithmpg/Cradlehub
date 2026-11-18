"""Tests for CradleHub Unified Shared Timeline, Dynamic Buffers & 10-Case Predictive Conflicts."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.onsite_models import OnsiteResourceInput, OnsiteTherapistInput, TimeWindow
from app.unified_engine import evaluate_unified_operations
from app.unified_models import (
    CrossBranchAssistanceInput,
    RoomTurnoverTaskInput,
    UnifiedBookingInput,
    UnifiedDriverInput,
    UnifiedEvaluateRequest,
    UnifiedRulesInput,
)

client = TestClient(app)


def test_detects_all_major_cross_mode_room_driver_gps_and_rule_conflicts() -> None:
    """Exercises shared timeline across home-service + on-site + turnover + GPS + rule drift."""
    shift = [TimeWindow(start_minute=600, end_minute=1320)]
    req = UnifiedEvaluateRequest(
        branch_id="main-spa",
        branch_name="Main Spa",
        date="2026-11-18",
        now_minute=700,  # 11:40
        source_snapshot_version="snap-test-v1",
        rules=UnifiedRulesInput(
            travel_buffer_minutes=30,
            scheduling_home_buffer_minutes=60,  # Deliberate live rule drift check
            room_reset_buffer_minutes=10,
        ),
        therapists=[
            OnsiteTherapistInput(
                staff_id="t1",
                name="Therapist One",
                home_branch_id="main-spa",
                qualified_service_ids=["svc-massage"],
                shift_windows=shift,
                checked_in=True,
                completed_count_today=2,
            ),
            OnsiteTherapistInput(
                staff_id="t2",
                name="Therapist Two Backup",
                home_branch_id="main-spa",
                qualified_service_ids=["svc-massage"],
                shift_windows=shift,
                checked_in=True,
                completed_count_today=0,
            ),
            OnsiteTherapistInput(
                staff_id="t3",
                name="Therapist Three Lend",
                home_branch_id="main-spa",
                qualified_service_ids=["svc-massage"],
                shift_windows=shift,
                checked_in=True,
            ),
        ],
        drivers=[
            UnifiedDriverInput(
                driver_id="d1",
                name="Driver One",
                home_branch_id="main-spa",
                shift_windows=shift,
                checked_in=True,
                gps_age_seconds=1200,  # Stale GPS (20 min > 15 min)
                gps_accuracy_meters=45.0,
            ),
            UnifiedDriverInput(
                driver_id="d2",
                name="Driver Two",
                home_branch_id="main-spa",
                shift_windows=shift,
                checked_in=True,
            ),
        ],
        resources=[
            OnsiteResourceInput(resource_id="r1", name="Room 1", capacity=1, sort_order=1),
            OnsiteResourceInput(resource_id="r2", name="Room 2", capacity=2, sort_order=2),
        ],
        room_turnovers=[
            RoomTurnoverTaskInput(
                task_id="turn-1",
                resource_id="r1",
                resource_name="Room 1",
                status="in_progress",
                started_minute=690,
                expected_ready_minute=735,  # Dirty until 12:15
            )
        ],
        assistance_requests=[
            CrossBranchAssistanceInput(
                request_id="assist-1",
                requesting_branch_id="sm-branch",
                lending_branch_id="main-spa",
                status="approved_pending_arrival",
                visit_type="in_spa",
                start_minute=780,
                end_minute=960,
                selected_staff_ids=["t3"],
            )
        ],
        bookings=[
            # 1. t1 does Home Service ending at 12:00 + dynamic buffer -> collides with 12:15 on-site
            UnifiedBookingInput(
                booking_id="b-hs-1",
                customer_name="Home Guest",
                service_id="svc-massage",
                delivery_type="home_service",
                status="in_progress",
                tracking_status="in_route",
                therapist_id="t1",
                driver_id="d1",
                start_minute=660,
                end_minute=720,
                live_eta_minutes=20.0,
                has_valid_customer_location=True,
            ),
            # 2. t1 also assigned to 12:15 in-spa in Room 1 (which ALSO has turnover until 12:15 -> 12:10 starts earlier!)
            UnifiedBookingInput(
                booking_id="b-in-2",
                customer_name="Spa Guest 2",
                service_id="svc-massage",
                delivery_type="in_spa",
                status="confirmed",
                therapist_id="t1",
                resource_id="r1",
                start_minute=725,  # 12:05 (hits HS return buffer AND Room 1 turnover!)
                end_minute=785,
                therapist_selection_source="auto_assigned",
            ),
            # 3. Unassigned driver on imminent Home Service
            UnifiedBookingInput(
                booking_id="b-hs-unassigned",
                customer_name="Missing Pin & Driver Guest",
                service_id="svc-massage",
                delivery_type="home_service",
                status="confirmed",
                therapist_id="t3",  # Also collides with assist-1!
                driver_id=None,
                start_minute=810,  # 13:30
                end_minute=870,
                has_valid_customer_location=False,
            ),
            # 4. Afternoon booking eligible for quiet earlier-slot suggestion
            UnifiedBookingInput(
                booking_id="b-late",
                customer_name="Afternoon Guest",
                service_id="svc-massage",
                delivery_type="in_spa",
                status="confirmed",
                therapist_id="t2",
                resource_id="r2",
                start_minute=1020,  # 17:00
                end_minute=1080,
            ),
        ],
    )

    resp = client.post("/v1/unified/evaluate", json=req.model_dump())
    assert resp.status_code == 200
    data = resp.json()

    issue_types = {item["issue_type"] for item in data["conflicts_and_opportunities"]}
    assert "home_service_to_onsite_collision" in issue_types
    assert "room_turnover_collision" in issue_types
    assert "driver_unassigned_risk" in issue_types
    assert "location_or_gps_degraded" in issue_types
    assert "rule_drift_or_cross_branch_gap" in issue_types
    assert "earlier_slot_opportunity" in issue_types

    # Verify structured contract completeness on every emitted conflict
    for conflict in data["conflicts_and_opportunities"]:
        assert conflict["branch_id"] == "main-spa"
        assert conflict["source_snapshot_version"] == "snap-test-v1"
        assert conflict["dedupe_key"].startswith("uoe:main-spa:")
        assert conflict["latest_useful_action_time"]
        assert conflict["expiration_or_resolution_condition"]

    # Ensure home_service_to_onsite_collision recommends verified backup therapist t2 (and NOT t1)
    hs_collision = next(
        c
        for c in data["conflicts_and_opportunities"]
        if c["issue_type"] == "home_service_to_onsite_collision"
    )
    assert any(
        act["action_type"] == "swap_therapist"
        and act["proposed_staff_id"] == "t2"
        and act["verified_feasible"] is True
        for act in hs_collision["recommended_actions"]
    )
    # Earlier opportunity must be quiet tier
    earlier = next(
        c
        for c in data["conflicts_and_opportunities"]
        if c["issue_type"] == "earlier_slot_opportunity"
    )
    assert earlier["assistant_tier"] == "quiet_opportunity"
    assert earlier["severity"] == "info"


def test_detects_remaining_predictive_scenarios_and_measures_latency_and_capacity() -> None:
    """Covers onsite->HS collision, driver ripple, room bottleneck, active overrun, unassigned therapist."""
    shift = [TimeWindow(start_minute=600, end_minute=1320)]
    req = UnifiedEvaluateRequest(
        branch_id="sm-branch",
        branch_name="SM Branch",
        date="2026-11-18",
        now_minute=720,  # 12:00
        source_snapshot_version="snap-test-v2",
        rules=UnifiedRulesInput(travel_buffer_minutes=30, room_reset_buffer_minutes=10),
        therapists=[
            OnsiteTherapistInput(
                staff_id="ta",
                name="Therapist Alpha",
                home_branch_id="sm-branch",
                qualified_service_ids=["svc-massage"],
                shift_windows=shift,
                checked_in=True,
                completed_count_today=1,
            ),
            OnsiteTherapistInput(
                staff_id="tb",
                name="Therapist Beta Backup",
                home_branch_id="sm-branch",
                qualified_service_ids=["svc-massage"],
                shift_windows=shift,
                checked_in=True,
                completed_count_today=0,
            ),
        ],
        drivers=[
            UnifiedDriverInput(
                driver_id="da",
                name="Driver A",
                home_branch_id="sm-branch",
                shift_windows=shift,
                checked_in=True,
            ),
            UnifiedDriverInput(
                driver_id="db",
                name="Driver B Free",
                home_branch_id="sm-branch",
                shift_windows=shift,
                checked_in=True,
            ),
        ],
        resources=[
            OnsiteResourceInput(resource_id="r-cap1", name="Room 5, bed 1", capacity=1, sort_order=1),
            OnsiteResourceInput(resource_id="r-free", name="Room 1", capacity=2, sort_order=2),
        ],
        bookings=[
            # Active overrun in progress since 10:45, due 11:45 (15 min overdue at 12:00!) + double-booked cap=1 room
            UnifiedBookingInput(
                booking_id="b-overrun",
                customer_name="Running Session Guest",
                service_id="svc-massage",
                delivery_type="in_spa",
                status="in_progress",
                booking_progress_status="service_started",
                therapist_id="ta",
                resource_id="r-cap1",
                start_minute=645,
                end_minute=705,
                session_started_minute=645,
                session_due_minute=705,
            ),
            # Double-booked in r-cap1 AND ta has HS starting at 12:20 -> onsite_to_home_service_collision
            UnifiedBookingInput(
                booking_id="b-hs-tight",
                customer_name="Tight HS Guest",
                service_id="svc-massage",
                delivery_type="home_service",
                status="confirmed",
                therapist_id="ta",
                driver_id="da",
                start_minute=740,
                end_minute=800,
                distance_km=6.5,
            ),
            # Driver ripple on da: second home-service overlaps da's trip window on b-hs-tight
            UnifiedBookingInput(
                booking_id="b-hs-ripple",
                customer_name="Downstream HS Guest",
                service_id="svc-massage",
                delivery_type="home_service",
                status="confirmed",
                therapist_id="tb",
                driver_id="da",
                start_minute=760,
                end_minute=820,
            ),
            # Room capacity overflow on r-cap1 + unassigned therapist
            UnifiedBookingInput(
                booking_id="b-room-unassigned",
                customer_name="Waiting Room & Staff Guest",
                service_id="svc-massage",
                delivery_type="in_spa",
                status="confirmed",
                therapist_id=None,
                resource_id="r-cap1",
                start_minute=720,  # 12:00: overlaps b-overrun's overrun + reset until 12:15
                end_minute=780,
            ),
        ],
    )

    resp = evaluate_unified_operations(req)
    issues = {c.issue_type: c for c in resp.conflicts_and_opportunities}
    assert "onsite_to_home_service_collision" in issues
    assert "session_overrun_ripple" in issues
    assert "driver_route_ripple" in issues
    assert "room_capacity_bottleneck" in issues
    assert "therapist_unassigned_risk" in issues

    assert any(
        act.proposed_driver_id == "db" and act.verified_feasible
        for act in issues["driver_route_ripple"].recommended_actions
    )
    assert any(
        act.proposed_resource_id == "r-free" and act.verified_feasible
        for act in issues["room_capacity_bottleneck"].recommended_actions
    )
    assert resp.evaluator_latency_ms < 500

