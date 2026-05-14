import type { NewSuggestion, StaffDayInfo, SchedulingRules } from "../types";

function addMinutes(time: string, minutes: number): string {
  const [hStr, mStr] = time.split(":");
  const total = parseInt(hStr ?? "0") * 60 + parseInt(mStr ?? "0") + minutes;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh ?? 0) * 60 + (em ?? 0) - (sh ?? 0) * 60 - (sm ?? 0);
}

// Finds a contiguous gap of `neededMinutes` in the shift after the midpoint.
function findGapAfterMidpoint(
  shiftStart: string,
  shiftEnd: string,
  occupied: Array<{ start_time: string; end_time: string }>,
  neededMinutes: number,
): string | null {
  const shiftDuration = minutesBetween(shiftStart, shiftEnd);
  const midpoint = addMinutes(shiftStart, Math.floor(shiftDuration / 2));

  // Build occupied windows sorted by start
  const sorted = [...occupied]
    .filter((b) => b.start_time >= midpoint)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  let cursor = midpoint;
  for (const block of sorted) {
    const gap = minutesBetween(cursor, block.start_time);
    if (gap >= neededMinutes) return cursor;
    cursor = block.end_time > cursor ? block.end_time : cursor;
  }
  const remainingGap = minutesBetween(cursor, shiftEnd);
  if (remainingGap >= neededMinutes) return cursor;
  return null;
}

// Generates a suggestion to insert a break block for a single staff member.
export function suggestBreakBlock(
  staff: StaffDayInfo,
  date: string,
  rules: SchedulingRules,
): NewSuggestion | null {
  if (!rules.auto_generate_breaks) return null;
  if (staff.is_day_off || !staff.shift_start || !staff.shift_end) return null;

  const shiftMinutes = minutesBetween(staff.shift_start, staff.shift_end);
  if (shiftMinutes < 240) return null; // < 4 h shift — no break needed

  const hasBreak = staff.existing_blocks.some((b) => b.type === "break");
  if (hasBreak) return null;

  const allBlocks = staff.existing_blocks
    .filter((b) => b.type !== "break")
    .map((b) => ({ start_time: b.start_time, end_time: b.end_time }));

  const breakStart = findGapAfterMidpoint(
    staff.shift_start,
    staff.shift_end,
    allBlocks,
    rules.default_break_minutes,
  );
  if (!breakStart) return null;

  const breakEnd = addMinutes(breakStart, rules.default_break_minutes);

  return {
    branch_id:       staff.staff_id,    // placeholder — caller sets branch_id
    staff_id:        staff.staff_id,
    suggestion_type: "add_break_block",
    target_date:     date,
    start_time:      breakStart,
    end_time:        breakEnd,
    current_value:   null,
    suggested_value: { start_time: breakStart, end_time: breakEnd, duration_minutes: rules.default_break_minutes },
    reason:          `Staff has ${Math.round(shiftMinutes / 60 * 10) / 10}h shift with no break scheduled.`,
    impact_summary:  `Inserts a ${rules.default_break_minutes}-minute break at ${breakStart}.`,
    priority:        "normal",
  };
}

// Generates a suggestion to insert a travel buffer after a home-service booking.
export function suggestTravelBuffer(
  staff: StaffDayInfo,
  bookingEndTime: string,
  bookingId: string,
  date: string,
  rules: SchedulingRules,
): NewSuggestion | null {
  if (!rules.auto_generate_travel_buffers) return null;

  const bufferEnd = addMinutes(bookingEndTime, rules.home_service_travel_buffer_minutes);
  // Check no existing block overlaps
  const conflict = staff.existing_blocks.some(
    (b) =>
      b.start_time < bufferEnd &&
      b.end_time > bookingEndTime,
  );
  if (conflict) return null;

  return {
    branch_id:       staff.staff_id,   // placeholder — caller sets branch_id
    staff_id:        staff.staff_id,
    suggestion_type: "add_travel_buffer",
    target_date:     date,
    start_time:      bookingEndTime,
    end_time:        bufferEnd,
    current_value:   null,
    suggested_value: {
      start_time:   bookingEndTime,
      end_time:     bufferEnd,
      booking_id:   bookingId,
      buffer_minutes: rules.home_service_travel_buffer_minutes,
    },
    reason:          "Home-service booking needs post-service travel buffer.",
    impact_summary:  `Blocks ${rules.home_service_travel_buffer_minutes} min after home-service end.`,
    priority:        "normal",
  };
}

// Generates a suggestion to insert a room-reset buffer after an in-spa booking.
export function suggestRoomResetBuffer(
  staff: StaffDayInfo,
  bookingEndTime: string,
  bookingId: string,
  date: string,
  rules: SchedulingRules,
): NewSuggestion | null {
  if (!rules.auto_generate_room_reset_buffers) return null;

  const bufferEnd = addMinutes(bookingEndTime, rules.room_reset_buffer_minutes);
  const conflict = staff.existing_blocks.some(
    (b) =>
      b.start_time < bufferEnd &&
      b.end_time > bookingEndTime,
  );
  if (conflict) return null;

  return {
    branch_id:       staff.staff_id,
    staff_id:        staff.staff_id,
    suggestion_type: "add_room_reset_buffer",
    target_date:     date,
    start_time:      bookingEndTime,
    end_time:        bufferEnd,
    current_value:   null,
    suggested_value: {
      start_time:     bookingEndTime,
      end_time:       bufferEnd,
      booking_id:     bookingId,
      buffer_minutes: rules.room_reset_buffer_minutes,
    },
    reason:          "In-spa booking room needs reset time.",
    impact_summary:  `Blocks ${rules.room_reset_buffer_minutes} min room-reset after booking end.`,
    priority:        "low",
  };
}
