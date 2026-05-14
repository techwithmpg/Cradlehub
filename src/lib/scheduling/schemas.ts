import { z } from "zod";

// ── Enum schemas ──────────────────────────────────────────────

export const SuggestionTypeSchema = z.enum([
  "move_day_off",
  "add_day_off",
  "add_break_block",
  "add_travel_buffer",
  "add_room_reset_buffer",
  "reassign_booking",
  "adjust_shift",
  "mark_staff_unavailable",
  "resolve_understaffing",
]);

export const SuggestionPrioritySchema = z.enum(["low", "normal", "high", "critical"]);

export const SuggestionStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "applied",
  "expired",
  "cancelled",
]);

export const HealthStatusSchema = z.enum(["ok", "warning", "critical"]);

// ── Scheduling rules upsert ───────────────────────────────────

export const SchedulingRulesUpsertSchema = z.object({
  min_daily_staff:                   z.number().int().min(0).max(50),
  min_daily_therapists:              z.number().int().min(0).max(50),
  min_daily_csr:                     z.number().int().min(0).max(20),
  min_daily_drivers:                 z.number().int().min(0).max(20),
  min_daily_utility:                 z.number().int().min(0).max(20),

  default_days_off_per_week:         z.number().int().min(0).max(7),
  max_same_role_off_per_day:         z.number().int().min(0).max(20),
  max_therapists_off_per_day:        z.number().int().min(0).max(20),
  protect_weekends:                  z.boolean(),

  default_break_minutes:             z.number().int().min(0).max(240),
  auto_breaks_enabled:               z.boolean(),
  max_working_hours_per_day:         z.number().min(1).max(24),
  max_services_per_staff_per_day:    z.number().int().min(1).max(50).nullable(),

  auto_generate_breaks:              z.boolean(),
  auto_generate_travel_buffers:      z.boolean(),
  auto_generate_room_reset_buffers:  z.boolean(),
  room_reset_buffer_minutes:         z.number().int().min(0).max(120),

  home_service_travel_buffer_minutes: z.number().int().min(0).max(120),

  suggestions_require_manager_approval: z.boolean(),
});

export type SchedulingRulesUpsertInput = z.infer<typeof SchedulingRulesUpsertSchema>;

// ── Staff scheduling preferences upsert ──────────────────────

export const DayOfWeekSchema = z.number().int().min(0).max(6).nullable();

export const StaffSchedulingPreferencesUpsertSchema = z.object({
  preferred_day_off:              DayOfWeekSchema,
  secondary_preferred_day_off:    DayOfWeekSchema,
  default_break_start:            z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  default_break_end:              z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  can_do_home_service:            z.boolean(),
  can_drive:                      z.boolean(),
  max_services_per_day:           z.number().int().min(1).max(50).nullable(),
  max_trips_per_day:              z.number().int().min(1).max(30).nullable(),
  max_working_hours_per_day:      z.number().min(1).max(24).nullable(),
  requires_manager_approval_for_changes: z.boolean(),
});

export type StaffSchedulingPreferencesUpsertInput = z.infer<
  typeof StaffSchedulingPreferencesUpsertSchema
>;

// ── Suggestion review actions ─────────────────────────────────

export const ApproveSuggestionSchema = z.object({
  suggestion_id: z.string().uuid(),
  approved_by:   z.string().uuid(),
});

export const RejectSuggestionSchema = z.object({
  suggestion_id:   z.string().uuid(),
  rejected_by:     z.string().uuid(),
  rejection_note:  z.string().max(500).optional(),
});

// ── Evaluate + generate input ─────────────────────────────────

export const EvaluateHealthInputSchema = z.object({
  branch_id: z.string().uuid(),
  date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const GenerateSuggestionsInputSchema = z.object({
  branch_id:    z.string().uuid(),
  date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dry_run:      z.boolean().optional().default(false),
});
