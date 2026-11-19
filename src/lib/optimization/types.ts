import { z } from "zod";

export const timeWindowSchema = z.object({
  start_minute: z.number().int().min(0).max(2880),
  end_minute: z.number().int().min(0).max(2880),
});

export type TimeWindow = z.infer<typeof timeWindowSchema>;

export const assistanceWindowSchema = z.object({
  requesting_branch_id: z.string(),
  start_minute: z.number().int().min(0).max(2880),
  end_minute: z.number().int().min(0).max(2880),
  visit_type: z.enum(["in_spa", "home_service", "both"]).default("in_spa"),
});

export const therapistBusyWindowSchema = z.object({
  booking_id: z.string(),
  start_minute: z.number().int(),
  end_minute: z.number().int(),
  effective_start_minute: z.number().int(),
  effective_end_minute: z.number().int(),
  delivery_type: z.enum(["in_spa", "home_service"]),
  resource_id: z.string().nullable().default(null),
  is_active_session: z.boolean().default(false),
});

export const resourceBusyWindowSchema = z.object({
  booking_id: z.string(),
  start_minute: z.number().int(),
  end_minute: z.number().int(),
  reset_after_minutes: z.number().int().min(0).default(0),
});

export const onsiteTherapistInputSchema = z.object({
  staff_id: z.string(),
  name: z.string(),
  home_branch_id: z.string(),
  seniority_rank: z.number().int().default(999),
  completed_count_today: z.number().int().min(0).default(0),
  checked_in: z.boolean().default(false),
  qualified_service_ids: z.array(z.string()).default([]),
  shift_windows: z.array(timeWindowSchema).default([]),
  break_windows: z.array(timeWindowSchema).default([]),
  blocked_windows: z.array(timeWindowSchema).default([]),
  assistance_windows: z.array(assistanceWindowSchema).default([]),
  busy_windows: z.array(therapistBusyWindowSchema).default([]),
  max_services_per_day: z.number().int().nullable().default(null),
  max_working_minutes_per_day: z.number().int().nullable().default(null),
  existing_service_count_today: z.number().int().min(0).default(0),
  existing_working_minutes_today: z.number().int().min(0).default(0),
});

export type OnsiteTherapistInput = z.infer<typeof onsiteTherapistInputSchema>;

export const onsiteResourceInputSchema = z.object({
  resource_id: z.string(),
  name: z.string(),
  resource_type: z.string().default("room"),
  capacity: z.number().int().min(1).default(1),
  sort_order: z.number().int().default(0),
  is_active: z.boolean().default(true),
  allowed_service_ids: z.array(z.string()).default([]),
  active_turnover_until_minute: z.number().int().nullable().default(null),
  turnover_start_minute: z.number().int().nullable().default(null),
  reset_buffer_minutes: z.number().int().nullable().default(null),
  busy_windows: z.array(resourceBusyWindowSchema).default([]),
});

export type OnsiteResourceInput = z.infer<typeof onsiteResourceInputSchema>;

export const onsiteServiceRequirementSchema = z.object({
  line_id: z.string(),
  attendee_id: z.string(),
  line_index: z.number().int().min(0).default(0),
  service_id: z.string(),
  service_name: z.string().default(""),
  duration_minutes: z.number().int().positive(),
  buffer_before_minutes: z.number().int().min(0).default(0),
  buffer_after_minutes: z.number().int().min(0).default(0),
  requires_room: z.boolean().default(true),
  preferred_staff_id: z.string().nullable().default(null),
  locked_staff_id: z.string().nullable().default(null),
  locked_resource_id: z.string().nullable().default(null),
  allowed_resource_types: z.array(z.string()).default([]),
});

export type OnsiteServiceRequirement = z.infer<typeof onsiteServiceRequirementSchema>;

export const onsiteSolveRequestSchema = z.object({
  branch_id: z.string(),
  date: z.string(),
  branch_open_minute: z.number().int().default(600),
  branch_close_minute: z.number().int().default(1350),
  slot_interval_minutes: z.number().int().default(30),
  room_reset_buffer_minutes: z.number().int().default(10),
  mode: z.enum(["assign_order", "slot_matrix"]).default("assign_order"),
  requested_start_minute: z.number().int().nullable().default(null),
  candidate_start_minutes: z.array(z.number().int()).default([]),
  allow_alternative_times: z.boolean().default(true),
  allow_earlier_opportunities: z.boolean().default(true),
  max_alternatives: z.number().int().default(5),
  enforce_room_capacity: z.boolean().default(true),
  group_room_policy: z
    .enum(["share_if_capacity", "prefer_together", "separate_ok"])
    .default("prefer_together"),
  therapists: z.array(onsiteTherapistInputSchema).default([]),
  resources: z.array(onsiteResourceInputSchema).default([]),
  requirements: z.array(onsiteServiceRequirementSchema).min(1),
});

export type OnsiteSolveRequest = z.infer<typeof onsiteSolveRequestSchema>;

export const onsiteAssignmentLineSchema = z.object({
  line_id: z.string(),
  attendee_id: z.string(),
  service_id: z.string(),
  start_minute: z.number().int(),
  end_minute: z.number().int(),
  staff_id: z.string(),
  staff_name: z.string(),
  resource_id: z.string().nullable().default(null),
  resource_name: z.string().nullable().default(null),
  matched_preferred_staff: z.boolean().default(false),
});

export const onsiteAlternativeSuggestionSchema = z.object({
  kind: z.enum(["earlier_slot", "nearby_slot", "alternate_staff_or_room"]),
  start_minute: z.number().int(),
  end_minute: z.number().int(),
  delta_minutes: z.number().int(),
  summary: z.string(),
  assignments: z.array(onsiteAssignmentLineSchema),
});

export const onsiteSlotAvailabilitySchema = z.object({
  start_minute: z.number().int(),
  available: z.boolean(),
  eligible_staff_ids: z.array(z.string()),
  available_room_count: z.number().int(),
  total_active_room_capacity: z.number().int(),
  blocking_reasons: z.array(z.string()),
  sample_assignments: z.array(onsiteAssignmentLineSchema).default([]),
});

export const onsiteSolveResponseSchema = z.object({
  feasible: z.boolean(),
  room_constraint_mode: z.enum([
    "enforced",
    "unconstrained_no_resources",
    "not_required",
  ]),
  requested_start_minute: z.number().int().nullable().default(null),
  assignments: z.array(onsiteAssignmentLineSchema).default([]),
  total_start_minute: z.number().int().nullable().default(null),
  total_end_minute: z.number().int().nullable().default(null),
  infeasibility_reasons: z.array(z.string()).default([]),
  alternatives: z.array(onsiteAlternativeSuggestionSchema).default([]),
  candidate_slots: z.array(onsiteSlotAvailabilitySchema).default([]),
  solver_latency_ms: z.number(),
});

export type OnsiteSolveResponse = z.infer<typeof onsiteSolveResponseSchema>;
export type OnsiteAssignmentLine = z.infer<typeof onsiteAssignmentLineSchema>;
export type OnsiteAlternativeSuggestion = z.infer<typeof onsiteAlternativeSuggestionSchema>;
export type OnsiteSlotAvailability = z.infer<typeof onsiteSlotAvailabilitySchema>;

export const unifiedRulesInputSchema = z.object({
  travel_buffer_minutes: z.number().int().default(30),
  scheduling_home_buffer_minutes: z.number().int().nullable().default(null),
  room_reset_buffer_minutes: z.number().int().default(10),
  in_spa_open_minute: z.number().int().default(600),
  in_spa_close_minute: z.number().int().default(1350),
  home_open_minute: z.number().int().nullable().default(null),
  home_close_minute: z.number().int().nullable().default(null),
  min_daily_therapists: z.number().int().default(1),
});

export const unifiedDriverInputSchema = z.object({
  driver_id: z.string(),
  name: z.string(),
  home_branch_id: z.string(),
  allowed_branch_ids: z.array(z.string()).default([]),
  shift_windows: z.array(timeWindowSchema).default([]),
  checked_in: z.boolean().default(false),
  gps_age_seconds: z.number().int().nullable().default(null),
  gps_accuracy_meters: z.number().nullable().default(null),
  gps_offline: z.boolean().default(false),
  gps_permission_missing: z.boolean().default(false),
  lat: z.number().nullable().default(null),
  lng: z.number().nullable().default(null),
});

export const unifiedBookingInputSchema = z.object({
  booking_id: z.string(),
  order_id: z.string().nullable().default(null),
  customer_name: z.string().default("Guest"),
  service_id: z.string(),
  service_name: z.string().default("Service"),
  delivery_type: z.enum(["in_spa", "home_service"]),
  status: z.string(),
  booking_progress_status: z.string().default("not_started"),
  tracking_status: z.string().nullable().default(null),
  therapist_id: z.string().nullable().default(null),
  therapist_selection_source: z.string().nullable().default(null),
  driver_id: z.string().nullable().default(null),
  collection_driver_id: z.string().nullable().default(null),
  resource_id: z.string().nullable().default(null),
  start_minute: z.number().int(),
  end_minute: z.number().int(),
  duration_minutes: z.number().int().positive().default(60),
  buffer_before_minutes: z.number().int().min(0).default(0),
  buffer_after_minutes: z.number().int().min(0).default(0),
  travel_buffer_minutes: z.number().int().nullable().default(null),
  live_eta_minutes: z.number().nullable().default(null),
  distance_km: z.number().nullable().default(null),
  session_started_minute: z.number().int().nullable().default(null),
  session_due_minute: z.number().int().nullable().default(null),
  projected_end_minute: z.number().int().nullable().default(null),
  collection_decision: z
    .enum(["required", "not_required", "undecided"])
    .nullable()
    .default(null),
  has_valid_customer_location: z.boolean().default(true),
  requires_room: z.boolean().default(true),
});

export const roomTurnoverTaskInputSchema = z.object({
  task_id: z.string(),
  resource_id: z.string(),
  resource_name: z.string().default(""),
  status: z.enum(["open", "in_progress", "resolved", "completed"]).default("open"),
  started_minute: z.number().int(),
  expected_ready_minute: z.number().int(),
});

export const crossBranchAssistanceInputSchema = z.object({
  request_id: z.string(),
  requesting_branch_id: z.string(),
  lending_branch_id: z.string(),
  status: z.string(),
  visit_type: z.enum(["in_spa", "home_service", "both"]).default("in_spa"),
  start_minute: z.number().int(),
  end_minute: z.number().int(),
  selected_staff_ids: z.array(z.string()).default([]),
});

export const unifiedEvaluateRequestSchema = z.object({
  branch_id: z.string(),
  branch_name: z.string().default("Branch"),
  date: z.string(),
  now_minute: z.number().int(),
  source_snapshot_version: z.string(),
  rules: unifiedRulesInputSchema,
  therapists: z.array(onsiteTherapistInputSchema).default([]),
  drivers: z.array(unifiedDriverInputSchema).default([]),
  resources: z.array(onsiteResourceInputSchema).default([]),
  bookings: z.array(unifiedBookingInputSchema).default([]),
  room_turnovers: z.array(roomTurnoverTaskInputSchema).default([]),
  assistance_requests: z.array(crossBranchAssistanceInputSchema).default([]),
});

export type UnifiedEvaluateRequest = z.infer<typeof unifiedEvaluateRequestSchema>;
export type UnifiedDriverInput = z.infer<typeof unifiedDriverInputSchema>;
export type UnifiedBookingInput = z.infer<typeof unifiedBookingInputSchema>;
export type RoomTurnoverTaskInput = z.infer<typeof roomTurnoverTaskInputSchema>;
export type CrossBranchAssistanceInput = z.infer<typeof crossBranchAssistanceInputSchema>;

export const recommendedStaffActionSchema = z.object({
  action_id: z.string(),
  action_type: z.enum([
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
  ]),
  label: z.string(),
  detail: z.string(),
  target_booking_id: z.string().nullable().default(null),
  proposed_staff_id: z.string().nullable().default(null),
  proposed_staff_name: z.string().nullable().default(null),
  proposed_resource_id: z.string().nullable().default(null),
  proposed_resource_name: z.string().nullable().default(null),
  proposed_driver_id: z.string().nullable().default(null),
  proposed_driver_name: z.string().nullable().default(null),
  proposed_start_minute: z.number().int().nullable().default(null),
  requires_customer_approval: z.boolean().default(false),
  verified_feasible: z.boolean().default(true),
});

export const predictiveConflictItemSchema = z.object({
  issue_type: z.enum([
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
  ]),
  branch_id: z.string(),
  affected_booking_ids: z.array(z.string()),
  affected_staff_ids: z.array(z.string()),
  affected_resource_ids: z.array(z.string()),
  severity: z.enum(["info", "warning", "high", "critical"]),
  confidence_or_data_quality: z.object({
    status: z.enum(["high", "medium", "degraded_gps", "rule_fallback"]),
    score: z.number(),
    notes: z.array(z.string()).default([]),
  }),
  predicted_impact: z.string(),
  latest_useful_action_time: z.string(),
  latest_useful_action_minute: z.number().int(),
  recommended_actions: z.array(recommendedStaffActionSchema),
  authorization_required: z.enum([
    "none",
    "crm_operator",
    "manager_or_owner",
    "customer_confirmation",
  ]),
  source_snapshot_version: z.string(),
  dedupe_key: z.string(),
  expiration_or_resolution_condition: z.string(),
  assistant_tier: z.enum([
    "quiet_opportunity",
    "early_warning_toast",
    "persistent_action_required",
  ]),
});

export const dynamicBufferDetailSchema = z.object({
  booking_id: z.string(),
  pre_buffer_minutes: z.number().int(),
  post_buffer_minutes: z.number().int(),
  buffer_source: z.enum([
    "live_traffic",
    "maps_matrix",
    "distance_fallback",
    "branch_rule_fallback",
  ]),
  configured_rule_buffer_minutes: z.number().int(),
  note: z.string(),
});

export const sharedTimelineSpanSchema = z.object({
  booking_id: z.string(),
  delivery_type: z.enum(["in_spa", "home_service"]),
  customer_name: z.string(),
  service_name: z.string(),
  start_minute: z.number().int(),
  end_minute: z.number().int(),
  effective_start_minute: z.number().int(),
  effective_end_minute: z.number().int(),
  resource_id: z.string().nullable().default(null),
  driver_id: z.string().nullable().default(null),
  is_active_session: z.boolean().default(false),
});

export const therapistTimelineSummarySchema = z.object({
  staff_id: z.string(),
  staff_name: z.string(),
  home_branch_id: z.string(),
  checked_in: z.boolean(),
  scheduled_minutes_today: z.number().int(),
  booked_minutes_today: z.number().int(),
  spans: z.array(sharedTimelineSpanSchema),
});

export const unifiedEvaluateResponseSchema = z.object({
  branch_id: z.string(),
  date: z.string(),
  now_minute: z.number().int(),
  source_snapshot_version: z.string(),
  dynamic_buffers: z.array(dynamicBufferDetailSchema),
  therapist_timelines: z.array(therapistTimelineSummarySchema),
  conflicts_and_opportunities: z.array(predictiveConflictItemSchema),
  summary_counts: z.record(z.string(), z.number().int()),
  evaluator_latency_ms: z.number(),
});

export type PredictiveConflictItem = z.infer<typeof predictiveConflictItemSchema>;
export type RecommendedStaffAction = z.infer<typeof recommendedStaffActionSchema>;
export type DynamicBufferDetail = z.infer<typeof dynamicBufferDetailSchema>;
export type UnifiedEvaluateResponse = z.infer<typeof unifiedEvaluateResponseSchema>;

export type EngineSource = "python_ortools" | "ts_deterministic_fallback";

export type UnifiedEvaluationResult = UnifiedEvaluateResponse & {
  engineSource: EngineSource;
  branchName: string;
  pythonConfigured?: boolean;
  degraded?: boolean;
  degradedReason?: string | null;
  evaluatedAt?: string;
};

export type OnsiteSolveResult = OnsiteSolveResponse & {
  engineSource: EngineSource;
};
