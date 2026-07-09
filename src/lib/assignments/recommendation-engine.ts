import { getBranchBusinessDate, timeToMinutes, rangesOverlap } from "@/lib/engine/slot-time";
import { NO_CHECKED_IN_STAFF_WARNING } from "@/lib/engine/availability";
import {
  canActAsBookingServiceProvider,
  staffTypeCanPerformService,
  type ServiceCapabilityContext,
} from "@/lib/staff/service-providers";
import { MVP_CHECKIN_PAUSED } from "@/lib/config/mvp-flags";

// ── Types ──────────────────────────────────────────────────────────────────────

export type RecommendationType = "therapist" | "driver";
export type RecommendationBookingMode =
  | "walkin"
  | "phone"
  | "home_service"
  | "standard_future"
  | "online"
  | "unknown";

export type ScoredStaff = {
  staffId: string;
  displayName: string;
  roleLabel: string;
  tier: string | null;
  recommendationType: RecommendationType;
  score: number;
  status: "recommended" | "available" | "warning" | "unavailable";
  reasons: string[];
  warnings: string[];
  queuePosition?: number | null;
  checkedInAt?: string | null;
  attendanceState?: "checked_in" | "checked_out" | "not_arrived" | "unknown";
  workloadCount?: number;
};

export type StaffForScoring = {
  id: string;
  full_name: string;
  staff_type: string | null;
  system_role: string | null;
  tier: string | null;
  is_active: boolean;
  branch_id: string;
};

export type ScheduleForScoring = {
  staff_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  shift_type: string;
};

export type OverrideForScoring = {
  staff_id: string;
  override_date: string;
  is_day_off: boolean;
  start_time: string | null;
  end_time: string | null;
};

export type BlockForScoring = {
  staff_id: string;
  block_date: string;
  start_time: string;
  end_time: string;
};

export type CheckinForScoring = {
  staff_id: string;
  shift_date: string;
  status: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
  attendance_status: string | null;
  shift_type: string | null;
  branch_id: string;
};

export type ConflictBooking = {
  staff_id: string;
  start_time: string;
  end_time: string;
  status: string;
};

export type StaffServiceMapping = {
  staff_id: string;
  service_id: string;
};

export type StaffPreference = {
  staff_id: string;
  can_do_home_service: boolean;
  can_drive: boolean;
  max_services_per_day: number | null;
  max_trips_per_day: number | null;
};

export type ServiceContext = ServiceCapabilityContext & {
  id: string;
  duration_minutes: number;
};

export type RecommendationContext = {
  bookingDate: string;
  bookingStartTime: string;
  bookingEndTime: string;
  bookingMode: RecommendationBookingMode;
  isHomeService: boolean;
  service: ServiceContext | null;
  staffList: StaffForScoring[];
  staffServices: StaffServiceMapping[];
  schedules: ScheduleForScoring[];
  overrides: OverrideForScoring[];
  blockedTimes: BlockForScoring[];
  checkins: CheckinForScoring[];
  existingBookings: ConflictBooking[];
  preferences: StaffPreference[];
};

// ── Scoring constants ──────────────────────────────────────────────────────────

const SCORE = {
  checkedIn: 40,
  queuePosition1: 30,
  queuePosition2: 25,
  queuePosition3: 20,
  queuePosition4Plus: 15,
  noConflict: 30,
  sameBranch: 20,
  serviceCapable: 20,
  insideShift: 15,
  shiftAlignment: 10,
  lessWorkload: 10,
  // MVP_CHECKIN_PAUSED: penalty is 0 while check-in is paused; restore to -50 when re-enabled.
  notCheckedIn: MVP_CHECKIN_PAUSED ? 0 : -50,
  activeConflict: -50,
  blockedTime: -30,
  dayOff: -30,
  noSchedule: -20,
} as const;

const STATUS_THRESHOLDS = {
  recommended: 60,
  available: 20,
  warning: 0,
} as const;

// ── Helpers ────────────────────────────────────────────────────────────────────

function dayOfWeekFromYmd(date: string): number {
  const [y = "0", m = "1", d = "1"] = date.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d)).getDay();
}

function formatAttendanceTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function timesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  return rangesOverlap(
    timeToMinutes(startA),
    timeToMinutes(endA),
    timeToMinutes(startB),
    timeToMinutes(endB)
  );
}

function workloadToday(staffId: string, existingBookings: ConflictBooking[]): number {
  return existingBookings.filter((b) => b.staff_id === staffId).length;
}

function hasScheduleForDay(
  staffId: string,
  dayOfWeek: number,
  schedules: ScheduleForScoring[]
): boolean {
  return schedules.some(
    (s) => s.staff_id === staffId && s.day_of_week === dayOfWeek && s.is_active
  );
}

function isInsideShift(
  staffId: string,
  dayOfWeek: number,
  bookingStart: string,
  bookingEnd: string,
  schedules: ScheduleForScoring[]
): boolean {
  const staffSchedules = schedules.filter(
    (s) => s.staff_id === staffId && s.day_of_week === dayOfWeek && s.is_active
  );
  if (staffSchedules.length === 0) return false;

  const bookingStartMin = timeToMinutes(bookingStart);
  const bookingEndMin = timeToMinutes(bookingEnd);

  return staffSchedules.some((s) => {
    const shiftStart = timeToMinutes(s.start_time);
    const shiftEnd = timeToMinutes(s.end_time);
    return bookingStartMin >= shiftStart && bookingEndMin <= shiftEnd;
  });
}

function hasDayOff(
  staffId: string,
  bookingDate: string,
  overrides: OverrideForScoring[]
): boolean {
  return overrides.some(
    (o) => o.staff_id === staffId && o.override_date === bookingDate && o.is_day_off
  );
}

function hasBlockedTime(
  staffId: string,
  bookingDate: string,
  bookingStart: string,
  bookingEnd: string,
  blockedTimes: BlockForScoring[]
): boolean {
  return blockedTimes.some(
    (b) =>
      b.staff_id === staffId &&
      b.block_date === bookingDate &&
      timesOverlap(b.start_time, b.end_time, bookingStart, bookingEnd)
  );
}

function hasBookingConflict(
  staffId: string,
  bookingStart: string,
  bookingEnd: string,
  existingBookings: ConflictBooking[]
): boolean {
  return existingBookings.some(
    (b) =>
      b.staff_id === staffId &&
      !["cancelled", "no_show"].includes(b.status) &&
      timesOverlap(b.start_time, b.end_time, bookingStart, bookingEnd)
  );
}

function isCheckedInToday(
  staffId: string,
  bookingDate: string,
  checkins: CheckinForScoring[]
): boolean {
  return checkins.some(
    (c) =>
      c.staff_id === staffId &&
      c.shift_date === bookingDate &&
      c.status === "checked_in" &&
      !c.checked_out_at
  );
}

function hasActiveCheckinsForDate(
  bookingDate: string,
  checkins: CheckinForScoring[]
): boolean {
  return checkins.some(
    (c) => c.shift_date === bookingDate && c.status === "checked_in" && !c.checked_out_at
  );
}

function shouldUseAttendancePreference(ctx: RecommendationContext): boolean {
  return (
    ctx.bookingMode === "walkin" &&
    !ctx.isHomeService &&
    ctx.bookingDate === getBranchBusinessDate()
  );
}

function getTodayCheckin(
  staffId: string,
  bookingDate: string,
  checkins: CheckinForScoring[]
): CheckinForScoring | undefined {
  return checkins.find(
    (c) =>
      c.staff_id === staffId &&
      c.shift_date === bookingDate &&
      c.status === "checked_in" &&
      !c.checked_out_at
  );
}

export function isCurrentlyCheckedIn(
  staffId: string,
  bookingDate: string,
  checkins: CheckinForScoring[]
): boolean {
  return Boolean(getTodayCheckin(staffId, bookingDate, checkins));
}

export function getCheckedInAt(
  staffId: string,
  bookingDate: string,
  checkins: CheckinForScoring[]
): string | null {
  return getTodayCheckin(staffId, bookingDate, checkins)?.checked_in_at ?? null;
}

export function getTodayQueuePosition(
  staffId: string,
  bookingDate: string,
  checkins: CheckinForScoring[]
): number | null {
  const activeCheckins = checkins
    .filter(
      (c) =>
        c.shift_date === bookingDate &&
        c.status === "checked_in" &&
        !c.checked_out_at &&
        c.checked_in_at
    )
    .sort(
      (a, b) =>
        new Date(a.checked_in_at!).getTime() - new Date(b.checked_in_at!).getTime()
    );

  const index = activeCheckins.findIndex((c) => c.staff_id === staffId);
  return index >= 0 ? index + 1 : null;
}

function isServiceProvider(staff: StaffForScoring): boolean {
  return canActAsBookingServiceProvider({
    is_active: staff.is_active,
    staff_type: staff.staff_type,
    system_role: staff.system_role,
  });
}

function canPerformService(
  staff: StaffForScoring,
  service: ServiceContext | null,
  staffServices: StaffServiceMapping[]
): boolean {
  if (!isServiceProvider(staff)) return false;

  // Direct staff_service mapping
  const hasMapping = staffServices.some((s) => s.staff_id === staff.id);
  if (hasMapping) return true;

  // Fallback: staff_type keyword matching
  if (service && staffTypeCanPerformService(staff.staff_type, service)) return true;

  // If no service specified but staff is a service provider, allow
  if (!service) return true;

  return false;
}

function isDriver(staff: StaffForScoring): boolean {
  return staff.system_role === "driver" || staff.staff_type === "driver";
}

function hasActiveDriverTrip(
  staffId: string,
  existingBookings: ConflictBooking[]
): boolean {
  // For drivers, existingBookings should already be filtered to driver_id assignments
  return existingBookings.some(
    (b) =>
      b.staff_id === staffId &&
      !["cancelled", "no_show", "completed"].includes(b.status)
  );
}

// ── Scoring ────────────────────────────────────────────────────────────────────

function scoreTherapist(
  staff: StaffForScoring,
  ctx: RecommendationContext
): ScoredStaff {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let score = 0;
  const dayOfWeek = dayOfWeekFromYmd(ctx.bookingDate);

  // Active check
  if (!staff.is_active) {
    warnings.push("Staff is inactive");
    return buildResult(staff, "therapist", score, reasons, warnings, ctx);
  }

  // Check-in status is only an assignment preference for walk-ins happening today.
  const useAttendancePreference = shouldUseAttendancePreference(ctx);
  const hasCheckedInStaff = hasActiveCheckinsForDate(ctx.bookingDate, ctx.checkins);
  const checkedIn = isCheckedInToday(staff.id, ctx.bookingDate, ctx.checkins);
  const queuePosition = getTodayQueuePosition(staff.id, ctx.bookingDate, ctx.checkins);
  const checkedInAt = getCheckedInAt(staff.id, ctx.bookingDate, ctx.checkins);

  if (useAttendancePreference) {
    if (checkedIn && queuePosition) {
      score += SCORE.checkedIn;
      const queueBonus =
        queuePosition === 1
          ? SCORE.queuePosition1
          : queuePosition === 2
            ? SCORE.queuePosition2
            : queuePosition === 3
              ? SCORE.queuePosition3
              : SCORE.queuePosition4Plus;
      score += queueBonus;
      reasons.push(`#${queuePosition} in today's attendance queue`);
      if (checkedInAt) {
        reasons.push(`Clocked in at ${formatAttendanceTime(checkedInAt)}`);
      }
    } else if (checkedIn) {
      score += SCORE.checkedIn;
      reasons.push("Checked in");
    } else if (hasCheckedInStaff) {
      score += SCORE.notCheckedIn;
      warnings.push("Not checked in for today");
    } else {
      warnings.push(NO_CHECKED_IN_STAFF_WARNING);
    }
  }

  // Same branch (implicit since we filter by branch, but document it)
  reasons.push("Same branch");
  score += SCORE.sameBranch;

  // Service capability
  const serviceCapable = canPerformService(staff, ctx.service, ctx.staffServices);
  if (serviceCapable) {
    score += SCORE.serviceCapable;
    reasons.push(ctx.service ? `Offers ${ctx.service.name}` : "Service-capable");
  } else {
    warnings.push("Does not offer this service");
  }

  // Schedule presence
  const hasSchedule = hasScheduleForDay(staff.id, dayOfWeek, ctx.schedules);
  if (!hasSchedule) {
    score += SCORE.noSchedule;
    warnings.push("No schedule for this day");
  }

  // Day off override
  const dayOff = hasDayOff(staff.id, ctx.bookingDate, ctx.overrides);
  if (dayOff) {
    score += SCORE.dayOff;
    warnings.push("Day-off override on this date");
  }

  // Blocked time
  const blocked = hasBlockedTime(
    staff.id,
    ctx.bookingDate,
    ctx.bookingStartTime,
    ctx.bookingEndTime,
    ctx.blockedTimes
  );
  if (blocked) {
    score += SCORE.blockedTime;
    warnings.push("Blocked during booking window");
  }

  // Inside active shift
  const insideShift = isInsideShift(
    staff.id,
    dayOfWeek,
    ctx.bookingStartTime,
    ctx.bookingEndTime,
    ctx.schedules
  );
  if (insideShift) {
    score += SCORE.insideShift;
    reasons.push("Inside active shift");
  } else if (hasSchedule) {
    warnings.push("Booking extends outside shift hours");
  }

  // Booking conflict
  const conflict = hasBookingConflict(
    staff.id,
    ctx.bookingStartTime,
    ctx.bookingEndTime,
    ctx.existingBookings
  );
  if (conflict) {
    score += SCORE.activeConflict;
    warnings.push("Has overlapping booking");
  } else {
    score += SCORE.noConflict;
    reasons.push("Free during booking window");
  }

  // Workload
  const workload = workloadToday(staff.id, ctx.existingBookings);
  if (workload === 0) {
    score += SCORE.lessWorkload;
    reasons.push("No bookings today");
  } else if (workload <= 2) {
    score += SCORE.shiftAlignment;
    reasons.push(`Light workload (${workload} booking${workload === 1 ? "" : "s"})`);
  }

  return buildResult(staff, "therapist", score, reasons, warnings, ctx);
}

function scoreDriver(
  staff: StaffForScoring,
  ctx: RecommendationContext
): ScoredStaff {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let score = 0;
  const dayOfWeek = dayOfWeekFromYmd(ctx.bookingDate);

  // Active check
  if (!staff.is_active) {
    warnings.push("Staff is inactive");
    return buildResult(staff, "driver", score, reasons, warnings, ctx);
  }

  // Must be driver
  if (!isDriver(staff)) {
    warnings.push("Not a driver");
    return buildResult(staff, "driver", score, reasons, warnings, ctx);
  }

  // Check-in status is only an assignment preference for walk-ins happening today.
  const useAttendancePreference = shouldUseAttendancePreference(ctx);
  const hasCheckedInStaff = hasActiveCheckinsForDate(ctx.bookingDate, ctx.checkins);
  const checkedIn = isCheckedInToday(staff.id, ctx.bookingDate, ctx.checkins);

  if (useAttendancePreference) {
    if (checkedIn) {
      score += SCORE.checkedIn;
      reasons.push("Checked in");
    } else if (hasCheckedInStaff) {
      score += SCORE.notCheckedIn;
      warnings.push("Not checked in for today");
    } else {
      warnings.push(NO_CHECKED_IN_STAFF_WARNING);
    }
  }

  // Same branch
  reasons.push("Same branch");
  score += SCORE.sameBranch;

  // No active trip
  const activeTrip = hasActiveDriverTrip(staff.id, ctx.existingBookings);
  if (activeTrip) {
    score += SCORE.activeConflict;
    warnings.push("Has active trip/dispatch");
  } else {
    score += SCORE.noConflict;
    reasons.push("No active trip");
  }

  // Schedule presence
  const hasSchedule = hasScheduleForDay(staff.id, dayOfWeek, ctx.schedules);
  if (!hasSchedule) {
    score += SCORE.noSchedule;
    warnings.push("No schedule for this day");
  }

  // Day off override
  const dayOff = hasDayOff(staff.id, ctx.bookingDate, ctx.overrides);
  if (dayOff) {
    score += SCORE.dayOff;
    warnings.push("Day-off override on this date");
  }

  // Blocked time
  const blocked = hasBlockedTime(
    staff.id,
    ctx.bookingDate,
    ctx.bookingStartTime,
    ctx.bookingEndTime,
    ctx.blockedTimes
  );
  if (blocked) {
    score += SCORE.blockedTime;
    warnings.push("Blocked during dispatch window");
  }

  // Inside active shift
  const insideShift = isInsideShift(
    staff.id,
    dayOfWeek,
    ctx.bookingStartTime,
    ctx.bookingEndTime,
    ctx.schedules
  );
  if (insideShift) {
    score += SCORE.insideShift;
    reasons.push("Inside active shift");
  } else if (hasSchedule) {
    warnings.push("Dispatch extends outside shift hours");
  }

  // Workload
  const workload = workloadToday(staff.id, ctx.existingBookings);
  if (workload === 0) {
    score += SCORE.lessWorkload;
    reasons.push("No trips today");
  } else if (workload <= 2) {
    score += SCORE.shiftAlignment;
    reasons.push(`Light trip load (${workload} trip${workload === 1 ? "" : "s"})`);
  }

  return buildResult(staff, "driver", score, reasons, warnings, ctx);
}

function buildResult(
  staff: StaffForScoring,
  recommendationType: RecommendationType,
  score: number,
  reasons: string[],
  warnings: string[],
  ctx: RecommendationContext
): ScoredStaff {
  let status: ScoredStaff["status"];
  if (score >= STATUS_THRESHOLDS.recommended) status = "recommended";
  else if (score >= STATUS_THRESHOLDS.available) status = "available";
  else if (score >= STATUS_THRESHOLDS.warning) status = "warning";
  else status = "unavailable";

  // If there are critical warnings, cap status
  const criticalWarnings = warnings.filter((w) =>
    ["Does not offer this service", "Not a driver", "Staff is inactive"].includes(w)
  );
  if (criticalWarnings.length > 0) {
    status = "unavailable";
  }

  const roleLabel = staff.staff_type
    ? staff.staff_type.replace(/_/g, " ")
    : staff.system_role?.replace(/_/g, " ") ?? "Staff";

  const attendanceState: ScoredStaff["attendanceState"] =
    getTodayQueuePosition(staff.id, ctx.bookingDate, ctx.checkins) !== null
      ? "checked_in"
      : ctx.checkins.some((c) => c.staff_id === staff.id && c.shift_date === ctx.bookingDate && c.status === "checked_out")
        ? "checked_out"
        : ctx.checkins.some((c) => c.staff_id === staff.id && c.shift_date === ctx.bookingDate)
          ? "not_arrived"
          : "unknown";

  return {
    staffId: staff.id,
    displayName: staff.full_name,
    roleLabel: roleLabel.charAt(0).toUpperCase() + roleLabel.slice(1),
    tier: staff.tier,
    recommendationType,
    score,
    status,
    reasons,
    warnings,
    queuePosition: getTodayQueuePosition(staff.id, ctx.bookingDate, ctx.checkins),
    checkedInAt: getCheckedInAt(staff.id, ctx.bookingDate, ctx.checkins),
    attendanceState,
    workloadCount: workloadToday(staff.id, ctx.existingBookings),
  };
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function scoreTherapistCandidates(
  ctx: RecommendationContext
): ScoredStaff[] {
  const candidates = ctx.staffList
    .filter((s) => isServiceProvider(s))
    .map((s) => scoreTherapist(s, ctx));

  return candidates.sort((a, b) => b.score - a.score);
}

export function scoreDriverCandidates(
  ctx: RecommendationContext
): ScoredStaff[] {
  const candidates = ctx.staffList
    .filter((s) => isDriver(s))
    .map((s) => scoreDriver(s, ctx));

  return candidates.sort((a, b) => b.score - a.score);
}
