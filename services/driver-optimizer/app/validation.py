"""Cross-entity validation, eligibility checks, infeasibility diagnostics, and post-solve hard-constraint verification."""

from __future__ import annotations

import math
from dataclasses import dataclass

from app.models import (
    DriverInput,
    DriverRoutePlan,
    LocationNode,
    OptimizeRequest,
    ReturnTransportDecision,
    TherapistInput,
    TransportObligationInput,
    UnassignedObligation,
)
from app.scheduling import reconcile_scheduling_and_obligations


class RequestValidationError(ValueError):
    """Raised when an optimization payload violates structural or domain invariants."""

    def __init__(self, errors: list[str]) -> None:
        self.errors = errors
        super().__init__("; ".join(errors))


@dataclass(frozen=True)
class ValidatedContext:
    """Normalized lookup tables derived after validating an OptimizeRequest."""

    location_index_by_id: dict[str, int]
    locations_by_id: dict[str, LocationNode]
    drivers_by_id: dict[str, DriverInput]
    therapists_by_id: dict[str, TherapistInput]
    obligations: list[TransportObligationInput]
    obligations_by_id: dict[str, TransportObligationInput]
    return_decisions: list[ReturnTransportDecision]
    excluded_collection_ids: set[str]
    withheld_undecided_deliveries: list[TransportObligationInput]


def validate_request_integrity(request: OptimizeRequest) -> ValidatedContext:
    """Validate cross-references, duplicate IDs, coordinates, and locked journey consistency."""
    errors: list[str] = []

    locations_by_id: dict[str, LocationNode] = {
        loc.location_id: loc for loc in request.travel_info.locations
    }
    location_index_by_id: dict[str, int] = {
        loc.location_id: idx for idx, loc in enumerate(request.travel_info.locations)
    }

    # Check duplicate driver IDs & location references
    drivers_by_id: dict[str, DriverInput] = {}
    for drv in request.drivers:
        if drv.driver_id in drivers_by_id:
            errors.append(f"Duplicate driver_id '{drv.driver_id}'.")
            continue
        drivers_by_id[drv.driver_id] = drv
        if drv.start_location_id not in locations_by_id:
            errors.append(
                f"Driver '{drv.driver_id}' start_location_id '{drv.start_location_id}' not found in travel_info.locations."
            )
        if drv.return_to_location_id and drv.return_to_location_id not in locations_by_id:
            errors.append(
                f"Driver '{drv.driver_id}' return_to_location_id '{drv.return_to_location_id}' not found in travel_info.locations."
            )

    # Check duplicate therapist IDs & location references
    therapists_by_id: dict[str, TherapistInput] = {}
    seen_therapist_keys: set[tuple[str, str]] = set()
    for th in request.therapists:
        t_key = (th.booking_id, th.therapist_id)
        if t_key in seen_therapist_keys:
            errors.append(f"Duplicate therapist assignment '{th.booking_id}:{th.therapist_id}'.")
        seen_therapist_keys.add(t_key)
        therapists_by_id[th.therapist_id] = th
        for loc_field, loc_val in (
            ("pickup_location_id", th.pickup_location_id),
            ("customer_location_id", th.customer_location_id),
            ("permitted_return_location_id", th.permitted_return_location_id),
            (
                "next_assignment.location_id",
                th.next_assignment.location_id if th.next_assignment else None,
            ),
        ):
            if loc_val and loc_val not in locations_by_id:
                errors.append(
                    f"Therapist '{th.therapist_id}' {loc_field} '{loc_val}' not found in travel_info.locations."
                )

    raw_obligations_by_id: dict[str, TransportObligationInput] = {}
    for ob in request.transport_obligations:
        if ob.obligation_id in raw_obligations_by_id:
            errors.append(f"Duplicate transport obligation_id '{ob.obligation_id}'.")
            continue
        raw_obligations_by_id[ob.obligation_id] = ob

        if ob.pickup_location_id not in locations_by_id:
            errors.append(
                f"Obligation '{ob.obligation_id}' pickup_location_id '{ob.pickup_location_id}' not found in travel_info.locations."
            )
        elif ob.pickup_coordinates is not None:
            loc = locations_by_id[ob.pickup_location_id]
            if (
                abs(loc.lat - ob.pickup_coordinates.lat) > 0.01
                or abs(loc.lng - ob.pickup_coordinates.lng) > 0.01
            ):
                errors.append(
                    f"Obligation '{ob.obligation_id}' pickup_coordinates differ significantly from location '{ob.pickup_location_id}'."
                )

        if ob.dropoff_location_id not in locations_by_id:
            errors.append(
                f"Obligation '{ob.obligation_id}' dropoff_location_id '{ob.dropoff_location_id}' not found in travel_info.locations."
            )
        elif ob.dropoff_coordinates is not None:
            loc = locations_by_id[ob.dropoff_location_id]
            if (
                abs(loc.lat - ob.dropoff_coordinates.lat) > 0.01
                or abs(loc.lng - ob.dropoff_coordinates.lng) > 0.01
            ):
                errors.append(
                    f"Obligation '{ob.obligation_id}' dropoff_coordinates differ significantly from location '{ob.dropoff_location_id}'."
                )

        if ob.locked_driver_id and ob.locked_driver_id not in drivers_by_id:
            errors.append(
                f"Obligation '{ob.obligation_id}' locked_driver_id '{ob.locked_driver_id}' not found in drivers."
            )

        if ob.dropoff_window.latest_minute > request.horizon_end_minute:
            errors.append(
                f"Obligation '{ob.obligation_id}' dropoff_window.latest_minute ({ob.dropoff_window.latest_minute}) exceeds horizon_end_minute ({request.horizon_end_minute})."
            )

    if errors:
        raise RequestValidationError(errors)

    reconciled = reconcile_scheduling_and_obligations(request, location_index_by_id)
    obligations = reconciled.obligations
    obligations_by_id = {ob.obligation_id: ob for ob in obligations}
    withheld_deliveries = reconciled.withheld_undecided_deliveries

    # Validate linked delivery references
    for ob in obligations:
        if ob.linked_delivery_obligation_id:
            linked = obligations_by_id.get(ob.linked_delivery_obligation_id)
            if linked is None:
                errors.append(
                    f"Obligation '{ob.obligation_id}' linked_delivery_obligation_id '{ob.linked_delivery_obligation_id}' not found."
                )
            elif linked.leg_type != "delivery":
                errors.append(
                    f"Obligation '{ob.obligation_id}' linked_delivery_obligation_id '{ob.linked_delivery_obligation_id}' must refer to a delivery leg."
                )
            elif linked.therapist_id != ob.therapist_id or linked.booking_id != ob.booking_id:
                errors.append(
                    f"Obligation '{ob.obligation_id}' linked delivery '{linked.obligation_id}' belongs to a different booking/therapist."
                )

    # Validate driver locked_stop_sequence references
    for drv in request.drivers:
        seen_stops: set[tuple[str, str]] = set()
        seen_pickups: set[str] = set()
        for ref in drv.locked_stop_sequence:
            pair = (ref.obligation_id, ref.stop_type)
            if pair in seen_stops:
                errors.append(
                    f"Driver '{drv.driver_id}' locked_stop_sequence contains duplicate stop {pair}."
                )
            seen_stops.add(pair)
            ob = obligations_by_id.get(ref.obligation_id)
            if ob is None:
                errors.append(
                    f"Driver '{drv.driver_id}' locked_stop_sequence references unknown obligation '{ref.obligation_id}'."
                )
                continue
            if ob.operational_state in ("completed", "cancelled"):
                errors.append(
                    f"Driver '{drv.driver_id}' locked_stop_sequence references {ob.operational_state} obligation '{ob.obligation_id}'."
                )
            if ob.locked_driver_id and ob.locked_driver_id != drv.driver_id:
                errors.append(
                    f"Driver '{drv.driver_id}' locked_stop_sequence references obligation '{ob.obligation_id}' locked to '{ob.locked_driver_id}'."
                )
            if ob.operational_state == "onboard" and ref.stop_type == "pickup":
                errors.append(
                    f"Driver '{drv.driver_id}' locked_stop_sequence includes 'pickup' for already-onboard obligation '{ob.obligation_id}'."
                )
            if ref.stop_type == "pickup":
                seen_pickups.add(ob.obligation_id)
            elif ref.stop_type == "dropoff" and ob.operational_state != "onboard":
                if ob.obligation_id not in seen_pickups:
                    # Dropoff of non-onboard obligation locked before its pickup would violate precedence
                    errors.append(
                        f"Driver '{drv.driver_id}' locked_stop_sequence places dropoff before pickup for '{ob.obligation_id}'."
                    )

    if errors:
        raise RequestValidationError(errors)

    return ValidatedContext(
        location_index_by_id=location_index_by_id,
        locations_by_id=locations_by_id,
        drivers_by_id=drivers_by_id,
        therapists_by_id=therapists_by_id,
        obligations=obligations,
        obligations_by_id=obligations_by_id,
        return_decisions=reconciled.return_decisions,
        excluded_collection_ids=reconciled.excluded_collection_ids,
        withheld_undecided_deliveries=withheld_deliveries,
    )


def effective_pickup_window(ob: TransportObligationInput) -> tuple[float, float]:
    """Return (earliest, latest) pickup window respecting therapist max_therapist_wait_minutes."""
    earliest = ob.pickup_window.earliest_minute
    latest = ob.pickup_window.latest_minute
    if ob.leg_type == "collection" and ob.max_therapist_wait_minutes is not None:
        ready = ob.expected_ready_minute if ob.expected_ready_minute is not None else earliest
        latest = min(latest, ready + ob.max_therapist_wait_minutes)
    return earliest, latest


def check_driver_obligation_compatibility(
    driver: DriverInput,
    ob: TransportObligationInput,
    travel_time_minutes: list[list[float]],
    loc_idx: dict[str, int],
) -> list[str]:
    """Return reason codes explaining why `driver` cannot serve `ob` (empty list if compatible)."""
    reasons: list[str] = []

    if not driver.is_available or driver.effective_available_duration() <= 0:
        reasons.append("driver_unavailable")
        return reasons

    allowed_branches = driver.allowed_branch_ids or [driver.branch_id]
    if ob.branch_id not in allowed_branches:
        reasons.append("branch_mismatch")

    if (ob.is_locked or ob.operational_state in ("onboard", "en_route_pickup")) and ob.locked_driver_id != driver.driver_id:
        reasons.append("locked_to_other_driver")

    if ob.passenger_count > driver.vehicle_capacity:
        reasons.append("vehicle_overcapacity")

    if ob.required_vehicle_types and driver.vehicle_type not in ob.required_vehicle_types:
        reasons.append("vehicle_type_restricted")

    if ob.required_vehicle_tags and not set(ob.required_vehicle_tags).issubset(set(driver.vehicle_tags)):
        reasons.append("vehicle_tag_restricted")

    # Single-leg feasibility lower bound inside driver's availability window
    start_idx = loc_idx[driver.start_location_id]
    p_idx = loc_idx[ob.pickup_location_id]
    d_idx = loc_idx[ob.dropoff_location_id]

    avail_from = driver.effective_available_from()
    avail_until = driver.effective_available_until()
    p_earliest, p_latest = effective_pickup_window(ob)
    if p_latest < p_earliest:
        reasons.append("therapist_wait_window_conflict")
        return reasons

    if ob.operational_state == "onboard":
        earliest_dropoff = avail_from + travel_time_minutes[start_idx][d_idx]
        if earliest_dropoff > ob.dropoff_window.latest_minute:
            reasons.append("appointment_unreachable")
        finish_time = max(earliest_dropoff, ob.dropoff_window.earliest_minute) + ob.dropoff_handling_minutes
    else:
        earliest_pickup = max(p_earliest, avail_from + travel_time_minutes[start_idx][p_idx])
        if earliest_pickup > p_latest:
            reasons.append("pickup_window_unreachable")
        depart_pickup = earliest_pickup + ob.pickup_handling_minutes
        earliest_dropoff = depart_pickup + travel_time_minutes[p_idx][d_idx]
        if earliest_dropoff > ob.dropoff_window.latest_minute:
            reasons.append("appointment_unreachable")
        if ob.max_ride_minutes is not None and (earliest_dropoff - earliest_pickup) > ob.max_ride_minutes:
            reasons.append("max_ride_time_exceeded")
        finish_time = max(earliest_dropoff, ob.dropoff_window.earliest_minute) + ob.dropoff_handling_minutes

    return_travel = (
        travel_time_minutes[d_idx][loc_idx[driver.return_to_location_id]]
        if driver.return_to_location_id
        else 0.0
    )
    if finish_time + return_travel > avail_until:
        reasons.append("shift_window_conflict")

    return reasons


def diagnose_unassigned_obligation(
    ob: TransportObligationInput,
    request: OptimizeRequest,
    loc_idx: dict[str, int],
    unassigned_ids: set[str],
    obligations_by_id: dict[str, TransportObligationInput],
) -> UnassignedObligation:
    """Produce structured root-cause reasons for an unassigned obligation."""
    active_drivers = [d for d in request.drivers if d.is_available and d.effective_available_duration() > 0]
    if not active_drivers:
        return UnassignedObligation(
            obligation_id=ob.obligation_id,
            booking_id=ob.booking_id,
            therapist_id=ob.therapist_id,
            leg_type=ob.leg_type,
            reasons=["no_available_drivers"],
            detail="No available drivers exist in the planning snapshot.",
        )

    driver_reasons: list[list[str]] = [
        check_driver_obligation_compatibility(
            drv, ob, request.travel_info.travel_time_minutes, loc_idx
        )
        for drv in active_drivers
    ]

    compatible_count = sum(1 for r in driver_reasons if not r)
    reason_set: list[str] = []

    if compatible_count == 0:
        # Aggregate distinct blocking reasons across drivers
        seen: set[str] = set()
        for rlist in driver_reasons:
            for code in rlist:
                if code not in seen:
                    seen.add(code)
                    reason_set.append(code)
        detail = (
            f"No individual driver can satisfy obligation '{ob.obligation_id}' "
            f"({', '.join(reason_set)})."
        )
    else:
        # Check if coupled collection/delivery caused the drop
        coupled_collection = next(
            (
                other
                for other in obligations_by_id.values()
                if other.linked_delivery_obligation_id == ob.obligation_id
                and other.require_collection_coverage
                and other.obligation_id in unassigned_ids
            ),
            None,
        )
        if coupled_collection is not None:
            col_reasons = [
                check_driver_obligation_compatibility(
                    drv, coupled_collection, request.travel_info.travel_time_minutes, loc_idx
                )
                for drv in active_drivers
            ]
            reason_set.append("collection_coverage_conflict")
            for rlist in col_reasons:
                for code in rlist:
                    if code not in reason_set:
                        reason_set.append(code)
            detail = (
                f"Delivery '{ob.obligation_id}' was withheld because paired collection "
                f"'{coupled_collection.obligation_id}' lacks feasible coverage."
            )
        else:
            reason_set.append("fleet_schedule_or_capacity_saturation")
            detail = (
                f"Obligation '{ob.obligation_id}' could not fit alongside higher-priority "
                "or locked commitments within available driver shifts and vehicle capacities."
            )

    return UnassignedObligation(
        obligation_id=ob.obligation_id,
        booking_id=ob.booking_id,
        therapist_id=ob.therapist_id,
        leg_type=ob.leg_type,
        reasons=reason_set,
        detail=detail,
    )


def verify_solution_hard_constraints(
    request: OptimizeRequest,
    routes: list[DriverRoutePlan],
    obligations_by_id: dict[str, TransportObligationInput],
    loc_idx: dict[str, int],
) -> list[str]:
    """Independently verify every returned route and stop against hard operational constraints.

    Guarantees that no invalid assignment is ever reported as feasible.
    """
    violations: list[str] = []
    drivers_by_id = {d.driver_id: d for d in request.drivers}
    travel_time = request.travel_info.travel_time_minutes
    tol = 1e-4

    seen_pickups: dict[str, tuple[str, float]] = {}
    seen_dropoffs: dict[str, tuple[str, float]] = {}

    for route in routes:
        drv = drivers_by_id.get(route.driver_id)
        if drv is None:
            violations.append(f"Route references unknown driver '{route.driver_id}'.")
            continue

        if not route.stops:
            continue

        if not drv.is_available and len(route.assigned_obligation_ids) > 0:
            violations.append(f"Unavailable driver '{drv.driver_id}' was assigned work.")

        avail_from = drv.effective_available_from()
        avail_until = drv.effective_available_until()
        allowed_branches = drv.allowed_branch_ids or [drv.branch_id]

        # Count onboard starting load for this driver
        expected_initial_occ = sum(
            ob.passenger_count
            for ob in obligations_by_id.values()
            if ob.operational_state == "onboard" and ob.locked_driver_id == drv.driver_id
        )
        first_stop = route.stops[0]
        if first_stop.occupancy_before != expected_initial_occ:
            violations.append(
                f"Driver '{drv.driver_id}' initial occupancy {first_stop.occupancy_before} != expected onboard {expected_initial_occ}."
            )

        # Verify locked prefix sequence if configured
        if drv.locked_stop_sequence:
            actual_service_stops = [
                (s.obligation_id, s.stop_type)
                for s in route.stops
                if s.stop_type in ("pickup", "dropoff")
            ]
            expected_prefix = [(r.obligation_id, r.stop_type) for r in drv.locked_stop_sequence]
            if actual_service_stops[: len(expected_prefix)] != expected_prefix:
                violations.append(
                    f"Driver '{drv.driver_id}' broke locked_stop_sequence prefix: expected {expected_prefix}, got {actual_service_stops[:len(expected_prefix)]}."
                )

        prev_loc_id: str | None = None
        prev_departure: float | None = None
        running_occ = expected_initial_occ

        for idx, stop in enumerate(route.stops):
            if stop.occupancy_before < 0 or stop.occupancy_after < 0:
                violations.append(
                    f"Driver '{drv.driver_id}' stop {idx} has negative occupancy."
                )
            if stop.occupancy_before > drv.vehicle_capacity or stop.occupancy_after > drv.vehicle_capacity:
                violations.append(
                    f"Driver '{drv.driver_id}' stop {idx} exceeded capacity {drv.vehicle_capacity} "
                    f"(before={stop.occupancy_before}, after={stop.occupancy_after})."
                )
            if stop.occupancy_before != running_occ:
                violations.append(
                    f"Driver '{drv.driver_id}' stop {idx} occupancy continuity mismatch ({stop.occupancy_before} != {running_occ})."
                )

            if stop.service_start_minute + tol < avail_from or stop.departure_minute - tol > avail_until:
                violations.append(
                    f"Driver '{drv.driver_id}' stop {idx} ({stop.service_start_minute:.2f}..{stop.departure_minute:.2f}) "
                    f"outside availability [{avail_from}, {avail_until}]."
                )

            if prev_loc_id is not None and prev_departure is not None:
                expected_travel = travel_time[loc_idx[prev_loc_id]][loc_idx[stop.location_id]]
                if stop.arrival_minute + tol < prev_departure + expected_travel:
                    violations.append(
                        f"Driver '{drv.driver_id}' stop {idx} arrives at {stop.arrival_minute:.2f} before "
                        f"prev_departure + travel ({prev_departure + expected_travel:.2f})."
                    )
            if stop.service_start_minute + tol < stop.arrival_minute:
                violations.append(
                    f"Driver '{drv.driver_id}' stop {idx} service_start < arrival."
                )

            if stop.stop_type in ("pickup", "dropoff") and stop.obligation_id:
                ob = obligations_by_id.get(stop.obligation_id)
                if ob is None:
                    violations.append(f"Unknown obligation '{stop.obligation_id}' in route.")
                    continue
                if ob.branch_id not in allowed_branches:
                    violations.append(
                        f"Obligation '{ob.obligation_id}' branch '{ob.branch_id}' not allowed for driver '{drv.driver_id}'."
                    )
                if (ob.is_locked or ob.operational_state in ("onboard", "en_route_pickup")) and ob.locked_driver_id != drv.driver_id:
                    violations.append(
                        f"Locked obligation '{ob.obligation_id}' assigned to '{drv.driver_id}' instead of '{ob.locked_driver_id}'."
                    )
                if ob.required_vehicle_types and drv.vehicle_type not in ob.required_vehicle_types:
                    violations.append(
                        f"Obligation '{ob.obligation_id}' assigned to incompatible vehicle_type '{drv.vehicle_type}'."
                    )
                if ob.required_vehicle_tags and not set(ob.required_vehicle_tags).issubset(set(drv.vehicle_tags)):
                    violations.append(
                        f"Obligation '{ob.obligation_id}' assigned to vehicle missing tags {ob.required_vehicle_tags}."
                    )

                if stop.stop_type == "pickup":
                    running_occ += ob.passenger_count
                    p_early, p_late = effective_pickup_window(ob)
                    if stop.service_start_minute + tol < p_early or stop.service_start_minute - tol > p_late:
                        violations.append(
                            f"Pickup '{ob.obligation_id}' at {stop.service_start_minute:.2f} outside window [{p_early}, {p_late}]."
                        )
                    if ob.obligation_id in seen_pickups:
                        violations.append(f"Duplicate pickup for '{ob.obligation_id}'.")
                    seen_pickups[ob.obligation_id] = (drv.driver_id, stop.service_start_minute)
                else:
                    running_occ -= ob.passenger_count
                    if (
                        stop.service_start_minute + tol < ob.dropoff_window.earliest_minute
                        or stop.service_start_minute - tol > ob.dropoff_window.latest_minute
                    ):
                        violations.append(
                            f"Dropoff '{ob.obligation_id}' at {stop.service_start_minute:.2f} outside window "
                            f"[{ob.dropoff_window.earliest_minute}, {ob.dropoff_window.latest_minute}]."
                        )
                    if ob.obligation_id in seen_dropoffs:
                        violations.append(f"Duplicate dropoff for '{ob.obligation_id}'.")
                    seen_dropoffs[ob.obligation_id] = (drv.driver_id, stop.service_start_minute)

            prev_loc_id = stop.location_id
            prev_departure = stop.departure_minute

        if running_occ != 0:
            violations.append(
                f"Driver '{drv.driver_id}' ended route with non-zero onboard occupancy ({running_occ})."
            )

    # Verify pickup-before-dropoff, same-vehicle continuity, max ride, and causal delivery->collection timing
    for ob_id, ob in obligations_by_id.items():
        if ob.operational_state in ("completed", "cancelled"):
            continue
        in_p = ob_id in seen_pickups
        in_d = ob_id in seen_dropoffs
        if ob.operational_state == "onboard":
            if in_p:
                violations.append(f"Onboard obligation '{ob_id}' should not have a pickup stop.")
            if not in_d:
                violations.append(f"Onboard obligation '{ob_id}' was dropped without dropoff!")
            continue

        if in_p != in_d:
            violations.append(f"Obligation '{ob_id}' has mismatched pickup/dropoff presence.")
        elif in_p and in_d:
            p_drv, p_time = seen_pickups[ob_id]
            d_drv, d_time = seen_dropoffs[ob_id]
            if p_drv != d_drv:
                violations.append(f"Obligation '{ob_id}' split pickup/dropoff across '{p_drv}' and '{d_drv}'.")
            if d_time + tol < p_time:
                violations.append(f"Obligation '{ob_id}' dropoff ({d_time}) occurred before pickup ({p_time}).")
            if ob.max_ride_minutes is not None and (d_time - p_time) - tol > ob.max_ride_minutes:
                violations.append(
                    f"Obligation '{ob_id}' ride duration {d_time - p_time:.2f} exceeds max_ride_minutes {ob.max_ride_minutes}."
                )
        elif ob.is_locked or ob.operational_state == "en_route_pickup":
            violations.append(f"Locked obligation '{ob_id}' was not served.")

        if ob.linked_delivery_obligation_id:
            del_id = ob.linked_delivery_obligation_id
            del_ob = obligations_by_id[del_id]
            if in_p and del_id in seen_dropoffs:
                _, del_drop_time = seen_dropoffs[del_id]
                _, col_pick_time = seen_pickups[ob_id]
                svc_dur = ob.estimated_service_duration_minutes or 0.0
                if col_pick_time + tol < del_drop_time + svc_dur:
                    violations.append(
                        f"Collection '{ob_id}' pickup ({col_pick_time:.2f}) precedes delivery '{del_id}' completion "
                        f"({del_drop_time:.2f} + {svc_dur:.2f})."
                    )
            if (
                in_d
                and del_ob.operational_state not in ("completed", "cancelled", "onboard", "en_route_pickup")
                and del_id not in seen_dropoffs
            ):
                violations.append(
                    f"Collection '{ob_id}' was scheduled even though prerequisite delivery '{del_id}' was not served."
                )
            if (
                ob.require_collection_coverage
                and del_ob.operational_state not in ("completed", "cancelled", "onboard", "en_route_pickup")
                and not del_ob.is_locked
            ):
                del_served = del_id in seen_dropoffs
                col_served = in_d
                if del_served and not col_served:
                    violations.append(
                        f"Unstarted delivery '{del_id}' was scheduled without feasible required collection '{ob_id}'."
                    )

    return violations
