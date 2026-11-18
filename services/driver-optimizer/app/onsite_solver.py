"""Deterministic On-Site Level 1 CP-SAT optimizer using Google OR-Tools."""

from __future__ import annotations

import time
from collections import defaultdict
from dataclasses import dataclass

from ortools.sat.python import cp_model

from app.onsite_models import (
    OnsiteAlternativeSuggestion,
    OnsiteAssignmentLine,
    OnsiteResourceInput,
    OnsiteServiceRequirement,
    OnsiteSlotAvailability,
    OnsiteSolveRequest,
    OnsiteSolveResponse,
    OnsiteTherapistInput,
)


@dataclass(frozen=True)
class _LineWindow:
    line: OnsiteServiceRequirement
    start_minute: int
    end_minute: int


def _overlaps(a_start: int, a_end: int, b_start: int, b_end: int) -> bool:
    return a_start < b_end and a_end > b_start


def _format_hhmm(minute: int) -> str:
    wrapped = minute % 1440
    h = wrapped // 60
    m = wrapped % 60
    suffix = " (+1d)" if minute >= 1440 else ""
    return f"{h:02d}:{m:02d}{suffix}"


def _build_line_windows(
    requirements: list[OnsiteServiceRequirement],
    order_start_minute: int,
) -> list[_LineWindow]:
    by_attendee: dict[str, list[OnsiteServiceRequirement]] = defaultdict(list)
    for req in requirements:
        by_attendee[req.attendee_id].append(req)

    windows: list[_LineWindow] = []
    # Preserve attendee declaration order for deterministic indexing
    seen_attendees: list[str] = []
    for req in requirements:
        if req.attendee_id not in seen_attendees:
            seen_attendees.append(req.attendee_id)

    for att_id in seen_attendees:
        lines = sorted(by_attendee[att_id], key=lambda item: (item.line_index, item.line_id))
        cursor = order_start_minute
        for line in lines:
            span = (
                line.buffer_before_minutes
                + line.duration_minutes
                + line.buffer_after_minutes
            )
            windows.append(
                _LineWindow(
                    line=line,
                    start_minute=cursor,
                    end_minute=cursor + span,
                )
            )
            cursor += span
    return windows


def _therapist_authorized_for_window(
    therapist: OnsiteTherapistInput,
    branch_id: str,
    start_minute: int,
    end_minute: int,
) -> bool:
    for win in therapist.assistance_windows:
        # Block home-branch assignments whenever the therapist is actively assigned to another branch
        if (
            win.requesting_branch_id != branch_id
            and _overlaps(start_minute, end_minute, win.start_minute, win.end_minute)
        ):
            return False
    if therapist.home_branch_id == branch_id:
        return True
    for win in therapist.assistance_windows:
        if (
            win.requesting_branch_id == branch_id
            and win.visit_type in ("in_spa", "both")
            and start_minute >= win.start_minute
            and end_minute <= win.end_minute
        ):
            return True
    return False


def _therapist_eligible_for_line(
    therapist: OnsiteTherapistInput,
    branch_id: str,
    lw: _LineWindow,
) -> tuple[bool, str | None]:
    line = lw.line
    if line.locked_staff_id and therapist.staff_id != line.locked_staff_id:
        return False, "locked_staff_mismatch"
    if (
        therapist.qualified_service_ids
        and line.service_id not in therapist.qualified_service_ids
    ):
        return False, "not_qualified"
    if not therapist.qualified_service_ids:
        return False, "not_qualified"
    if not _therapist_authorized_for_window(
        therapist, branch_id, lw.start_minute, lw.end_minute
    ):
        return False, "cross_branch_unavailable"

    in_shift = any(
        lw.start_minute >= sw.start_minute and lw.end_minute <= sw.end_minute
        for sw in therapist.shift_windows
    )
    if not in_shift:
        return False, "outside_shift"

    for br in therapist.break_windows:
        if _overlaps(lw.start_minute, lw.end_minute, br.start_minute, br.end_minute):
            return False, "break_overlap"

    for blk in therapist.blocked_windows:
        if _overlaps(lw.start_minute, lw.end_minute, blk.start_minute, blk.end_minute):
            return False, "blocked_time"

    for busy in therapist.busy_windows:
        if _overlaps(
            lw.start_minute,
            lw.end_minute,
            busy.effective_start_minute,
            busy.effective_end_minute,
        ):
            return (
                False,
                "home_service_transition_gap"
                if busy.delivery_type == "home_service"
                else "therapist_conflict",
            )

    return True, None


def _resource_eligible_for_line(
    resource: OnsiteResourceInput,
    lw: _LineWindow,
    default_reset_minutes: int,
) -> tuple[bool, str | None]:
    line = lw.line
    if not resource.is_active:
        return False, "room_inactive"
    if line.locked_resource_id and resource.resource_id != line.locked_resource_id:
        return False, "locked_resource_mismatch"
    if (
        resource.allowed_service_ids
        and line.service_id not in resource.allowed_service_ids
    ):
        return False, "room_service_incompatible"
    if (
        line.allowed_resource_types
        and resource.resource_type not in line.allowed_resource_types
    ):
        return False, "room_type_incompatible"

    if resource.active_turnover_until_minute is not None:
        turnover_start = resource.turnover_start_minute or 0
        if _overlaps(
            lw.start_minute,
            lw.end_minute,
            turnover_start,
            resource.active_turnover_until_minute,
        ):
            return False, "room_turnover_active"

    return True, None


def _remaining_resource_capacity(
    resource: OnsiteResourceInput,
    start_minute: int,
    end_minute: int,
    default_reset_minutes: int,
) -> int:
    reset = (
        resource.reset_buffer_minutes
        if resource.reset_buffer_minutes is not None
        else default_reset_minutes
    )
    probe_end = end_minute + reset
    # Evaluate exact worst-case simultaneous occupancy across existing busy intervals
    check_points: set[int] = {start_minute, end_minute}
    relevant: list[tuple[int, int]] = []
    for busy in resource.busy_windows:
        b_end = busy.end_minute + busy.reset_after_minutes
        if _overlaps(start_minute, probe_end, busy.start_minute, b_end):
            relevant.append((busy.start_minute, b_end))
            check_points.add(max(start_minute, busy.start_minute))
    if not relevant:
        return resource.capacity
    peak = 0
    for pt in check_points:
        if pt >= probe_end:
            continue
        occ = sum(1 for bs, be in relevant if bs <= pt < be)
        if occ > peak:
            peak = occ
    return max(0, resource.capacity - peak)


def _solve_fixed_start(
    request: OnsiteSolveRequest,
    order_start_minute: int,
) -> tuple[
    bool,
    list[OnsiteAssignmentLine],
    list[str],
    list[str],
    str,
]:
    """Solve exact CP-SAT therapist + room assignment for a candidate start minute."""
    windows = _build_line_windows(request.requirements, order_start_minute)
    if not windows:
        return False, [], ["no_requirements"], [], "enforced"

    min_start = min(w.start_minute for w in windows)
    max_end = max(w.end_minute for w in windows)
    if min_start < request.branch_open_minute or max_end > request.branch_close_minute:
        return False, [], ["outside_branch_hours"], [], "enforced"

    active_resources = [r for r in request.resources if r.is_active]
    any_requires_room = any(w.line.requires_room for w in windows)
    if not any_requires_room:
        room_mode = "not_required"
    elif not request.enforce_room_capacity or len(active_resources) == 0:
        room_mode = "unconstrained_no_resources"
    else:
        room_mode = "enforced"

    model = cp_model.CpModel()
    line_count = len(windows)
    therapists = request.therapists
    diagnostic_reasons: set[str] = set()

    # 1. Therapist decision vars
    x: dict[tuple[int, int], cp_model.IntVar] = {}
    for li, lw in enumerate(windows):
        eligible_t: list[int] = []
        line_rejects: set[str] = set()
        for ti, therapist in enumerate(therapists):
            ok, reason = _therapist_eligible_for_line(therapist, request.branch_id, lw)
            if ok:
                eligible_t.append(ti)
                x[li, ti] = model.new_bool_var(f"x_{li}_{ti}")
            elif reason:
                line_rejects.add(reason)
        if not eligible_t:
            if "home_service_transition_gap" in line_rejects:
                diagnostic_reasons.add("home_service_transition_gap")
            elif "therapist_conflict" in line_rejects:
                diagnostic_reasons.add("therapist_conflict")
            elif "break_overlap" in line_rejects or "blocked_time" in line_rejects:
                diagnostic_reasons.add("break_or_block_overlap")
            elif "outside_shift" in line_rejects:
                diagnostic_reasons.add("outside_shift")
            elif "cross_branch_unavailable" in line_rejects:
                diagnostic_reasons.add("cross_branch_unavailable")
            else:
                diagnostic_reasons.add("no_qualified_therapist")
            return False, [], sorted(diagnostic_reasons), [], room_mode
        model.add(sum(x[li, ti] for ti in eligible_t) == 1)

    # Therapist constraints: non-overlapping lines + daily limits
    for ti, therapist in enumerate(therapists):
        # Prevent double-booking a therapist on overlapping lines (e.g., concurrent group attendees)
        for li in range(line_count):
            if (li, ti) not in x:
                continue
            overlapping_group = [
                x[lj, ti]
                for lj in range(li + 1, line_count)
                if (lj, ti) in x
                and _overlaps(
                    windows[li].start_minute,
                    windows[li].end_minute,
                    windows[lj].start_minute,
                    windows[lj].end_minute,
                )
            ]
            for lj_var in overlapping_group:
                model.add(x[li, ti] + lj_var <= 1)

        assigned_vars = [x[li, ti] for li in range(line_count) if (li, ti) in x]
        if assigned_vars:
            if therapist.max_services_per_day is not None:
                rem_services = (
                    therapist.max_services_per_day
                    - therapist.existing_service_count_today
                )
                if rem_services <= 0:
                    for v in assigned_vars:
                        model.add(v == 0)
                    diagnostic_reasons.add("max_services_limit")
                else:
                    model.add(sum(assigned_vars) <= rem_services)
            if therapist.max_working_minutes_per_day is not None:
                rem_mins = (
                    therapist.max_working_minutes_per_day
                    - therapist.existing_working_minutes_today
                )
                if rem_mins <= 0:
                    for v in assigned_vars:
                        model.add(v == 0)
                    diagnostic_reasons.add("max_working_hours_limit")
                else:
                    model.add(
                        sum(
                            x[li, ti]
                            * (windows[li].end_minute - windows[li].start_minute)
                            for li in range(line_count)
                            if (li, ti) in x
                        )
                        <= rem_mins
                    )

    # 2. Room resource decision vars (when enforced)
    y: dict[tuple[int, int], cp_model.IntVar] = {}
    if room_mode == "enforced":
        for li, lw in enumerate(windows):
            if not lw.line.requires_room:
                continue
            eligible_r: list[int] = []
            room_rejects: set[str] = set()
            for ri, res in enumerate(active_resources):
                ok, reason = _resource_eligible_for_line(
                    res, lw, request.room_reset_buffer_minutes
                )
                if not ok:
                    if reason:
                        room_rejects.add(reason)
                    continue
                rem_cap = _remaining_resource_capacity(
                    res,
                    lw.start_minute,
                    lw.end_minute,
                    request.room_reset_buffer_minutes,
                )
                if rem_cap <= 0:
                    room_rejects.add("room_capacity_full")
                    continue
                eligible_r.append(ri)
                y[li, ri] = model.new_bool_var(f"y_{li}_{ri}")

            if not eligible_r:
                if "room_turnover_active" in room_rejects:
                    diagnostic_reasons.add("room_turnover_active")
                else:
                    diagnostic_reasons.add("room_capacity_full")
                return False, [], sorted(diagnostic_reasons), [], room_mode
            model.add(sum(y[li, ri] for ri in eligible_r) == 1)

        # Cumulative room capacity across all candidate lines
        for ri, res in enumerate(active_resources):
            res_lines = [li for li in range(line_count) if (li, ri) in y]
            if not res_lines:
                continue
            reset = (
                res.reset_buffer_minutes
                if res.reset_buffer_minutes is not None
                else request.room_reset_buffer_minutes
            )
            # Check capacity at every line start/end + existing busy start/end
            event_points: set[int] = set()
            for li in res_lines:
                event_points.add(windows[li].start_minute)
                event_points.add(windows[li].end_minute)
            for busy in res.busy_windows:
                event_points.add(busy.start_minute)

            for pt in event_points:
                existing_occ = sum(
                    1
                    for busy in res.busy_windows
                    if busy.start_minute <= pt < (busy.end_minute + busy.reset_after_minutes)
                )
                overlapping_new = [
                    y[li, ri]
                    for li in res_lines
                    if windows[li].start_minute <= pt < (windows[li].end_minute + reset)
                ]
                if overlapping_new:
                    model.add(sum(overlapping_new) + existing_occ <= res.capacity)

    # 3. Objective function: maximize preference, continuity, fairness, checked-in priority
    obj_terms: list[cp_model.LinearExpr] = []
    for (li, ti), var in x.items():
        lw = windows[li]
        therapist = therapists[ti]
        score = 100
        if lw.line.preferred_staff_id == therapist.staff_id:
            score += 5000
        if therapist.checked_in:
            score += 400
        if therapist.home_branch_id == request.branch_id:
            score += 200
        # Balance workload & honor seniority (lower seniority_rank / completed_count preferred)
        score -= therapist.completed_count_today * 60
        score -= min(therapist.seniority_rank, 100) * 5
        obj_terms.append(var * score)

    # Encourage same therapist & same room across sequential services for same attendee
    by_att: dict[str, list[int]] = defaultdict(list)
    for li, lw in enumerate(windows):
        by_att[lw.line.attendee_id].append(li)
    for att_lines in by_att.values():
        for idx in range(len(att_lines) - 1):
            l1, l2 = att_lines[idx], att_lines[idx + 1]
            for ti in range(len(therapists)):
                if (l1, ti) in x and (l2, ti) in x:
                    same_t = model.new_bool_var(f"same_t_{l1}_{l2}_{ti}")
                    model.add_multiplication_equality(same_t, [x[l1, ti], x[l2, ti]])
                    obj_terms.append(same_t * 350)
            for ri in range(len(active_resources)):
                if (l1, ri) in y and (l2, ri) in y:
                    same_r = model.new_bool_var(f"same_r_{l1}_{l2}_{ri}")
                    model.add_multiplication_equality(same_r, [y[l1, ri], y[l2, ri]])
                    obj_terms.append(same_r * 250)

    # Group room sharing vs separation preference
    if (
        room_mode == "enforced"
        and request.group_room_policy in ("prefer_together", "share_if_capacity")
        and len(by_att) > 1
    ):
        for ri, res in enumerate(active_resources):
            if res.capacity >= 2:
                used = model.new_bool_var(f"room_used_{ri}")
                vars_in_room = [y[li, ri] for li in range(line_count) if (li, ri) in y]
                if vars_in_room:
                    model.add_max_equality(used, vars_in_room)
                    # Penalize opening extra rooms so couples share a capacity>=2 room cleanly
                    obj_terms.append(used * -120)
            obj_terms.extend(
                y[li, ri] * (-res.sort_order)
                for li in range(line_count)
                if (li, ri) in y
            )

    model.maximize(sum(obj_terms))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 0.5
    solver.parameters.num_workers = 1  # Deterministic execution
    status = solver.solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        # Provide actionable infeasibility reason
        if len(by_att) > 1:
            diagnostic_reasons.add("group_concurrent_capacity_unavailable")
        else:
            diagnostic_reasons.add("no_combined_therapist_room_match")
        return False, [], sorted(diagnostic_reasons), [], room_mode

    assignments: list[OnsiteAssignmentLine] = []
    eligible_staff_ids_first: set[str] = set()
    for (li, ti) in x:
        if solver.value(x[li, ti]) == 1:
            eligible_staff_ids_first.add(therapists[ti].staff_id)

    for li, lw in enumerate(windows):
        chosen_t: OnsiteTherapistInput | None = None
        for ti, therapist in enumerate(therapists):
            if (li, ti) in x and solver.value(x[li, ti]) == 1:
                chosen_t = therapist
                break
        assert chosen_t is not None
        chosen_r: OnsiteResourceInput | None = None
        if room_mode == "enforced" and lw.line.requires_room:
            for ri, res in enumerate(active_resources):
                if (li, ri) in y and solver.value(y[li, ri]) == 1:
                    chosen_r = res
                    break
        assignments.append(
            OnsiteAssignmentLine(
                line_id=lw.line.line_id,
                attendee_id=lw.line.attendee_id,
                service_id=lw.line.service_id,
                start_minute=lw.start_minute,
                end_minute=lw.end_minute,
                staff_id=chosen_t.staff_id,
                staff_name=chosen_t.name,
                resource_id=chosen_r.resource_id if chosen_r else None,
                resource_name=chosen_r.name if chosen_r else None,
                matched_preferred_staff=(
                    lw.line.preferred_staff_id == chosen_t.staff_id
                ),
            )
        )

    # Also compute all therapists who could individually start line 0 at this slot
    if windows:
        first_lw = windows[0]
        first_eligible_ids = [
            t.staff_id
            for t in therapists
            if _therapist_eligible_for_line(t, request.branch_id, first_lw)[0]
        ]
    else:
        first_eligible_ids = list(eligible_staff_ids_first)

    return True, assignments, [], first_eligible_ids, room_mode


def solve_onsite_request(request: OnsiteSolveRequest) -> OnsiteSolveResponse:
    """Solve On-Site Level 1 therapist + room allocation or slot matrix."""
    t0 = time.perf_counter()

    # Estimate max span across attendees
    probe_windows = _build_line_windows(request.requirements, 0)
    max_span = max((w.end_minute for w in probe_windows), default=60)

    def _candidate_grid() -> list[int]:
        if request.candidate_start_minutes:
            return sorted(set(request.candidate_start_minutes))
        slots: list[int] = []
        cur = request.branch_open_minute
        while cur + max_span <= request.branch_close_minute:
            slots.append(cur)
            cur += request.slot_interval_minutes
        return slots

    if request.mode == "slot_matrix":
        grid = _candidate_grid()
        slot_results: list[OnsiteSlotAvailability] = []
        active_resources = [r for r in request.resources if r.is_active]
        total_cap = sum(r.capacity for r in active_resources)
        room_mode: str = (
            "unconstrained_no_resources"
            if (not request.enforce_room_capacity or len(active_resources) == 0)
            else "enforced"
        )
        if not any(r.requires_room for r in request.requirements):
            room_mode = "not_required"

        for slot_min in grid:
            ok, assignments, reasons, eligible_staff_ids, rm = _solve_fixed_start(
                request, slot_min
            )
            room_mode = rm
            avail_room_spots = (
                sum(
                    _remaining_resource_capacity(
                        res,
                        slot_min,
                        slot_min + max_span,
                        request.room_reset_buffer_minutes,
                    )
                    for res in active_resources
                )
                if rm == "enforced"
                else total_cap
            )
            slot_results.append(
                OnsiteSlotAvailability(
                    start_minute=slot_min,
                    available=ok,
                    eligible_staff_ids=eligible_staff_ids,
                    available_room_count=avail_room_spots,
                    total_active_room_capacity=total_cap,
                    blocking_reasons=reasons,
                    sample_assignments=assignments if ok else [],
                )
            )

        first_ok = next((s for s in slot_results if s.available), None)
        elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)
        return OnsiteSolveResponse(
            feasible=first_ok is not None,
            room_constraint_mode=room_mode,  # type: ignore[arg-type]
            assignments=first_ok.sample_assignments if first_ok else [],
            total_start_minute=first_ok.start_minute if first_ok else None,
            total_end_minute=(
                max(a.end_minute for a in first_ok.sample_assignments)
                if first_ok and first_ok.sample_assignments
                else None
            ),
            infeasibility_reasons=(
                [] if first_ok else ["no_feasible_slots_in_requested_window"]
            ),
            candidate_slots=slot_results,
            solver_latency_ms=elapsed_ms,
        )

    # mode == "assign_order"
    req_start = request.requested_start_minute
    assert req_start is not None
    ok, assignments, reasons, _eligible, room_mode = _solve_fixed_start(
        request, req_start
    )

    alternatives: list[OnsiteAlternativeSuggestion] = []
    if (request.allow_alternative_times or request.allow_earlier_opportunities) and (
        request.max_alternatives > 0
    ):
        grid = _candidate_grid()
        # Sort candidates: earlier feasible opportunities when requested infeasible or earlier sought,
        # ordered by closeness when searching alternatives or chronologically for earlier slots.
        ordered_candidates = sorted(
            [m for m in grid if m != req_start],
            key=lambda m: (0 if m < req_start else 1, abs(m - req_start)),
        )
        for cand in ordered_candidates:
            if len(alternatives) >= request.max_alternatives:
                break
            if ok and not request.allow_earlier_opportunities:
                break
            if ok and cand > req_start:
                continue
            cand_ok, cand_assign, _r, _e, _rm = _solve_fixed_start(request, cand)
            if not cand_ok or not cand_assign:
                continue
            cand_end = max(a.end_minute for a in cand_assign)
            kind = "earlier_slot" if cand < req_start else "nearby_slot"
            lead_names = ", ".join(
                sorted({f"{a.staff_name}" for a in cand_assign})
            )
            summary = (
                f"{'Earlier' if cand < req_start else 'Alternative'} feasible slot at "
                f"{_format_hhmm(cand)}–{_format_hhmm(cand_end)} with {lead_names}"
            )
            alternatives.append(
                OnsiteAlternativeSuggestion(
                    kind=kind,
                    start_minute=cand,
                    end_minute=cand_end,
                    delta_minutes=cand - req_start,
                    summary=summary,
                    assignments=cand_assign,
                )
            )

    elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)
    return OnsiteSolveResponse(
        feasible=ok,
        room_constraint_mode=room_mode,  # type: ignore[arg-type]
        requested_start_minute=req_start,
        assignments=assignments,
        total_start_minute=min((a.start_minute for a in assignments), default=None),
        total_end_minute=max((a.end_minute for a in assignments), default=None),
        infeasibility_reasons=reasons,
        alternatives=alternatives,
        solver_latency_ms=elapsed_ms,
    )
