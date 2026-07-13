import type {
  DailyScheduleBlock,
  DailyScheduleBooking,
  DailyScheduleStaffRow,
} from "@/lib/queries/schedule";
import { getDatabaseShiftLabel } from "@/lib/schedule/schedule-domain";
import { doesDurationFitWithinScheduleWindow } from "@/lib/schedule/resolve-staff-schedule";
import { formatScheduleTime } from "@/lib/utils/schedule-timeline";
import type {
  BookingConflictContext,
  BuildLiveScheduleConflictsOptions,
  LiveScheduleConflict,
  LiveScheduleConflictQuickAction,
  LiveScheduleIssueCode,
  LiveScheduleConflictSeverity,
  LiveScheduleConflictType,
} from "./live-schedule-conflict-types";

const INACTIVE_BOOKING_STATUSES = new Set(["cancelled", "no_show"]);

function isActiveBooking(booking: DailyScheduleBooking): boolean {
  return !INACTIVE_BOOKING_STATUSES.has(booking.status);
}

function timeToMinutes(time: string): number {
  const [hours = "0", minutes = "0"] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
}

function absoluteRange(startTime: string, endTime: string): { start: number; end: number } {
  const start = timeToMinutes(startTime);
  let end = timeToMinutes(endTime);
  if (end <= start) end += 24 * 60;
  return { start, end };
}

function durationMinutes(booking: DailyScheduleBooking): number {
  const range = absoluteRange(booking.start_time, booking.end_time);
  return Math.max(1, range.end - range.start);
}

function rangesOverlap(
  a: { start_time: string; end_time: string },
  b: { start_time: string; end_time: string }
): boolean {
  const first = absoluteRange(a.start_time, a.end_time);
  const second = absoluteRange(b.start_time, b.end_time);
  return first.start < second.end && second.start < first.end;
}

function formatTimeRange(startTime: string | null, endTime: string | null): string {
  if (!startTime || !endTime) return "time not set";
  return `${formatScheduleTime(startTime)}-${formatScheduleTime(endTime)}`;
}

function bookingLabel(booking: DailyScheduleBooking, staffName?: string): string {
  const pieces = [
    booking.service,
    booking.customer,
    staffName,
    formatTimeRange(booking.start_time, booking.end_time),
  ].filter(Boolean);
  return pieces.join(" - ");
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function fingerprint(parts: Array<string | number | null | undefined>): string {
  return parts
    .filter((part) => part !== null && part !== undefined && String(part).trim() !== "")
    .map((part) =>
      String(part)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9:_-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
    )
    .join(":");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function metadataBoolean(
  metadata: Record<string, unknown> | null | undefined,
  keys: string[]
): boolean | null {
  if (!metadata) return null;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "t", "1", "yes", "y"].includes(normalized)) return true;
      if (["false", "f", "0", "no", "n"].includes(normalized)) return false;
    }
  }
  return null;
}

function metadataString(
  metadata: Record<string, unknown> | null | undefined,
  keys: string[]
): string | null {
  if (!metadata) return null;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function isHomeServiceBooking(booking: DailyScheduleBooking): boolean {
  return booking.type === "home_service" || booking.delivery_type === "home_service";
}

export function getRequiredResourceType(booking: DailyScheduleBooking): string | null {
  if (isHomeServiceBooking(booking)) return null;
  const metadata = isRecord(booking.service_metadata) ? booking.service_metadata : null;
  const explicitType = metadataString(metadata, [
    "required_resource_type",
    "requiredResourceType",
    "resource_type",
    "resourceType",
    "required_room_type",
    "requiredRoomType",
  ]);
  const requiresRoom = metadataBoolean(metadata, [
    "requires_room",
    "requiresRoom",
    "room_required",
    "roomRequired",
  ]);
  const requiresResource = metadataBoolean(metadata, [
    "requires_resource",
    "requiresResource",
    "resource_required",
    "resourceRequired",
  ]);

  if (requiresRoom === false || requiresResource === false) return null;
  if (explicitType && !["none", "false", "no"].includes(explicitType.toLowerCase())) {
    return explicitType;
  }
  if (requiresRoom === true) return "room";
  if (requiresResource === true) return "resource";
  return null;
}

function primaryBookingAction(params: {
  label?: string;
  booking: DailyScheduleBooking;
  staffId: string;
}): LiveScheduleConflictQuickAction {
  return {
    label: params.label ?? "View booking",
    intent: "view_booking",
    staffId: params.staffId,
    bookingId: params.booking.id,
  };
}

function bookingQuickActions(params: {
  type: LiveScheduleConflictType;
  staffId: string;
  booking: DailyScheduleBooking;
}): LiveScheduleConflictQuickAction[] {
  const { type, staffId, booking } = params;
  const view = primaryBookingAction({ booking, staffId });

  if (type === "missing_room" || type === "room_double_booked") {
    return [
      view,
      { label: "Assign different room", intent: "assign_resource", staffId, bookingId: booking.id },
      { label: "Move booking time", intent: "move_booking", staffId, bookingId: booking.id },
      { label: "View room availability", intent: "open_full_schedule", staffId },
    ];
  }

  if (type === "booking_on_day_off") {
    return [
      view,
      { label: "Assign another staff", intent: "assign_staff", staffId, bookingId: booking.id },
      { label: "Edit staff schedule", intent: "edit_staff_schedule", staffId },
      { label: "Move booking", intent: "move_booking", staffId, bookingId: booking.id },
    ];
  }

  if (type === "booking_during_blocked_time") {
    return [
      view,
      { label: "Move booking", intent: "move_booking", staffId, bookingId: booking.id },
      { label: "Edit blocked time", intent: "edit_blocked_time", staffId },
      { label: "Assign another staff", intent: "assign_staff", staffId, bookingId: booking.id },
    ];
  }

  if (type === "home_service_travel_buffer_warning") {
    return [
      view,
      { label: "Review travel timing", intent: "review_travel_timing", staffId, bookingId: booking.id },
      { label: "Move booking", intent: "move_booking", staffId, bookingId: booking.id },
      { label: "Assign different staff/driver", intent: "assign_staff", staffId, bookingId: booking.id },
    ];
  }

  return [
    view,
    { label: "Move booking inside shift", intent: "move_booking", staffId, bookingId: booking.id },
    { label: "Assign another staff", intent: "assign_staff", staffId, bookingId: booking.id },
    { label: "Edit staff schedule", intent: "edit_staff_schedule", staffId },
  ];
}

function makeConflict(params: Omit<LiveScheduleConflict, "affected_staff_ids" | "affected_staff_names" | "affected_booking_ids" | "affected_booking_labels"> & {
  staff: Array<{ id: string; name: string }>;
  bookings?: Array<{ booking: DailyScheduleBooking; staffName?: string }>;
}): LiveScheduleConflict {
  const { staff, bookings: bookingItems, ...conflict } = params;
  const bookings = bookingItems ?? [];
  const stableFingerprint = conflict.fingerprint ?? conflict.id;
  return {
    ...conflict,
    fingerprint: stableFingerprint,
    affected_staff_ids: unique(staff.map((item) => item.id)),
    affected_staff_names: unique(staff.map((item) => item.name)),
    affected_booking_ids: unique(bookings.map((item) => item.booking.id)),
    affected_booking_labels: bookings.map((item) => bookingLabel(item.booking, item.staffName)),
  };
}

type ScheduleWindowEvidence = DailyScheduleStaffRow["schedule_windows"][number];

function absoluteScheduleWindowRange(window: ScheduleWindowEvidence): {
  start: number;
  end: number;
} {
  const start = timeToMinutes(window.startTime);
  let end = timeToMinutes(window.endTime);
  if (window.endsNextDay === true || end <= start) end += 24 * 60;
  return { start, end };
}

function scheduleWindowsOverlap(
  first: ScheduleWindowEvidence,
  second: ScheduleWindowEvidence
): boolean {
  const firstRange = absoluteScheduleWindowRange(first);
  const secondRange = absoluteScheduleWindowRange(second);
  return firstRange.start < secondRange.end && secondRange.start < firstRange.end;
}

function getAffectedScheduleWindows(row: DailyScheduleStaffRow): ScheduleWindowEvidence[] {
  const windows = row.schedule_windows;
  if (windows.length <= 1) return windows;

  if (row.schedule_conflict_code === "overlapping_windows") {
    for (let index = 0; index < windows.length; index++) {
      for (let other = index + 1; other < windows.length; other++) {
        const first = windows[index]!;
        const second = windows[other]!;
        if (scheduleWindowsOverlap(first, second)) return [first, second];
      }
    }
  }

  return windows;
}

function getScheduleConflictTime(
  windows: ScheduleWindowEvidence[]
): { startTime: string | null; endTime: string | null } {
  if (windows.length === 0) return { startTime: null, endTime: null };
  const startWindow = [...windows].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  )[0]!;
  const endWindow = [...windows].sort(
    (a, b) => absoluteScheduleWindowRange(b).end - absoluteScheduleWindowRange(a).end
  )[0]!;
  return { startTime: startWindow.startTime, endTime: endWindow.endTime };
}

function describeScheduleWindow(window: ScheduleWindowEvidence): string {
  const order = window.windowOrder != null ? ` #${window.windowOrder}` : "";
  const nextDay = window.endsNextDay === true ? " next day" : "";
  const source = window.id ? ` source ${window.id}` : "";
  return `${getDatabaseShiftLabel(window.shiftType)}${order}: ${formatTimeRange(window.startTime, window.endTime)}${nextDay}${source}`;
}

function scheduleIssueDetails(row: DailyScheduleStaffRow): {
  type: LiveScheduleConflictType;
  issueCode: LiveScheduleIssueCode;
  title: string;
  brokenRule: string;
  recommendedFix: string;
} {
  switch (row.schedule_conflict_code) {
    case "invalid_time_range":
      return {
        type: "schedule_invalid_time_window",
        issueCode: "INVALID_TIME_WINDOW",
        title: "Invalid schedule time window",
        brokenRule: "A configured schedule window must have a valid start/end time and stay within the allowed daily length.",
        recommendedFix: "Open Adjust Schedule and replace the invalid window with intended working hours, or mark the day off if the staff member should not work.",
      };
    case "overlapping_windows":
      return {
        type: "schedule_overlapping_windows",
        issueCode: "OVERLAPPING_WINDOWS",
        title: "Overlapping schedule windows",
        brokenRule: "A staff member cannot have overlapping active work windows for the same day.",
        recommendedFix: "Open Adjust Schedule and keep the intended non-overlapping window or split-shift windows.",
      };
    case "ineligible_shift_type":
      return {
        type: "schedule_ineligible_shift_type",
        issueCode: "INELIGIBLE_SHIFT_TYPE",
        title: "Shift type not allowed for staff role",
        brokenRule: "Opening and Closing shifts are allowed only for therapists and CRM/front-desk staff.",
        recommendedFix: "Change the window to a Regular shift unless the staff role is wrong and should be corrected first.",
      };
    case "day_off_with_working_window":
    case "contradictory_day_state":
      return {
        type: "schedule_contradictory_day_state",
        issueCode: "CONTRADICTORY_DAY_STATE",
        title: "Day-off state conflicts with work windows",
        brokenRule: "A staff day cannot be both configured as day off and configured with working windows.",
        recommendedFix: "Open Adjust Schedule and choose either Day Off or the intended working windows.",
      };
    default:
      return {
        type: "schedule_rule_conflict",
        issueCode:
          row.schedule_state === "CONTRADICTORY_DAY_STATE"
            ? "CONTRADICTORY_DAY_STATE"
            : "INVALID_TIME_WINDOW",
        title: "Schedule needs review",
        brokenRule: "The resolver found a schedule state that cannot be used for trusted availability.",
        recommendedFix: "Open Adjust Schedule and confirm the intended schedule for this day.",
      };
  }
}

function missingRoomSeverity(booking: DailyScheduleBooking): LiveScheduleConflictSeverity {
  return booking.status === "confirmed" || booking.status === "in_progress" ? "critical" : "warning";
}

function bookingFitsSchedule(row: DailyScheduleStaffRow, booking: DailyScheduleBooking): boolean {
  return row.schedule_windows.some((window) =>
    doesDurationFitWithinScheduleWindow({
      slotStartTime: booking.start_time,
      durationMinutes: durationMinutes(booking),
      window,
    })
  );
}

function buildBookingContext(rows: DailyScheduleStaffRow[]): BookingConflictContext[] {
  return rows.flatMap((row) =>
    row.bookings.filter(isActiveBooking).map((booking) => ({
      staffId: row.staff_id,
      staffName: row.staff_name,
      booking,
    }))
  );
}

function addStaffBookingConflicts(
  conflicts: LiveScheduleConflict[],
  row: DailyScheduleStaffRow,
  date: string
) {
  const activeBookings = row.bookings.filter(isActiveBooking);

  if (row.schedule_status === "conflict") {
    const details = scheduleIssueDetails(row);
    const affectedWindows = getAffectedScheduleWindows(row);
    const affectedWindowIds = affectedWindows.map((window) => window.id).filter(Boolean) as string[];
    const time = getScheduleConflictTime(affectedWindows);
    const windowSummary = affectedWindows.map(describeScheduleWindow);
    const evidence = windowSummary.length > 0
      ? ` Affected window${windowSummary.length === 1 ? "" : "s"}: ${windowSummary.join("; ")}.`
      : " No usable schedule window was provided.";
    conflicts.push(makeConflict({
      id: fingerprint(["schedule", date, row.staff_id, details.issueCode, ...affectedWindowIds]),
      fingerprint: fingerprint(["schedule", date, row.staff_id, details.issueCode, ...affectedWindowIds]),
      issue_code: details.issueCode,
      type: details.type,
      severity: activeBookings.length > 0 ? "critical" : "warning",
      title: details.title,
      plain_language_message: `${row.staff_name} has ${details.title.toLowerCase()}.${evidence}`,
      staff: [{ id: row.staff_id, name: row.staff_name }],
      bookings: activeBookings.map((booking) => ({ booking, staffName: row.staff_name })),
      affected_resource_id: null,
      affected_resource_name: null,
      date,
      start_time: time.startTime,
      end_time: time.endTime,
      broken_rule: details.brokenRule,
      why_it_matters: "Availability and booking recommendations will exclude this staff member until the schedule is corrected.",
      recommended_fix: details.recommendedFix,
      quick_actions: [
        { label: "Edit staff schedule", intent: "edit_staff_schedule", staffId: row.staff_id },
        { label: "Open schedule setup", intent: "open_schedule_setup", staffId: row.staff_id },
        { label: "View full schedule", intent: "open_full_schedule", staffId: row.staff_id },
      ],
      debug_metadata: {
        schedule_source: row.schedule_source,
        schedule_status: row.schedule_status,
        schedule_state: row.schedule_state,
        schedule_conflict_code: row.schedule_conflict_code,
        schedule_conflict_reason: row.schedule_conflict_reason,
        affected_windows: affectedWindows,
      },
      source_ids: affectedWindowIds,
    }));
  }

  for (const booking of activeBookings) {
    const requiredResourceType = getRequiredResourceType(booking);
    if (requiredResourceType && !booking.resource_id) {
      const resourceLabel = requiredResourceType.replace(/_/g, " ");
      conflicts.push(makeConflict({
        id: fingerprint(["resource-missing", date, booking.id, requiredResourceType]),
        fingerprint: fingerprint(["resource-missing", date, booking.id, requiredResourceType]),
        issue_code: "RESOURCE_REQUIRED_MISSING",
        type: "missing_room",
        severity: missingRoomSeverity(booking),
        title: `Missing ${resourceLabel} assignment`,
        plain_language_message: `${booking.service} for ${booking.customer} requires a ${resourceLabel}, but none is assigned.`,
        staff: [{ id: row.staff_id, name: row.staff_name }],
        bookings: [{ booking, staffName: row.staff_name }],
        affected_resource_id: null,
        affected_resource_name: null,
        date,
        start_time: booking.start_time,
        end_time: booking.end_time,
        broken_rule: `This in-spa service is configured to require a ${resourceLabel} before service time.`,
        why_it_matters: "Front desk and therapists may not know where to take the customer or which resource to prepare.",
        recommended_fix: `Assign an available ${resourceLabel} or move the booking to a time with an eligible ${resourceLabel} available.`,
        quick_actions: bookingQuickActions({ type: "missing_room", staffId: row.staff_id, booking }),
        debug_metadata: {
          booking_status: booking.status,
          booking_type: booking.type,
          delivery_type: booking.delivery_type,
          service_id: booking.service_id,
          service_metadata: booking.service_metadata,
          required_resource_type: requiredResourceType,
        },
        source_ids: [booking.id, booking.service_id].filter(Boolean) as string[],
      }));
    }

    if (row.schedule_is_day_off || row.current_override?.is_day_off) {
      conflicts.push(makeConflict({
        id: `day-off-${row.staff_id}-${booking.id}`,
        fingerprint: fingerprint(["booking-day-off", date, row.staff_id, booking.id]),
        issue_code: "BOOKING_ON_DAY_OFF",
        type: "booking_on_day_off",
        severity: "critical",
        title: "Booking on staff day off",
        plain_language_message: `${row.staff_name} is marked day off but still has ${booking.service} at ${formatScheduleTime(booking.start_time)}.`,
        staff: [{ id: row.staff_id, name: row.staff_name }],
        bookings: [{ booking, staffName: row.staff_name }],
        affected_resource_id: booking.resource_id,
        affected_resource_name: booking.resource_name,
        date,
        start_time: booking.start_time,
        end_time: booking.end_time,
        broken_rule: "A staff member marked day off should not have assigned bookings.",
        why_it_matters: "The booking may be unstaffed unless the day-off override is intentional and confirmed.",
        recommended_fix: "Assign another available staff member, move the booking, or remove the day-off override after confirmation.",
        quick_actions: bookingQuickActions({ type: "booking_on_day_off", staffId: row.staff_id, booking }),
        debug_metadata: {
          schedule_source: row.schedule_source,
          current_override: row.current_override,
        },
      }));
      continue;
    }

    if (row.schedule_windows.length > 0 && !bookingFitsSchedule(row, booking)) {
      conflicts.push(makeConflict({
        id: `outside-shift-${row.staff_id}-${booking.id}`,
        fingerprint: fingerprint(["booking-outside-shift", date, row.staff_id, booking.id]),
        issue_code: "BOOKING_OUTSIDE_SHIFT",
        type: "booking_outside_shift",
        severity: "warning",
        title: "Booking outside staff shift",
        plain_language_message: `${booking.service} for ${booking.customer} is outside ${row.staff_name}'s scheduled work time.`,
        staff: [{ id: row.staff_id, name: row.staff_name }],
        bookings: [{ booking, staffName: row.staff_name }],
        affected_resource_id: booking.resource_id,
        affected_resource_name: booking.resource_name,
        date,
        start_time: booking.start_time,
        end_time: booking.end_time,
        broken_rule: "Booking time must fit fully inside one of the assigned staff schedule windows.",
        why_it_matters: "The staff member may not be working when the service starts or ends.",
        recommended_fix: `Move the booking inside ${row.staff_name}'s shift or assign another available staff member.`,
        quick_actions: bookingQuickActions({ type: "booking_outside_shift", staffId: row.staff_id, booking }),
        debug_metadata: {
          schedule_source: row.schedule_source,
          schedule_windows: row.schedule_windows,
        },
      }));
    }

    const block = row.blocks.find((candidate) => rangesOverlap(booking, candidate));
    if (block) {
      conflicts.push(makeConflict({
        id: `blocked-time-${row.staff_id}-${booking.id}-${block.id}`,
        fingerprint: fingerprint(["booking-blocked-time", date, row.staff_id, booking.id, block.id]),
        issue_code: "BOOKING_DURING_BLOCKED_TIME",
        type: "booking_during_blocked_time",
        severity: "critical",
        title: "Booking during blocked time",
        plain_language_message: `${booking.service} overlaps ${row.staff_name}'s blocked period (${block.reason ?? "blocked time"}).`,
        staff: [{ id: row.staff_id, name: row.staff_name }],
        bookings: [{ booking, staffName: row.staff_name }],
        affected_resource_id: booking.resource_id,
        affected_resource_name: booking.resource_name,
        date,
        start_time: booking.start_time,
        end_time: booking.end_time,
        broken_rule: "Bookings should not overlap staff blocked time, breaks, training, or leave.",
        why_it_matters: "The staff member is not available for service during this blocked period.",
        recommended_fix: "Move the booking, edit the block after confirmation, or assign another available staff member.",
        quick_actions: bookingQuickActions({ type: "booking_during_blocked_time", staffId: row.staff_id, booking }),
        debug_metadata: { blocked_time: block },
      }));
    }
  }

  for (let index = 0; index < activeBookings.length; index++) {
    for (let other = index + 1; other < activeBookings.length; other++) {
      const first = activeBookings[index]!;
      const second = activeBookings[other]!;
      if (!rangesOverlap(first, second)) continue;
      conflicts.push(makeConflict({
        id: `staff-overlap-${row.staff_id}-${first.id}-${second.id}`,
        fingerprint: fingerprint(["staff-overlap", date, row.staff_id, first.id, second.id]),
        issue_code: "STAFF_DOUBLE_BOOKED",
        type: "staff_overlap",
        severity: "critical",
        title: "Staff double-booked",
        plain_language_message: `${row.staff_name} has two bookings at the same time: ${first.service} ${formatTimeRange(first.start_time, first.end_time)} and ${second.service} ${formatTimeRange(second.start_time, second.end_time)}.`,
        staff: [{ id: row.staff_id, name: row.staff_name }],
        bookings: [
          { booking: first, staffName: row.staff_name },
          { booking: second, staffName: row.staff_name },
        ],
        affected_resource_id: null,
        affected_resource_name: null,
        date,
        start_time: first.start_time < second.start_time ? first.start_time : second.start_time,
        end_time: first.end_time > second.end_time ? first.end_time : second.end_time,
        broken_rule: "One staff member cannot serve two overlapping bookings.",
        why_it_matters: "One customer may be left waiting or the booking may start late.",
        recommended_fix: "Move one booking or assign one booking to another available therapist.",
        quick_actions: [
          primaryBookingAction({ booking: first, staffId: row.staff_id, label: "View first booking" }),
          primaryBookingAction({ booking: second, staffId: row.staff_id, label: "View second booking" }),
          { label: "Move one booking", intent: "move_booking", staffId: row.staff_id, bookingId: first.id },
          { label: "Assign another therapist", intent: "assign_staff", staffId: row.staff_id, bookingId: second.id },
        ],
        debug_metadata: { booking_ids: [first.id, second.id] },
      }));
    }
  }
}

function addDuplicateScheduleWindowConflicts(
  conflicts: LiveScheduleConflict[],
  row: DailyScheduleStaffRow,
  date: string
) {
  if (row.schedule_status === "conflict") return;

  for (let index = 0; index < row.schedule_windows.length; index++) {
    for (let other = index + 1; other < row.schedule_windows.length; other++) {
      const first = row.schedule_windows[index]!;
      const second = row.schedule_windows[other]!;
      const exactMatch = first.startTime === second.startTime && first.endTime === second.endTime;
      const overlap = rangesOverlap(
        { start_time: first.startTime, end_time: first.endTime },
        { start_time: second.startTime, end_time: second.endTime }
      );
      if (!exactMatch && !overlap) continue;
      conflicts.push(makeConflict({
        id: `duplicate-window-${row.staff_id}-${index}-${other}`,
        fingerprint: fingerprint([
          "duplicate-schedule-window",
          date,
          row.staff_id,
          first.id,
          second.id,
          first.startTime,
          second.startTime,
        ]),
        issue_code: "DUPLICATE_SCHEDULE_WINDOW",
        type: "duplicate_schedule_window",
        severity: "warning",
        title: "Overlapping schedule rules",
        plain_language_message: `${row.staff_name} has overlapping schedule windows: ${formatTimeRange(first.startTime, first.endTime)} and ${formatTimeRange(second.startTime, second.endTime)}.`,
        staff: [{ id: row.staff_id, name: row.staff_name }],
        affected_resource_id: null,
        affected_resource_name: null,
        date,
        start_time: first.startTime < second.startTime ? first.startTime : second.startTime,
        end_time: first.endTime > second.endTime ? first.endTime : second.endTime,
        broken_rule: "A staff member should not have duplicate or overlapping schedule windows for the same day.",
        why_it_matters: "Availability can look wider than intended and booking recommendations may be confusing.",
        recommended_fix: "Open the staff schedule and keep only the correct shift window.",
        quick_actions: [
          { label: "Edit staff schedule", intent: "edit_staff_schedule", staffId: row.staff_id },
          { label: "Open schedule setup", intent: "open_schedule_setup", staffId: row.staff_id },
        ],
        debug_metadata: { schedule_windows: row.schedule_windows },
      }));
    }
  }
}

function addRoomConflicts(
  conflicts: LiveScheduleConflict[],
  contexts: BookingConflictContext[],
  date: string
) {
  const byResource = new Map<string, BookingConflictContext[]>();
  for (const context of contexts) {
    if (!context.booking.resource_id) continue;
    const list = byResource.get(context.booking.resource_id) ?? [];
    list.push(context);
    byResource.set(context.booking.resource_id, list);
  }

  for (const contextsForResource of byResource.values()) {
    for (let index = 0; index < contextsForResource.length; index++) {
      for (let other = index + 1; other < contextsForResource.length; other++) {
        const first = contextsForResource[index]!;
        const second = contextsForResource[other]!;
        if (!rangesOverlap(first.booking, second.booking)) continue;
        const resourceName = first.booking.resource_name ?? second.booking.resource_name ?? "Room";
        const capacity = Math.max(
          1,
          first.booking.resource_capacity ?? second.booking.resource_capacity ?? 1
        );
        if (capacity > 1) {
          const concurrentBookings = contextsForResource.filter((context) =>
            rangesOverlap(context.booking, first.booking)
          );
          if (concurrentBookings.length <= capacity) continue;
        }
        conflicts.push(makeConflict({
          id: `room-double-booked-${first.booking.id}-${second.booking.id}`,
          fingerprint: fingerprint([
            "room-double-booked",
            date,
            first.booking.resource_id ?? second.booking.resource_id,
            first.booking.id,
            second.booking.id,
          ]),
          issue_code: "ROOM_DOUBLE_BOOKED",
          type: "room_double_booked",
          severity: "critical",
          title: "Room double-booked",
          plain_language_message: `${resourceName} is assigned to two bookings at ${formatScheduleTime(first.booking.start_time)}.`,
          staff: [
            { id: first.staffId, name: first.staffName },
            { id: second.staffId, name: second.staffName },
          ],
          bookings: [
            { booking: first.booking, staffName: first.staffName },
            { booking: second.booking, staffName: second.staffName },
          ],
          affected_resource_id: first.booking.resource_id ?? second.booking.resource_id,
          affected_resource_name: resourceName,
          date,
          start_time: first.booking.start_time < second.booking.start_time ? first.booking.start_time : second.booking.start_time,
          end_time: first.booking.end_time > second.booking.end_time ? first.booking.end_time : second.booking.end_time,
          broken_rule: "One room or resource cannot be assigned to overlapping bookings.",
          why_it_matters: "Two customers may be sent to the same room at the same time.",
          recommended_fix: "Move one booking to another room or another time.",
          quick_actions: [
            primaryBookingAction({ booking: first.booking, staffId: first.staffId, label: "View first booking" }),
            primaryBookingAction({ booking: second.booking, staffId: second.staffId, label: "View second booking" }),
            { label: "Assign different room", intent: "assign_resource", staffId: first.staffId, bookingId: first.booking.id },
            { label: "Move booking time", intent: "move_booking", staffId: second.staffId, bookingId: second.booking.id },
          ],
          debug_metadata: {
            resource_id: first.booking.resource_id,
            booking_ids: [first.booking.id, second.booking.id],
            resource_capacity: capacity,
          },
          source_ids: [
            first.booking.resource_id ?? second.booking.resource_id,
            first.booking.id,
            second.booking.id,
          ].filter(Boolean) as string[],
        }));
      }
    }
  }
}

function addTravelBufferConflicts(
  conflicts: LiveScheduleConflict[],
  row: DailyScheduleStaffRow,
  date: string,
  bufferMinutes: number
) {
  const activeBookings = [...row.bookings.filter(isActiveBooking)].sort(
    (a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time)
  );

  for (let index = 0; index < activeBookings.length - 1; index++) {
    const current = activeBookings[index]!;
    const next = activeBookings[index + 1]!;
    if (!isHomeServiceBooking(current) && !isHomeServiceBooking(next)) continue;
    const currentRange = absoluteRange(current.start_time, current.end_time);
    const nextRange = absoluteRange(next.start_time, next.end_time);
    const gap = nextRange.start - currentRange.end;
    if (gap < 0 || gap >= bufferMinutes) continue;
    conflicts.push(makeConflict({
      id: `home-service-travel-buffer-${row.staff_id}-${current.id}-${next.id}`,
      fingerprint: fingerprint(["home-service-travel-buffer", date, row.staff_id, current.id, next.id]),
      issue_code: "HOME_SERVICE_TRAVEL_BUFFER",
      type: "home_service_travel_buffer_warning",
      severity: "warning",
      title: "Home-service travel buffer warning",
      plain_language_message: `${row.staff_name} may not have enough travel time between ${current.service} and ${next.service}.`,
      staff: [{ id: row.staff_id, name: row.staff_name }],
      bookings: [
        { booking: current, staffName: row.staff_name },
        { booking: next, staffName: row.staff_name },
      ],
      affected_resource_id: null,
      affected_resource_name: null,
      date,
      start_time: current.end_time,
      end_time: next.start_time,
      broken_rule: `Home-service bookings should leave at least ${bufferMinutes} minutes for travel before the next required assignment.`,
      why_it_matters: "The staff member or driver may arrive late to the next customer or service.",
      recommended_fix: "Review travel timing, move one booking, or assign different staff/driver coverage.",
      quick_actions: bookingQuickActions({ type: "home_service_travel_buffer_warning", staffId: row.staff_id, booking: current }),
      debug_metadata: { gap_minutes: gap, required_buffer_minutes: bufferMinutes },
    }));
  }
}

function addCoverageGapConflict(
  conflicts: LiveScheduleConflict[],
  rows: DailyScheduleStaffRow[],
  options: BuildLiveScheduleConflictsOptions
) {
  const requirement = options.coverageRequirement;
  if (!options.includeCoverageGap || !requirement || requirement.minimum <= 0) return;
  const scheduledRows = rows.filter((row) => row.schedule_windows.length > 0 && !row.schedule_is_day_off);
  const actualRows = requirement.actual_staff_ids
    ? scheduledRows.filter((row) => requirement.actual_staff_ids?.includes(row.staff_id))
    : scheduledRows;
  const minimum = requirement.minimum;
  if (actualRows.length >= minimum) return;
  const shortage = minimum - actualRows.length;
  const category = requirement.category ? ` ${requirement.category}` : "";
  const windowLabel =
    requirement.start_time && requirement.end_time
      ? ` ${formatTimeRange(requirement.start_time, requirement.end_time)}`
      : "";
  conflicts.push(makeConflict({
    id: fingerprint(["coverage-gap", options.date, requirement.id, requirement.sourceId]),
    fingerprint: fingerprint(["coverage-gap", options.date, requirement.id, requirement.sourceId]),
    issue_code: "COVERAGE_REQUIREMENT_SHORTAGE",
    type: "coverage_gap",
    severity: "warning",
    title: "Coverage gap",
    plain_language_message: `${requirement.label}${category}${windowLabel}: ${actualRows.length}/${minimum} scheduled, shortage ${shortage}.`,
    staff: actualRows.map((row) => ({ id: row.staff_id, name: row.staff_name })),
    affected_resource_id: null,
    affected_resource_name: null,
    date: options.date,
    start_time: requirement.start_time ?? null,
    end_time: requirement.end_time ?? null,
    broken_rule: "Explicit time/category coverage requirements should be met by scheduled operational staff.",
    why_it_matters: "The branch may not have enough configured coverage for this specific requirement.",
    recommended_fix: "Open Schedule Setup and add eligible staff to the required time/category, or update the explicit coverage rule.",
    quick_actions: [
      { label: "Open schedule setup", intent: "open_schedule_setup" },
      { label: "Add staff to shift", intent: "edit_staff_schedule" },
      { label: "Review day-off overrides", intent: "open_schedule_setup" },
    ],
    debug_metadata: {
      requirement,
      scheduled_staff_count: actualRows.length,
      minimum_required: minimum,
      shortage,
    },
    source_ids: [requirement.sourceId, requirement.id].filter(Boolean) as string[],
  }));
}

function dedupeConflicts(conflicts: LiveScheduleConflict[]): LiveScheduleConflict[] {
  const byFingerprint = new Map<string, LiveScheduleConflict>();
  const severityRank = { critical: 0, warning: 1, info: 2 } as const;

  for (const conflict of conflicts) {
    const key = conflict.fingerprint ?? conflict.id;
    const existing = byFingerprint.get(key);
    if (!existing || severityRank[conflict.severity] < severityRank[existing.severity]) {
      byFingerprint.set(key, conflict);
    }
  }

  return Array.from(byFingerprint.values());
}

export function buildLiveScheduleConflicts(
  rows: DailyScheduleStaffRow[],
  options: BuildLiveScheduleConflictsOptions
): LiveScheduleConflict[] {
  const conflicts: LiveScheduleConflict[] = [];
  const contexts = buildBookingContext(rows);
  const bufferMinutes = options.schedulingRules?.home_service_travel_buffer_minutes ?? 30;

  for (const row of rows) {
    addStaffBookingConflicts(conflicts, row, options.date);
    addDuplicateScheduleWindowConflicts(conflicts, row, options.date);
    addTravelBufferConflicts(conflicts, row, options.date, bufferMinutes);
  }

  addRoomConflicts(conflicts, contexts, options.date);
  addCoverageGapConflict(conflicts, rows, options);

  return dedupeConflicts(conflicts).sort((a, b) => {
    const severityRank = { critical: 0, warning: 1, info: 2 } as const;
    const rankDiff = severityRank[a.severity] - severityRank[b.severity];
    if (rankDiff !== 0) return rankDiff;
    return (a.start_time ?? "99:99").localeCompare(b.start_time ?? "99:99");
  });
}

export function getConflictForBooking(
  conflicts: LiveScheduleConflict[],
  bookingId: string
): LiveScheduleConflict | null {
  return conflicts.find((conflict) => conflict.affected_booking_ids.includes(bookingId)) ?? null;
}

export function getConflictForStaff(
  conflicts: LiveScheduleConflict[],
  staffId: string
): LiveScheduleConflict | null {
  return conflicts.find((conflict) => conflict.affected_staff_ids.includes(staffId)) ?? null;
}

export function getBlockingConflictReason(
  conflicts: LiveScheduleConflict[],
  booking: DailyScheduleBooking
): string | null {
  const conflict = getConflictForBooking(conflicts, booking.id);
  return conflict?.plain_language_message ?? null;
}

export function getBlockedTimeLabel(block: DailyScheduleBlock): string {
  return `${block.reason ?? "Blocked time"} ${formatTimeRange(block.start_time, block.end_time)}`;
}
