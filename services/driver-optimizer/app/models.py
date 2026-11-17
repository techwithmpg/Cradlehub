"""Strict Pydantic v2 request/response models for the CradleHub O1 fleet optimizer."""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


def _ensure_finite(value: float, field_name: str) -> float:
    if not math.isfinite(value):
        raise ValueError(f"{field_name} must be a finite number.")
    return value


class Coordinates(BaseModel):
    model_config = ConfigDict(extra="forbid")

    lat: float = Field(..., ge=-90.0, le=90.0)
    lng: float = Field(..., ge=-180.0, le=180.0)

    @model_validator(mode="after")
    def validate_finite(self) -> Coordinates:
        _ensure_finite(self.lat, "lat")
        _ensure_finite(self.lng, "lng")
        return self


class LocationNode(BaseModel):
    model_config = ConfigDict(extra="forbid")

    location_id: str = Field(..., min_length=1)
    label: str = ""
    lat: float = Field(..., ge=-90.0, le=90.0)
    lng: float = Field(..., ge=-180.0, le=180.0)
    location_type: Literal["branch", "customer", "driver_start", "staging"] = "customer"
    branch_id: str | None = None

    @model_validator(mode="after")
    def validate_finite_coords(self) -> LocationNode:
        _ensure_finite(self.lat, "lat")
        _ensure_finite(self.lng, "lng")
        return self


class TravelInfo(BaseModel):
    model_config = ConfigDict(extra="forbid")

    locations: list[LocationNode] = Field(..., min_length=1)
    travel_time_minutes: list[list[float]]
    travel_distance_km: list[list[float]]
    matrix_version: str = "synthetic-v1"
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @model_validator(mode="after")
    def validate_matrices(self) -> TravelInfo:
        n = len(self.locations)
        loc_ids = [loc.location_id for loc in self.locations]
        if len(set(loc_ids)) != n:
            raise ValueError("Duplicate location_id entries in travel_info.locations.")

        for name, matrix in (
            ("travel_time_minutes", self.travel_time_minutes),
            ("travel_distance_km", self.travel_distance_km),
        ):
            if len(matrix) != n:
                raise ValueError(f"{name} row count ({len(matrix)}) must match locations count ({n}).")
            for row_idx, row in enumerate(matrix):
                if len(row) != n:
                    raise ValueError(
                        f"{name} row {row_idx} length ({len(row)}) must match locations count ({n})."
                    )
                for col_idx, val in enumerate(row):
                    if not math.isfinite(val) or val < 0:
                        raise ValueError(
                            f"{name}[{row_idx}][{col_idx}] must be finite and >= 0 (got {val})."
                        )
        return self


class TimeWindow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    earliest_minute: float = Field(..., ge=0.0)
    latest_minute: float = Field(..., ge=0.0)

    @model_validator(mode="after")
    def validate_bounds(self) -> TimeWindow:
        _ensure_finite(self.earliest_minute, "earliest_minute")
        _ensure_finite(self.latest_minute, "latest_minute")
        if self.latest_minute < self.earliest_minute:
            raise ValueError(
                f"Impossible time window: latest_minute ({self.latest_minute}) < earliest_minute ({self.earliest_minute})."
            )
        return self


class LockedStopRef(BaseModel):
    model_config = ConfigDict(extra="forbid")

    obligation_id: str = Field(..., min_length=1)
    stop_type: Literal["pickup", "dropoff"]


class DriverInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    driver_id: str = Field(..., min_length=1)
    name: str = ""
    branch_id: str = "main"
    allowed_branch_ids: list[str] | None = None
    start_location_id: str = Field(..., min_length=1)
    return_to_location_id: str | None = None
    shift_start_minute: float = Field(..., ge=0.0)
    shift_end_minute: float = Field(..., ge=0.0)
    available_from_minute: float | None = Field(default=None, ge=0.0)
    available_until_minute: float | None = Field(default=None, ge=0.0)
    is_available: bool = True
    existing_committed_workload_minutes: float = Field(default=0.0, ge=0.0)
    vehicle_capacity: int = Field(..., ge=0)
    vehicle_type: str = "sedan"
    vehicle_tags: list[str] = Field(default_factory=list)
    max_stops: int | None = Field(default=None, ge=1)
    locked_stop_sequence: list[LockedStopRef] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_shift_and_availability(self) -> DriverInput:
        for fname in (
            "shift_start_minute",
            "shift_end_minute",
            "existing_committed_workload_minutes",
        ):
            _ensure_finite(getattr(self, fname), fname)
        if self.shift_end_minute < self.shift_start_minute:
            raise ValueError(
                f"Driver {self.driver_id}: shift_end_minute ({self.shift_end_minute}) < shift_start_minute ({self.shift_start_minute})."
            )
        avail_start = (
            self.available_from_minute
            if self.available_from_minute is not None
            else self.shift_start_minute
        )
        avail_end = (
            self.available_until_minute
            if self.available_until_minute is not None
            else self.shift_end_minute
        )
        _ensure_finite(avail_start, "available_from_minute")
        _ensure_finite(avail_end, "available_until_minute")
        if avail_end < avail_start:
            raise ValueError(
                f"Driver {self.driver_id}: available_until_minute ({avail_end}) < available_from_minute ({avail_start})."
            )
        if avail_start < self.shift_start_minute or avail_end > self.shift_end_minute:
            raise ValueError(
                f"Driver {self.driver_id}: availability [{avail_start}, {avail_end}] must lie within shift [{self.shift_start_minute}, {self.shift_end_minute}]."
            )
        return self

    def effective_available_from(self) -> float:
        return (
            self.available_from_minute
            if self.available_from_minute is not None
            else self.shift_start_minute
        )

    def effective_available_until(self) -> float:
        return (
            self.available_until_minute
            if self.available_until_minute is not None
            else self.shift_end_minute
        )

    def effective_available_duration(self) -> float:
        return max(0.0, self.effective_available_until() - self.effective_available_from())


class TherapistScheduleWindow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    shift_start_minute: float = Field(..., ge=0.0)
    shift_end_minute: float = Field(..., ge=0.0)

    @model_validator(mode="after")
    def validate_bounds(self) -> TherapistScheduleWindow:
        _ensure_finite(self.shift_start_minute, "shift_start_minute")
        _ensure_finite(self.shift_end_minute, "shift_end_minute")
        if self.shift_end_minute < self.shift_start_minute:
            raise ValueError(
                f"Therapist shift_end_minute ({self.shift_end_minute}) < shift_start_minute ({self.shift_start_minute})."
            )
        return self


class NextAssignmentInfo(BaseModel):
    model_config = ConfigDict(extra="forbid")

    booking_id: str | None = None
    assignment_type: Literal["home_service", "in_branch", "off_shift_or_none"] = "home_service"
    location_id: str = Field(..., min_length=1)
    earliest_start_minute: float | None = Field(default=None, ge=0.0)
    required_arrival_minute: float = Field(..., ge=0.0)
    requires_company_transport: bool | None = None
    estimated_service_end_minute: float | None = Field(default=None, ge=0.0)

    @model_validator(mode="after")
    def validate_times(self) -> NextAssignmentInfo:
        _ensure_finite(self.required_arrival_minute, "required_arrival_minute")
        if self.earliest_start_minute is not None:
            _ensure_finite(self.earliest_start_minute, "earliest_start_minute")
        if self.estimated_service_end_minute is not None:
            _ensure_finite(self.estimated_service_end_minute, "estimated_service_end_minute")
        return self


ReturnRequirementType = Literal["required", "not_required", "undecided"]


class ReturnArrangement(BaseModel):
    model_config = ConfigDict(extra="forbid")

    disposition: ReturnRequirementType | None = None
    independent_departure_approved: bool | None = None
    return_to_branch_required: bool | None = None
    confirmed_collection_commitment: bool = False
    approval_source: str | None = None
    approved_by: str | None = None
    approved_at: datetime | None = None
    approval_notes: str | None = None
    reason_code: str | None = None


class TherapistInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    therapist_id: str = Field(..., min_length=1)
    name: str = ""
    booking_id: str = Field(..., min_length=1)
    branch_id: str = "main"
    pickup_location_id: str = Field(..., min_length=1)
    customer_location_id: str = Field(..., min_length=1)
    required_arrival_minute: float = Field(..., ge=0.0)
    estimated_service_end_minute: float = Field(..., ge=0.0)
    collection_window: TimeWindow | None = None
    permitted_return_location_id: str | None = None
    passenger_seats: int = Field(default=1, ge=1)
    shift_window: TherapistScheduleWindow | None = None
    is_final_appointment: bool | None = None
    next_assignment: NextAssignmentInfo | None = None
    return_arrangement: ReturnArrangement | None = None
    collection_handling_minutes: float = Field(default=3.0, ge=0.0)
    max_collection_wait_minutes: float | None = Field(default=None, ge=0.0)

    @model_validator(mode="after")
    def validate_times(self) -> TherapistInput:
        _ensure_finite(self.required_arrival_minute, "required_arrival_minute")
        _ensure_finite(self.estimated_service_end_minute, "estimated_service_end_minute")
        _ensure_finite(self.collection_handling_minutes, "collection_handling_minutes")
        if self.estimated_service_end_minute < self.required_arrival_minute:
            raise ValueError(
                f"Therapist {self.therapist_id}: estimated_service_end_minute ({self.estimated_service_end_minute}) < required_arrival_minute ({self.required_arrival_minute})."
            )
        return self


OperationalState = Literal[
    "unstarted",
    "assigned",
    "en_route_pickup",
    "onboard",
    "in_service",
    "completed",
    "cancelled",
]


class TransportObligationInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    obligation_id: str = Field(..., min_length=1)
    booking_id: str = Field(..., min_length=1)
    therapist_id: str = Field(..., min_length=1)
    branch_id: str = "main"
    leg_type: Literal["delivery", "collection"]
    pickup_location_id: str = Field(..., min_length=1)
    dropoff_location_id: str = Field(..., min_length=1)
    pickup_coordinates: Coordinates | None = None
    dropoff_coordinates: Coordinates | None = None
    pickup_window: TimeWindow
    dropoff_window: TimeWindow
    target_arrival_minute: float | None = Field(default=None, ge=0.0)
    expected_ready_minute: float | None = Field(default=None, ge=0.0)
    max_therapist_wait_minutes: float | None = Field(default=None, ge=0.0)
    max_ride_minutes: float | None = Field(default=None, ge=0.0)
    passenger_count: int = Field(default=1, ge=1)
    pickup_handling_minutes: float = Field(default=3.0, ge=0.0)
    dropoff_handling_minutes: float = Field(default=3.0, ge=0.0)
    operational_state: OperationalState = "unstarted"
    is_locked: bool = False
    locked_driver_id: str | None = None
    previous_driver_id: str | None = None
    previous_pickup_minute: float | None = Field(default=None, ge=0.0)
    previous_dropoff_minute: float | None = Field(default=None, ge=0.0)
    linked_delivery_obligation_id: str | None = None
    estimated_service_duration_minutes: float | None = Field(default=None, ge=0.0)
    require_collection_coverage: bool = True
    required_vehicle_types: list[str] = Field(default_factory=list)
    required_vehicle_tags: list[str] = Field(default_factory=list)
    priority: int = Field(default=1, ge=1)

    @model_validator(mode="after")
    def validate_leg_consistency(self) -> TransportObligationInput:
        for fname in ("pickup_handling_minutes", "dropoff_handling_minutes"):
            _ensure_finite(getattr(self, fname), fname)
        if self.target_arrival_minute is not None:
            _ensure_finite(self.target_arrival_minute, "target_arrival_minute")
        if self.expected_ready_minute is not None:
            _ensure_finite(self.expected_ready_minute, "expected_ready_minute")
        if self.dropoff_window.latest_minute < self.pickup_window.earliest_minute:
            raise ValueError(
                f"Obligation {self.obligation_id}: dropoff_window.latest_minute ({self.dropoff_window.latest_minute}) < pickup_window.earliest_minute ({self.pickup_window.earliest_minute})."
            )
        if self.operational_state in ("onboard", "en_route_pickup") and not self.locked_driver_id:
            raise ValueError(
                f"Obligation {self.obligation_id} in state '{self.operational_state}' must specify locked_driver_id."
            )
        if self.is_locked and not self.locked_driver_id:
            raise ValueError(
                f"Obligation {self.obligation_id} has is_locked=True without locked_driver_id."
            )
        return self


class OptimizationConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    solver_time_limit_seconds: float = Field(default=5.0, ge=0.1, le=60.0)
    fairness_weight: float = Field(default=1.0, ge=0.0, le=100.0)
    travel_time_weight: float = Field(default=1.0, ge=0.0, le=100.0)
    travel_distance_weight: float = Field(default=0.5, ge=0.0, le=100.0)
    therapist_wait_weight: float = Field(default=1.5, ge=0.0, le=100.0)
    lateness_soft_weight: float = Field(default=5.0, ge=0.0, le=100.0)
    reassignment_penalty: float = Field(default=15.0, ge=0.0, le=1000.0)
    stop_complexity_minutes: float = Field(default=4.0, ge=0.0, le=60.0)
    unserved_penalty: int = Field(default=10_000_000, ge=100_000, le=1_000_000_000)
    allow_partial_service: bool = True
    allow_delivery_when_collection_undecided: bool = True
    local_search_metaheuristic: Literal[
        "automatic", "greedy_descent", "guided_local_search", "tabu_search"
    ] = "automatic"
    deterministic_seed: int | None = 42


class OptimizeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    snapshot_id: str = "synthetic-snapshot"
    planning_date: str = "2026-11-17"
    timezone: str = "Asia/Manila"
    horizon_end_minute: float = Field(default=1440.0, gt=0.0, le=4320.0)
    drivers: list[DriverInput] = Field(default_factory=list)
    therapists: list[TherapistInput] = Field(default_factory=list)
    transport_obligations: list[TransportObligationInput] = Field(default_factory=list)
    travel_info: TravelInfo
    config: OptimizationConfig = Field(default_factory=OptimizationConfig)


class StopSchedule(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sequence_index: int
    obligation_id: str | None = None
    booking_id: str | None = None
    therapist_id: str | None = None
    leg_type: Literal["delivery", "collection"] | None = None
    stop_type: Literal["driver_start", "pickup", "dropoff", "driver_return"]
    location_id: str
    location_label: str
    arrival_minute: float
    service_start_minute: float
    departure_minute: float
    wait_minutes: float
    handling_minutes: float
    driving_minutes_from_prev: float
    distance_km_from_prev: float
    occupancy_before: int
    occupancy_after: int
    is_locked: bool = False


class DriverRoutePlan(BaseModel):
    model_config = ConfigDict(extra="forbid")

    driver_id: str
    driver_name: str
    vehicle_capacity: int
    stops: list[StopSchedule]
    assigned_obligation_ids: list[str]
    driving_minutes: float
    empty_driving_minutes: float
    distance_km: float
    empty_distance_km: float
    handling_minutes: float
    idle_wait_minutes: float
    shift_span_minutes: float
    existing_committed_workload_minutes: float
    new_workload_minutes: float
    total_workload_minutes: float
    available_shift_minutes: float
    workload_utilization_ratio: float
    peak_occupancy: int
    returns_to_branch: bool


class LegAssignmentSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    obligation_id: str
    booking_id: str
    therapist_id: str
    leg_type: Literal["delivery", "collection"]
    driver_id: str
    pickup_minute: float
    dropoff_minute: float
    direct_travel_minutes: float
    ride_duration_minutes: float
    therapist_wait_minutes: float
    on_time: bool
    is_pooled_leg: bool
    change_type: Literal["new", "unchanged", "reassigned", "rescheduled"]
    previous_driver_id: str | None = None


class ReturnTransportDecision(BaseModel):
    model_config = ConfigDict(extra="forbid")

    booking_id: str
    therapist_id: str
    delivery_obligation_id: str | None = None
    collection_obligation_id: str | None = None
    requirement: ReturnRequirementType
    reason_code: str
    decision_source: str
    destination_location_id: str | None = None
    destination_type: Literal["branch", "next_customer", "none", "unresolved"] = "unresolved"
    is_final_appointment: bool | None = None
    independent_departure_approved: bool | None = None
    confirmed_collection_commitment: bool = False
    approval_source: str | None = None
    approved_by: str | None = None
    approved_at: datetime | None = None
    approval_notes: str | None = None
    detail: str = ""


class CollectionCoverageEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    booking_id: str
    therapist_id: str
    delivery_obligation_id: str | None = None
    collection_obligation_id: str | None = None
    delivery_driver_id: str | None = None
    collection_driver_id: str | None = None
    split_driver_coverage: bool = False
    return_requirement: ReturnRequirementType = "required"
    reason_code: str | None = None
    decision_source: str | None = None
    coverage_status: Literal[
        "covered_same_driver",
        "covered_split_driver",
        "collection_only_covered",
        "uncovered_collection",
        "delivery_blocked_no_collection",
        "delivery_only_no_collection_requested",
        "not_required_excluded",
        "unresolved_collection_undecided",
    ]


class UnassignedObligation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    obligation_id: str
    booking_id: str
    therapist_id: str
    leg_type: Literal["delivery", "collection"]
    reasons: list[str]
    detail: str


class FleetMetrics(BaseModel):
    model_config = ConfigDict(extra="forbid")

    total_driving_minutes: float
    total_distance_km: float
    total_empty_driving_minutes: float
    total_empty_distance_km: float
    total_idle_wait_minutes: float
    total_therapist_wait_minutes: float
    on_time_arrival_rate: float
    collection_coverage_rate: float
    pooled_route_count: int
    pooled_leg_count: int
    active_driver_count: int
    served_obligation_count: int
    unassigned_obligation_count: int
    workload_utilization_min: float
    workload_utilization_max: float
    workload_utilization_spread: float
    workload_utilization_stddev: float
    reassigned_count: int


class SolverDiagnostics(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ortools_version: str
    routing_status_code: int
    routing_status_name: str
    objective_value: int | None = None
    solver_duration_ms: float
    time_limit_seconds: float
    timed_out: bool
    first_solution_strategy: str
    local_search_metaheuristic: str
    solution_guarantee: Literal["heuristic_time_bounded", "presolve_rejected"]
    verified_hard_constraints: bool


class OptimizationResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    snapshot_id: str
    feasibility_status: Literal["feasible", "partial", "infeasible", "timeout"]
    all_obligations_served: bool
    collection_plan_safe: bool = True
    operational_commitment_allowed: bool = True
    routes: list[DriverRoutePlan]
    assignments: list[LegAssignmentSummary]
    return_decisions: list[ReturnTransportDecision] = Field(default_factory=list)
    unresolved_collection_requirements: list[ReturnTransportDecision] = Field(default_factory=list)
    collection_coverage: list[CollectionCoverageEntry]
    unassigned_obligations: list[UnassignedObligation]
    constraint_violations: list[str]
    infeasibility_reasons: list[str]
    metrics: FleetMetrics
    diagnostics: SolverDiagnostics
    matrix_version: str


class SimulationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scenario_name: str | None = None
    custom_request: OptimizeRequest | None = None
    compare_fairness: bool = True

    @model_validator(mode="after")
    def validate_source(self) -> SimulationRequest:
        if not self.scenario_name and self.custom_request is None:
            raise ValueError("Provide either scenario_name or custom_request.")
        return self


class SimulationDelta(BaseModel):
    model_config = ConfigDict(extra="forbid")

    driving_minutes_saved: float
    distance_km_saved: float
    empty_driving_minutes_saved: float
    empty_distance_km_saved: float
    workload_spread_reduction: float
    served_obligation_delta: int
    collection_coverage_delta: float


class SimulationResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scenario_name: str
    baseline_strategy: str
    baseline_metrics: FleetMetrics
    optimized_metrics: FleetMetrics
    delta_vs_baseline: SimulationDelta
    baseline_result: OptimizationResponse
    optimized_result: OptimizationResponse
    fairness_off_metrics: FleetMetrics | None = None
    fairness_off_result: OptimizationResponse | None = None
    fairness_vs_efficiency_notes: list[str] = Field(default_factory=list)
