"""Pydantic contracts for CradleHub On-Site Level 1 CP-SAT optimization."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class TimeWindow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    start_minute: int = Field(ge=0, le=2880)
    end_minute: int = Field(ge=0, le=2880)

    @model_validator(mode="after")
    def _validate_order(self) -> TimeWindow:
        if self.end_minute <= self.start_minute:
            raise ValueError("end_minute must be greater than start_minute.")
        return self


class AssistanceWindow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    requesting_branch_id: str
    start_minute: int = Field(ge=0, le=2880)
    end_minute: int = Field(ge=0, le=2880)
    visit_type: Literal["in_spa", "home_service", "both"] = "in_spa"

    @model_validator(mode="after")
    def _validate_order(self) -> AssistanceWindow:
        if self.end_minute <= self.start_minute:
            raise ValueError("assistance window end_minute must exceed start_minute.")
        return self


class TherapistBusyWindow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    booking_id: str
    start_minute: int = Field(ge=0, le=2880)
    end_minute: int = Field(ge=0, le=2880)
    effective_start_minute: int = Field(ge=0, le=2880)
    effective_end_minute: int = Field(ge=0, le=2880)
    delivery_type: Literal["in_spa", "home_service"] = "in_spa"
    resource_id: str | None = None
    is_active_session: bool = False


class ResourceBusyWindow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    booking_id: str
    start_minute: int = Field(ge=0, le=2880)
    end_minute: int = Field(ge=0, le=2880)
    reset_after_minutes: int = Field(default=0, ge=0, le=180)


class OnsiteTherapistInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    staff_id: str
    name: str
    home_branch_id: str
    seniority_rank: int = 999
    completed_count_today: int = Field(default=0, ge=0)
    checked_in: bool = False
    qualified_service_ids: list[str] = Field(default_factory=list)
    shift_windows: list[TimeWindow] = Field(default_factory=list)
    break_windows: list[TimeWindow] = Field(default_factory=list)
    blocked_windows: list[TimeWindow] = Field(default_factory=list)
    assistance_windows: list[AssistanceWindow] = Field(default_factory=list)
    busy_windows: list[TherapistBusyWindow] = Field(default_factory=list)
    max_services_per_day: int | None = Field(default=None, ge=1, le=30)
    max_working_minutes_per_day: int | None = Field(default=None, ge=30, le=1440)
    existing_service_count_today: int = Field(default=0, ge=0)
    existing_working_minutes_today: int = Field(default=0, ge=0)


class OnsiteResourceInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    resource_id: str
    name: str
    resource_type: str = "room"
    capacity: int = Field(default=1, ge=1, le=20)
    sort_order: int = 0
    is_active: bool = True
    allowed_service_ids: list[str] = Field(default_factory=list)
    active_turnover_until_minute: int | None = Field(default=None, ge=0, le=2880)
    turnover_start_minute: int | None = Field(default=None, ge=0, le=2880)
    reset_buffer_minutes: int | None = Field(default=None, ge=0, le=180)
    busy_windows: list[ResourceBusyWindow] = Field(default_factory=list)


class OnsiteServiceRequirement(BaseModel):
    model_config = ConfigDict(extra="forbid")

    line_id: str
    attendee_id: str
    line_index: int = Field(default=0, ge=0)
    service_id: str
    service_name: str = ""
    duration_minutes: int = Field(gt=0, le=480)
    buffer_before_minutes: int = Field(default=0, ge=0, le=180)
    buffer_after_minutes: int = Field(default=0, ge=0, le=180)
    requires_room: bool = True
    preferred_staff_id: str | None = None
    locked_staff_id: str | None = None
    locked_resource_id: str | None = None
    allowed_resource_types: list[str] = Field(default_factory=list)


class OnsiteSolveRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    branch_id: str
    date: str
    branch_open_minute: int = Field(default=600, ge=0, le=1440)
    branch_close_minute: int = Field(default=1350, ge=60, le=2880)
    slot_interval_minutes: int = Field(default=30, ge=5, le=120)
    room_reset_buffer_minutes: int = Field(default=10, ge=0, le=180)
    mode: Literal["assign_order", "slot_matrix"] = "assign_order"
    requested_start_minute: int | None = Field(default=None, ge=0, le=2880)
    candidate_start_minutes: list[int] = Field(default_factory=list)
    allow_alternative_times: bool = True
    allow_earlier_opportunities: bool = True
    max_alternatives: int = Field(default=5, ge=0, le=20)
    enforce_room_capacity: bool = True
    group_room_policy: Literal["share_if_capacity", "prefer_together", "separate_ok"] = (
        "prefer_together"
    )
    therapists: list[OnsiteTherapistInput] = Field(default_factory=list)
    resources: list[OnsiteResourceInput] = Field(default_factory=list)
    requirements: list[OnsiteServiceRequirement] = Field(min_length=1)

    @model_validator(mode="after")
    def _validate_request(self) -> OnsiteSolveRequest:
        if self.branch_close_minute <= self.branch_open_minute:
            raise ValueError("branch_close_minute must exceed branch_open_minute.")
        if self.mode == "assign_order" and self.requested_start_minute is None:
            raise ValueError("requested_start_minute is required when mode='assign_order'.")
        return self


class OnsiteAssignmentLine(BaseModel):
    model_config = ConfigDict(extra="forbid")

    line_id: str
    attendee_id: str
    service_id: str
    start_minute: int
    end_minute: int
    staff_id: str
    staff_name: str
    resource_id: str | None = None
    resource_name: str | None = None
    matched_preferred_staff: bool = False


class OnsiteAlternativeSuggestion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["earlier_slot", "nearby_slot", "alternate_staff_or_room"]
    start_minute: int
    end_minute: int
    delta_minutes: int
    summary: str
    assignments: list[OnsiteAssignmentLine]


class OnsiteSlotAvailability(BaseModel):
    model_config = ConfigDict(extra="forbid")

    start_minute: int
    available: bool
    eligible_staff_ids: list[str]
    available_room_count: int
    total_active_room_capacity: int
    blocking_reasons: list[str]
    sample_assignments: list[OnsiteAssignmentLine] = Field(default_factory=list)


class OnsiteSolveResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    feasible: bool
    room_constraint_mode: Literal[
        "enforced", "unconstrained_no_resources", "not_required"
    ]
    requested_start_minute: int | None = None
    assignments: list[OnsiteAssignmentLine] = Field(default_factory=list)
    total_start_minute: int | None = None
    total_end_minute: int | None = None
    infeasibility_reasons: list[str] = Field(default_factory=list)
    alternatives: list[OnsiteAlternativeSuggestion] = Field(default_factory=list)
    candidate_slots: list[OnsiteSlotAvailability] = Field(default_factory=list)
    solver_latency_ms: float
