"""Normalized driver workload fairness model and fleet-wide optimization metrics."""

from __future__ import annotations

import math
from typing import Any

from app.models import (
    DriverInput,
    DriverRoutePlan,
    FleetMetrics,
    LegAssignmentSummary,
    OptimizationConfig,
    OptimizeRequest,
    TransportObligationInput,
    UnassignedObligation,
)

# 10,000 basis points = 100.00% of authorized available shift duration.
WORKLOAD_NORMALIZATION_SCALE = 10_000
COST_UNITS_PER_MINUTE = 600
FAIRNESS_SPAN_COEFFICIENT_PER_WEIGHT = 12
FAIRNESS_TIER_COEFFICIENT_PER_WEIGHT = 2
FAIRNESS_UTILIZATION_TIERS = (1500, 3000, 4500, 6000, 7500, 9000)


def compute_driver_available_minutes(driver: DriverInput) -> float:
    """Authorized remaining shift duration in minutes (0 if unavailable)."""
    if not driver.is_available:
        return 0.0
    return driver.effective_available_duration()


def compute_initial_workload_units(driver: DriverInput) -> int:
    """Convert existing committed workload into shift-normalized basis points."""
    avail = compute_driver_available_minutes(driver)
    if avail <= 0.0:
        return 0
    ratio = driver.existing_committed_workload_minutes / avail
    return max(0, int(round(ratio * WORKLOAD_NORMALIZATION_SCALE)))


def compute_arc_workload_units(
    driving_minutes: float,
    handling_minutes: float,
    is_service_stop: bool,
    stop_complexity_minutes: float,
    available_minutes: float,
) -> int:
    """Normalized workload increment for traversing an arc from a node."""
    if available_minutes <= 0.0:
        return WORKLOAD_NORMALIZATION_SCALE * 10
    effective_minutes = (
        driving_minutes
        + handling_minutes
        + (stop_complexity_minutes if is_service_stop else 0.0)
    )
    if effective_minutes <= 0.0:
        return 0
    return int(round((effective_minutes / available_minutes) * WORKLOAD_NORMALIZATION_SCALE))


def register_fairness_dimension(
    routing: Any,
    manager: Any,
    drivers: list[DriverInput],
    node_meta: list[dict[str, Any]],
    travel_time_minutes: list[list[float]],
    loc_idx_by_id: dict[str, int],
    config: OptimizationConfig,
) -> Any | None:
    """Add normalized Workload dimension and soft min-max/convex fairness penalties."""
    if config.fairness_weight <= 0.0 or not drivers:
        return None

    num_vehicles = len(drivers)
    transit_indices: list[int] = []

    for v_idx, drv in enumerate(drivers):
        avail_min = compute_driver_available_minutes(drv)
        end_node_idx = num_vehicles + v_idx  # matches layout in constraints.py

        def make_callback(
            vehicle_idx: int,
            driver: DriverInput,
            available_minutes: float,
            vehicle_end_node: int,
        ):
            def workload_callback(from_index: int, to_index: int) -> int:
                from_node = manager.IndexToNode(from_index)
                to_node = manager.IndexToNode(to_index)
                from_info = node_meta[from_node]
                to_info = node_meta[to_node]

                # Virtual end sink with no forced branch return incurs 0 return travel.
                if (
                    to_node == vehicle_end_node
                    and driver.return_to_location_id is None
                ):
                    driving_min = 0.0
                else:
                    u = loc_idx_by_id[from_info["location_id"]]
                    w = loc_idx_by_id[to_info["location_id"]]
                    driving_min = travel_time_minutes[u][w]

                is_service = from_info["kind"] in ("pickup", "dropoff")
                return compute_arc_workload_units(
                    driving_minutes=driving_min,
                    handling_minutes=from_info["handling_minutes"],
                    is_service_stop=is_service,
                    stop_complexity_minutes=config.stop_complexity_minutes,
                    available_minutes=available_minutes,
                )

            return workload_callback

        cb_idx = routing.RegisterTransitCallback(
            make_callback(v_idx, drv, avail_min, end_node_idx)
        )
        transit_indices.append(cb_idx)

    # Allow generous upper bound so Workload dimension shapes costs without falsely pruning feasible shifts.
    max_cap = WORKLOAD_NORMALIZATION_SCALE * 20
    routing.AddDimensionWithVehicleTransits(
        transit_indices,
        0,
        max_cap,
        False,
        "Workload",
    )
    workload_dim = routing.GetDimensionOrDie("Workload")

    for v_idx, drv in enumerate(drivers):
        start_index = routing.Start(v_idx)
        end_index = routing.End(v_idx)
        init_units = compute_initial_workload_units(drv)
        workload_dim.CumulVar(start_index).SetValue(init_units)

        if drv.is_available and drv.effective_available_duration() > 0.0:
            tier_penalty = max(1, int(round(config.fairness_weight * FAIRNESS_TIER_COEFFICIENT_PER_WEIGHT)))
            for threshold in FAIRNESS_UTILIZATION_TIERS:
                workload_dim.SetCumulVarSoftUpperBound(end_index, threshold, tier_penalty)

    span_coeff = max(1, int(round(config.fairness_weight * FAIRNESS_SPAN_COEFFICIENT_PER_WEIGHT)))
    workload_dim.SetGlobalSpanCostCoefficient(span_coeff)
    return workload_dim


def compute_fleet_metrics(
    request: OptimizeRequest,
    routes: list[DriverRoutePlan],
    assignments: list[LegAssignmentSummary],
    unassigned: list[UnassignedObligation],
    collection_coverage_rate: float,
) -> FleetMetrics:
    """Aggregate exact fleet KPIs across all available drivers and obligations."""
    total_driving = round(sum(r.driving_minutes for r in routes), 2)
    total_dist = round(sum(r.distance_km for r in routes), 3)
    total_empty_driving = round(sum(r.empty_driving_minutes for r in routes), 2)
    total_empty_dist = round(sum(r.empty_distance_km for r in routes), 3)
    total_idle = round(sum(r.idle_wait_minutes for r in routes), 2)
    total_therapist_wait = round(sum(a.therapist_wait_minutes for a in assignments), 2)

    on_time_count = sum(1 for a in assignments if a.on_time)
    on_time_rate = (
        round(on_time_count / len(assignments), 4) if assignments else 1.0
    )

    # Pooled route = carried multiple passengers simultaneously (peak_occupancy > 1)
    pooled_routes = sum(1 for r in routes if r.peak_occupancy > 1)
    pooled_legs = sum(1 for a in assignments if a.is_pooled_leg)
    active_drivers = sum(1 for r in routes if len(r.assigned_obligation_ids) > 0)

    # Include ALL available drivers when measuring workload spread (idle drivers have 0 + committed ratio!)
    available_driver_ids = {
        d.driver_id
        for d in request.drivers
        if d.is_available and d.effective_available_duration() > 0
    }
    util_ratios = [
        r.workload_utilization_ratio
        for r in routes
        if r.driver_id in available_driver_ids
    ]
    if util_ratios:
        u_min = round(min(util_ratios), 4)
        u_max = round(max(util_ratios), 4)
        u_spread = round(u_max - u_min, 4)
        mean = sum(util_ratios) / len(util_ratios)
        variance = sum((u - mean) ** 2 for u in util_ratios) / len(util_ratios)
        u_stddev = round(math.sqrt(variance), 4)
    else:
        u_min = u_max = u_spread = u_stddev = 0.0

    reassigned_count = sum(1 for a in assignments if a.change_type == "reassigned")

    return FleetMetrics(
        total_driving_minutes=total_driving,
        total_distance_km=total_dist,
        total_empty_driving_minutes=total_empty_driving,
        total_empty_distance_km=total_empty_dist,
        total_idle_wait_minutes=total_idle,
        total_therapist_wait_minutes=total_therapist_wait,
        on_time_arrival_rate=on_time_rate,
        collection_coverage_rate=round(collection_coverage_rate, 4),
        pooled_route_count=pooled_routes,
        pooled_leg_count=pooled_legs,
        active_driver_count=active_drivers,
        served_obligation_count=len(assignments),
        unassigned_obligation_count=len(unassigned),
        workload_utilization_min=u_min,
        workload_utilization_max=u_max,
        workload_utilization_spread=u_spread,
        workload_utilization_stddev=u_stddev,
        reassigned_count=reassigned_count,
    )
