import { createClient } from "@/lib/supabase/server";
import { getSchedulingRules } from "./get-scheduling-rules";
import { evaluateScheduleHealth } from "./evaluate-schedule-health";
import { suggestBreakBlock, suggestTravelBuffer, suggestRoomResetBuffer } from "./generate-routine-blocks";
import type { Json } from "@/types/supabase";
import type {
  DailyCoverageSnapshot,
  StaffDayInfo,
  BookingDayInfo,
  TimeBlock,
  NewSuggestion,
  SuggestionGenerationResult,
} from "../types";

const THERAPIST_ROLES = new Set(["therapist", "senior_therapist"]);

export async function generateScheduleSuggestions(
  branchId: string,
  date: string,
  dryRun = false,
): Promise<SuggestionGenerationResult> {
  const supabase = await createClient();

  const rules = await getSchedulingRules(branchId);

  // ── Load staff with schedules for the day ─────────────────
  const dayOfWeek = new Date(date).getDay();

  const { data: staffRows } = await supabase
    .from("staff")
    .select(
      `id, full_name, system_role, staff_type,
       staff_schedules!inner(day_of_week, start_time, end_time, is_active)`,
    )
    .eq("branch_id", branchId)
    .eq("is_active", true);

  // ── Load day overrides (day-off or custom shift) ──────────
  const { data: overrides } = await supabase
    .from("schedule_overrides")
    .select("staff_id, is_day_off, start_time, end_time")
    .eq("override_date", date);

  const overrideMap = new Map(overrides?.map((o) => [o.staff_id, o]) ?? []);

  // ── Load today's bookings ─────────────────────────────────
  const { data: bookingRows } = await supabase
    .from("bookings")
    .select(
      `id, staff_id, start_time, end_time, type, status,
       services(name)`,
    )
    .eq("branch_id", branchId)
    .eq("booking_date", date)
    .not("status", "in", "(cancelled,no_show)");

  // ── Load blocked times ────────────────────────────────────
  const staffIds = staffRows?.map((s) => s.id) ?? [];
  const { data: blockedRows } = await supabase
    .from("blocked_times")
    .select("staff_id, start_time, end_time, reason")
    .in("staff_id", staffIds.length ? staffIds : ["__none__"])
    .eq("block_date", date);

  // ── Build snapshot ────────────────────────────────────────
  const scheduledStaff: StaffDayInfo[] = [];

  for (const s of staffRows ?? []) {
    const schedules = Array.isArray(s.staff_schedules)
      ? s.staff_schedules
      : [s.staff_schedules];
    const todaySchedule = schedules.find(
      (sc) => sc.is_active && sc.day_of_week === dayOfWeek,
    );
    if (!todaySchedule) continue;

    const override = overrideMap.get(s.id);
    const isDayOff = override?.is_day_off ?? false;
    const shiftStart = override?.start_time ?? todaySchedule.start_time ?? null;
    const shiftEnd   = override?.end_time   ?? todaySchedule.end_time   ?? null;

    const staffBookings = (bookingRows ?? []).filter((b) => b.staff_id === s.id);
    const staffBlocks   = (blockedRows  ?? []).filter((b) => b.staff_id === s.id);

    const existingBlocks: TimeBlock[] = [
      ...staffBookings.map((b): TimeBlock => ({
        start_time: b.start_time ?? "",
        end_time:   b.end_time   ?? "",
        type:       "booking",
      })),
      ...staffBlocks.map((b): TimeBlock => ({
        start_time: b.start_time,
        end_time:   b.end_time,
        type:       "break",
        label:      b.reason ?? undefined,
      })),
    ].filter((b) => b.start_time && b.end_time);

    const totalBookedMinutes = staffBookings.reduce((acc, b) => {
      if (!b.start_time || !b.end_time) return acc;
      const [sh, sm] = b.start_time.split(":").map(Number);
      const [eh, em] = b.end_time.split(":").map(Number);
      return acc + ((eh ?? 0) * 60 + (em ?? 0)) - ((sh ?? 0) * 60 + (sm ?? 0));
    }, 0);

    scheduledStaff.push({
      staff_id:            s.id,
      full_name:           s.full_name,
      system_role:         s.system_role,
      staff_type:          s.staff_type ?? null,
      is_day_off:          isDayOff,
      shift_start:         isDayOff ? null : shiftStart,
      shift_end:           isDayOff ? null : shiftEnd,
      existing_blocks:     existingBlocks,
      booking_count:       staffBookings.length,
      total_booked_minutes: totalBookedMinutes,
    });
  }

  const bookings: BookingDayInfo[] = (bookingRows ?? []).map((b) => ({
    booking_id:   b.id,
    staff_id:     b.staff_id ?? null,
    start_time:   b.start_time ?? "",
    end_time:     b.end_time   ?? "",
    service_name: (Array.isArray(b.services) ? b.services[0]?.name : (b.services as { name?: string } | null)?.name) ?? "Service",
    booking_type: (b.type === "home_service" ? "home_service" : "in_spa") as "in_spa" | "home_service",
    status:       b.status,
  }));

  const snapshot: DailyCoverageSnapshot = {
    date,
    branch_id: branchId,
    scheduled_staff: scheduledStaff,
    bookings,
    rules,
  };

  // ── Evaluate health first ─────────────────────────────────
  const health = evaluateScheduleHealth(snapshot);

  const suggestions: NewSuggestion[] = [];

  // ── Generate break blocks ─────────────────────────────────
  for (const staff of scheduledStaff) {
    const suggestion = suggestBreakBlock(staff, date, rules);
    if (suggestion) suggestions.push({ ...suggestion, branch_id: branchId });
  }

  // ── Generate travel / room-reset buffers ──────────────────
  for (const booking of bookings) {
    if (!booking.staff_id) continue;
    const staff = scheduledStaff.find((s) => s.staff_id === booking.staff_id);
    if (!staff || !THERAPIST_ROLES.has(staff.system_role)) continue;

    if (booking.booking_type === "home_service") {
      const s = suggestTravelBuffer(staff, booking.end_time, booking.booking_id, date, rules);
      if (s) suggestions.push({ ...s, branch_id: branchId });
    } else {
      const s = suggestRoomResetBuffer(staff, booking.end_time, booking.booking_id, date, rules);
      if (s) suggestions.push({ ...s, branch_id: branchId });
    }
  }

  // ── Resolve understaffing via day-off suggestions ─────────
  if (health.status === "critical") {
    const offStaff = scheduledStaff.filter(
      (s) => s.is_day_off && THERAPIST_ROLES.has(s.system_role),
    );
    if (offStaff.length > 0) {
      const candidate = offStaff[0]!;
      suggestions.push({
        branch_id:       branchId,
        staff_id:        candidate.staff_id,
        suggestion_type: "resolve_understaffing",
        target_date:     date,
        start_time:      null,
        end_time:        null,
        current_value:   { is_day_off: true },
        suggested_value: { is_day_off: false },
        reason:          `Critical understaffing — consider moving ${candidate.full_name}'s day off.`,
        impact_summary:  "Could restore minimum therapist coverage.",
        priority:        "critical",
      });
    }
  }

  if (dryRun) return { suggestions };

  // ── Persist non-duplicate suggestions ────────────────────
  if (suggestions.length === 0) return { suggestions };

  // Dedupe: don't create same type+date+staff if a pending one exists
  const { data: existing } = await supabase
    .from("schedule_suggestions")
    .select("suggestion_type, target_date, staff_id")
    .eq("branch_id", branchId)
    .eq("target_date", date)
    .in("status", ["pending", "approved"]);

  const existingKeys = new Set(
    (existing ?? []).map((e) => `${e.suggestion_type}|${e.target_date}|${e.staff_id ?? "null"}`),
  );

  const toInsert = suggestions.filter(
    (s) => !existingKeys.has(`${s.suggestion_type}|${s.target_date}|${s.staff_id ?? "null"}`),
  );

  if (toInsert.length > 0) {
    await supabase.from("schedule_suggestions").insert(
      toInsert.map((s) => ({
        branch_id:       s.branch_id,
        staff_id:        s.staff_id,
        suggestion_type: s.suggestion_type,
        target_date:     s.target_date,
        start_time:      s.start_time,
        end_time:        s.end_time,
        current_value:   s.current_value as Json,
        suggested_value: s.suggested_value as Json,
        reason:          s.reason,
        impact_summary:  s.impact_summary,
        priority:        s.priority,
      })),
    );
  }

  return { suggestions: toInsert };
}
