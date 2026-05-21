import { timeToMinutes, rangesOverlap } from "@/lib/engine/slot-time";
import {
  canActAsBookingServiceProvider,
  staffTypeCanPerformService,
  type ServiceCapabilityContext,
} from "@/lib/staff/service-providers";

// ── Types ──────────────────────────────────────────────────────────────────────

export type RecommendationType = "therapist" | "driver";

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
  noConflict: 30,
  sameBranch: 20,
  serviceCapable: 20,
  insideShift: 15,
  shiftAlignment: 10,
  lessWorkload: 10,
  notCheckedIn: -50,
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
    (c) => c.staff_id === staffId && c.shift_date === bookingDate && c.status === "checked_in"
  );
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
    return buildResult(staff, "therapist", score, reasons, warnings);
  }

  // Check-in status (only matters if booking is today)
  const today = new Date().toISOString().split("T")[0]!;
  const isToday = ctx.bookingDate === today;
  const checkedIn = isCheckedInToday(staff.id, ctx.bookingDate, ctx.checkins);

  if (isToday) {
    if (checkedIn) {
      score += SCORE.checkedIn;
      reasons.push("Checked in");
    } else {
      score += SCORE.notCheckedIn;
      warnings.push("Not checked in for today");
    }
  } else {
    if (checkedIn) {
      reasons.push("Already checked in");
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

  return buildResult(staff, "therapist", score, reasons, warnings);
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
    return buildResult(staff, "driver", score, reasons, warnings);
  }

  // Must be driver
  if (!isDriver(staff)) {
    warnings.push("Not a driver");
    return buildResult(staff, "driver", score, reasons, warnings);
  }

  // Check-in status
  const today = new Date().toISOString().split("T")[0]!;
  const isToday = ctx.bookingDate === today;
  const checkedIn = isCheckedInToday(staff.id, ctx.bookingDate, ctx.checkins);

  if (isToday) {
    if (checkedIn) {
      score += SCORE.checkedIn;
      reasons.push("Checked in");
    } else {
      score += SCORE.notCheckedIn;
      warnings.push("Not checked in for today");
    }
  } else {
    if (checkedIn) {
      reasons.push("Already checked in");
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

  return buildResult(staff, "driver", score, reasons, warnings);
}

function buildResult(
  staff: StaffForScoring,
  recommendationType: RecommendationType,
  score: number,
  reasons: string[],
  warnings: string[]
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
