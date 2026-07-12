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
  | "duplicate_schedule_window"
  | "coverage_gap"
  | "home_service_travel_buffer_warning";

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
};

export type BuildLiveScheduleConflictsOptions = {
  date: string;
  schedulingRules?: SchedulingRules | null;
  includeCoverageGap?: boolean;
};

export type BookingConflictContext = {
  staffId: string;
  staffName: string;
  booking: DailyScheduleBooking;
};
