import { createClient } from "@/lib/supabase/server";
import { notifyStaffBlockApplied } from "./notify-affected-staff";
import type { ApplySuggestionResult, ScheduleSuggestion } from "../types";

export async function applyApprovedSuggestion(
  suggestionId: string,
  branchId: string,
): Promise<ApplySuggestionResult> {
  const supabase = await createClient();

  const { data: suggestion, error: fetchErr } = await supabase
    .from("schedule_suggestions")
    .select("*")
    .eq("id", suggestionId)
    .eq("branch_id", branchId)
    .eq("status", "approved")
    .maybeSingle();

  if (fetchErr || !suggestion) {
    return {
      success:              false,
      applied_suggestion_id: suggestionId,
      error: fetchErr?.message ?? "Suggestion not found or not in approved status.",
    };
  }

  const s = suggestion as ScheduleSuggestion;
  const sv = s.suggested_value as Record<string, unknown>;

  let createdOverrideId: string | undefined;
  let createdBlockId:    string | undefined;

  try {
    switch (s.suggestion_type) {
      case "add_break_block":
      case "add_travel_buffer":
      case "add_room_reset_buffer": {
        if (!s.staff_id || !s.start_time || !s.end_time) {
          throw new Error("Missing staff_id or time range for block suggestion.");
        }
        const { data: block, error: blockErr } = await supabase
          .from("blocked_times")
          .insert({
            staff_id:     s.staff_id,
            block_date: s.target_date,
            start_time:   s.start_time,
            end_time:     s.end_time,
            reason:       s.suggestion_type === "add_break_block"
              ? "Break (auto-scheduled)"
              : s.suggestion_type === "add_travel_buffer"
              ? "Travel buffer (auto-scheduled)"
              : "Room reset (auto-scheduled)",
          })
          .select("id")
          .single();

        if (blockErr) throw blockErr;
        createdBlockId = block.id;
        break;
      }

      case "move_day_off":
      case "add_day_off":
      case "resolve_understaffing": {
        if (!s.staff_id) {
          throw new Error("Missing staff_id for day-off suggestion.");
        }
        const isDayOff = Boolean(sv.is_day_off);
        const { data: override, error: overrideErr } = await supabase
          .from("schedule_overrides")
          .upsert(
            {
              staff_id:      s.staff_id,
              override_date: s.target_date,
              is_day_off:    isDayOff,
              shift_type:    null,
              start_time:    typeof sv.start_time === "string" ? sv.start_time : null,
              end_time:      typeof sv.end_time   === "string" ? sv.end_time   : null,
              reason:        "Applied via schedule suggestion",
              created_by:    s.approved_by ?? null,
            },
            { onConflict: "staff_id,override_date" },
          )
          .select("id")
          .single();

        if (overrideErr) throw overrideErr;
        createdOverrideId = override.id;
        break;
      }

      case "adjust_shift": {
        if (!s.staff_id || !s.start_time || !s.end_time) {
          throw new Error("Missing time range for adjust_shift suggestion.");
        }
        const { data: override, error: overrideErr } = await supabase
          .from("schedule_overrides")
          .upsert(
            {
              staff_id:      s.staff_id,
              override_date: s.target_date,
              is_day_off:    false,
              shift_type:    null,
              start_time:    s.start_time,
              end_time:      s.end_time,
              reason:        "Shift adjusted via schedule suggestion",
              created_by:    s.approved_by ?? null,
            },
            { onConflict: "staff_id,override_date" },
          )
          .select("id")
          .single();

        if (overrideErr) throw overrideErr;
        createdOverrideId = override.id;
        break;
      }

      case "mark_staff_unavailable": {
        if (!s.staff_id) throw new Error("Missing staff_id for unavailability suggestion.");
        const { data: override, error: overrideErr } = await supabase
          .from("schedule_overrides")
          .upsert(
            {
              staff_id:      s.staff_id,
              override_date: s.target_date,
              is_day_off:    true,
              shift_type:    null,
              start_time:    null,
              end_time:      null,
              reason:        "Marked unavailable via schedule suggestion",
              created_by:    s.approved_by ?? null,
            },
            { onConflict: "staff_id,override_date" },
          )
          .select("id")
          .single();

        if (overrideErr) throw overrideErr;
        createdOverrideId = override.id;
        break;
      }

      case "reassign_booking": {
        const bookingId  = typeof sv.booking_id  === "string" ? sv.booking_id  : null;
        const newStaffId = typeof sv.new_staff_id === "string" ? sv.new_staff_id : null;
        if (!bookingId || !newStaffId) {
          throw new Error("Missing booking_id or new_staff_id for reassign_booking.");
        }
        const { error: bookingErr } = await supabase
          .from("bookings")
          .update({ staff_id: newStaffId })
          .eq("id", bookingId);

        if (bookingErr) throw bookingErr;
        break;
      }

      default:
        break;
    }

    // ── Mark suggestion as applied ─────────────────────────
    await supabase
      .from("schedule_suggestions")
      .update({ status: "applied", applied_at: new Date().toISOString() })
      .eq("id", suggestionId);

    // ── Notify the affected staff member ───────────────────
    await notifyStaffBlockApplied(s, branchId);

    return {
      success:               true,
      applied_suggestion_id: suggestionId,
      created_override_id:   createdOverrideId,
      created_block_id:      createdBlockId,
    };
  } catch (err) {
    return {
      success:               false,
      applied_suggestion_id: suggestionId,
      error:                 err instanceof Error ? err.message : String(err),
    };
  }
}
