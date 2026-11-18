"""Pydantic contracts for CradleHub Unified Optimization Engine & Predictive Conflicts."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.onsite_models import (
    AssistanceWindow,
    OnsiteResourceInput,
    OnsiteTherapistInput,
    TimeWindow,
)


class UnifiedRulesInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    travel_buffer_minutes: int = Field(default=30, ge=0, le=240)
    scheduling_home_buffer_minutes: int | None = Field(default=None, ge=0, le=240)
    room_reset_buffer_minutes: int = Field(default=10, ge=0, le=180)
    in_spa_open_minute: int = Field(default=600, ge=0, le=1440)
    in_spa_close_minute: int = Field(default=1350, ge=60, le=2880)
    home_open_minute: int | None = Field(default=None, ge=0, le=1440)
    home_close_minute: int | None = Field(default=None, ge=60, le=2880)
    min_daily_therapists: int = Field(default=1, ge=0, le=50)


class UnifiedDriverInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    driver_id: str
    name: str
    home_branch_id: str
    allowed_branch_ids: list[str] = Field(default_factory=list)
    shift_windows: list[TimeWindow] = Field(default_factory=list)
    checked_in: bool = False
    gps_age_seconds: int | None = Field(default=None, ge=0)
    gps_accuracy_meters: float | None = Field(default=None, ge=0)
    gps_offline: bool = False
    gps_permission_missing: bool = False
    lat: float | None = None
    lng: float | None = None


class UnifiedBookingInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    booking_id: str
    order_id: str | None = None
    customer_name: str = "Guest"
    service_id: str
    service_name: str = "Service"
    delivery_type: Literal["in_spa", "home_service"]
    status: str
    booking_progress_status: str = "not_started"
    tracking_status: str | None = None
    therapist_id: str | None = None
    therapist_selection_source: str | None = None
    driver_id: str | None = None
    collection_driver_id: str | None = None
    resource_id: str | None = None
    start_minute: int = Field(ge=0, le=2880)
    end_minute: int = Field(ge=0, le=2880)
    duration_minutes: int = Field(default=60, gt=0)
    buffer_before_minutes: int = Field(default=0, ge=0)
    buffer_after_minutes: int = Field(default=0, ge=0)
    travel_buffer_minutes: int | None = Field(default=None, ge=0)
    live_eta_minutes: float | None = Field(default=None, ge=0)
    distance_km: float | None = Field(default=None, ge=0)
    session_started_minute: int | None = Field(default=None, ge=0, le=2880)
    session_due_minute: int | None = Field(default=None, ge=0, le=2880)
    projected_end_minute: int | None = Field(default=None, ge=0, le=2880)
    collection_decision: Literal["required", "not_required", "undecided"] | None = None
    has_valid_customer_location: bool = True
    requires_room: bool = True


class RoomTurnoverTaskInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    task_id: str
    resource_id: str
    resource_name: str = ""
    status: Literal["open", "in_progress", "resolved", "completed"] = "open"
    started_minute: int = Field(ge=0, le=2880)
    expected_ready_minute: int = Field(ge=0, le=2880)


class CrossBranchAssistanceInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    request_id: str
    requesting_branch_id: str
    lending_branch_id: str
    status: str
    visit_type: Literal["in_spa", "home_service", "both"] = "in_spa"
    start_minute: int = Field(ge=0, le=2880)
    end_minute: int = Field(ge=0, le=2880)
    selected_staff_ids: list[str] = Field(default_factory=list)


class UnifiedEvaluateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    branch_id: str
    branch_name: str = "Branch"
    date: str
    now_minute: int = Field(ge=0, le=2880)
    source_snapshot_version: str
    rules: UnifiedRulesInput = Field(default_factory=UnifiedRulesInput)
    therapists: list[OnsiteTherapistInput] = Field(default_factory=list)
    drivers: list[UnifiedDriverInput] = Field(default_factory=list)
    resources: list[OnsiteResourceInput] = Field(default_factory=list)
    bookings: list[UnifiedBookingInput] = Field(default_factory=list)
    room_turnovers: list[RoomTurnoverTaskInput] = Field(default_factory=list)
    assistance_requests: list[CrossBranchAssistanceInput] = Field(default_factory=list)


class DynamicBufferDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    booking_id: str
    pre_buffer_minutes: int
    post_buffer_minutes: int
    buffer_source: Literal[
        "live_traffic", "maps_matrix", "distance_fallback", "branch_rule_fallback"
    ]
    configured_rule_buffer_minutes: int
    note: str


class RecommendedStaffAction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action_id: str
    action_type: Literal[
        "swap_therapist",
        "assign_therapist",
        "reassign_room",
        "assign_room",
        "assign_driver",
        "reassign_collection_driver",
        "prioritize_room_turnover",
        "offer_earlier_slot",
        "reschedule_booking",
        "fix_location_or_gps",
        "reconcile_branch_rules",
    ]
    label: str
    detail: str
    target_booking_id: str | None = None
    proposed_staff_id: str | None = None
    proposed_staff_name: str | None = None
    proposed_resource_id: str | None = None
    proposed_resource_name: str | None = None
    proposed_driver_id: str | None = None
    proposed_driver_name: str | None = None
    proposed_start_minute: int | None = None
    requires_customer_approval: bool = False
    verified_feasible: bool = True


class DataQualityAssessment(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["high", "medium", "degraded_gps", "rule_fallback"]
    score: float = Field(ge=0.0, le=1.0)
    notes: list[str] = Field(default_factory=list)


class PredictiveConflictItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    issue_type: Literal[
        "home_service_to_onsite_collision",
        "onsite_to_home_service_collision",
        "driver_route_ripple",
        "room_capacity_bottleneck",
        "room_turnover_collision",
        "session_overrun_ripple",
        "therapist_unassigned_risk",
        "driver_unassigned_risk",
        "location_or_gps_degraded",
        "rule_drift_or_cross_branch_gap",
        "earlier_slot_opportunity",
    ]
    branch_id: str
    affected_booking_ids: list[str]
    affected_staff_ids: list[str]
    affected_resource_ids: list[str]
    severity: Literal["info", "warning", "high", "critical"]
    confidence_or_data_quality: DataQualityAssessment
    predicted_impact: str
    latest_useful_action_time: str
    latest_useful_action_minute: int
    recommended_actions: list[RecommendedStaffAction]
    authorization_required: Literal[
        "none", "crm_operator", "manager_or_owner", "customer_confirmation"
    ]
    source_snapshot_version: str
    dedupe_key: str
    expiration_or_resolution_condition: str
    assistant_tier: Literal[
        "quiet_opportunity", "early_warning_toast", "persistent_action_required"
    ]


class SharedTimelineSpan(BaseModel):
    model_config = ConfigDict(extra="forbid")

    booking_id: str
    delivery_type: Literal["in_spa", "home_service"]
    customer_name: str
    service_name: str
    start_minute: int
    end_minute: int
    effective_start_minute: int
    effective_end_minute: int
    resource_id: str | None = None
    driver_id: str | None = None
    is_active_session: bool = False


class TherapistTimelineSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    staff_id: str
    staff_name: str
    home_branch_id: str
    checked_in: bool
    scheduled_minutes_today: int
    booked_minutes_today: int
    spans: list[SharedTimelineSpan]


class UnifiedEvaluateResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    branch_id: str
    date: str
    now_minute: int
    source_snapshot_version: str
    dynamic_buffers: list[DynamicBufferDetail]
    therapist_timelines: list[TherapistTimelineSummary]
    conflicts_and_opportunities: list[PredictiveConflictItem]
    summary_counts: dict[str, int]
    evaluator_latency_ms: float
