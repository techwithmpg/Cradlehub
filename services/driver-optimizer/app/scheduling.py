"""Scheduling-aware conditional therapist collection classifier and obligation reconciler."""

from __future__ import annotations

from dataclasses import dataclass

from app.models import (
    OptimizeRequest,
    ReturnTransportDecision,
    TherapistInput,
    TimeWindow,
    TransportObligationInput,
)


@dataclass(frozen=True)
class ReconciledSchedule:
    """Result of evaluating therapist schedules, bookings, and return arrangements."""

    obligations: list[TransportObligationInput]
    return_decisions: list[ReturnTransportDecision]
    excluded_collection_ids: set[str]
    withheld_undecided_deliveries: list[TransportObligationInput]


def _build_delivery_from_therapist(t: TherapistInput) -> TransportObligationInput:
    del_earliest = max(0.0, t.required_arrival_minute - 60.0)
    return TransportObligationInput(
        obligation_id=f"{t.booking_id}:{t.therapist_id}:delivery",
        booking_id=t.booking_id,
        therapist_id=t.therapist_id,
        branch_id=t.branch_id,
        leg_type="delivery",
        pickup_location_id=t.pickup_location_id,
        dropoff_location_id=t.customer_location_id,
        pickup_window=TimeWindow(
            earliest_minute=del_earliest,
            latest_minute=t.required_arrival_minute,
        ),
        dropoff_window=TimeWindow(
            earliest_minute=del_earliest,
            latest_minute=t.required_arrival_minute,
        ),
        target_arrival_minute=t.required_arrival_minute,
        passenger_count=t.passenger_seats,
    )


def _build_onward_collection_from_therapist(
    t: TherapistInput,
    decision: ReturnTransportDecision,
    delivery_ob: TransportObligationInput | None,
    request: OptimizeRequest,
    loc_idx_by_id: dict[str, int],
) -> TransportObligationInput:
    dest_loc = decision.destination_location_id or t.permitted_return_location_id or t.pickup_location_id
    earliest_ready = t.estimated_service_end_minute
    handling = t.collection_handling_minutes

    if t.collection_window is not None:
        p_win = t.collection_window
        d_latest = (
            t.next_assignment.required_arrival_minute
            if t.next_assignment is not None
            else min(request.horizon_end_minute, max(p_win.latest_minute + 90.0, request.horizon_end_minute))
        )
        d_win = TimeWindow(
            earliest_minute=p_win.earliest_minute,
            latest_minute=max(p_win.earliest_minute, min(request.horizon_end_minute, d_latest)),
        )
    elif t.next_assignment is not None:
        u = loc_idx_by_id.get(t.customer_location_id)
        w = loc_idx_by_id.get(dest_loc)
        direct_drive = (
            request.travel_info.travel_time_minutes[u][w]
            if u is not None and w is not None
            else 0.0
        )
        req_arr = min(request.horizon_end_minute, t.next_assignment.required_arrival_minute)
        slack = max(0.0, req_arr - earliest_ready - direct_drive - handling)
        p_latest = min(request.horizon_end_minute, earliest_ready + max(slack, 15.0))
        if t.max_collection_wait_minutes is not None:
            p_latest = min(p_latest, earliest_ready + t.max_collection_wait_minutes)
        p_win = TimeWindow(earliest_minute=earliest_ready, latest_minute=max(earliest_ready, p_latest))
        d_win = TimeWindow(
            earliest_minute=earliest_ready,
            latest_minute=max(earliest_ready, req_arr),
        )
    else:
        max_wait = t.max_collection_wait_minutes if t.max_collection_wait_minutes is not None else 45.0
        p_latest = min(request.horizon_end_minute, earliest_ready + max_wait)
        d_latest = min(request.horizon_end_minute, p_latest + 90.0)
        p_win = TimeWindow(earliest_minute=earliest_ready, latest_minute=max(earliest_ready, p_latest))
        d_win = TimeWindow(earliest_minute=earliest_ready, latest_minute=max(earliest_ready, d_latest))

    service_dur = max(0.0, t.estimated_service_end_minute - t.required_arrival_minute)
    return TransportObligationInput(
        obligation_id=f"{t.booking_id}:{t.therapist_id}:collection",
        booking_id=t.booking_id,
        therapist_id=t.therapist_id,
        branch_id=t.branch_id,
        leg_type="collection",
        pickup_location_id=t.customer_location_id,
        dropoff_location_id=dest_loc,
        pickup_window=p_win,
        dropoff_window=d_win,
        target_arrival_minute=(
            t.next_assignment.required_arrival_minute if t.next_assignment is not None else None
        ),
        expected_ready_minute=earliest_ready,
        max_therapist_wait_minutes=t.max_collection_wait_minutes,
        passenger_count=t.passenger_seats,
        pickup_handling_minutes=handling,
        dropoff_handling_minutes=handling,
        linked_delivery_obligation_id=delivery_ob.obligation_id if delivery_ob else None,
        estimated_service_duration_minutes=service_dur,
        require_collection_coverage=True,
    )


def _is_confirmed_or_active_collection(
    col_ob: TransportObligationInput | None,
    therapist: TherapistInput,
    locked_stop_ob_ids: set[str],
) -> bool:
    if col_ob is not None and (
        col_ob.is_locked
        or col_ob.obligation_id in locked_stop_ob_ids
        or col_ob.operational_state in ("en_route_pickup", "onboard", "completed")
    ):
        return True
    if therapist.return_arrangement and therapist.return_arrangement.confirmed_collection_commitment:
        return True
    return False


def classify_therapist_return_transport(
    t: TherapistInput,
    delivery_ob: TransportObligationInput | None,
    collection_ob: TransportObligationInput | None,
    locked_stop_ob_ids: set[str] | None = None,
) -> ReturnTransportDecision:
    """Deterministically classify whether onward transport is required, not_required, or undecided."""
    arr = t.return_arrangement
    nxt = t.next_assignment
    confirmed = _is_confirmed_or_active_collection(collection_ob, t, locked_stop_ob_ids or set())

    common_meta = {
        "booking_id": t.booking_id,
        "therapist_id": t.therapist_id,
        "delivery_obligation_id": delivery_ob.obligation_id if delivery_ob else None,
        "collection_obligation_id": collection_ob.obligation_id if collection_ob else None,
        "is_final_appointment": t.is_final_appointment,
        "independent_departure_approved": arr.independent_departure_approved if arr else None,
        "confirmed_collection_commitment": confirmed,
        "approval_source": arr.approval_source if arr else None,
        "approved_by": arr.approved_by if arr else None,
        "approved_at": arr.approved_at if arr else None,
        "approval_notes": arr.approval_notes if arr else None,
    }

    # 1. Preserve confirmed / active collection commitments above disposition changes
    if confirmed:
        dest_loc = (
            collection_ob.dropoff_location_id
            if collection_ob is not None
            else (nxt.location_id if nxt and nxt.requires_company_transport else (t.permitted_return_location_id or t.pickup_location_id))
        )
        dest_type = (
            "next_customer"
            if nxt and nxt.assignment_type == "home_service" and dest_loc == nxt.location_id
            else "branch"
        )
        if arr and arr.disposition == "not_required":
            detail = (
                "Confirmed/active collection commitment preserved despite updated 'not_required' "
                "disposition; only unstarted commitments may be cancelled."
            )
        else:
            detail = "Confirmed or active collection commitment remains mandatory."
        return ReturnTransportDecision(
            **common_meta,
            requirement="required",
            reason_code="confirmed_collection_commitment_preserved",
            decision_source=arr.approval_source if arr and arr.approval_source else "active_commitment",
            destination_location_id=dest_loc,
            destination_type=dest_type,
            detail=detail,
        )

    # 2. Check conflicting or contradictory scheduling metadata -> always undecided (fail safe)
    if arr and arr.independent_departure_approved is True and arr.return_to_branch_required is True:
        return ReturnTransportDecision(
            **common_meta,
            requirement="undecided",
            reason_code="conflicting_return_and_independent_approval",
            decision_source="schedule_conflict_detector",
            detail="Both independent_departure_approved and return_to_branch_required are True.",
        )

    if arr and arr.disposition == "required" and arr.independent_departure_approved is True:
        return ReturnTransportDecision(
            **common_meta,
            requirement="undecided",
            reason_code="conflicting_required_and_independent_approval",
            decision_source="schedule_conflict_detector",
            detail="Arrangement marks return 'required' while independent_departure_approved is True.",
        )

    if nxt is not None and t.is_final_appointment is True:
        return ReturnTransportDecision(
            **common_meta,
            requirement="undecided",
            reason_code="conflicting_final_flag_and_next_booking",
            decision_source="schedule_conflict_detector",
            detail="Therapist is marked is_final_appointment=True yet has a scheduled next_assignment.",
        )

    if nxt is not None and nxt.required_arrival_minute < t.estimated_service_end_minute:
        return ReturnTransportDecision(
            **common_meta,
            requirement="undecided",
            reason_code="schedule_overlap_conflict",
            decision_source="schedule_conflict_detector",
            detail=(
                f"Next assignment arrival ({nxt.required_arrival_minute}) precedes current "
                f"estimated_service_end_minute ({t.estimated_service_end_minute})."
            ),
        )

    if arr and arr.disposition == "not_required" and (
        arr.return_to_branch_required is True
        or (nxt is not None and nxt.requires_company_transport is True)
    ):
        return ReturnTransportDecision(
            **common_meta,
            requirement="undecided",
            reason_code="conflicting_disposition_with_onward_requirement",
            decision_source="schedule_conflict_detector",
            detail="Disposition is 'not_required' while onward transport or branch return is flagged required.",
        )

    if arr and arr.disposition == "undecided":
        return ReturnTransportDecision(
            **common_meta,
            requirement="undecided",
            reason_code=arr.reason_code or "explicit_undecided_arrangement",
            decision_source=arr.approval_source or "return_arrangement",
            detail=arr.approval_notes or "Return transport requirement is explicitly marked undecided.",
        )

    # 3. Upcoming scheduled assignment
    if nxt is not None:
        if nxt.requires_company_transport is True:
            dest_type = "next_customer" if nxt.assignment_type == "home_service" else "branch"
            return ReturnTransportDecision(
                **common_meta,
                requirement="required",
                reason_code=(arr.reason_code if arr and arr.reason_code else None)
                or "onward_booking_requires_transport",
                decision_source="therapist_next_assignment",
                destination_location_id=nxt.location_id,
                destination_type=dest_type,
                detail=f"Onward company transport required to next assignment '{nxt.location_id}'.",
            )
        if nxt.requires_company_transport is None:
            return ReturnTransportDecision(
                **common_meta,
                requirement="undecided",
                reason_code="unresolved_next_booking_transport",
                decision_source="therapist_next_assignment",
                detail="Next assignment exists, but requires_company_transport is unresolved.",
            )
        # nxt.requires_company_transport is False
        if nxt.location_id == t.customer_location_id:
            return ReturnTransportDecision(
                **common_meta,
                requirement="not_required",
                reason_code="same_location_consecutive_service",
                decision_source="therapist_next_assignment",
                destination_type="none",
                detail="Next booking is at the same customer location; no driver travel required.",
            )
        if (arr and arr.independent_departure_approved is True) or (arr and arr.disposition == "not_required"):
            return ReturnTransportDecision(
                **common_meta,
                requirement="not_required",
                reason_code=(arr.reason_code if arr and arr.reason_code else None)
                or "next_booking_independent_transport_approved",
                decision_source=(arr.approval_source if arr and arr.approval_source else None)
                or "return_arrangement",
                destination_type="none",
                detail="Next assignment uses approved independent transportation.",
            )
        if arr and arr.return_to_branch_required is True:
            dest = t.permitted_return_location_id or t.pickup_location_id
            return ReturnTransportDecision(
                **common_meta,
                requirement="required",
                reason_code="authorized_return_to_branch_required",
                decision_source=arr.approval_source or "return_arrangement",
                destination_location_id=dest,
                destination_type="branch",
                detail="Authorized return to branch is required before independent next assignment.",
            )
        return ReturnTransportDecision(
            **common_meta,
            requirement="undecided",
            reason_code="next_booking_transport_unconfirmed",
            decision_source="therapist_next_assignment",
            detail="Next assignment marks company transport false without independent travel confirmation.",
        )

    # 4. Explicit branch return or disposition=required (takes precedence over shift end!)
    if (arr and arr.return_to_branch_required is True) or (arr and arr.disposition == "required"):
        dest = t.permitted_return_location_id or t.pickup_location_id
        return ReturnTransportDecision(
            **common_meta,
            requirement="required",
            reason_code=(arr.reason_code if arr and arr.reason_code else None)
            or "authorized_return_to_branch_required",
            decision_source=(arr.approval_source if arr and arr.approval_source else None)
            or "return_arrangement",
            destination_location_id=dest,
            destination_type="branch",
            detail="Authorized schedule/arrangement requires therapist return to branch.",
        )

    # 5. Approved independent departure or explicit not_required
    if (arr and arr.independent_departure_approved is True) or (arr and arr.disposition == "not_required"):
        reason = (
            arr.reason_code
            if arr and arr.reason_code
            else (
                "final_appointment_independent_departure_approved"
                if t.is_final_appointment is True
                else "authorized_independent_departure"
            )
        )
        return ReturnTransportDecision(
            **common_meta,
            requirement="not_required",
            reason_code=reason,
            decision_source=(arr.approval_source if arr and arr.approval_source else None)
            or "return_arrangement",
            destination_type="none",
            detail="Approved independent departure established; no collection required.",
        )

    # 6. Explicit denial of independent departure -> return required
    if arr and arr.independent_departure_approved is False:
        dest = t.permitted_return_location_id or t.pickup_location_id
        return ReturnTransportDecision(
            **common_meta,
            requirement="required",
            reason_code=arr.reason_code or "independent_departure_not_approved_return_required",
            decision_source=arr.approval_source or "return_arrangement",
            destination_location_id=dest,
            destination_type="branch",
            detail="Independent departure not approved; company return transport required.",
        )

    # 7. Explicit collection obligation or collection_window supplied without not_required override
    if collection_ob is not None or t.collection_window is not None:
        dest = (
            collection_ob.dropoff_location_id
            if collection_ob is not None
            else (t.permitted_return_location_id or t.pickup_location_id)
        )
        return ReturnTransportDecision(
            **common_meta,
            requirement="required",
            reason_code="explicit_collection_obligation",
            decision_source="collection_obligation_or_window",
            destination_location_id=dest,
            destination_type="branch",
            detail="Explicit collection obligation or collection window provided.",
        )

    # 8. Unresolved cases — NEVER infer not_required from shift end alone!
    if t.is_final_appointment is True:
        return ReturnTransportDecision(
            **common_meta,
            requirement="undecided",
            reason_code="final_appointment_departure_unconfirmed",
            decision_source="schedule_policy",
            detail="Final appointment reached without confirmed independent departure or branch-return authorization.",
        )

    if t.is_final_appointment is False:
        return ReturnTransportDecision(
            **common_meta,
            requirement="undecided",
            reason_code="future_schedule_unresolved",
            decision_source="schedule_policy",
            detail="More shift time remains, but subsequent booking or return arrangement is unresolved.",
        )

    return ReturnTransportDecision(
        **common_meta,
        requirement="undecided",
        reason_code="missing_scheduling_context",
        decision_source="schedule_policy",
        detail="Insufficient therapist scheduling or return authorization data to classify return transport.",
    )


def reconcile_scheduling_and_obligations(
    request: OptimizeRequest,
    loc_idx_by_id: dict[str, int],
) -> ReconciledSchedule:
    """Reconcile therapists' scheduling classifications with transport_obligations."""
    existing_obs = list(request.transport_obligations)
    by_key_del: dict[tuple[str, str], TransportObligationInput] = {}
    by_key_col: dict[tuple[str, str], TransportObligationInput] = {}

    for ob in existing_obs:
        if ob.operational_state == "cancelled":
            continue
        key = (ob.booking_id, ob.therapist_id)
        if ob.leg_type == "delivery":
            by_key_del[key] = ob
        else:
            by_key_col[key] = ob

    decisions: list[ReturnTransportDecision] = []
    excluded_collection_ids: set[str] = set()
    withheld_undecided_delivery_ids: set[str] = set()
    synthesized: list[TransportObligationInput] = []

    seen_keys: set[tuple[str, str]] = set()
    locked_stop_ob_ids = {
        ref.obligation_id for drv in request.drivers for ref in drv.locked_stop_sequence
    }
    for t in request.therapists:
        key = (t.booking_id, t.therapist_id)
        seen_keys.add(key)
        del_ob = by_key_del.get(key)
        col_ob = by_key_col.get(key)

        if del_ob is None and col_ob is None and not existing_obs:
            del_ob = _build_delivery_from_therapist(t)
            synthesized.append(del_ob)
            by_key_del[key] = del_ob

        decision = classify_therapist_return_transport(
            t, del_ob, col_ob, locked_stop_ob_ids=locked_stop_ob_ids
        )

        if decision.requirement == "required":
            if col_ob is None:
                new_col = _build_onward_collection_from_therapist(
                    t, decision, del_ob, request, loc_idx_by_id
                )
                synthesized.append(new_col)
                by_key_col[key] = new_col
                decision = decision.model_copy(
                    update={"collection_obligation_id": new_col.obligation_id}
                )
        elif decision.requirement == "not_required":
            # Only unstarted/unlocked/unconfirmed collections may be reconsidered & removed
            if (
                col_ob is not None
                and col_ob.operational_state in ("unstarted", "assigned")
                and not col_ob.is_locked
                and col_ob.obligation_id not in locked_stop_ob_ids
            ):
                excluded_collection_ids.add(col_ob.obligation_id)
                decision = decision.model_copy(update={"collection_obligation_id": None})
        else:  # undecided
            if (
                col_ob is not None
                and col_ob.operational_state in ("unstarted", "assigned")
                and not col_ob.is_locked
                and col_ob.obligation_id not in locked_stop_ob_ids
            ):
                excluded_collection_ids.add(col_ob.obligation_id)
                decision = decision.model_copy(update={"collection_obligation_id": None})
            if (
                not request.config.allow_delivery_when_collection_undecided
                and del_ob is not None
                and del_ob.operational_state in ("unstarted", "assigned")
                and not del_ob.is_locked
            ):
                withheld_undecided_delivery_ids.add(del_ob.obligation_id)

        decisions.append(decision)

    # Also classify any transport_obligations lacking a TherapistInput entry
    all_keys_from_obs: list[tuple[str, str]] = []
    for ob in existing_obs:
        if ob.operational_state == "cancelled":
            continue
        k = (ob.booking_id, ob.therapist_id)
        if k not in seen_keys and k not in all_keys_from_obs:
            all_keys_from_obs.append(k)

    for key in all_keys_from_obs:
        del_ob = by_key_del.get(key)
        col_ob = by_key_col.get(key)
        booking_id, therapist_id = key
        if col_ob is not None:
            decisions.append(
                ReturnTransportDecision(
                    booking_id=booking_id,
                    therapist_id=therapist_id,
                    delivery_obligation_id=del_ob.obligation_id if del_ob else None,
                    collection_obligation_id=col_ob.obligation_id,
                    requirement="required",
                    reason_code="explicit_collection_obligation",
                    decision_source="transport_obligation_input",
                    destination_location_id=col_ob.dropoff_location_id,
                    destination_type="branch",
                    confirmed_collection_commitment=(
                        col_ob.is_locked
                        or col_ob.operational_state in ("en_route_pickup", "onboard", "completed")
                    ),
                    detail="Collection obligation explicitly provided in transport_obligations.",
                )
            )
        elif del_ob is not None:
            decisions.append(
                ReturnTransportDecision(
                    booking_id=booking_id,
                    therapist_id=therapist_id,
                    delivery_obligation_id=del_ob.obligation_id,
                    collection_obligation_id=None,
                    requirement="undecided",
                    reason_code="missing_scheduling_context",
                    decision_source="schedule_policy",
                    destination_type="unresolved",
                    detail="Delivery obligation provided without therapist scheduling or return authorization.",
                )
            )
            if (
                not request.config.allow_delivery_when_collection_undecided
                and del_ob.operational_state in ("unstarted", "assigned")
                and not del_ob.is_locked
            ):
                withheld_undecided_delivery_ids.add(del_ob.obligation_id)

    all_candidates = [*existing_obs, *synthesized]
    withheld_deliveries = [
        ob for ob in all_candidates if ob.obligation_id in withheld_undecided_delivery_ids
    ]
    final_obligations = [
        ob
        for ob in all_candidates
        if ob.obligation_id not in excluded_collection_ids
        and ob.obligation_id not in withheld_undecided_delivery_ids
    ]

    return ReconciledSchedule(
        obligations=final_obligations,
        return_decisions=decisions,
        excluded_collection_ids=excluded_collection_ids,
        withheld_undecided_deliveries=withheld_deliveries,
    )
