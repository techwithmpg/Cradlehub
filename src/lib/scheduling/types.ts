// Domain types for the deterministic scheduling rules engine.
// These mirror the DB schema but are typed for use in application logic.

export type ScheduleHealthStatus = "ok" | "warning" | "critical";

export type ScheduleSuggestionStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "applied"
  | "expired"
  | "cancelled";

export type ScheduleSuggestionType =
  | "move_day_off"
  | "add_day_off"
  | "add_break_block"
  | "add_travel_buffer"
  | "add_room_reset_buffer"
  | "reassign_booking"
  | "adjust_shift"
  | "mark_staff_unavailable"
  | "resolve_understaffing";

export type SuggestionPriority = "low" | "normal" | "high" | "critical";

// ── Scheduling rules (branch-level config) ────────────────────
export interface SchedulingRules {
  id: string;
  branch_id: string;

  // Coverage thresholds
  min_daily_staff: number;
  min_daily_therapists: number;
  min_daily_csr: number;
  min_daily_drivers: number;
  min_daily_utility: number;

  // Day-off limits
  default_days_off_per_week: number;
  max_same_role_off_per_day: number;
  max_therapists_off_per_day: number;
  protect_weekends: boolean;

  // Break & working hour rules
  default_break_minutes: number;
  auto_breaks_enabled: boolean;
  max_working_hours_per_day: number;
  max_services_per_staff_per_day: number | null;

  // Auto-blocking
  auto_generate_breaks: boolean;
  auto_generate_travel_buffers: boolean;
  auto_generate_room_reset_buffers: boolean;
  room_reset_buffer_minutes: number;

  // Home service
  home_service_travel_buffer_minutes: number;

  // Approval flow
  suggestions_require_manager_approval: boolean;

  created_at: string;
  updated_at: string;
}

export type SchedulingRulesUpdate = Partial<
  Omit<SchedulingRules, "id" | "branch_id" | "created_at" | "updated_at">
>;

// ── Staff scheduling preferences (per-staff) ─────────────────
export interface StaffSchedulingPreferences {
  id: string;
  staff_id: string;
  branch_id: string | null;
  preferred_day_off: number | null;
  secondary_preferred_day_off: number | null;
  default_break_start: string | null;
  default_break_end: string | null;
  can_do_home_service: boolean;
  can_drive: boolean;
  max_services_per_day: number | null;
  max_trips_per_day: number | null;
  max_working_hours_per_day: number | null;
  requires_manager_approval_for_changes: boolean;
  created_at: string;
  updated_at: string;
}

// ── Schedule suggestion ───────────────────────────────────────
export interface ScheduleSuggestion {
  id: string;
  branch_id: string;
  staff_id: string | null;
  suggestion_type: ScheduleSuggestionType;
  target_date: string;
  start_time: string | null;
  end_time: string | null;
  current_value: Record<string, unknown> | null;
  suggested_value: Record<string, unknown>;
  reason: string;
  impact_summary: string | null;
  priority: SuggestionPriority;
  status: ScheduleSuggestionStatus;
  created_by: string;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── Schedule health check (daily snapshot) ───────────────────
export interface ScheduleHealthCheck {
  id: string;
  branch_id: string;
  check_date: string;
  status: ScheduleHealthStatus;
  scheduled_staff_count: number;
  available_staff_count: number;
  checked_in_staff_count: number | null;
  scheduled_therapists_count: number;
  available_therapists_count: number;
  scheduled_drivers_count: number;
  available_drivers_count: number;
  missing_staff_count: number;
  affected_bookings_count: number;
  issues: ScheduleHealthIssue[];
  recommendations: string[];
  created_at: string;
}

export interface ScheduleHealthIssue {
  type:
    | "understaffed"
    | "no_therapist"
    | "no_csr"
    | "no_driver"
    | "missing_break"
    | "overtime_risk"
    | "too_many_off";
  severity: ScheduleHealthStatus;
  message: string;
  affected_staff_ids?: string[];
  affected_booking_ids?: string[];
}

// ── Internal engine types ─────────────────────────────────────

export interface DailyCoverageSnapshot {
  date: string;
  branch_id: string;
  scheduled_staff: StaffDayInfo[];
  bookings: BookingDayInfo[];
  rules: SchedulingRules;
}

export interface StaffDayInfo {
  staff_id: string;
  full_name: string;
  system_role: string;
  staff_type: string | null;
  is_day_off: boolean;
  shift_start: string | null;
  shift_end: string | null;
  existing_blocks: TimeBlock[];
  booking_count: number;
  total_booked_minutes: number;
}

export interface TimeBlock {
  start_time: string;
  end_time: string;
  type: "booking" | "break" | "travel_buffer" | "room_reset" | "day_off";
  label?: string;
}

export interface BookingDayInfo {
  booking_id: string;
  staff_id: string | null;
  start_time: string;
  end_time: string;
  service_name: string;
  booking_type: "in_spa" | "home_service";
  status: string;
}

// ── Result shapes from engine functions ───────────────────────

export interface HealthEvaluationResult {
  status: ScheduleHealthStatus;
  issues: ScheduleHealthIssue[];
  recommendations: string[];
  counts: {
    scheduled_staff: number;
    available_staff: number;
    scheduled_therapists: number;
    available_therapists: number;
    scheduled_drivers: number;
    available_drivers: number;
    missing_staff: number;
    affected_bookings: number;
  };
}

export interface SuggestionGenerationResult {
  suggestions: NewSuggestion[];
  skipped_reason?: string;
}

export interface NewSuggestion {
  branch_id: string;
  staff_id: string | null;
  suggestion_type: ScheduleSuggestionType;
  target_date: string;
  start_time: string | null;
  end_time: string | null;
  current_value: Record<string, unknown> | null;
  suggested_value: Record<string, unknown>;
  reason: string;
  impact_summary: string | null;
  priority: SuggestionPriority;
}

export interface ApplySuggestionResult {
  success: boolean;
  applied_suggestion_id: string;
  created_override_id?: string;
  created_block_id?: string;
  error?: string;
}
