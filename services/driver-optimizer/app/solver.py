"""OR-Tools fleet optimization solver, solution extraction, collection coverage, and greedy baseline."""

from __future__ import annotations

import time
from typing import Any

import ortools
from ortools.constraint_solver import pywrapcp, routing_enums_pb2

from app.constraints import TIME_SCALE_SECONDS, CompiledRoutingModel, build_routing_model
from app.fairness import compute_driver_available_minutes, compute_fleet_metrics
from app.models import (
    CollectionCoverageEntry,
    DriverInput,
    DriverRoutePlan,
    FleetMetrics,
    LegAssignmentSummary,
    OptimizationConfig,
    OptimizationResponse,
    OptimizeRequest,
    SimulationDelta,
    SimulationResponse,
    SolverDiagnostics,
    StopSchedule,
    TransportObligationInput,
    UnassignedObligation,
)
from app.validation import (
    ValidatedContext,
    check_driver_obligation_compatibility,
    diagnose_unassigned_obligation,
    effective_pickup_window,
    validate_request_integrity,
    verify_solution_hard_constraints,
)


def _routing_status_name(status_code: int) -> str:
    try:
        return routing_enums_pb2.RoutingSearchStatus.Value.Name(status_code)
    except ValueError:
        return f"UNKNOWN_{status_code}"


def _metaheuristic_enum(name: str) -> int:
    mapping = {
        "automatic": routing_enums_pb2.LocalSearchMetaheuristic.AUTOMATIC,
        "greedy_descent": routing_enums_pb2.LocalSearchMetaheuristic.GREEDY_DESCENT,
        "guided_local_search": routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH,
        "tabu_search": routing_enums_pb2.LocalSearchMetaheuristic.TABU_SEARCH,
    }
    return mapping.get(name, routing_enums_pb2.LocalSearchMetaheuristic.AUTOMATIC)


def _build_search_parameters(
    config: OptimizationConfig,
    first_solution: int,
    time_limit_ms: int,
) -> pywrapcp.DefaultRoutingSearchParameters:
    params = pywrapcp.DefaultRoutingSearchParameters()
    params.first_solution_strategy = first_solution
    params.local_search_metaheuristic = _metaheuristic_enum(config.local_search_metaheuristic)
    params.time_limit.FromMilliseconds(max(50, time_limit_ms))
    return params


def _extract_routes_and_assignments(
    request: OptimizeRequest,
    ctx: ValidatedContext,
    compiled: CompiledRoutingModel,
    assignment: pywrapcp.Assignment,
) -> tuple[list[DriverRoutePlan], list[LegAssignmentSummary], set[str]]:
    """Decode OR-Tools Assignment into DriverRoutePlan and LegAssignmentSummary objects."""
    manager = compiled.manager
    routing = compiled.routing
    time_dim = compiled.time_dim
    loc_idx_by_id = ctx.location_index_by_id
    travel_time = request.travel_info.travel_time_minutes
    travel_dist = request.travel_info.travel_distance_km
    config = request.config

    active_by_id = {d.driver_id: idx for idx, d in enumerate(compiled.active_drivers)}
    assigned_ob_ids: set[str] = set()
    pickup_times: dict[str, tuple[str, float]] = {}
    dropoff_times: dict[str, tuple[str, float]] = {}
    routes_by_driver_id: dict[str, DriverRoutePlan] = {}

    for v_idx, drv in enumerate(compiled.active_drivers):
        initial_onboard = sum(
            ob.passenger_count
            for ob in compiled.routed_obligations
            if ob.operational_state == "onboard" and ob.locked_driver_id == drv.driver_id
        )
        running_occ = initial_onboard
        peak_occ = initial_onboard
        stops: list[StopSchedule] = []
        route_ob_ids: list[str] = []

        total_drive_min = 0.0
        empty_drive_min = 0.0
        total_dist_km = 0.0
        empty_dist_km = 0.0
        total_handling_min = 0.0
        total_idle_wait_min = 0.0

        idx = routing.Start(v_idx)
        seq = 0
        start_min = round(assignment.Value(time_dim.CumulVar(idx)) / TIME_SCALE_SECONDS, 2)
        start_loc = ctx.locations_by_id[drv.start_location_id]
        stops.append(
            StopSchedule(
                sequence_index=seq,
                stop_type="driver_start",
                location_id=drv.start_location_id,
                location_label=start_loc.label or start_loc.location_id,
                arrival_minute=start_min,
                service_start_minute=start_min,
                departure_minute=start_min,
                wait_minutes=0.0,
                handling_minutes=0.0,
                driving_minutes_from_prev=0.0,
                distance_km_from_prev=0.0,
                occupancy_before=running_occ,
                occupancy_after=running_occ,
                is_locked=bool(drv.locked_stop_sequence),
            )
        )
        prev_loc_id = drv.start_location_id
        prev_dep_min = start_min
        idx = assignment.Value(routing.NextVar(idx))

        while not routing.IsEnd(idx):
            seq += 1
            node = manager.IndexToNode(idx)
            meta = compiled.node_meta[node]
            ob_id = meta["obligation_id"]
            ob = ctx.obligations_by_id[ob_id]

            u = loc_idx_by_id[prev_loc_id]
            w = loc_idx_by_id[meta["location_id"]]
            d_min = float(travel_time[u][w])
            d_km = float(travel_dist[u][w])

            total_drive_min += d_min
            total_dist_km += d_km
            if running_occ == 0:
                empty_drive_min += d_min
                empty_dist_km += d_km

            arrival_min = round(prev_dep_min + d_min, 2)
            svc_start_min = round(assignment.Value(time_dim.CumulVar(idx)) / TIME_SCALE_SECONDS, 2)
            wait_min = round(max(0.0, svc_start_min - arrival_min), 2)
            handling_min = float(meta["handling_minutes"])
            dep_min = round(svc_start_min + handling_min, 2)

            total_idle_wait_min += wait_min
            total_handling_min += handling_min

            occ_before = running_occ
            running_occ += int(meta["demand"])
            peak_occ = max(peak_occ, running_occ)

            if meta["kind"] == "pickup":
                pickup_times[ob_id] = (drv.driver_id, svc_start_min)
            else:
                dropoff_times[ob_id] = (drv.driver_id, svc_start_min)

            if ob_id not in route_ob_ids:
                route_ob_ids.append(ob_id)
                assigned_ob_ids.add(ob_id)

            stops.append(
                StopSchedule(
                    sequence_index=seq,
                    obligation_id=ob_id,
                    booking_id=ob.booking_id,
                    therapist_id=ob.therapist_id,
                    leg_type=ob.leg_type,
                    stop_type=meta["kind"],
                    location_id=meta["location_id"],
                    location_label=meta["location_label"],
                    arrival_minute=arrival_min,
                    service_start_minute=svc_start_min,
                    departure_minute=dep_min,
                    wait_minutes=wait_min,
                    handling_minutes=handling_min,
                    driving_minutes_from_prev=round(d_min, 2),
                    distance_km_from_prev=round(d_km, 3),
                    occupancy_before=occ_before,
                    occupancy_after=running_occ,
                    is_locked=bool(meta["is_locked"]),
                )
            )
            prev_loc_id = meta["location_id"]
            prev_dep_min = dep_min
            idx = assignment.Value(routing.NextVar(idx))

        returns_to_branch = False
        if route_ob_ids and drv.return_to_location_id is not None:
            returns_to_branch = True
            seq += 1
            u = loc_idx_by_id[prev_loc_id]
            w = loc_idx_by_id[drv.return_to_location_id]
            d_min = float(travel_time[u][w])
            d_km = float(travel_dist[u][w])
            total_drive_min += d_min
            total_dist_km += d_km
            if running_occ == 0:
                empty_drive_min += d_min
                empty_dist_km += d_km
            end_arrival = round(prev_dep_min + d_min, 2)
            end_svc = round(assignment.Value(time_dim.CumulVar(idx)) / TIME_SCALE_SECONDS, 2)
            ret_loc = ctx.locations_by_id[drv.return_to_location_id]
            stops.append(
                StopSchedule(
                    sequence_index=seq,
                    stop_type="driver_return",
                    location_id=drv.return_to_location_id,
                    location_label=ret_loc.label or ret_loc.location_id,
                    arrival_minute=end_arrival,
                    service_start_minute=end_svc,
                    departure_minute=end_svc,
                    wait_minutes=round(max(0.0, end_svc - end_arrival), 2),
                    handling_minutes=0.0,
                    driving_minutes_from_prev=round(d_min, 2),
                    distance_km_from_prev=round(d_km, 3),
                    occupancy_before=running_occ,
                    occupancy_after=running_occ,
                )
            )
            end_min = end_svc
        else:
            end_min = prev_dep_min

        avail_min = compute_driver_available_minutes(drv)
        service_stop_count = sum(1 for s in stops if s.stop_type in ("pickup", "dropoff"))
        new_work_min = round(
            total_drive_min + total_handling_min + service_stop_count * config.stop_complexity_minutes,
            2,
        )
        total_work_min = round(drv.existing_committed_workload_minutes + new_work_min, 2)
        util_ratio = round(total_work_min / avail_min, 4) if avail_min > 0 else 0.0
        shift_span = round(max(0.0, end_min - start_min), 2)

        routes_by_driver_id[drv.driver_id] = DriverRoutePlan(
            driver_id=drv.driver_id,
            driver_name=drv.name or drv.driver_id,
            vehicle_capacity=drv.vehicle_capacity,
            stops=stops,
            assigned_obligation_ids=route_ob_ids,
            driving_minutes=round(total_drive_min, 2),
            empty_driving_minutes=round(empty_drive_min, 2),
            distance_km=round(total_dist_km, 3),
            empty_distance_km=round(empty_dist_km, 3),
            handling_minutes=round(total_handling_min, 2),
            idle_wait_minutes=round(total_idle_wait_min, 2),
            shift_span_minutes=shift_span,
            existing_committed_workload_minutes=drv.existing_committed_workload_minutes,
            new_workload_minutes=new_work_min,
            total_workload_minutes=total_work_min,
            available_shift_minutes=round(avail_min, 2),
            workload_utilization_ratio=util_ratio,
            peak_occupancy=peak_occ,
            returns_to_branch=returns_to_branch,
        )

    # Preserve input driver order (including unavailable drivers as idle plans)
    routes: list[DriverRoutePlan] = []
    for drv in request.drivers:
        if drv.driver_id in routes_by_driver_id:
            routes.append(routes_by_driver_id[drv.driver_id])
        else:
            avail_min = compute_driver_available_minutes(drv)
            util = round(drv.existing_committed_workload_minutes / avail_min, 4) if avail_min > 0 else 0.0
            routes.append(
                DriverRoutePlan(
                    driver_id=drv.driver_id,
                    driver_name=drv.name or drv.driver_id,
                    vehicle_capacity=drv.vehicle_capacity,
                    stops=[],
                    assigned_obligation_ids=[],
                    driving_minutes=0.0,
                    empty_driving_minutes=0.0,
                    distance_km=0.0,
                    empty_distance_km=0.0,
                    handling_minutes=0.0,
                    idle_wait_minutes=0.0,
                    shift_span_minutes=0.0,
                    existing_committed_workload_minutes=drv.existing_committed_workload_minutes,
                    new_workload_minutes=0.0,
                    total_workload_minutes=drv.existing_committed_workload_minutes,
                    available_shift_minutes=round(avail_min, 2),
                    workload_utilization_ratio=util,
                    peak_occupancy=0,
                    returns_to_branch=False,
                )
            )

    # Build per-leg summaries
    assignments: list[LegAssignmentSummary] = []
    for ob_id in sorted(assigned_ob_ids):
        ob = ctx.obligations_by_id[ob_id]
        drv_id, drop_min = dropoff_times[ob_id]
        if ob.operational_state == "onboard":
            pick_min = ob.previous_pickup_minute if ob.previous_pickup_minute is not None else drop_min
        else:
            _, pick_min = pickup_times[ob_id]

        u = loc_idx_by_id[ob.pickup_location_id]
        w = loc_idx_by_id[ob.dropoff_location_id]
        direct_min = round(float(travel_time[u][w]), 2)
        ride_dur = round(max(0.0, drop_min - pick_min), 2)

        if ob.leg_type == "collection":
            ready = (
                ob.expected_ready_minute
                if ob.expected_ready_minute is not None
                else ob.pickup_window.earliest_minute
            )
            wait_min = round(max(0.0, pick_min - ready), 2)
        else:
            wait_min = 0.0

        target = ob.target_arrival_minute if ob.target_arrival_minute is not None else ob.dropoff_window.latest_minute
        on_time = drop_min <= target + 1e-4

        route = routes_by_driver_id[drv_id]
        # Pooled if vehicle physically shared ride (peak occupancy > this leg's passenger_count)
        is_pooled = route.peak_occupancy > ob.passenger_count

        if ob.previous_driver_id is None:
            change_type = "new"
        elif ob.previous_driver_id != drv_id:
            change_type = "reassigned"
        elif (
            ob.previous_pickup_minute is not None
            and abs(ob.previous_pickup_minute - pick_min) > 0.5
        ) or (
            ob.previous_dropoff_minute is not None
            and abs(ob.previous_dropoff_minute - drop_min) > 0.5
        ):
            change_type = "rescheduled"
        else:
            change_type = "unchanged"

        assignments.append(
            LegAssignmentSummary(
                obligation_id=ob_id,
                booking_id=ob.booking_id,
                therapist_id=ob.therapist_id,
                leg_type=ob.leg_type,
                driver_id=drv_id,
                pickup_minute=pick_min,
                dropoff_minute=drop_min,
                direct_travel_minutes=direct_min,
                ride_duration_minutes=ride_dur,
                therapist_wait_minutes=wait_min,
                on_time=on_time,
                is_pooled_leg=is_pooled,
                change_type=change_type,
                previous_driver_id=ob.previous_driver_id,
            )
        )

    return routes, assignments, assigned_ob_ids


def _build_collection_coverage(
    ctx: ValidatedContext,
    assignments: list[LegAssignmentSummary],
    unassigned_by_id: dict[str, UnassignedObligation],
) -> tuple[list[CollectionCoverageEntry], float]:
    """Summarize paired delivery, collection, and conditional return decisions per (booking_id, therapist_id)."""
    assign_by_ob = {a.obligation_id: a for a in assignments}
    decision_by_key = {(d.booking_id, d.therapist_id): d for d in ctx.return_decisions}
    grouped: dict[tuple[str, str], dict[str, TransportObligationInput]] = {}

    for ob in ctx.obligations:
        if ob.operational_state == "cancelled":
            continue
        key = (ob.booking_id, ob.therapist_id)
        grouped.setdefault(key, {})[ob.leg_type] = ob
    for ob in ctx.withheld_undecided_deliveries:
        key = (ob.booking_id, ob.therapist_id)
        grouped.setdefault(key, {}).setdefault("delivery", ob)
    for key in decision_by_key:
        grouped.setdefault(key, {})

    entries: list[CollectionCoverageEntry] = []
    requiring_or_unresolved = 0
    covered_collections = 0

    for (booking_id, therapist_id), legs in grouped.items():
        del_ob = legs.get("delivery")
        col_ob = legs.get("collection")
        decision = decision_by_key.get((booking_id, therapist_id))
        del_assign = assign_by_ob.get(del_ob.obligation_id) if del_ob else None
        col_assign = assign_by_ob.get(col_ob.obligation_id) if col_ob else None

        del_drv = del_assign.driver_id if del_assign else None
        col_drv = col_assign.driver_id if col_assign else None

        req_class = decision.requirement if decision else ("required" if col_ob else "undecided")
        reason_code = decision.reason_code if decision else None
        decision_source = decision.decision_source if decision else None

        if req_class == "not_required":
            entries.append(
                CollectionCoverageEntry(
                    booking_id=booking_id,
                    therapist_id=therapist_id,
                    delivery_obligation_id=del_ob.obligation_id if del_ob else None,
                    collection_obligation_id=None,
                    delivery_driver_id=del_drv,
                    collection_driver_id=None,
                    split_driver_coverage=False,
                    return_requirement="not_required",
                    reason_code=reason_code,
                    decision_source=decision_source,
                    coverage_status="not_required_excluded",
                )
            )
            continue

        if req_class == "undecided":
            requiring_or_unresolved += 1
            entries.append(
                CollectionCoverageEntry(
                    booking_id=booking_id,
                    therapist_id=therapist_id,
                    delivery_obligation_id=del_ob.obligation_id if del_ob else None,
                    collection_obligation_id=None,
                    delivery_driver_id=del_drv,
                    collection_driver_id=None,
                    split_driver_coverage=False,
                    return_requirement="undecided",
                    reason_code=reason_code,
                    decision_source=decision_source,
                    coverage_status="unresolved_collection_undecided",
                )
            )
            continue

        if col_ob is None:
            entries.append(
                CollectionCoverageEntry(
                    booking_id=booking_id,
                    therapist_id=therapist_id,
                    delivery_obligation_id=del_ob.obligation_id if del_ob else None,
                    delivery_driver_id=del_drv,
                    return_requirement=req_class,
                    reason_code=reason_code,
                    decision_source=decision_source,
                    coverage_status="delivery_only_no_collection_requested",
                )
            )
            continue

        requiring_or_unresolved += 1
        col_covered = col_assign is not None or col_ob.operational_state == "completed"
        if col_covered:
            covered_collections += 1

        if del_ob is None or del_ob.operational_state == "completed":
            status = "collection_only_covered" if col_covered else "uncovered_collection"
            split = False
        elif del_assign is not None and col_covered:
            split = bool(del_drv and col_drv and del_drv != col_drv)
            status = "covered_split_driver" if split else "covered_same_driver"
        elif del_assign is None and del_ob.obligation_id in unassigned_by_id and not col_covered:
            del_reasons = unassigned_by_id[del_ob.obligation_id].reasons
            status = (
                "delivery_blocked_no_collection"
                if "collection_coverage_conflict" in del_reasons
                else "uncovered_collection"
            )
            split = False
        else:
            status = "uncovered_collection"
            split = False

        entries.append(
            CollectionCoverageEntry(
                booking_id=booking_id,
                therapist_id=therapist_id,
                delivery_obligation_id=del_ob.obligation_id if del_ob else None,
                collection_obligation_id=col_ob.obligation_id,
                delivery_driver_id=del_drv,
                collection_driver_id=col_drv,
                split_driver_coverage=split,
                return_requirement="required",
                reason_code=reason_code,
                decision_source=decision_source,
                coverage_status=status,
            )
        )

    cov_rate = (
        covered_collections / requiring_or_unresolved if requiring_or_unresolved > 0 else 1.0
    )
    return entries, cov_rate


def _evaluate_collection_safety(
    ctx: ValidatedContext,
    cov_rate: float,
    feasibility_status: str,
    violations: list[str],
) -> tuple[list[Any], bool, bool]:
    unresolved = [d for d in ctx.return_decisions if d.requirement == "undecided"]
    safe = (
        len(unresolved) == 0
        and cov_rate >= 1.0 - 1e-9
        and len(violations) == 0
        and feasibility_status in ("feasible", "partial")
    )
    commit_ok = safe and len(ctx.withheld_undecided_deliveries) == 0
    return unresolved, safe, commit_ok


def _withheld_unassigned_entries(ctx: ValidatedContext) -> list[UnassignedObligation]:
    decision_by_key = {(d.booking_id, d.therapist_id): d for d in ctx.return_decisions}
    out: list[UnassignedObligation] = []
    for ob in ctx.withheld_undecided_deliveries:
        dec = decision_by_key.get((ob.booking_id, ob.therapist_id))
        reason = dec.reason_code if dec else "undecided_collection_requirement"
        out.append(
            UnassignedObligation(
                obligation_id=ob.obligation_id,
                booking_id=ob.booking_id,
                therapist_id=ob.therapist_id,
                leg_type=ob.leg_type,
                reasons=["undecided_collection_requirement", reason],
                detail=(
                    f"Delivery '{ob.obligation_id}' withheld from commitment until undecided "
                    f"collection requirement ({reason}) is resolved."
                ),
            )
        )
    return out


def _empty_idle_routes(request: OptimizeRequest) -> list[DriverRoutePlan]:
    routes: list[DriverRoutePlan] = []
    for drv in request.drivers:
        avail_min = compute_driver_available_minutes(drv)
        util = round(drv.existing_committed_workload_minutes / avail_min, 4) if avail_min > 0 else 0.0
        routes.append(
            DriverRoutePlan(
                driver_id=drv.driver_id,
                driver_name=drv.name or drv.driver_id,
                vehicle_capacity=drv.vehicle_capacity,
                stops=[],
                assigned_obligation_ids=[],
                driving_minutes=0.0,
                empty_driving_minutes=0.0,
                distance_km=0.0,
                empty_distance_km=0.0,
                handling_minutes=0.0,
                idle_wait_minutes=0.0,
                shift_span_minutes=0.0,
                existing_committed_workload_minutes=drv.existing_committed_workload_minutes,
                new_workload_minutes=0.0,
                total_workload_minutes=drv.existing_committed_workload_minutes,
                available_shift_minutes=round(avail_min, 2),
                workload_utilization_ratio=util,
                peak_occupancy=0,
                returns_to_branch=False,
            )
        )
    return routes


def _collect_unassigned_obligations(
    pending_all: list[TransportObligationInput],
    assigned_ids: set[str],
    compiled: CompiledRoutingModel,
    collection_blocked_deliveries: dict[str, tuple[str, list[str]]],
    request: OptimizeRequest,
    ctx: ValidatedContext,
) -> list[UnassignedObligation]:
    pre_unassigned_map = {
        ob.obligation_id: (reasons, detail)
        for ob, reasons, detail in compiled.pre_unassigned
    }
    all_unassigned_ids = {
        ob.obligation_id for ob in pending_all if ob.obligation_id not in assigned_ids
    }
    unassigned_list: list[UnassignedObligation] = []
    for ob in pending_all:
        if ob.obligation_id in assigned_ids:
            continue
        if ob.obligation_id in pre_unassigned_map:
            r_codes, detail = pre_unassigned_map[ob.obligation_id]
            unassigned_list.append(
                UnassignedObligation(
                    obligation_id=ob.obligation_id,
                    booking_id=ob.booking_id,
                    therapist_id=ob.therapist_id,
                    leg_type=ob.leg_type,
                    reasons=r_codes,
                    detail=detail,
                )
            )
        elif ob.obligation_id in collection_blocked_deliveries:
            col_id, col_reasons = collection_blocked_deliveries[ob.obligation_id]
            dedup_reasons = ["collection_coverage_conflict"]
            for r in col_reasons:
                if r not in dedup_reasons:
                    dedup_reasons.append(r)
            unassigned_list.append(
                UnassignedObligation(
                    obligation_id=ob.obligation_id,
                    booking_id=ob.booking_id,
                    therapist_id=ob.therapist_id,
                    leg_type=ob.leg_type,
                    reasons=dedup_reasons,
                    detail=f"Delivery '{ob.obligation_id}' withheld because paired collection '{col_id}' lacks feasible coverage.",
                )
            )
        else:
            unassigned_list.append(
                diagnose_unassigned_obligation(
                    ob,
                    request,
                    ctx.location_index_by_id,
                    all_unassigned_ids,
                    ctx.obligations_by_id,
                )
            )
    unassigned_list.extend(_withheld_unassigned_entries(ctx))
    return unassigned_list


def optimize_dispatch(request: OptimizeRequest) -> OptimizationResponse:
    """Solve a synthetic CradleHub dispatch snapshot using Google OR-Tools."""
    t0 = time.perf_counter()
    ctx = validate_request_integrity(request)
    pending_all = [
        ob for ob in ctx.obligations if ob.operational_state not in ("completed", "cancelled")
    ]

    if not pending_all:
        routes = _empty_idle_routes(request)
        withheld_unassigned = _withheld_unassigned_entries(ctx)
        unassigned_by_id = {u.obligation_id: u for u in withheld_unassigned}
        cov_entries, cov_rate = _build_collection_coverage(ctx, [], unassigned_by_id)
        metrics = compute_fleet_metrics(request, routes, [], withheld_unassigned, cov_rate)
        feas = "infeasible" if withheld_unassigned else "feasible"
        unresolved, plan_safe, commit_ok = _evaluate_collection_safety(ctx, cov_rate, feas, [])
        return OptimizationResponse(
            snapshot_id=request.snapshot_id,
            feasibility_status=feas,
            all_obligations_served=(not withheld_unassigned),
            collection_plan_safe=plan_safe,
            operational_commitment_allowed=commit_ok,
            routes=routes,
            assignments=[],
            return_decisions=ctx.return_decisions,
            unresolved_collection_requirements=unresolved,
            collection_coverage=cov_entries,
            unassigned_obligations=withheld_unassigned,
            constraint_violations=[],
            infeasibility_reasons=[u.detail for u in withheld_unassigned],
            metrics=metrics,
            diagnostics=SolverDiagnostics(
                ortools_version=ortools.__version__,
                routing_status_code=7,
                routing_status_name="ROUTING_OPTIMAL",
                objective_value=0,
                solver_duration_ms=round((time.perf_counter() - t0) * 1000, 2),
                time_limit_seconds=request.config.solver_time_limit_seconds,
                timed_out=False,
                first_solution_strategy="NONE_NEEDED",
                local_search_metaheuristic="NONE_NEEDED",
                solution_guarantee="heuristic_time_bounded",
                verified_hard_constraints=True,
            ),
            matrix_version=request.travel_info.matrix_version,
        )

    coupled_excluded: set[str] = set()
    collection_blocked_deliveries: dict[str, tuple[str, list[str]]] = {}
    max_coupling_passes = max(1, len(pending_all))

    final_compiled: CompiledRoutingModel | None = None
    final_assignment: pywrapcp.Assignment | None = None
    final_status_code = 0
    final_fss_name = "PARALLEL_CHEAPEST_INSERTION"

    for _ in range(max_coupling_passes):
        final_assignment = None
        compiled = build_routing_model(request, ctx, excluded_obligation_ids=coupled_excluded)
        assert compiled is not None
        final_compiled = compiled

        if compiled.locked_infeasibility_reasons or not compiled.routed_obligations:
            if not compiled.locked_infeasibility_reasons and not compiled.routed_obligations:
                final_status_code = 6
                final_fss_name = "PRESOLVE_FILTERED"
            break

        limit_ms = int(round(request.config.solver_time_limit_seconds * 1000))
        params = _build_search_parameters(
            request.config,
            routing_enums_pb2.FirstSolutionStrategy.PARALLEL_CHEAPEST_INSERTION,
            limit_ms,
        )
        assignment = compiled.routing.SolveWithParameters(params)
        status_code = int(compiled.routing.status())
        fss_name = "PARALLEL_CHEAPEST_INSERTION"

        # Fallback construction heuristic if PCI returned FAIL (not timeout)
        if assignment is None and status_code != 4:
            fallback_params = _build_search_parameters(
                request.config,
                routing_enums_pb2.FirstSolutionStrategy.AUTOMATIC,
                max(100, limit_ms // 2),
            )
            assignment = compiled.routing.SolveWithParameters(fallback_params)
            status_code = int(compiled.routing.status())
            fss_name = "AUTOMATIC"

        final_assignment = assignment
        final_status_code = status_code
        final_fss_name = fss_name

        if assignment is None:
            break

        # Check if any unstarted delivery was dispatched without its required paired collection
        _, _, assigned_ids = _extract_routes_and_assignments(
            request, ctx, compiled, assignment
        )
        newly_blocked = False
        for ob in compiled.routed_obligations:
            if not ob.linked_delivery_obligation_id or not ob.require_collection_coverage:
                continue
            del_id = ob.linked_delivery_obligation_id
            del_ob = ctx.obligations_by_id.get(del_id)
            if (
                del_ob
                and del_ob.obligation_id in assigned_ids
                and ob.obligation_id not in assigned_ids
                and not del_ob.is_locked
                and del_ob.operational_state not in ("onboard", "en_route_pickup")
            ):
                coupled_excluded.add(del_ob.obligation_id)
                coupled_excluded.add(ob.obligation_id)
                diag = diagnose_unassigned_obligation(
                    ob,
                    request,
                    ctx.location_index_by_id,
                    set(pending_ob.obligation_id for pending_ob in pending_all if pending_ob.obligation_id not in assigned_ids),
                    ctx.obligations_by_id,
                )
                collection_blocked_deliveries[del_ob.obligation_id] = (
                    ob.obligation_id,
                    diag.reasons,
                )
                newly_blocked = True

        if not newly_blocked:
            break

    assert final_compiled is not None
    elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)

    # Case A: Locked conflict or no active drivers or solver failed to return assignment
    if final_compiled.locked_infeasibility_reasons or final_assignment is None:
        routes = _empty_idle_routes(request)
        if final_compiled.locked_infeasibility_reasons:
            reasons = list(final_compiled.locked_infeasibility_reasons)
            status_name = "PRESOLVE_INFEASIBLE"
            status_code = 6
            timed_out = False
        else:
            status_code = final_status_code
            status_name = _routing_status_name(status_code)
            timed_out = status_code == 4
            reasons = (
                ["Solver exceeded configured time limit before finding a valid assignment."]
                if timed_out
                else [f"OR-Tools could not find a feasible solution (status={status_name})."]
            )

        unassigned_list = _collect_unassigned_obligations(
            pending_all=pending_all,
            assigned_ids=set(),
            compiled=final_compiled,
            collection_blocked_deliveries=collection_blocked_deliveries,
            request=request,
            ctx=ctx,
        )
        unassigned_by_id = {u.obligation_id: u for u in unassigned_list}
        cov_entries, cov_rate = _build_collection_coverage(ctx, [], unassigned_by_id)
        metrics = compute_fleet_metrics(request, routes, [], unassigned_list, cov_rate)
        feas_fail = "timeout" if timed_out else "infeasible"
        unresolved, plan_safe, commit_ok = _evaluate_collection_safety(ctx, cov_rate, feas_fail, [])
        return OptimizationResponse(
            snapshot_id=request.snapshot_id,
            feasibility_status=feas_fail,
            all_obligations_served=False,
            collection_plan_safe=plan_safe,
            operational_commitment_allowed=commit_ok,
            routes=routes,
            assignments=[],
            return_decisions=ctx.return_decisions,
            unresolved_collection_requirements=unresolved,
            collection_coverage=cov_entries,
            unassigned_obligations=unassigned_list,
            constraint_violations=[],
            infeasibility_reasons=reasons,
            metrics=metrics,
            diagnostics=SolverDiagnostics(
                ortools_version=ortools.__version__,
                routing_status_code=status_code,
                routing_status_name=status_name,
                objective_value=None,
                solver_duration_ms=elapsed_ms,
                time_limit_seconds=request.config.solver_time_limit_seconds,
                timed_out=timed_out,
                first_solution_strategy=final_fss_name,
                local_search_metaheuristic=request.config.local_search_metaheuristic.upper(),
                solution_guarantee=(
                    "presolve_rejected"
                    if final_compiled.locked_infeasibility_reasons
                    else "heuristic_time_bounded"
                ),
                verified_hard_constraints=True,
            ),
            matrix_version=request.travel_info.matrix_version,
        )

    # Case B: Assignment extracted (full or partial)
    routes, assignments, assigned_ids = _extract_routes_and_assignments(
        request, ctx, final_compiled, final_assignment
    )

    unassigned_list = _collect_unassigned_obligations(
        pending_all=pending_all,
        assigned_ids=assigned_ids,
        compiled=final_compiled,
        collection_blocked_deliveries=collection_blocked_deliveries,
        request=request,
        ctx=ctx,
    )
    violations = verify_solution_hard_constraints(
        request, routes, ctx.obligations_by_id, ctx.location_index_by_id
    )
    infeasibility_reasons = [u.detail for u in unassigned_list]
    if violations:
        feasibility_status = "infeasible"
    elif not unassigned_list:
        feasibility_status = "feasible"
    elif assignments and request.config.allow_partial_service:
        feasibility_status = "partial"
    else:
        feasibility_status = "infeasible"

    # Never present routes if violations occurred or partial service was forbidden
    if violations or (not request.config.allow_partial_service and unassigned_list):
        routes = _empty_idle_routes(request)
        assignments = []

    unassigned_by_id = {u.obligation_id: u for u in unassigned_list}
    cov_entries, cov_rate = _build_collection_coverage(ctx, assignments, unassigned_by_id)
    metrics = compute_fleet_metrics(request, routes, assignments, unassigned_list, cov_rate)
    unresolved, plan_safe, commit_ok = _evaluate_collection_safety(
        ctx, cov_rate, feasibility_status, violations
    )

    return OptimizationResponse(
        snapshot_id=request.snapshot_id,
        feasibility_status=feasibility_status,
        all_obligations_served=(len(unassigned_list) == 0 and len(violations) == 0),
        collection_plan_safe=plan_safe,
        operational_commitment_allowed=commit_ok,
        routes=routes,
        assignments=assignments,
        return_decisions=ctx.return_decisions,
        unresolved_collection_requirements=unresolved,
        collection_coverage=cov_entries,
        unassigned_obligations=unassigned_list,
        constraint_violations=violations,
        infeasibility_reasons=infeasibility_reasons,
        metrics=metrics,
        diagnostics=SolverDiagnostics(
            ortools_version=ortools.__version__,
            routing_status_code=final_status_code,
            routing_status_name=_routing_status_name(final_status_code),
            objective_value=int(final_assignment.ObjectiveValue()),
            solver_duration_ms=elapsed_ms,
            time_limit_seconds=request.config.solver_time_limit_seconds,
            timed_out=(final_status_code == 4),
            first_solution_strategy=final_fss_name,
            local_search_metaheuristic=request.config.local_search_metaheuristic.upper(),
            solution_guarantee="heuristic_time_bounded",
            verified_hard_constraints=(len(violations) == 0),
        ),
        matrix_version=request.travel_info.matrix_version,
    )


def solve_greedy_baseline(request: OptimizeRequest) -> OptimizationResponse:
    """Simple unpooled greedy nearest-driver baseline (with return-to-branch after deliveries).

    Models current single-trip dispatch behavior for /v1/simulate comparisons.
    """
    t0 = time.perf_counter()
    ctx = validate_request_integrity(request)
    travel_time = request.travel_info.travel_time_minutes
    travel_dist = request.travel_info.travel_distance_km
    loc_idx = ctx.location_index_by_id

    pending = sorted(
        [ob for ob in ctx.obligations if ob.operational_state not in ("completed", "cancelled")],
        key=lambda o: (o.dropoff_window.latest_minute, o.pickup_window.earliest_minute, o.obligation_id),
    )

    # Track per-driver mutable cursor state
    state: dict[str, dict[str, Any]] = {}
    for drv in request.drivers:
        initial_onboard = sum(
            ob.passenger_count
            for ob in pending
            if ob.operational_state == "onboard" and ob.locked_driver_id == drv.driver_id
        )
        start_loc = ctx.locations_by_id[drv.start_location_id]
        start_time = drv.effective_available_from()
        state[drv.driver_id] = {
            "driver": drv,
            "loc_id": drv.start_location_id,
            "time": start_time,
            "start_time": start_time,
            "drive_min": 0.0,
            "empty_drive_min": 0.0,
            "dist_km": 0.0,
            "empty_dist_km": 0.0,
            "handling_min": 0.0,
            "idle_min": 0.0,
            "ob_ids": [],
            "peak_occ": initial_onboard,
            "occ": initial_onboard,
            "stops": [
                StopSchedule(
                    sequence_index=0,
                    stop_type="driver_start",
                    location_id=drv.start_location_id,
                    location_label=start_loc.label or start_loc.location_id,
                    arrival_minute=start_time,
                    service_start_minute=start_time,
                    departure_minute=start_time,
                    wait_minutes=0.0,
                    handling_minutes=0.0,
                    driving_minutes_from_prev=0.0,
                    distance_km_from_prev=0.0,
                    occupancy_before=initial_onboard,
                    occupancy_after=initial_onboard,
                )
            ]
            if drv.is_available and drv.effective_available_duration() > 0
            else [],
        }

    assigned_times: dict[str, tuple[str, float, float]] = {}
    unassigned_ids: set[str] = set()

    # First handle onboard locked obligations, then remaining obligations one-by-one unpooled
    ordered_pending = sorted(
        pending,
        key=lambda o: (0 if o.operational_state == "onboard" else 1, o.pickup_window.earliest_minute),
    )

    for ob in ordered_pending:
        # Respect coupled delivery timing if delivery already dropped or scheduled
        min_pickup_from_del = 0.0
        if ob.linked_delivery_obligation_id:
            if ob.linked_delivery_obligation_id in unassigned_ids:
                unassigned_ids.add(ob.obligation_id)
                continue
            if ob.linked_delivery_obligation_id in assigned_times:
                _, _, del_drop = assigned_times[ob.linked_delivery_obligation_id]
                min_pickup_from_del = del_drop + (ob.estimated_service_duration_minutes or 0.0)

        best_candidate: tuple[float, DriverInput, dict[str, Any]] | None = None
        for drv in request.drivers:
            reasons = check_driver_obligation_compatibility(drv, ob, travel_time, loc_idx)
            if reasons:
                continue
            st = state[drv.driver_id]
            if drv.max_stops is not None:
                added = 1 if ob.operational_state == "onboard" else 2
                cur_stops = sum(1 for s in st["stops"] if s.stop_type in ("pickup", "dropoff"))
                if cur_stops + added > drv.max_stops:
                    continue

            cur_u = loc_idx[st["loc_id"]]
            p_u = loc_idx[ob.pickup_location_id]
            d_u = loc_idx[ob.dropoff_location_id]
            avail_until = drv.effective_available_until()

            if ob.operational_state == "onboard":
                d_min = travel_time[cur_u][d_u]
                arr = st["time"] + d_min
                if arr > ob.dropoff_window.latest_minute:
                    continue
                svc = max(arr, ob.dropoff_window.earliest_minute)
                dep = svc + ob.dropoff_handling_minutes
                ret_min = (
                    travel_time[d_u][loc_idx[drv.return_to_location_id]]
                    if drv.return_to_location_id
                    else 0.0
                )
                if dep + ret_min > avail_until:
                    continue
                best_candidate = (d_min, drv, {"mode": "onboard", "d_min": d_min, "arr": arr, "svc": svc, "dep": dep})
                break

            # Unpooled single-leg trip from current driver position -> pickup -> dropoff
            if st["occ"] + ob.passenger_count > drv.vehicle_capacity:
                continue
            d_to_p = travel_time[cur_u][p_u]
            arr_p = st["time"] + d_to_p
            p_early, p_late = effective_pickup_window(ob)
            p_early = max(p_early, min_pickup_from_del)
            if arr_p > p_late or p_early > p_late:
                continue
            svc_p = max(arr_p, p_early)
            dep_p = svc_p + ob.pickup_handling_minutes

            d_p_d = travel_time[p_u][d_u]
            arr_d = dep_p + d_p_d
            if arr_d > ob.dropoff_window.latest_minute:
                continue
            svc_d = max(arr_d, ob.dropoff_window.earliest_minute)
            if ob.max_ride_minutes is not None and (svc_d - svc_p) > ob.max_ride_minutes:
                continue
            dep_d = svc_d + ob.dropoff_handling_minutes
            ret_min = (
                travel_time[d_u][loc_idx[drv.return_to_location_id]]
                if drv.return_to_location_id
                else 0.0
            )
            if dep_d + ret_min > avail_until:
                continue

            total_added_drive = d_to_p + d_p_d
            if best_candidate is None or total_added_drive < best_candidate[0]:
                best_candidate = (
                    total_added_drive,
                    drv,
                    {
                        "mode": "pair",
                        "d_to_p": d_to_p,
                        "arr_p": arr_p,
                        "svc_p": svc_p,
                        "dep_p": dep_p,
                        "d_p_d": d_p_d,
                        "arr_d": arr_d,
                        "svc_d": svc_d,
                        "dep_d": dep_d,
                    },
                )

        if best_candidate is None:
            unassigned_ids.add(ob.obligation_id)
            continue

        _, drv, sim = best_candidate
        st = state[drv.driver_id]
        if sim["mode"] == "onboard":
            d_min = sim["d_min"]
            d_km = travel_dist[loc_idx[st["loc_id"]]][loc_idx[ob.dropoff_location_id]]
            st["drive_min"] += d_min
            st["dist_km"] += d_km
            st["handling_min"] += ob.dropoff_handling_minutes
            wait_d = max(0.0, sim["svc"] - sim["arr"])
            st["idle_min"] += wait_d
            occ_before = st["occ"]
            st["occ"] -= ob.passenger_count
            drop_loc = ctx.locations_by_id[ob.dropoff_location_id]
            st["stops"].append(
                StopSchedule(
                    sequence_index=len(st["stops"]),
                    obligation_id=ob.obligation_id,
                    booking_id=ob.booking_id,
                    therapist_id=ob.therapist_id,
                    leg_type=ob.leg_type,
                    stop_type="dropoff",
                    location_id=ob.dropoff_location_id,
                    location_label=drop_loc.label or drop_loc.location_id,
                    arrival_minute=round(sim["arr"], 2),
                    service_start_minute=round(sim["svc"], 2),
                    departure_minute=round(sim["dep"], 2),
                    wait_minutes=round(wait_d, 2),
                    handling_minutes=ob.dropoff_handling_minutes,
                    driving_minutes_from_prev=round(d_min, 2),
                    distance_km_from_prev=round(d_km, 3),
                    occupancy_before=occ_before,
                    occupancy_after=st["occ"],
                    is_locked=True,
                )
            )
            st["loc_id"] = ob.dropoff_location_id
            st["time"] = sim["dep"]
            st["ob_ids"].append(ob.obligation_id)
            pick_t = ob.previous_pickup_minute if ob.previous_pickup_minute is not None else sim["svc"]
            assigned_times[ob.obligation_id] = (drv.driver_id, round(pick_t, 2), round(sim["svc"], 2))
        else:
            d1 = sim["d_to_p"]
            k1 = travel_dist[loc_idx[st["loc_id"]]][loc_idx[ob.pickup_location_id]]
            d2 = sim["d_p_d"]
            k2 = travel_dist[loc_idx[ob.pickup_location_id]][loc_idx[ob.dropoff_location_id]]
            if st["occ"] == 0:
                st["empty_drive_min"] += d1
                st["empty_dist_km"] += k1
            st["drive_min"] += d1 + d2
            st["dist_km"] += k1 + k2
            st["handling_min"] += ob.pickup_handling_minutes + ob.dropoff_handling_minutes
            wait_p = max(0.0, sim["svc_p"] - sim["arr_p"])
            wait_d = max(0.0, sim["svc_d"] - sim["arr_d"])
            st["idle_min"] += wait_p + wait_d

            occ_before_p = st["occ"]
            occ_after_p = occ_before_p + ob.passenger_count
            st["peak_occ"] = max(st["peak_occ"], occ_after_p)
            p_loc = ctx.locations_by_id[ob.pickup_location_id]
            d_loc = ctx.locations_by_id[ob.dropoff_location_id]
            st["stops"].append(
                StopSchedule(
                    sequence_index=len(st["stops"]),
                    obligation_id=ob.obligation_id,
                    booking_id=ob.booking_id,
                    therapist_id=ob.therapist_id,
                    leg_type=ob.leg_type,
                    stop_type="pickup",
                    location_id=ob.pickup_location_id,
                    location_label=p_loc.label or p_loc.location_id,
                    arrival_minute=round(sim["arr_p"], 2),
                    service_start_minute=round(sim["svc_p"], 2),
                    departure_minute=round(sim["dep_p"], 2),
                    wait_minutes=round(wait_p, 2),
                    handling_minutes=ob.pickup_handling_minutes,
                    driving_minutes_from_prev=round(d1, 2),
                    distance_km_from_prev=round(k1, 3),
                    occupancy_before=occ_before_p,
                    occupancy_after=occ_after_p,
                    is_locked=ob.is_locked,
                )
            )
            st["stops"].append(
                StopSchedule(
                    sequence_index=len(st["stops"]),
                    obligation_id=ob.obligation_id,
                    booking_id=ob.booking_id,
                    therapist_id=ob.therapist_id,
                    leg_type=ob.leg_type,
                    stop_type="dropoff",
                    location_id=ob.dropoff_location_id,
                    location_label=d_loc.label or d_loc.location_id,
                    arrival_minute=round(sim["arr_d"], 2),
                    service_start_minute=round(sim["svc_d"], 2),
                    departure_minute=round(sim["dep_d"], 2),
                    wait_minutes=round(wait_d, 2),
                    handling_minutes=ob.dropoff_handling_minutes,
                    driving_minutes_from_prev=round(d2, 2),
                    distance_km_from_prev=round(k2, 3),
                    occupancy_before=occ_after_p,
                    occupancy_after=occ_before_p,
                    is_locked=ob.is_locked,
                )
            )
            st["loc_id"] = ob.dropoff_location_id
            st["time"] = sim["dep_d"]
            st["ob_ids"].append(ob.obligation_id)
            assigned_times[ob.obligation_id] = (drv.driver_id, round(sim["svc_p"], 2), round(sim["svc_d"], 2))

    # Build baseline routes & assignments
    routes: list[DriverRoutePlan] = []
    for drv in request.drivers:
        st = state[drv.driver_id]
        returns_to_branch = False
        if st["ob_ids"] and drv.return_to_location_id is not None:
            returns_to_branch = True
            r_min = travel_time[loc_idx[st["loc_id"]]][loc_idx[drv.return_to_location_id]]
            r_km = travel_dist[loc_idx[st["loc_id"]]][loc_idx[drv.return_to_location_id]]
            st["drive_min"] += r_min
            st["dist_km"] += r_km
            if st["occ"] == 0:
                st["empty_drive_min"] += r_min
                st["empty_dist_km"] += r_km
            ret_loc = ctx.locations_by_id[drv.return_to_location_id]
            arr_ret = round(st["time"] + r_min, 2)
            st["stops"].append(
                StopSchedule(
                    sequence_index=len(st["stops"]),
                    stop_type="driver_return",
                    location_id=drv.return_to_location_id,
                    location_label=ret_loc.label or ret_loc.location_id,
                    arrival_minute=arr_ret,
                    service_start_minute=arr_ret,
                    departure_minute=arr_ret,
                    wait_minutes=0.0,
                    handling_minutes=0.0,
                    driving_minutes_from_prev=round(r_min, 2),
                    distance_km_from_prev=round(r_km, 3),
                    occupancy_before=st["occ"],
                    occupancy_after=st["occ"],
                )
            )
            st["time"] = arr_ret

        avail_min = compute_driver_available_minutes(drv)
        service_count = sum(1 for s in st["stops"] if s.stop_type in ("pickup", "dropoff"))
        new_work = round(
            st["drive_min"] + st["handling_min"] + service_count * request.config.stop_complexity_minutes,
            2,
        )
        total_work = round(drv.existing_committed_workload_minutes + new_work, 2)
        util = round(total_work / avail_min, 4) if avail_min > 0 else 0.0
        routes.append(
            DriverRoutePlan(
                driver_id=drv.driver_id,
                driver_name=drv.name or drv.driver_id,
                vehicle_capacity=drv.vehicle_capacity,
                stops=st["stops"],
                assigned_obligation_ids=st["ob_ids"],
                driving_minutes=round(st["drive_min"], 2),
                empty_driving_minutes=round(st["empty_drive_min"], 2),
                distance_km=round(st["dist_km"], 3),
                empty_distance_km=round(st["empty_dist_km"], 3),
                handling_minutes=round(st["handling_min"], 2),
                idle_wait_minutes=round(st["idle_min"], 2),
                shift_span_minutes=round(max(0.0, st["time"] - st["start_time"]), 2),
                existing_committed_workload_minutes=drv.existing_committed_workload_minutes,
                new_workload_minutes=new_work,
                total_workload_minutes=total_work,
                available_shift_minutes=round(avail_min, 2),
                workload_utilization_ratio=util,
                peak_occupancy=st["peak_occ"],
                returns_to_branch=returns_to_branch,
            )
        )

    routes_by_id = {r.driver_id: r for r in routes}
    assignments: list[LegAssignmentSummary] = []
    for ob_id, (drv_id, pick_min, drop_min) in sorted(assigned_times.items()):
        ob = ctx.obligations_by_id[ob_id]
        direct_min = round(
            float(travel_time[loc_idx[ob.pickup_location_id]][loc_idx[ob.dropoff_location_id]]), 2
        )
        ready = ob.expected_ready_minute if ob.expected_ready_minute is not None else ob.pickup_window.earliest_minute
        wait_min = round(max(0.0, pick_min - ready), 2) if ob.leg_type == "collection" else 0.0
        target = ob.target_arrival_minute if ob.target_arrival_minute is not None else ob.dropoff_window.latest_minute
        route = routes_by_id[drv_id]
        assignments.append(
            LegAssignmentSummary(
                obligation_id=ob_id,
                booking_id=ob.booking_id,
                therapist_id=ob.therapist_id,
                leg_type=ob.leg_type,
                driver_id=drv_id,
                pickup_minute=pick_min,
                dropoff_minute=drop_min,
                direct_travel_minutes=direct_min,
                ride_duration_minutes=round(max(0.0, drop_min - pick_min), 2),
                therapist_wait_minutes=wait_min,
                on_time=(drop_min <= target + 1e-4),
                is_pooled_leg=(route.peak_occupancy > ob.passenger_count),
                change_type="new" if ob.previous_driver_id is None else ("reassigned" if ob.previous_driver_id != drv_id else "unchanged"),
                previous_driver_id=ob.previous_driver_id,
            )
        )

    unassigned = [
        diagnose_unassigned_obligation(
            ctx.obligations_by_id[ob_id], request, loc_idx, unassigned_ids, ctx.obligations_by_id
        )
        for ob_id in sorted(unassigned_ids)
    ]
    unassigned.extend(_withheld_unassigned_entries(ctx))
    unassigned_by_id = {u.obligation_id: u for u in unassigned}
    cov_entries, cov_rate = _build_collection_coverage(ctx, assignments, unassigned_by_id)
    metrics = compute_fleet_metrics(request, routes, assignments, unassigned, cov_rate)
    violations = verify_solution_hard_constraints(request, routes, ctx.obligations_by_id, loc_idx)
    feas = "feasible" if (not unassigned and not violations) else ("partial" if assignments else "infeasible")
    unresolved, plan_safe, commit_ok = _evaluate_collection_safety(ctx, cov_rate, feas, violations)

    return OptimizationResponse(
        snapshot_id=request.snapshot_id,
        feasibility_status=feas,
        all_obligations_served=(not unassigned and not violations),
        collection_plan_safe=plan_safe,
        operational_commitment_allowed=commit_ok,
        routes=routes,
        assignments=assignments,
        return_decisions=ctx.return_decisions,
        unresolved_collection_requirements=unresolved,
        collection_coverage=cov_entries,
        unassigned_obligations=unassigned,
        constraint_violations=violations,
        infeasibility_reasons=[u.detail for u in unassigned],
        metrics=metrics,
        diagnostics=SolverDiagnostics(
            ortools_version=ortools.__version__,
            routing_status_code=1,
            routing_status_name="GREEDY_UNPOOLED_BASELINE",
            objective_value=None,
            solver_duration_ms=round((time.perf_counter() - t0) * 1000, 2),
            time_limit_seconds=request.config.solver_time_limit_seconds,
            timed_out=False,
            first_solution_strategy="GREEDY_CHRONOLOGICAL_UNPOOLED",
            local_search_metaheuristic="NONE",
            solution_guarantee="heuristic_time_bounded",
            verified_hard_constraints=(len(violations) == 0),
        ),
        matrix_version=request.travel_info.matrix_version,
    )


def run_simulation_comparison(
    request: OptimizeRequest,
    scenario_name: str,
    compare_fairness: bool = True,
) -> SimulationResponse:
    """Compare baseline unpooled greedy dispatch vs OR-Tools optimized fleet plan."""
    baseline = solve_greedy_baseline(request)
    optimized = optimize_dispatch(request)

    fairness_off_res: OptimizationResponse | None = None
    notes: list[str] = []
    if compare_fairness:
        req_no_fair = request.model_copy(
            update={
                "config": request.config.model_copy(update={"fairness_weight": 0.0})
            }
        )
        fairness_off_res = optimize_dispatch(req_no_fair)
        spread_delta = round(
            fairness_off_res.metrics.workload_utilization_spread
            - optimized.metrics.workload_utilization_spread,
            4,
        )
        drive_delta = round(
            optimized.metrics.total_driving_minutes
            - fairness_off_res.metrics.total_driving_minutes,
            2,
        )
        notes.append(
            f"Fairness-aware mode changed workload spread by {-spread_delta:+.4f} "
            f"(from {fairness_off_res.metrics.workload_utilization_spread:.4f} to "
            f"{optimized.metrics.workload_utilization_spread:.4f}) with {drive_delta:+.2f} driving min delta."
        )

    delta = SimulationDelta(
        driving_minutes_saved=round(
            baseline.metrics.total_driving_minutes - optimized.metrics.total_driving_minutes, 2
        ),
        distance_km_saved=round(
            baseline.metrics.total_distance_km - optimized.metrics.total_distance_km, 3
        ),
        empty_driving_minutes_saved=round(
            baseline.metrics.total_empty_driving_minutes - optimized.metrics.total_empty_driving_minutes,
            2,
        ),
        empty_distance_km_saved=round(
            baseline.metrics.total_empty_distance_km - optimized.metrics.total_empty_distance_km,
            3,
        ),
        workload_spread_reduction=round(
            baseline.metrics.workload_utilization_spread - optimized.metrics.workload_utilization_spread,
            4,
        ),
        served_obligation_delta=(
            optimized.metrics.served_obligation_count - baseline.metrics.served_obligation_count
        ),
        collection_coverage_delta=round(
            optimized.metrics.collection_coverage_rate - baseline.metrics.collection_coverage_rate,
            4,
        ),
    )

    return SimulationResponse(
        scenario_name=scenario_name,
        baseline_strategy="greedy_unpooled_nearest_driver",
        baseline_metrics=baseline.metrics,
        optimized_metrics=optimized.metrics,
        delta_vs_baseline=delta,
        baseline_result=baseline,
        optimized_result=optimized,
        fairness_off_metrics=fairness_off_res.metrics if fairness_off_res else None,
        fairness_off_result=fairness_off_res,
        fairness_vs_efficiency_notes=notes,
    )
