import { createNotification } from "@/lib/notifications/create";
import type { ScheduleSuggestion } from "../types";

const TYPE_LABELS: Record<string, string> = {
  add_break_block:       "break block",
  add_travel_buffer:     "travel buffer",
  add_room_reset_buffer: "room-reset buffer",
  move_day_off:          "day-off change",
  add_day_off:           "day off",
  adjust_shift:          "shift adjustment",
  mark_staff_unavailable: "unavailability block",
  resolve_understaffing: "coverage change",
  reassign_booking:      "booking reassignment",
};

// Notifies a staff member that a schedule change affecting them was approved.
export async function notifyStaffSuggestionApproved(
  suggestion: ScheduleSuggestion,
  branchId: string,
): Promise<void> {
  if (!suggestion.staff_id) return;

  const label = TYPE_LABELS[suggestion.suggestion_type] ?? "schedule change";

  await createNotification({
    branchId,
    targetWorkspace:    "staff",
    recipientStaffId:   suggestion.staff_id,
    type:               "schedule_suggestion_approved",
    title:              "Schedule change approved",
    body:               `A ${label} for ${suggestion.target_date} was approved by your manager.`,
    entityType:         "schedule_suggestion",
    entityId:           suggestion.id,
    actionHref:         "/staff-portal/schedule",
    priority:           suggestion.priority === "critical" ? "high" : "normal",
  });
}

// Notifies a staff member that a proposed schedule change was rejected.
export async function notifyStaffSuggestionRejected(
  suggestion: ScheduleSuggestion,
  branchId: string,
): Promise<void> {
  if (!suggestion.staff_id) return;

  const label = TYPE_LABELS[suggestion.suggestion_type] ?? "schedule change";

  await createNotification({
    branchId,
    targetWorkspace:    "staff",
    recipientStaffId:   suggestion.staff_id,
    type:               "schedule_suggestion_rejected",
    title:              "Schedule change rejected",
    body:               `A proposed ${label} for ${suggestion.target_date} was not approved.`,
    entityType:         "schedule_suggestion",
    entityId:           suggestion.id,
    actionHref:         "/staff-portal/schedule",
    priority:           "normal",
  });
}

// Notifies a staff member that an approved change has been applied to their schedule.
export async function notifyStaffBlockApplied(
  suggestion: ScheduleSuggestion,
  branchId: string,
): Promise<void> {
  if (!suggestion.staff_id) return;

  const label = TYPE_LABELS[suggestion.suggestion_type] ?? "schedule change";

  await createNotification({
    branchId,
    targetWorkspace:    "staff",
    recipientStaffId:   suggestion.staff_id,
    type:               "schedule_block_applied",
    title:              "Your schedule was updated",
    body:               `A ${label} was added to your schedule for ${suggestion.target_date}.`,
    entityType:         "schedule_suggestion",
    entityId:           suggestion.id,
    actionHref:         "/staff-portal/schedule",
    priority:           "normal",
  });
}
