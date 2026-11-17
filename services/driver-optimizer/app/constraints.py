"""OR-Tools VRPPD routing model builder: constraints, windows, capacity, locking, and collection coupling."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from ortools.constraint_solver import pywrapcp

from app.fairness import COST_UNITS_PER_MINUTE, register_fairness_dimension
from app.models import (
    DriverInput,
    OptimizeRequest,
    TransportObligationInput,
)
from app.validation import (
    ValidatedContext,
    check_driver_obligation_compatibility,
    effective_pickup_window,
)

TIME_SCALE_SECONDS = 60


def _restrict_vehicles_for_index(
    routing: pywrapcp.RoutingModel,
    num_vehicles: int,
    idx: int,
    allowed_vehicles: list[int],
    allow_drop: bool,
) -> None:
    """Restrict routing.VehicleVar(idx) using IntVar methods compatible with OR-Tools 9.15."""
    var = routing.VehicleVar(idx)
    if not allow_drop and len(allowed_vehicles) == 1:
        var.SetValue(allowed_vehicles[0])
        return
    allowed_set = set(allowed_vehicles)
    for v in range(num_vehicles):
        if v not in allowed_set:
            var.RemoveValue(v)
    if not allow_drop:
        var.RemoveValue(-1)


@dataclass
class CompiledRoutingModel:
    manager: pywrapcp.RoutingIndexManager
    routing: pywrapcp.RoutingModel
    time_dim: pywrapcp.RoutingDimension
    capacity_dim: pywrapcp.RoutingDimension
    workload_dim: pywrapcp.RoutingDimension | None
    active_drivers: list[DriverInput]
    routed_obligations: list[TransportObligationInput]
    node_meta: list[dict[str, Any]]
    ob_nodes: dict[str, tuple[int | None, int | None]]
    pre_unassigned: list[tuple[TransportObligationInput, list[str], str]]
    locked_infeasibility_reasons: list[str]


def build_routing_model(
    request: OptimizeRequest,
    ctx: ValidatedContext,
    excluded_obligation_ids: set[str] | None = None,
) -> CompiledRoutingModel | None:
    """Build the OR-Tools RoutingModel and dimensions for the given request.

    Returns None when zero active drivers exist or a locked obligation cannot be represented.
    """
    excluded = excluded_obligation_ids or set()
    active_drivers = [
        d for d in request.drivers if d.is_available and d.effective_available_duration() > 0.0
    ]
    driver_index_by_id = {d.driver_id: idx for idx, d in enumerate(active_drivers)}
    loc_idx_by_id = ctx.location_index_by_id
    travel_time = request.travel_info.travel_time_minutes
    travel_dist = request.travel_info.travel_distance_km
    config = request.config

    pending_obligations = [
        ob
        for ob in ctx.obligations
        if ob.operational_state not in ("completed", "cancelled")
        and ob.obligation_id not in excluded
    ]

    # Pre-check compatibility per obligation and detect locked conflicts early
    compat_map: dict[str, list[int]] = {}
    compat_reasons_map: dict[str, dict[str, list[str]]] = {}
    pre_unassigned: list[tuple[TransportObligationInput, list[str], str]] = []
    locked_failures: list[str] = []

    for ob in pending_obligations:
        eligible_vehicles: list[int] = []
        per_driver_reasons: dict[str, list[str]] = {}
        for v_idx, drv in enumerate(active_drivers):
            reasons = check_driver_obligation_compatibility(drv, ob, travel_time, loc_idx_by_id)
            if not reasons:
                eligible_vehicles.append(v_idx)
            else:
                per_driver_reasons[drv.driver_id] = reasons
        compat_map[ob.obligation_id] = eligible_vehicles
        compat_reasons_map[ob.obligation_id] = per_driver_reasons

        is_mandatory = ob.is_locked or ob.operational_state in ("onboard", "en_route_pickup")
        if is_mandatory:
            if not ob.locked_driver_id or ob.locked_driver_id not in driver_index_by_id:
                locked_failures.append(
                    f"Locked/active obligation '{ob.obligation_id}' references unavailable or unknown driver '{ob.locked_driver_id}'."
                )
            elif driver_index_by_id[ob.locked_driver_id] not in eligible_vehicles:
                reasons = per_driver_reasons.get(ob.locked_driver_id, ["incompatible"])
                locked_failures.append(
                    f"Locked/active obligation '{ob.obligation_id}' is infeasible for driver '{ob.locked_driver_id}': {', '.join(reasons)}."
                )

    # Check total initial onboard load per driver
    for v_idx, drv in enumerate(active_drivers):
        onboard_load = sum(
            ob.passenger_count
            for ob in pending_obligations
            if ob.operational_state == "onboard" and ob.locked_driver_id == drv.driver_id
        )
        if onboard_load > drv.vehicle_capacity:
            locked_failures.append(
                f"Driver '{drv.driver_id}' onboard passenger load ({onboard_load}) exceeds vehicle_capacity ({drv.vehicle_capacity})."
            )

    if not active_drivers or locked_failures:
        # Let caller produce clean infeasible response without constructing empty OR-Tools manager
        return CompiledRoutingModel(
            manager=None,  # type: ignore[arg-type]
            routing=None,  # type: ignore[arg-type]
            time_dim=None,  # type: ignore[arg-type]
            capacity_dim=None,  # type: ignore[arg-type]
            workload_dim=None,
            active_drivers=active_drivers,
            routed_obligations=[],
            node_meta=[],
            ob_nodes={},
            pre_unassigned=[],
            locked_infeasibility_reasons=locked_failures
            or (["No available drivers in planning snapshot."] if pending_obligations else []),
        )

    # Filter out obligations that already have 0 compatible drivers (and unstarted deliveries
    # whose required collection has 0 compatible drivers).
    pre_dropped_ids: set[str] = set()
    for ob in pending_obligations:
        if not compat_map[ob.obligation_id]:
            pre_dropped_ids.add(ob.obligation_id)
            seen: list[str] = []
            for rlist in compat_reasons_map[ob.obligation_id].values():
                for r in rlist:
                    if r not in seen:
                        seen.append(r)
            pre_unassigned.append(
                (
                    ob,
                    seen or ["no_compatible_driver"],
                    f"No active driver satisfies '{ob.obligation_id}' constraints ({', '.join(seen)}).",
                )
            )

    for ob in pending_obligations:
        if (
            ob.linked_delivery_obligation_id
            and ob.obligation_id in pre_dropped_ids
            and ob.require_collection_coverage
        ):
            del_ob = ctx.obligations_by_id.get(ob.linked_delivery_obligation_id)
            if (
                del_ob
                and del_ob.obligation_id not in pre_dropped_ids
                and not del_ob.is_locked
                and del_ob.operational_state not in ("onboard", "en_route_pickup", "completed", "cancelled")
            ):
                pre_dropped_ids.add(del_ob.obligation_id)
                pre_unassigned.append(
                    (
                        del_ob,
                        ["collection_coverage_conflict"],
                        f"Delivery '{del_ob.obligation_id}' withheld because paired collection '{ob.obligation_id}' has no compatible driver.",
                    )
                )

    routed_obligations = [
        ob for ob in pending_obligations if ob.obligation_id not in pre_dropped_ids
    ]

    # Build routing node table:
    # 0 .. V-1      -> driver_start
    # V .. 2V-1     -> driver_end
    # 2V .. N-1     -> pickup / dropoff nodes
    num_vehicles = len(active_drivers)
    node_meta: list[dict[str, Any]] = []

    for v_idx, drv in enumerate(active_drivers):
        start_loc = ctx.locations_by_id[drv.start_location_id]
        node_meta.append(
            {
                "kind": "driver_start",
                "vehicle_idx": v_idx,
                "driver_id": drv.driver_id,
                "location_id": drv.start_location_id,
                "location_label": start_loc.label or start_loc.location_id,
                "handling_minutes": 0.0,
                "demand": 0,
                "obligation_id": None,
                "previous_driver_id": None,
            }
        )

    for v_idx, drv in enumerate(active_drivers):
        end_loc_id = drv.return_to_location_id or drv.start_location_id
        end_loc = ctx.locations_by_id[end_loc_id]
        node_meta.append(
            {
                "kind": "driver_end",
                "vehicle_idx": v_idx,
                "driver_id": drv.driver_id,
                "location_id": end_loc_id,
                "location_label": end_loc.label or end_loc.location_id,
                "handling_minutes": 0.0,
                "demand": 0,
                "obligation_id": None,
                "previous_driver_id": None,
            }
        )

    ob_nodes: dict[str, tuple[int | None, int | None]] = {}
    stop_lookup: dict[tuple[str, str], int] = {}

    for ob in routed_obligations:
        p_node: int | None = None
        if ob.operational_state != "onboard":
            p_loc = ctx.locations_by_id[ob.pickup_location_id]
            p_node = len(node_meta)
            node_meta.append(
                {
                    "kind": "pickup",
                    "obligation_id": ob.obligation_id,
                    "location_id": ob.pickup_location_id,
                    "location_label": p_loc.label or p_loc.location_id,
                    "handling_minutes": ob.pickup_handling_minutes,
                    "demand": ob.passenger_count,
                    "previous_driver_id": ob.previous_driver_id,
                    "is_locked": ob.is_locked or ob.operational_state == "en_route_pickup",
                }
            )
            stop_lookup[(ob.obligation_id, "pickup")] = p_node

        d_loc = ctx.locations_by_id[ob.dropoff_location_id]
        d_node = len(node_meta)
        node_meta.append(
            {
                "kind": "dropoff",
                "obligation_id": ob.obligation_id,
                "location_id": ob.dropoff_location_id,
                "location_label": d_loc.label or d_loc.location_id,
                "handling_minutes": ob.dropoff_handling_minutes,
                "demand": -ob.passenger_count,
                "previous_driver_id": ob.previous_driver_id,
                "is_locked": ob.is_locked or ob.operational_state in ("onboard", "en_route_pickup"),
            }
        )
        stop_lookup[(ob.obligation_id, "dropoff")] = d_node
        ob_nodes[ob.obligation_id] = (p_node, d_node)

    starts = list(range(num_vehicles))
    ends = list(range(num_vehicles, 2 * num_vehicles))
    manager = pywrapcp.RoutingIndexManager(len(node_meta), num_vehicles, starts, ends)
    routing = pywrapcp.RoutingModel(manager)

    # 1. Per-vehicle primary arc cost evaluator (driving time + distance + reassignment penalty)
    for v_idx, drv in enumerate(active_drivers):
        end_node_idx = num_vehicles + v_idx

        def make_cost_cb(driver: DriverInput, vehicle_end_node: int):
            def arc_cost_cb(from_index: int, to_index: int) -> int:
                from_node = manager.IndexToNode(from_index)
                to_node = manager.IndexToNode(to_index)
                from_info = node_meta[from_node]
                to_info = node_meta[to_node]

                if to_node == vehicle_end_node and driver.return_to_location_id is None:
                    d_min = 0.0
                    d_km = 0.0
                else:
                    u = loc_idx_by_id[from_info["location_id"]]
                    w = loc_idx_by_id[to_info["location_id"]]
                    d_min = travel_time[u][w]
                    d_km = travel_dist[u][w]

                cost = (
                    d_min * config.travel_time_weight + d_km * config.travel_distance_weight
                ) * COST_UNITS_PER_MINUTE

                if (
                    to_info["kind"] == "pickup"
                    and to_info["previous_driver_id"] is not None
                    and driver.driver_id != to_info["previous_driver_id"]
                ):
                    cost += config.reassignment_penalty * COST_UNITS_PER_MINUTE

                return int(round(cost))

            return arc_cost_cb

        cost_cb_idx = routing.RegisterTransitCallback(make_cost_cb(drv, end_node_idx))
        routing.SetArcCostEvaluatorOfVehicle(cost_cb_idx, v_idx)

    # 2. Per-vehicle Time dimension (seconds)
    horizon_sec = int(round(request.horizon_end_minute * TIME_SCALE_SECONDS))
    time_cb_indices: list[int] = []
    for v_idx, drv in enumerate(active_drivers):
        end_node_idx = num_vehicles + v_idx

        def make_time_cb(driver: DriverInput, vehicle_end_node: int):
            def time_cb(from_index: int, to_index: int) -> int:
                from_node = manager.IndexToNode(from_index)
                to_node = manager.IndexToNode(to_index)
                from_info = node_meta[from_node]
                to_info = node_meta[to_node]
                handling_sec = int(round(from_info["handling_minutes"] * TIME_SCALE_SECONDS))
                if to_node == vehicle_end_node and driver.return_to_location_id is None:
                    drive_sec = 0
                else:
                    u = loc_idx_by_id[from_info["location_id"]]
                    w = loc_idx_by_id[to_info["location_id"]]
                    drive_sec = int(round(travel_time[u][w] * TIME_SCALE_SECONDS))
                return handling_sec + drive_sec

            return time_cb

        time_cb_indices.append(routing.RegisterTransitCallback(make_time_cb(drv, end_node_idx)))

    routing.AddDimensionWithVehicleTransits(
        time_cb_indices,
        horizon_sec,
        horizon_sec,
        False,
        "Time",
    )
    time_dim = routing.GetDimensionOrDie("Time")

    for v_idx, drv in enumerate(active_drivers):
        avail_start_sec = int(round(drv.effective_available_from() * TIME_SCALE_SECONDS))
        avail_end_sec = min(horizon_sec, int(round(drv.effective_available_until() * TIME_SCALE_SECONDS)))
        time_dim.CumulVar(routing.Start(v_idx)).SetRange(avail_start_sec, avail_end_sec)
        time_dim.CumulVar(routing.End(v_idx)).SetRange(avail_start_sec, avail_end_sec)
        # Small span cost prevents unnecessary idle wait and anchors departure just-in-time.
        time_dim.SetSpanCostCoefficientForVehicle(1, v_idx)

    # 3. Capacity dimension
    def demand_cb(from_index: int) -> int:
        from_node = manager.IndexToNode(from_index)
        return int(node_meta[from_node]["demand"])

    demand_cb_idx = routing.RegisterUnaryTransitCallback(demand_cb)
    routing.AddDimensionWithVehicleCapacity(
        demand_cb_idx,
        0,
        [d.vehicle_capacity for d in active_drivers],
        False,
        "Capacity",
    )
    capacity_dim = routing.GetDimensionOrDie("Capacity")

    for v_idx, drv in enumerate(active_drivers):
        initial_onboard = sum(
            ob.passenger_count
            for ob in routed_obligations
            if ob.operational_state == "onboard" and ob.locked_driver_id == drv.driver_id
        )
        capacity_dim.CumulVar(routing.Start(v_idx)).SetValue(initial_onboard)
        capacity_dim.CumulVar(routing.End(v_idx)).SetValue(0)

    # 4. Optional max_stops dimension if any driver defines max_stops
    if any(d.max_stops is not None for d in active_drivers):
        def stop_count_cb(from_index: int) -> int:
            node = manager.IndexToNode(from_index)
            return 1 if node_meta[node]["kind"] in ("pickup", "dropoff") else 0

        stop_cb_idx = routing.RegisterUnaryTransitCallback(stop_count_cb)
        max_possible_stops = len(node_meta)
        routing.AddDimensionWithVehicleCapacity(
            stop_cb_idx,
            0,
            [d.max_stops if d.max_stops is not None else max_possible_stops for d in active_drivers],
            True,
            "Stops",
        )

    # 5. Obligation constraints: windows, pickup-before-dropoff, eligibility, disjunctions, ride limit
    solver = routing.solver()
    for ob in routed_obligations:
        p_node, d_node = ob_nodes[ob.obligation_id]
        d_idx = manager.NodeToIndex(d_node)  # type: ignore[arg-type]
        d_early_sec = int(round(ob.dropoff_window.earliest_minute * TIME_SCALE_SECONDS))
        d_late_sec = int(round(ob.dropoff_window.latest_minute * TIME_SCALE_SECONDS))
        time_dim.CumulVar(d_idx).SetRange(d_early_sec, d_late_sec)

        if ob.target_arrival_minute is not None and ob.target_arrival_minute < ob.dropoff_window.latest_minute:
            if config.lateness_soft_weight > 0.0:
                time_dim.SetCumulVarSoftUpperBound(
                    d_idx,
                    int(round(ob.target_arrival_minute * TIME_SCALE_SECONDS)),
                    max(1, int(round(config.lateness_soft_weight * 10))),
                )

        if ob.operational_state == "onboard":
            locked_v = driver_index_by_id[ob.locked_driver_id]  # type: ignore[index]
            _restrict_vehicles_for_index(routing, num_vehicles, d_idx, [locked_v], allow_drop=False)
            continue

        assert p_node is not None
        p_idx = manager.NodeToIndex(p_node)
        p_early, p_late = effective_pickup_window(ob)
        p_early_sec = int(round(p_early * TIME_SCALE_SECONDS))
        p_late_sec = int(round(p_late * TIME_SCALE_SECONDS))
        time_dim.CumulVar(p_idx).SetRange(p_early_sec, p_late_sec)

        if ob.leg_type == "collection" and config.therapist_wait_weight > 0.0:
            ready_min = ob.expected_ready_minute if ob.expected_ready_minute is not None else p_early
            time_dim.SetCumulVarSoftUpperBound(
                p_idx,
                int(round(ready_min * TIME_SCALE_SECONDS)),
                max(1, int(round(config.therapist_wait_weight * 10))),
            )

        routing.AddPickupAndDelivery(p_idx, d_idx)
        solver.Add(routing.VehicleVar(p_idx) == routing.VehicleVar(d_idx))
        solver.Add(time_dim.CumulVar(p_idx) <= time_dim.CumulVar(d_idx))

        if ob.max_ride_minutes is not None:
            max_ride_sec = int(round(ob.max_ride_minutes * TIME_SCALE_SECONDS))
            solver.Add(time_dim.CumulVar(d_idx) - time_dim.CumulVar(p_idx) <= max_ride_sec)

        is_mandatory = ob.is_locked or ob.operational_state == "en_route_pickup"
        if is_mandatory:
            locked_v = driver_index_by_id[ob.locked_driver_id]  # type: ignore[index]
            _restrict_vehicles_for_index(routing, num_vehicles, p_idx, [locked_v], allow_drop=False)
            _restrict_vehicles_for_index(routing, num_vehicles, d_idx, [locked_v], allow_drop=False)
        else:
            eligible = compat_map[ob.obligation_id]
            _restrict_vehicles_for_index(routing, num_vehicles, p_idx, eligible, allow_drop=True)
            _restrict_vehicles_for_index(routing, num_vehicles, d_idx, eligible, allow_drop=True)
            penalty = config.unserved_penalty * ob.priority
            routing.AddDisjunction([p_idx], penalty)
            routing.AddDisjunction([d_idx], 0)
            solver.Add(routing.ActiveVar(p_idx) == routing.ActiveVar(d_idx))

    # 6. Causal timing & collection coverage coupling between Delivery (Leg A) and Collection (Leg B)
    for ob in routed_obligations:
        if not ob.linked_delivery_obligation_id:
            continue
        del_id = ob.linked_delivery_obligation_id
        if del_id not in ob_nodes:
            continue
        del_ob = ctx.obligations_by_id[del_id]
        col_p_node, _ = ob_nodes[ob.obligation_id]
        del_p_node, del_d_node = ob_nodes[del_id]
        if col_p_node is None or del_d_node is None:
            continue

        col_p_idx = manager.NodeToIndex(col_p_node)
        del_d_idx = manager.NodeToIndex(del_d_node)
        svc_sec = int(round((ob.estimated_service_duration_minutes or 0.0) * TIME_SCALE_SECONDS))

        if del_p_node is None:
            # Delivery is onboard -> del_d_idx is always active
            solver.Add(
                time_dim.CumulVar(col_p_idx)
                >= time_dim.CumulVar(del_d_idx) + svc_sec - horizon_sec * (1 - routing.ActiveVar(col_p_idx))
            )
        else:
            del_p_idx = manager.NodeToIndex(del_p_node)
            solver.Add(
                time_dim.CumulVar(col_p_idx)
                >= time_dim.CumulVar(del_d_idx)
                + svc_sec
                - horizon_sec * (2 - routing.ActiveVar(del_d_idx) - routing.ActiveVar(col_p_idx))
            )
            if ob.require_collection_coverage and not del_ob.is_locked and del_ob.operational_state not in ("en_route_pickup",):
                # Cannot collect an unserved delivery; uncollected deliveries are pruned in Pass 2 if needed.
                solver.Add(routing.ActiveVar(col_p_idx) <= routing.ActiveVar(del_p_idx))

    # 7. Locked active prefix stop sequences
    for v_idx, drv in enumerate(active_drivers):
        if not drv.locked_stop_sequence:
            continue
        prev_idx = routing.Start(v_idx)
        for ref in drv.locked_stop_sequence:
            node = stop_lookup.get((ref.obligation_id, ref.stop_type))
            if node is None:
                continue
            stop_idx = manager.NodeToIndex(node)
            _restrict_vehicles_for_index(routing, num_vehicles, stop_idx, [v_idx], allow_drop=False)
            solver.Add(routing.NextVar(prev_idx) == stop_idx)
            prev_idx = stop_idx

    # 8. Normalized Workload Fairness Dimension
    workload_dim = register_fairness_dimension(
        routing=routing,
        manager=manager,
        drivers=active_drivers,
        node_meta=node_meta,
        travel_time_minutes=travel_time,
        loc_idx_by_id=loc_idx_by_id,
        config=config,
    )

    return CompiledRoutingModel(
        manager=manager,
        routing=routing,
        time_dim=time_dim,
        capacity_dim=capacity_dim,
        workload_dim=workload_dim,
        active_drivers=active_drivers,
        routed_obligations=routed_obligations,
        node_meta=node_meta,
        ob_nodes=ob_nodes,
        pre_unassigned=pre_unassigned,
        locked_infeasibility_reasons=[],
    )
