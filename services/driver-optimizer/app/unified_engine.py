"""Unified Shared Timeline, Dynamic Buffers, and Predictive Conflict Evaluator."""

from __future__ import annotations

import math
import time
from collections import defaultdict

from app.onsite_models import (
    OnsiteResourceInput,
    OnsiteServiceRequirement,
    OnsiteSolveRequest,
    OnsiteTherapistInput,
    ResourceBusyWindow,
    TherapistBusyWindow,
)
from app.onsite_solver import solve_onsite_request
from app.unified_models import (
    DataQualityAssessment,
    DynamicBufferDetail,
    PredictiveConflictItem,
    RecommendedStaffAction,
    SharedTimelineSpan,
    TherapistTimelineSummary,
    UnifiedBookingInput,
    UnifiedEvaluateRequest,
    UnifiedEvaluateResponse,
)

GPS_STALE_SECONDS = 15 * 60
GPS_MAX_ACCURACY_METERS = 100.0
MIN_SAFETY_HOME_BUFFER_MINUTES = 15
DEFAULT_HOME_TRAVEL_FALLBACK_MINUTES = 30
IMMINENT_UNASSIGNED_HORIZON_MINUTES = 180


def _fmt_min(minute: int) -> str:
    m = max(0, int(round(minute)))
    hh = (m // 60) % 24
    mm = m % 60
    return f"{hh:02d}:{mm:02d}"


def _overlaps(a0: int, a1: int, b0: int, b1: int) -> bool:
    return a0 < b1 and a1 > b0


def _active_booking_end_minute(booking: UnifiedBookingInput, now_minute: int) -> int:
    if booking.projected_end_minute is not None:
        return max(booking.end_minute, booking.projected_end_minute)
    is_running = (
        booking.status == "in_progress"
        or booking.booking_progress_status == "service_started"
        or booking.tracking_status == "service_started"
    )
    due = booking.session_due_minute or booking.end_minute
    if is_running and now_minute > due:
        # Active overdue session projects at least +5 min remaining cleanup/finish margin
        return now_minute + 5
    return max(booking.end_minute, due)


def compute_dynamic_transition_buffer(
    booking: UnifiedBookingInput,
    configured_rule_buffer_minutes: int,
) -> DynamicBufferDetail:
    """Compute conservative dynamic pre/post transition buffer for a booking."""
    floor = max(
        MIN_SAFETY_HOME_BUFFER_MINUTES,
        booking.travel_buffer_minutes or configured_rule_buffer_minutes,
    )
    if booking.delivery_type == "in_spa":
        return DynamicBufferDetail(
            booking_id=booking.booking_id,
            pre_buffer_minutes=booking.buffer_before_minutes,
            post_buffer_minutes=booking.buffer_after_minutes,
            buffer_source="branch_rule_fallback",
            configured_rule_buffer_minutes=configured_rule_buffer_minutes,
            note="On-site service buffer derives from service prep/cleanup windows.",
        )

    wrapped = ((booking.start_minute % 1440) + 1440) % 1440
    is_peak = (690 <= wrapped <= 810) or (990 <= wrapped <= 1200)
    multiplier = 1.25 if is_peak else 1.15

    if booking.live_eta_minutes is not None:
        padded = math.ceil(booking.live_eta_minutes * multiplier)
        pre = max(floor, padded + 10)
        post = (
            max(floor, padded + 5)
            if booking.collection_decision != "not_required"
            else 5
        )
        return DynamicBufferDetail(
            booking_id=booking.booking_id,
            pre_buffer_minutes=pre,
            post_buffer_minutes=post,
            buffer_source="live_traffic",
            configured_rule_buffer_minutes=configured_rule_buffer_minutes,
            note=(
                f"Traffic ETA {booking.live_eta_minutes:.0f}m × {multiplier:.2f} safety margin "
                f"(pre {pre}m, return/post {post}m)."
            ),
        )

    if booking.distance_km is not None:
        # Peak/off-peak urban Bacolod conservative speed aligned with TS dynamic-buffer.ts
        min_per_km = 3.2 if is_peak else 2.6
        est_drive = math.ceil(booking.distance_km * min_per_km) + 12
        pre = max(floor, est_drive + 5)
        post = (
            max(floor, est_drive)
            if booking.collection_decision != "not_required"
            else 5
        )
        return DynamicBufferDetail(
            booking_id=booking.booking_id,
            pre_buffer_minutes=pre,
            post_buffer_minutes=post,
            buffer_source="distance_fallback",
            configured_rule_buffer_minutes=configured_rule_buffer_minutes,
            note=(
                f"Distance fallback ({booking.distance_km:.1f} km) conservative buffer "
                f"(pre {pre}m, post {post}m)."
            ),
        )

    pre = max(floor, DEFAULT_HOME_TRAVEL_FALLBACK_MINUTES)
    post = pre if booking.collection_decision != "not_required" else 10
    return DynamicBufferDetail(
        booking_id=booking.booking_id,
        pre_buffer_minutes=pre,
        post_buffer_minutes=post,
        buffer_source="branch_rule_fallback",
        configured_rule_buffer_minutes=configured_rule_buffer_minutes,
        note="Rule-based conservative travel buffer used (distance/ETA unavailable).",
    )


def _tier_for_severity(
    severity: str,
    lead_minutes: int,
    has_action: bool = True,
) -> str:
    if severity == "info":
        return "quiet_opportunity"
    if severity in ("critical", "high") or (lead_minutes <= 30 and has_action):
        return "persistent_action_required"
    return "early_warning_toast"


def _find_verified_replacement_therapists(
    target_booking: UnifiedBookingInput,
    target_start: int,
    target_end: int,
    request: UnifiedEvaluateRequest,
    therapist_timelines: dict[str, list[SharedTimelineSpan]],
    exclude_current_therapist: bool = True,
    room_busy_map: dict[str, list[ResourceBusyWindow]] | None = None,
    turnover_ready_map: dict[str, int] | None = None,
) -> list[tuple[OnsiteTherapistInput, OnsiteResourceInput | None]]:
    """Return feasible (therapist, resource) pairs verified against live timeline."""
    candidates: list[tuple[OnsiteTherapistInput, OnsiteResourceInput | None]] = []
    current_room_blocked = False
    if target_booking.resource_id and target_start == target_booking.start_minute:
        t_until = turnover_ready_map.get(target_booking.resource_id) if turnover_ready_map else None
        if t_until is not None and target_start < t_until:
            current_room_blocked = True

    req_line = OnsiteServiceRequirement(
        line_id=target_booking.booking_id,
        attendee_id="att-1",
        line_index=0,
        service_id=target_booking.service_id,
        service_name=target_booking.service_name,
        duration_minutes=max(15, target_end - target_start),
        buffer_before_minutes=target_booking.buffer_before_minutes,
        buffer_after_minutes=target_booking.buffer_after_minutes,
        requires_room=target_booking.delivery_type == "in_spa"
        and target_booking.requires_room,
        locked_resource_id=(
            target_booking.resource_id
            if target_start == target_booking.start_minute and not current_room_blocked
            else None
        ),
    )

    for therapist in sorted(
        request.therapists,
        key=lambda t: (
            0 if t.staff_id == target_booking.therapist_id else 1,
            0 if t.checked_in else 1,
            t.completed_count_today,
            t.seniority_rank,
        ),
    ):
        if exclude_current_therapist and therapist.staff_id == target_booking.therapist_id:
            continue
        busy_wins = [
            TherapistBusyWindow(
                booking_id=sp.booking_id,
                start_minute=sp.start_minute,
                end_minute=sp.end_minute,
                effective_start_minute=sp.effective_start_minute,
                effective_end_minute=sp.effective_end_minute,
                delivery_type=sp.delivery_type,
                resource_id=sp.resource_id,
                is_active_session=sp.is_active_session,
            )
            for sp in therapist_timelines.get(therapist.staff_id, [])
            if sp.booking_id != target_booking.booking_id
        ]
        probe_therapist = therapist.model_copy(
            update={"busy_windows": busy_wins}
        )
        # Keep existing resources unless target already holds its own room (when home_service not needed)
        probe_resources: list[OnsiteResourceInput] = []
        if target_booking.delivery_type == "in_spa":
            for r in request.resources:
                combined_busy = list(r.busy_windows)
                if room_busy_map and r.resource_id in room_busy_map:
                    seen_ids = {bw.booking_id for bw in combined_busy}
                    for rb in room_busy_map[r.resource_id]:
                        if rb.booking_id not in seen_ids:
                            combined_busy.append(rb)
                filtered_busy = [
                    bw for bw in combined_busy if bw.booking_id != target_booking.booking_id
                ]
                turnover_until = (
                    max(
                        r.active_turnover_until_minute or 0,
                        turnover_ready_map.get(r.resource_id, 0)
                        if turnover_ready_map
                        else 0,
                    )
                    or None
                )
                probe_resources.append(
                    r.model_copy(
                        update={
                            "busy_windows": filtered_busy,
                            "active_turnover_until_minute": turnover_until,
                        }
                    )
                )

        solve_req = OnsiteSolveRequest(
            branch_id=request.branch_id,
            date=request.date,
            branch_open_minute=min(request.rules.in_spa_open_minute, target_start),
            branch_close_minute=max(request.rules.in_spa_close_minute, target_end + 30),
            room_reset_buffer_minutes=request.rules.room_reset_buffer_minutes,
            mode="assign_order",
            requested_start_minute=target_start,
            allow_alternative_times=False,
            allow_earlier_opportunities=False,
            max_alternatives=0,
            enforce_room_capacity=target_booking.delivery_type == "in_spa"
            and len(probe_resources) > 0,
            therapists=[probe_therapist],
            resources=probe_resources,
            requirements=[req_line.model_copy(update={"locked_staff_id": therapist.staff_id})],
        )
        res = solve_onsite_request(solve_req)
        if res.feasible and res.assignments:
            chosen_res_id = res.assignments[0].resource_id
            chosen_res = next(
                (r for r in request.resources if r.resource_id == chosen_res_id),
                None,
            )
            candidates.append((therapist, chosen_res))
            if len(candidates) >= 2:
                break
    return candidates


def _find_verified_replacement_room(
    target_booking: UnifiedBookingInput,
    request: UnifiedEvaluateRequest,
    room_busy_map: dict[str, list[ResourceBusyWindow]],
    turnover_ready_map: dict[str, int],
) -> OnsiteResourceInput | None:
    if target_booking.delivery_type != "in_spa" or not target_booking.requires_room:
        return None
    reset = request.rules.room_reset_buffer_minutes
    b_start = target_booking.start_minute
    b_end = _active_booking_end_minute(target_booking, request.now_minute) + reset

    for res in sorted(request.resources, key=lambda r: (r.sort_order, r.name)):
        if not res.is_active or res.resource_id == target_booking.resource_id:
            continue
        if res.allowed_service_ids and target_booking.service_id not in res.allowed_service_ids:
            continue
        turnover_until = turnover_ready_map.get(res.resource_id)
        if turnover_until is not None and b_start < turnover_until:
            continue
        other_busy = [
            bw
            for bw in room_busy_map.get(res.resource_id, [])
            if bw.booking_id != target_booking.booking_id
        ]
        peak_occ = sum(
            1
            for bw in other_busy
            if _overlaps(b_start, b_end, bw.start_minute, bw.end_minute + bw.reset_after_minutes)
        )
        if peak_occ < res.capacity:
            return res
    return None


def _find_verified_replacement_driver(
    target_booking: UnifiedBookingInput,
    request: UnifiedEvaluateRequest,
    driver_spans: dict[str, list[tuple[str, int, int]]],
    exclude_driver_id: str | None = None,
) -> tuple[str, str] | None:
    w_start = max(0, target_booking.start_minute - (target_booking.travel_buffer_minutes or 30))
    w_end = _active_booking_end_minute(target_booking, request.now_minute) + 15
    for drv in sorted(
        request.drivers,
        key=lambda d: (0 if d.checked_in else 1, len(driver_spans.get(d.driver_id, []))),
    ):
        if drv.driver_id == exclude_driver_id:
            continue
        if (
            drv.home_branch_id != request.branch_id
            and request.branch_id not in drv.allowed_branch_ids
        ):
            continue
        in_shift = any(
            w_start >= sw.start_minute and w_end <= sw.end_minute
            for sw in drv.shift_windows
        ) if drv.shift_windows else False
        if not in_shift:
            continue
        overlaps = any(
            _overlaps(w_start, w_end, s0, s1)
            for bid, s0, s1 in driver_spans.get(drv.driver_id, [])
            if bid != target_booking.booking_id
        )
        if not overlaps:
            return drv.driver_id, drv.name
    return None


def evaluate_unified_operations(
    request: UnifiedEvaluateRequest,
) -> UnifiedEvaluateResponse:
    """Evaluate unified shared timeline, dynamic buffers, predictive conflicts & opportunities."""
    t0 = time.perf_counter()
    active_bookings = [
        b
        for b in request.bookings
        if b.status not in ("cancelled", "rejected", "no_show", "completed")
    ]
    configured_rule = (
        request.rules.scheduling_home_buffer_minutes
        if request.rules.scheduling_home_buffer_minutes is not None
        else request.rules.travel_buffer_minutes
    )

    # 1. Dynamic transition buffers per booking
    buffers: list[DynamicBufferDetail] = []
    buffer_by_booking: dict[str, DynamicBufferDetail] = {}
    for b in active_bookings:
        buf = compute_dynamic_transition_buffer(b, configured_rule)
        buffers.append(buf)
        buffer_by_booking[b.booking_id] = buf

    # 2. Shared therapist timelines + room occupancy + driver occupancy
    therapist_spans: dict[str, list[SharedTimelineSpan]] = defaultdict(list)
    driver_spans: dict[str, list[tuple[str, int, int]]] = defaultdict(list)
    room_busy_map: dict[str, list[ResourceBusyWindow]] = defaultdict(list)
    turnover_ready_map: dict[str, int] = {}

    for task in request.room_turnovers:
        if task.status in ("open", "in_progress"):
            prev = turnover_ready_map.get(task.resource_id, 0)
            turnover_ready_map[task.resource_id] = max(prev, task.expected_ready_minute)

    for b in active_bookings:
        buf = buffer_by_booking[b.booking_id]
        eff_end_core = _active_booking_end_minute(b, request.now_minute)
        eff_start = max(0, b.start_minute - buf.pre_buffer_minutes)
        eff_end = eff_end_core + buf.post_buffer_minutes
        is_running = (
            b.status == "in_progress"
            or b.booking_progress_status == "service_started"
            or b.tracking_status == "service_started"
        )
        span = SharedTimelineSpan(
            booking_id=b.booking_id,
            delivery_type=b.delivery_type,
            customer_name=b.customer_name,
            service_name=b.service_name,
            start_minute=b.start_minute,
            end_minute=eff_end_core,
            effective_start_minute=eff_start,
            effective_end_minute=eff_end,
            resource_id=b.resource_id,
            driver_id=b.driver_id,
            is_active_session=is_running,
        )
        if b.therapist_id:
            therapist_spans[b.therapist_id].append(span)
        if b.driver_id and b.delivery_type == "home_service":
            driver_spans[b.driver_id].append((b.booking_id, eff_start, eff_end))
        if b.collection_driver_id and b.collection_driver_id != b.driver_id:
            driver_spans[b.collection_driver_id].append(
                (b.booking_id, eff_end_core, eff_end)
            )
        if b.resource_id and b.delivery_type == "in_spa":
            room_busy_map[b.resource_id].append(
                ResourceBusyWindow(
                    booking_id=b.booking_id,
                    start_minute=b.start_minute,
                    end_minute=eff_end_core,
                    reset_after_minutes=request.rules.room_reset_buffer_minutes,
                )
            )

    for tid in therapist_spans:
        therapist_spans[tid].sort(key=lambda s: (s.start_minute, s.booking_id))

    therapist_map = {t.staff_id: t for t in request.therapists}
    booking_map = {b.booking_id: b for b in active_bookings}
    resource_map = {r.resource_id: r for r in request.resources}

    timeline_summaries = [
        TherapistTimelineSummary(
            staff_id=t.staff_id,
            staff_name=t.name,
            home_branch_id=t.home_branch_id,
            checked_in=t.checked_in,
            scheduled_minutes_today=sum(
                sw.end_minute - sw.start_minute for sw in t.shift_windows
            ),
            booked_minutes_today=sum(
                sp.end_minute - sp.start_minute
                for sp in therapist_spans.get(t.staff_id, [])
            ),
            spans=therapist_spans.get(t.staff_id, []),
        )
        for t in request.therapists
    ]

    conflicts: list[PredictiveConflictItem] = []

    def _emit_conflict(item: PredictiveConflictItem) -> None:
        if not any(c.dedupe_key == item.dedupe_key for c in conflicts):
            conflicts.append(item)

    # ---- Detector 1 & 2 & 6: Cross-mode collisions + Active session overrun ripples ----
    for tid, spans in therapist_spans.items():
        therapist = therapist_map.get(tid)
        t_name = therapist.name if therapist else "Therapist"
        for idx in range(len(spans) - 1):
            curr = spans[idx]
            nxt = spans[idx + 1]
            curr_b = booking_map[curr.booking_id]
            nxt_b = booking_map[nxt.booking_id]
            curr_buf = buffer_by_booking[curr.booking_id]
            nxt_buf = buffer_by_booking[nxt.booking_id]

            needed_end = curr.end_minute + curr_buf.post_buffer_minutes
            nxt_effective_start = nxt.start_minute - nxt_buf.pre_buffer_minutes

            if needed_end <= nxt_effective_start:
                continue

            overlap_mins = needed_end - nxt_effective_start
            if curr.delivery_type == "home_service" and nxt.delivery_type == "in_spa":
                issue_type = "home_service_to_onsite_collision"
                impact = (
                    f"{t_name} finishes Home Service ({curr.customer_name}) at "
                    f"{_fmt_min(curr.end_minute)} plus {curr_buf.post_buffer_minutes}m return "
                    f"({overlap_mins}m overlap with in-spa {nxt.customer_name} at {_fmt_min(nxt.start_minute)})."
                )
            elif curr.delivery_type == "in_spa" and nxt.delivery_type == "home_service":
                issue_type = "onsite_to_home_service_collision"
                impact = (
                    f"{t_name}'s on-site service ({curr.customer_name}) ends {_fmt_min(curr.end_minute)}, "
                    f"leaving insufficient pre-travel window for Home Service {nxt.customer_name} at {_fmt_min(nxt.start_minute)} "
                    f"({overlap_mins}m shortfall)."
                )
            elif curr.is_active_session:
                issue_type = "session_overrun_ripple"
                impact = (
                    f"{t_name}'s active session ({curr.customer_name}) projects finish at "
                    f"{_fmt_min(curr.end_minute)}, colliding by {overlap_mins}m with "
                    f"{nxt.customer_name} at {_fmt_min(nxt.start_minute)}."
                )
            else:
                issue_type = "session_overrun_ripple"
                impact = (
                    f"{t_name} has overlapping appointments ({curr.customer_name} -> "
                    f"{nxt.customer_name}) colliding by {overlap_mins}m."
                )

            latest_min = max(request.now_minute, min(curr.end_minute, nxt.start_minute) - 15)
            lead = latest_min - request.now_minute
            sev = "critical" if overlap_mins >= 20 or lead <= 15 else "high"
            replacements = _find_verified_replacement_therapists(
                nxt_b,
                nxt.start_minute,
                nxt.end_minute,
                request,
                therapist_spans,
                room_busy_map=room_busy_map,
                turnover_ready_map=turnover_ready_map,
            )
            actions: list[RecommendedStaffAction] = []
            cust_selected = nxt_b.therapist_selection_source == "customer_selected"
            for rep_t, rep_r in replacements:
                actions.append(
                    RecommendedStaffAction(
                        action_id=f"swap-therapist:{nxt_b.booking_id}:{rep_t.staff_id}",
                        action_type="swap_therapist",
                        label=f"Move {nxt.customer_name} ({_fmt_min(nxt.start_minute)}) to {rep_t.name}",
                        detail=(
                            f"{rep_t.name} is verified free & qualified at {_fmt_min(nxt.start_minute)}"
                            + (f" in {rep_r.name}." if rep_r else ".")
                            + (
                                " Guest requested original therapist; confirm approval first."
                                if cust_selected
                                else ""
                            )
                        ),
                        target_booking_id=nxt_b.booking_id,
                        proposed_staff_id=rep_t.staff_id,
                        proposed_staff_name=rep_t.name,
                        proposed_resource_id=rep_r.resource_id if rep_r else nxt_b.resource_id,
                        proposed_resource_name=rep_r.name if rep_r else None,
                        requires_customer_approval=cust_selected,
                        verified_feasible=True,
                    )
                )

            dq = DataQualityAssessment(
                status="high" if curr_buf.buffer_source == "live_traffic" else "medium",
                score=0.92 if curr_buf.buffer_source == "live_traffic" else 0.78,
                notes=[curr_buf.note, nxt_buf.note],
            )

            _emit_conflict(
                PredictiveConflictItem(
                    issue_type=issue_type,  # type: ignore[arg-type]
                    branch_id=request.branch_id,
                    affected_booking_ids=[curr.booking_id, nxt.booking_id],
                    affected_staff_ids=[tid],
                    affected_resource_ids=[
                        r for r in (curr.resource_id, nxt.resource_id) if r
                    ],
                    severity=sev,  # type: ignore[arg-type]
                    confidence_or_data_quality=dq,
                    predicted_impact=impact,
                    latest_useful_action_time=_fmt_min(latest_min),
                    latest_useful_action_minute=latest_min,
                    recommended_actions=actions,
                    authorization_required=(
                        "customer_confirmation" if cust_selected else "crm_operator"
                    ),
                    source_snapshot_version=request.source_snapshot_version,
                    dedupe_key=f"uoe:{request.branch_id}:{issue_type}:{curr.booking_id}:{nxt.booking_id}",
                    expiration_or_resolution_condition=(
                        f"Resolves when {nxt.booking_id} is reassigned/rescheduled or {curr.booking_id} clears."
                    ),
                    assistant_tier=_tier_for_severity(sev, lead, bool(actions)),  # type: ignore[arg-type]
                )
            )

        # Also catch active overdue session ending soon with ANY booking (even if gap <= 10m)
        for sp in spans:
            if not sp.is_active_session:
                continue
            b = booking_map[sp.booking_id]
            due = b.session_due_minute or b.end_minute
            if request.now_minute > due:
                overrun_mins = request.now_minute - due
                _emit_conflict(
                    PredictiveConflictItem(
                        issue_type="session_overrun_ripple",
                        branch_id=request.branch_id,
                        affected_booking_ids=[b.booking_id],
                        affected_staff_ids=[tid],
                        affected_resource_ids=[b.resource_id] if b.resource_id else [],
                        severity="warning" if overrun_mins < 10 else "high",
                        confidence_or_data_quality=DataQualityAssessment(
                            status="high",
                            score=0.95,
                            notes=[f"Session past due by {overrun_mins}m at {_fmt_min(due)}."],
                        ),
                        predicted_impact=(
                            f"{t_name}'s active service for {b.customer_name} is {overrun_mins}m past due "
                            f"(due {_fmt_min(due)}), tying up therapist/room capacity."
                        ),
                        latest_useful_action_time=_fmt_min(request.now_minute),
                        latest_useful_action_minute=request.now_minute,
                        recommended_actions=[],
                        authorization_required="crm_operator",
                        source_snapshot_version=request.source_snapshot_version,
                        dedupe_key=f"uoe:{request.branch_id}:active_overrun:{b.booking_id}",
                        expiration_or_resolution_condition=f"Resolves when {b.booking_id} completes or extends.",
                        assistant_tier=_tier_for_severity(
                            "high" if overrun_mins >= 10 else "warning", 0, False
                        ),  # type: ignore[arg-type]
                    )
                )

    # ---- Detector 3: Driver route cascades ----
    for did, dsp in driver_spans.items():
        ordered = sorted(dsp, key=lambda x: (x[1], x[0]))
        driver = next((d for d in request.drivers if d.driver_id == did), None)
        d_name = driver.name if driver else "Driver"
        for idx in range(len(ordered) - 1):
            b1_id, _s1, e1 = ordered[idx]
            b2_id, s2, _e2 = ordered[idx + 1]
            if e1 <= s2:
                continue
            b2 = booking_map[b2_id]
            alt_drv = _find_verified_replacement_driver(
                b2, request, driver_spans, exclude_driver_id=did
            )
            actions = []
            if alt_drv:
                actions.append(
                    RecommendedStaffAction(
                        action_id=f"assign-driver:{b2_id}:{alt_drv[0]}",
                        action_type="assign_driver",
                        label=f"Assign {alt_drv[1]} to {b2.customer_name} ({_fmt_min(b2.start_minute)})",
                        detail=f"Prevents {e1 - s2}m ripple delay from {d_name}'s previous route leg.",
                        target_booking_id=b2_id,
                        proposed_driver_id=alt_drv[0],
                        proposed_driver_name=alt_drv[1],
                        verified_feasible=True,
                    )
                )
            lead = max(0, s2 - request.now_minute)
            _emit_conflict(
                PredictiveConflictItem(
                    issue_type="driver_route_ripple",
                    branch_id=request.branch_id,
                    affected_booking_ids=[b1_id, b2_id],
                    affected_staff_ids=[did],
                    affected_resource_ids=[],
                    severity="high" if e1 - s2 >= 15 else "warning",
                    confidence_or_data_quality=DataQualityAssessment(
                        status="high",
                        score=0.88,
                        notes=["Route timeline overlap calculated with transition buffer."],
                    ),
                    predicted_impact=(
                        f"Driver {d_name} projects finish/return at {_fmt_min(e1)}, delaying "
                        f"{b2.customer_name}'s leg starting {_fmt_min(s2)} by {e1 - s2}m."
                    ),
                    latest_useful_action_time=_fmt_min(max(request.now_minute, s2 - 15)),
                    latest_useful_action_minute=max(request.now_minute, s2 - 15),
                    recommended_actions=actions,
                    authorization_required="crm_operator",
                    source_snapshot_version=request.source_snapshot_version,
                    dedupe_key=f"uoe:{request.branch_id}:driver_ripple:{b1_id}:{b2_id}",
                    expiration_or_resolution_condition=f"Resolves when {b2_id} driver/timing is adjusted.",
                    assistant_tier=_tier_for_severity("high", lead, bool(actions)),  # type: ignore[arg-type]
                )
            )

    # ---- Detector 4 & 5: Room capacity bottlenecks + Room turnover collisions ----
    for b in active_bookings:
        if b.delivery_type != "in_spa" or not b.requires_room:
            continue
        if b.resource_id is None and len(request.resources) > 0:
            # Unassigned in-spa booking: check whether ANY room is available
            free_room = _find_verified_replacement_room(
                b, request, room_busy_map, turnover_ready_map
            )
            actions = []
            if free_room:
                actions.append(
                    RecommendedStaffAction(
                        action_id=f"assign-room:{b.booking_id}:{free_room.resource_id}",
                        action_type="assign_room",
                        label=f"Assign {free_room.name} to {b.customer_name}",
                        detail=f"{free_room.name} is clean and has available capacity at {_fmt_min(b.start_minute)}.",
                        target_booking_id=b.booking_id,
                        proposed_resource_id=free_room.resource_id,
                        proposed_resource_name=free_room.name,
                        verified_feasible=True,
                    )
                )
            lead = max(0, b.start_minute - request.now_minute)
            sev = "high" if lead <= 90 or not free_room else "warning"
            _emit_conflict(
                PredictiveConflictItem(
                    issue_type="room_capacity_bottleneck",
                    branch_id=request.branch_id,
                    affected_booking_ids=[b.booking_id],
                    affected_staff_ids=[b.therapist_id] if b.therapist_id else [],
                    affected_resource_ids=[],
                    severity=sev,  # type: ignore[arg-type]
                    confidence_or_data_quality=DataQualityAssessment(
                        status="high", score=0.95, notes=["Authoritative room inventory check."]
                    ),
                    predicted_impact=(
                        f"{b.customer_name} ({_fmt_min(b.start_minute)}) has no treatment room assigned"
                        + (" and no room currently fits this window." if not free_room else ".")
                    ),
                    latest_useful_action_time=_fmt_min(max(request.now_minute, b.start_minute - 10)),
                    latest_useful_action_minute=max(request.now_minute, b.start_minute - 10),
                    recommended_actions=actions,
                    authorization_required="crm_operator",
                    source_snapshot_version=request.source_snapshot_version,
                    dedupe_key=f"uoe:{request.branch_id}:missing_room:{b.booking_id}",
                    expiration_or_resolution_condition=f"Resolves once a room is assigned to {b.booking_id}.",
                    assistant_tier=_tier_for_severity(sev, lead, bool(actions)),  # type: ignore[arg-type]
                )
            )
        elif b.resource_id is not None:
            res = resource_map.get(b.resource_id)
            if not res:
                continue
            turnover_until = turnover_ready_map.get(b.resource_id)
            if turnover_until is not None and b.start_minute < turnover_until:
                alt_room = _find_verified_replacement_room(
                    b, request, room_busy_map, turnover_ready_map
                )
                actions = []
                if alt_room:
                    actions.append(
                        RecommendedStaffAction(
                            action_id=f"move-room:{b.booking_id}:{alt_room.resource_id}",
                            action_type="reassign_room",
                            label=f"Move {b.customer_name} to ready room {alt_room.name}",
                            detail=f"{res.name} cleaning runs until {_fmt_min(turnover_until)}; {alt_room.name} is ready.",
                            target_booking_id=b.booking_id,
                            proposed_resource_id=alt_room.resource_id,
                            proposed_resource_name=alt_room.name,
                            verified_feasible=True,
                        )
                    )
                actions.append(
                    RecommendedStaffAction(
                        action_id=f"priority-turnover:{res.resource_id}",
                        action_type="prioritize_room_turnover",
                        label=f"Expedite cleaning for {res.name}",
                        detail=f"Guest {b.customer_name} starts at {_fmt_min(b.start_minute)}.",
                        target_booking_id=b.booking_id,
                        proposed_resource_id=res.resource_id,
                        proposed_resource_name=res.name,
                        verified_feasible=True,
                    )
                )
                lead = max(0, b.start_minute - request.now_minute)
                _emit_conflict(
                    PredictiveConflictItem(
                        issue_type="room_turnover_collision",
                        branch_id=request.branch_id,
                        affected_booking_ids=[b.booking_id],
                        affected_staff_ids=[b.therapist_id] if b.therapist_id else [],
                        affected_resource_ids=[res.resource_id],
                        severity="high",
                        confidence_or_data_quality=DataQualityAssessment(
                            status="high", score=0.93, notes=["Active workflow room_turnover task checked."]
                        ),
                        predicted_impact=(
                            f"{res.name} has an active room turnover until {_fmt_min(turnover_until)}, "
                            f"overlapping {b.customer_name} starting at {_fmt_min(b.start_minute)}."
                        ),
                        latest_useful_action_time=_fmt_min(max(request.now_minute, b.start_minute - 5)),
                        latest_useful_action_minute=max(request.now_minute, b.start_minute - 5),
                        recommended_actions=actions,
                        authorization_required="crm_operator",
                        source_snapshot_version=request.source_snapshot_version,
                        dedupe_key=f"uoe:{request.branch_id}:turnover:{res.resource_id}:{b.booking_id}",
                        expiration_or_resolution_condition="Resolves when turnover completes or room is switched.",
                        assistant_tier=_tier_for_severity("high", lead, True),  # type: ignore[arg-type]
                    )
                )

    # Check exact point-in-time room capacity + reset buffer violations per room
    for rid, busy_list in room_busy_map.items():
        res = resource_map.get(rid)
        if not res or not busy_list:
            continue
        sorted_b = sorted(busy_list, key=lambda x: (x.start_minute, x.booking_id))
        reset = (
            res.reset_buffer_minutes
            if res.reset_buffer_minutes is not None
            else request.rules.room_reset_buffer_minutes
        )
        check_pts = sorted({b.start_minute for b in sorted_b})
        for pt in check_pts:
            active_at_pt = [
                bw
                for bw in sorted_b
                if bw.start_minute <= pt < bw.end_minute
            ]
            # Also detect sequential gap < reset buffer on exclusive/single-bed or full occupancy
            overlapping_with_reset = [
                bw
                for bw in sorted_b
                if bw.start_minute <= pt < (bw.end_minute + reset)
            ]
            colliding = active_at_pt if len(active_at_pt) > res.capacity else (
                overlapping_with_reset if len(overlapping_with_reset) > res.capacity else []
            )
            if not colliding:
                continue
            affected = [x.booking_id for x in colliding]
            nxt_b = booking_map[colliding[-1].booking_id]
            alt_room = _find_verified_replacement_room(
                nxt_b, request, room_busy_map, turnover_ready_map
            )
            actions = []
            if alt_room:
                actions.append(
                    RecommendedStaffAction(
                        action_id=f"move-room:{nxt_b.booking_id}:{alt_room.resource_id}",
                        action_type="reassign_room",
                        label=f"Move {nxt_b.customer_name} to {alt_room.name}",
                        detail=f"Relieves {res.name} capacity/reset collision.",
                        target_booking_id=nxt_b.booking_id,
                        proposed_resource_id=alt_room.resource_id,
                        proposed_resource_name=alt_room.name,
                        verified_feasible=True,
                    )
                )
            cur = colliding[0]
            _emit_conflict(
                PredictiveConflictItem(
                    issue_type="room_capacity_bottleneck",
                    branch_id=request.branch_id,
                    affected_booking_ids=affected,
                    affected_staff_ids=[],
                    affected_resource_ids=[rid],
                    severity="critical" if len(active_at_pt) > res.capacity else "high",
                    confidence_or_data_quality=DataQualityAssessment(
                        status="high", score=0.96, notes=["Exceeds branch_resources.capacity or reset buffer."]
                    ),
                    predicted_impact=(
                        f"{res.name} (capacity {res.capacity}) has {len(colliding)} overlapping "
                        f"allocations around {_fmt_min(cur.start_minute)}."
                    ),
                    latest_useful_action_time=_fmt_min(max(request.now_minute, cur.start_minute - 10)),
                    latest_useful_action_minute=max(request.now_minute, cur.start_minute - 10),
                    recommended_actions=actions,
                    authorization_required="crm_operator",
                    source_snapshot_version=request.source_snapshot_version,
                    dedupe_key=f"uoe:{request.branch_id}:room_cap:{rid}:{'_'.join(sorted(affected))}",
                    expiration_or_resolution_condition="Resolves when room capacity no longer exceeds limit.",
                    assistant_tier="persistent_action_required",
                )
            )

    # ---- Detector 7: Unassigned Therapist or Driver within horizon ----
    for b in active_bookings:
        lead = b.start_minute - request.now_minute
        if lead < -30 or lead > IMMINENT_UNASSIGNED_HORIZON_MINUTES:
            continue
        if not b.therapist_id:
            reps = _find_verified_replacement_therapists(
                b,
                b.start_minute,
                b.end_minute,
                request,
                therapist_spans,
                room_busy_map=room_busy_map,
                turnover_ready_map=turnover_ready_map,
            )
            actions = [
                RecommendedStaffAction(
                    action_id=f"assign-therapist:{b.booking_id}:{t.staff_id}",
                    action_type="assign_therapist",
                    label=f"Assign therapist {t.name}",
                    detail=f"{t.name} is available & qualified at {_fmt_min(b.start_minute)}.",
                    target_booking_id=b.booking_id,
                    proposed_staff_id=t.staff_id,
                    proposed_staff_name=t.name,
                    proposed_resource_id=r.resource_id if r else None,
                    proposed_resource_name=r.name if r else None,
                    verified_feasible=True,
                )
                for t, r in reps
            ]
            sev = "critical" if lead <= 45 else "high"
            _emit_conflict(
                PredictiveConflictItem(
                    issue_type="therapist_unassigned_risk",
                    branch_id=request.branch_id,
                    affected_booking_ids=[b.booking_id],
                    affected_staff_ids=[],
                    affected_resource_ids=[b.resource_id] if b.resource_id else [],
                    severity=sev,  # type: ignore[arg-type]
                    confidence_or_data_quality=DataQualityAssessment(
                        status="high", score=0.98, notes=["Confirmed/pending booking missing therapist."]
                    ),
                    predicted_impact=(
                        f"{b.customer_name} ({_fmt_min(b.start_minute)}) has no therapist assigned."
                    ),
                    latest_useful_action_time=_fmt_min(max(request.now_minute, b.start_minute - 15)),
                    latest_useful_action_minute=max(request.now_minute, b.start_minute - 15),
                    recommended_actions=actions,
                    authorization_required="crm_operator",
                    source_snapshot_version=request.source_snapshot_version,
                    dedupe_key=f"uoe:{request.branch_id}:unassigned_therapist:{b.booking_id}",
                    expiration_or_resolution_condition=f"Resolves when therapist is assigned to {b.booking_id}.",
                    assistant_tier="persistent_action_required",
                )
            )

        if b.delivery_type == "home_service" and not b.driver_id:
            drv = _find_verified_replacement_driver(b, request, driver_spans)
            actions = []
            if drv:
                actions.append(
                    RecommendedStaffAction(
                        action_id=f"assign-driver:{b.booking_id}:{drv[0]}",
                        action_type="assign_driver",
                        label=f"Assign driver {drv[1]}",
                        detail=f"{drv[1]} is on shift and free for {_fmt_min(b.start_minute)} dispatch.",
                        target_booking_id=b.booking_id,
                        proposed_driver_id=drv[0],
                        proposed_driver_name=drv[1],
                        verified_feasible=True,
                    )
                )
            sev = "critical" if lead <= 60 else "high"
            _emit_conflict(
                PredictiveConflictItem(
                    issue_type="driver_unassigned_risk",
                    branch_id=request.branch_id,
                    affected_booking_ids=[b.booking_id],
                    affected_staff_ids=[b.therapist_id] if b.therapist_id else [],
                    affected_resource_ids=[],
                    severity=sev,  # type: ignore[arg-type]
                    confidence_or_data_quality=DataQualityAssessment(
                        status="high", score=0.98, notes=["Home-service dispatch missing driver."]
                    ),
                    predicted_impact=(
                        f"Home Service {b.customer_name} ({_fmt_min(b.start_minute)}) has no driver assigned."
                    ),
                    latest_useful_action_time=_fmt_min(max(request.now_minute, b.start_minute - 30)),
                    latest_useful_action_minute=max(request.now_minute, b.start_minute - 30),
                    recommended_actions=actions,
                    authorization_required="crm_operator",
                    source_snapshot_version=request.source_snapshot_version,
                    dedupe_key=f"uoe:{request.branch_id}:unassigned_driver:{b.booking_id}",
                    expiration_or_resolution_condition=f"Resolves when driver is assigned to {b.booking_id}.",
                    assistant_tier="persistent_action_required",
                )
            )

    # ---- Detector 8: Location / GPS quality degradation on Home Service ----
    for b in active_bookings:
        if b.delivery_type != "home_service":
            continue
        if not b.has_valid_customer_location:
            _emit_conflict(
                PredictiveConflictItem(
                    issue_type="location_or_gps_degraded",
                    branch_id=request.branch_id,
                    affected_booking_ids=[b.booking_id],
                    affected_staff_ids=[s for s in (b.therapist_id, b.driver_id) if s],
                    affected_resource_ids=[],
                    severity="high",
                    confidence_or_data_quality=DataQualityAssessment(
                        status="degraded_gps",
                        score=0.45,
                        notes=["Home service booking missing verified customer map pin."],
                    ),
                    predicted_impact=(
                        f"Home Service {b.customer_name} ({_fmt_min(b.start_minute)}) lacks verified coordinates."
                    ),
                    latest_useful_action_time=_fmt_min(max(request.now_minute, b.start_minute - 45)),
                    latest_useful_action_minute=max(request.now_minute, b.start_minute - 45),
                    recommended_actions=[
                        RecommendedStaffAction(
                            action_id=f"fix-loc:{b.booking_id}",
                            action_type="fix_location_or_gps",
                            label="Verify customer address pin in CRM",
                            detail="Pinpoint customer address before driver departs.",
                            target_booking_id=b.booking_id,
                            verified_feasible=True,
                        )
                    ],
                    authorization_required="crm_operator",
                    source_snapshot_version=request.source_snapshot_version,
                    dedupe_key=f"uoe:{request.branch_id}:missing_loc:{b.booking_id}",
                    expiration_or_resolution_condition="Resolves when lat/lng pin is verified.",
                    assistant_tier="persistent_action_required",
                )
            )
        if b.driver_id and b.tracking_status in ("in_route", "ready"):
            drv = next((d for d in request.drivers if d.driver_id == b.driver_id), None)
            if drv:
                gps_issue: str | None = None
                if drv.gps_permission_missing:
                    gps_issue = f"{drv.name} lacks GPS permission on device."
                elif drv.gps_offline:
                    gps_issue = f"{drv.name}'s driver device is offline."
                elif (
                    drv.gps_age_seconds is not None
                    and drv.gps_age_seconds > GPS_STALE_SECONDS
                ):
                    gps_issue = f"{drv.name}'s GPS ping is {round(drv.gps_age_seconds / 60)}m stale."
                elif (
                    drv.gps_accuracy_meters is not None
                    and drv.gps_accuracy_meters > GPS_MAX_ACCURACY_METERS
                ):
                    gps_issue = f"{drv.name}'s GPS accuracy is low (±{drv.gps_accuracy_meters:.0f}m)."
                if gps_issue:
                    _emit_conflict(
                        PredictiveConflictItem(
                            issue_type="location_or_gps_degraded",
                            branch_id=request.branch_id,
                            affected_booking_ids=[b.booking_id],
                            affected_staff_ids=[drv.driver_id],
                            affected_resource_ids=[],
                            severity="warning",
                            confidence_or_data_quality=DataQualityAssessment(
                                status="degraded_gps",
                                score=0.5,
                                notes=[gps_issue],
                            ),
                            predicted_impact=gps_issue + " ETAs fall back conservatively to route baseline.",
                            latest_useful_action_time=_fmt_min(request.now_minute + 10),
                            latest_useful_action_minute=request.now_minute + 10,
                            recommended_actions=[],
                            authorization_required="crm_operator",
                            source_snapshot_version=request.source_snapshot_version,
                            dedupe_key=f"uoe:{request.branch_id}:gps_degraded:{drv.driver_id}:{b.booking_id}",
                            expiration_or_resolution_condition="Resolves on fresh <=100m GPS telemetry.",
                            assistant_tier="early_warning_toast",
                        )
                    )

    # ---- Detector 9: Branch Rule Drift & Cross-Branch Assistance Impacts ----
    if (
        request.rules.scheduling_home_buffer_minutes is not None
        and request.rules.scheduling_home_buffer_minutes
        != request.rules.travel_buffer_minutes
    ):
        _emit_conflict(
            PredictiveConflictItem(
                issue_type="rule_drift_or_cross_branch_gap",
                branch_id=request.branch_id,
                affected_booking_ids=[],
                affected_staff_ids=[],
                affected_resource_ids=[],
                severity="warning",
                confidence_or_data_quality=DataQualityAssessment(
                    status="rule_fallback",
                    score=0.9,
                    notes=[
                        f"branch_booking_rules.travel_buffer_mins={request.rules.travel_buffer_minutes} vs "
                        f"scheduling_rules.home_service_travel_buffer_minutes={request.rules.scheduling_home_buffer_minutes}"
                    ],
                ),
                predicted_impact=(
                    f"{request.branch_name} travel buffer differs between booking rules "
                    f"({request.rules.travel_buffer_minutes}m) and scheduling rules "
                    f"({request.rules.scheduling_home_buffer_minutes}m); engine uses safe maximum ({configured_rule}m)."
                ),
                latest_useful_action_time=_fmt_min(request.now_minute + 60),
                latest_useful_action_minute=request.now_minute + 60,
                recommended_actions=[
                    RecommendedStaffAction(
                        action_id=f"reconcile-rules:{request.branch_id}",
                        action_type="reconcile_branch_rules",
                        label="Align branch & scheduling home-service buffer rules",
                        detail="Review in Branch Setup > Spaces & Rules.",
                        verified_feasible=True,
                    )
                ],
                authorization_required="manager_or_owner",
                source_snapshot_version=request.source_snapshot_version,
                dedupe_key=f"uoe:{request.branch_id}:rule_drift",
                expiration_or_resolution_condition="Resolves when both rules agree.",
                assistant_tier="early_warning_toast",
            )
        )

    for assist in request.assistance_requests:
        if assist.lending_branch_id != request.branch_id:
            continue
        if assist.status not in ("approved_pending_arrival", "requested"):
            continue
        for sid in assist.selected_staff_ids:
            overlaps = [
                sp
                for sp in therapist_spans.get(sid, [])
                if _overlaps(
                    assist.start_minute,
                    assist.end_minute,
                    sp.effective_start_minute,
                    sp.effective_end_minute,
                )
            ]
            if overlaps:
                t_name = therapist_map[sid].name if sid in therapist_map else "Therapist"
                _emit_conflict(
                    PredictiveConflictItem(
                        issue_type="rule_drift_or_cross_branch_gap",
                        branch_id=request.branch_id,
                        affected_booking_ids=[sp.booking_id for sp in overlaps],
                        affected_staff_ids=[sid],
                        affected_resource_ids=[],
                        severity="high",
                        confidence_or_data_quality=DataQualityAssessment(
                            status="high", score=0.95, notes=["Cross-branch assistance overlap checked."]
                        ),
                        predicted_impact=(
                            f"Cross-branch assistance for {t_name} ({_fmt_min(assist.start_minute)}–"
                            f"{_fmt_min(assist.end_minute)}) overlaps {len(overlaps)} home-branch booking(s)."
                        ),
                        latest_useful_action_time=_fmt_min(max(request.now_minute, assist.start_minute - 30)),
                        latest_useful_action_minute=max(request.now_minute, assist.start_minute - 30),
                        recommended_actions=[],
                        authorization_required="manager_or_owner",
                        source_snapshot_version=request.source_snapshot_version,
                        dedupe_key=f"uoe:{request.branch_id}:assist_overlap:{assist.request_id}:{sid}",
                        expiration_or_resolution_condition="Resolves when lending assignment or conflicting bookings are adjusted.",
                        assistant_tier="persistent_action_required",
                    )
                )

    # ---- Detector 10: Quiet Earlier-Slot / Capacity Recovery Opportunities ----
    for b in active_bookings:
        if b.delivery_type != "in_spa" or b.status not in ("confirmed", "pending", "pending_crm_confirmation"):
            continue
        if b.start_minute - request.now_minute < 60:
            continue
        earlier_target = max(
            request.rules.in_spa_open_minute + b.buffer_before_minutes,
            ((request.now_minute + 29) // 30) * 30,
        )
        if earlier_target >= b.start_minute - 30:
            continue
        reps = _find_verified_replacement_therapists(
            b,
            earlier_target,
            earlier_target + b.duration_minutes,
            request,
            therapist_spans,
            exclude_current_therapist=False,
            room_busy_map=room_busy_map,
            turnover_ready_map=turnover_ready_map,
        )
        if reps:
            rep_t, rep_r = reps[0]
            _emit_conflict(
                PredictiveConflictItem(
                    issue_type="earlier_slot_opportunity",
                    branch_id=request.branch_id,
                    affected_booking_ids=[b.booking_id],
                    affected_staff_ids=[rep_t.staff_id],
                    affected_resource_ids=[rep_r.resource_id] if rep_r else [],
                    severity="info",
                    confidence_or_data_quality=DataQualityAssessment(
                        status="high", score=0.86, notes=["Verified open therapist & room slot earlier today."]
                    ),
                    predicted_impact=(
                        f"{b.customer_name}'s {_fmt_min(b.start_minute)} booking can move earlier to "
                        f"{_fmt_min(earlier_target)} with {rep_t.name}"
                        + (f" ({rep_r.name})." if rep_r else ".")
                    ),
                    latest_useful_action_time=_fmt_min(max(request.now_minute, earlier_target - 15)),
                    latest_useful_action_minute=max(request.now_minute, earlier_target - 15),
                    recommended_actions=[
                        RecommendedStaffAction(
                            action_id=f"earlier:{b.booking_id}:{earlier_target}",
                            action_type="offer_earlier_slot",
                            label=f"Offer {_fmt_min(earlier_target)} slot to {b.customer_name}",
                            detail=f"Frees peak afternoon capacity around {_fmt_min(b.start_minute)}.",
                            target_booking_id=b.booking_id,
                            proposed_staff_id=rep_t.staff_id,
                            proposed_staff_name=rep_t.name,
                            proposed_resource_id=rep_r.resource_id if rep_r else None,
                            proposed_resource_name=rep_r.name if rep_r else None,
                            proposed_start_minute=earlier_target,
                            requires_customer_approval=True,
                            verified_feasible=True,
                        )
                    ],
                    authorization_required="customer_confirmation",
                    source_snapshot_version=request.source_snapshot_version,
                    dedupe_key=f"uoe:{request.branch_id}:earlier:{b.booking_id}:{earlier_target}",
                    expiration_or_resolution_condition="Expires once earlier window passes.",
                    assistant_tier="quiet_opportunity",
                )
            )
            if sum(1 for c in conflicts if c.issue_type == "earlier_slot_opportunity") >= 3:
                break

    # Deterministic severity ordering: critical -> high -> warning -> info
    sev_rank = {"critical": 0, "high": 1, "warning": 2, "info": 3}
    conflicts.sort(key=lambda c: (sev_rank.get(c.severity, 9), c.latest_useful_action_minute, c.dedupe_key))

    counts = {
        "critical": sum(1 for c in conflicts if c.severity == "critical"),
        "high": sum(1 for c in conflicts if c.severity == "high"),
        "warning": sum(1 for c in conflicts if c.severity == "warning"),
        "info": sum(1 for c in conflicts if c.severity == "info"),
        "persistent_action_required": sum(
            1 for c in conflicts if c.assistant_tier == "persistent_action_required"
        ),
        "early_warning_toast": sum(
            1 for c in conflicts if c.assistant_tier == "early_warning_toast"
        ),
        "quiet_opportunity": sum(
            1 for c in conflicts if c.assistant_tier == "quiet_opportunity"
        ),
    }

    return UnifiedEvaluateResponse(
        branch_id=request.branch_id,
        date=request.date,
        now_minute=request.now_minute,
        source_snapshot_version=request.source_snapshot_version,
        dynamic_buffers=buffers,
        therapist_timelines=timeline_summaries,
        conflicts_and_opportunities=conflicts,
        summary_counts=counts,
        evaluator_latency_ms=round((time.perf_counter() - t0) * 1000, 2),
    )
