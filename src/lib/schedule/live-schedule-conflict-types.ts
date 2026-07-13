import type { DailyScheduleBooking } from "@/lib/queries/schedule";
import type { SchedulingRules } from "@/lib/scheduling/types";

export type LiveScheduleConflictSeverity = "info" | "warning" | "critical";

export type LiveScheduleConflictType =
  | "staff_overlap"
  | "room_double_booked"
  | "missing_room"
  | "booking_outside_shift"
  | "booking_on_day_off"
  | "booking_during_blocked_time"
  | "missing_schedule"
  | "schedule_rule_conflict"
  | "schedule_invalid_time_window"
  | "schedule_overlapping_windows"
  | "schedule_ineligible_shift_type"
  | "schedule_contradictory_day_state"
  | "duplicate_schedule_window"
  | "coverage_gap"
  | "home_service_travel_buffer_warning";

export type LiveScheduleIssueCode =
  | "STAFF_DOUBLE_BOOKED"
  | "ROOM_DOUBLE_BOOKED"
  | "RESOURCE_REQUIRED_MISSING"
  | "BOOKING_OUTSIDE_SHIFT"
  | "BOOKING_ON_DAY_OFF"
  | "BOOKING_DURING_BLOCKED_TIME"
  | "NO_SCHEDULE_CONFIGURED"
  | "INVALID_TIME_WINDOW"
  | "OVERLAPPING_WINDOWS"
  | "INELIGIBLE_SHIFT_TYPE"
  | "CONTRADICTORY_DAY_STATE"
  | "DUPLICATE_SCHEDULE_WINDOW"
  | "COVERAGE_REQUIREMENT_SHORTAGE"
  | "HOME_SERVICE_TRAVEL_BUFFER";

export type LiveScheduleConflictActionIntent =
  | "view_booking"
  | "assign_resource"
  | "move_booking"
  | "assign_staff"
  | "edit_staff_schedule"
  | "edit_blocked_time"
  | "open_schedule_setup"
  | "open_full_schedule"
  | "review_travel_timing";

export type LiveScheduleConflictQuickAction = {
  label: string;
  intent: LiveScheduleConflictActionIntent;
  staffId?: string;
  bookingId?: string;
};

export type LiveScheduleConflict = {
  id: string;
  fingerprint?: string;
  issue_code?: LiveScheduleIssueCode;
  type: LiveScheduleConflictType;
  severity: LiveScheduleConflictSeverity;
  title: string;
  plain_language_message: string;
  affected_staff_ids: string[];
  affected_staff_names: string[];
  affected_booking_ids: string[];
  affected_booking_labels: string[];
  affected_resource_id: string | null;
  affected_resource_name: string | null;
  date: string;
  start_time: string | null;
  end_time: string | null;
  broken_rule: string;
  why_it_matters: string;
  recommended_fix: string;
  quick_actions: LiveScheduleConflictQuickAction[];
  debug_metadata: Record<string, unknown>;
  source_ids?: string[];
};

export type ExplicitCoverageRequirement = {
  id: string;
  sourceId?: string;
  label: string;
  minimum: number;
  category?: string;
  start_time?: string | null;
  end_time?: string | null;
  actual_staff_ids?: string[];
};

export type BuildLiveScheduleConflictsOptions = {
  date: string;
  schedulingRules?: SchedulingRules | null;
  includeCoverageGap?: boolean;
  coverageRequirement?: ExplicitCoverageRequirement | null;
};

export type BookingConflictContext = {
  staffId: string;
  staffName: string;
  booking: DailyScheduleBooking;
};
