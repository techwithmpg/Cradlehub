import type { ScheduleSuggestion, ScheduleSuggestionType } from "../types";

interface SuggestionExplanation {
  headline:   string;
  detail:     string;
  actionable: boolean;
}

const HEADLINES: Record<ScheduleSuggestionType, string> = {
  add_break_block:        "Add break block",
  add_travel_buffer:      "Add travel buffer",
  add_room_reset_buffer:  "Add room-reset buffer",
  move_day_off:           "Move day off",
  add_day_off:            "Add extra day off",
  adjust_shift:           "Adjust shift hours",
  mark_staff_unavailable: "Mark staff unavailable",
  resolve_understaffing:  "Resolve understaffing",
  reassign_booking:       "Reassign booking",
};

export function explainSuggestion(
  suggestion: ScheduleSuggestion,
  staffName?: string,
): SuggestionExplanation {
  const who     = staffName ?? "A staff member";
  const date    = suggestion.target_date;
  const type    = suggestion.suggestion_type;
  const sv      = suggestion.suggested_value as Record<string, unknown>;
  const headline = HEADLINES[type] ?? "Schedule change";

  let detail = suggestion.reason;

  switch (type) {
    case "add_break_block": {
      const start = suggestion.start_time ?? sv.start_time;
      const end   = suggestion.end_time   ?? sv.end_time;
      const mins  = typeof sv.duration_minutes === "number" ? sv.duration_minutes : null;
      detail = `Schedule a ${mins ? `${mins}-min ` : ""}break for ${who} on ${date}${start && end ? ` from ${start} to ${end}` : ""}.`;
      break;
    }
    case "add_travel_buffer": {
      const mins = typeof sv.buffer_minutes === "number" ? sv.buffer_minutes : null;
      detail = `Reserve ${mins ? `${mins} min` : "travel time"} after ${who}'s home-service booking on ${date}.`;
      break;
    }
    case "add_room_reset_buffer": {
      const mins = typeof sv.buffer_minutes === "number" ? sv.buffer_minutes : null;
      detail = `Reserve ${mins ? `${mins} min` : "reset time"} after ${who}'s in-spa booking on ${date} for room turnover.`;
      break;
    }
    case "move_day_off":
    case "add_day_off":
    case "resolve_understaffing": {
      const isDayOff = Boolean(sv.is_day_off);
      detail = isDayOff
        ? `Mark ${who} as day off on ${date}.`
        : `Remove day-off designation for ${who} on ${date} to restore coverage.`;
      break;
    }
    case "adjust_shift": {
      const start = suggestion.start_time ?? sv.start_time;
      const end   = suggestion.end_time   ?? sv.end_time;
      detail = `Adjust ${who}'s shift on ${date}${start && end ? ` to ${start}–${end}` : ""}.`;
      break;
    }
    case "mark_staff_unavailable": {
      detail = `Mark ${who} as unavailable for the full day on ${date}.`;
      break;
    }
    case "reassign_booking": {
      const newName = typeof sv.new_staff_name === "string" ? sv.new_staff_name : "another staff";
      detail = `Reassign booking on ${date} from ${who} to ${newName}.`;
      break;
    }
  }

  const actionable = ["pending", "approved"].includes(suggestion.status);

  return { headline, detail, actionable };
}
