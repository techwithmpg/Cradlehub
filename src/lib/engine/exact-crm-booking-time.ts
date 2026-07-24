import { bookingBlocksAvailability } from "@/lib/bookings/hold-status";
import {
  canScheduledProviderPerformServices,
  formatMinutesAsClock,
  type ScheduledProviderService,
} from "@/lib/bookings/scheduled-provider-roster";
import { parseBookingTime } from "@/lib/bookings/booking-clock-time";
import {
  CRM_AVAILABILITY_MESSAGES,
  NO_CHECKED_IN_STAFF_WARNING,
  type CrmAvailabilityReasonCode,
  type CrmRejectedTherapistReason,
} from "@/lib/engine/availability";
import {
  BRANCH_TIMEZONE,
  getBranchBusinessDate,
  getDayOfWeekFromYmd,
  isPastSlot,
  rangesOverlap,
  timeToMinutes,
} from "@/lib/engine/slot-time";
import {
  getBranchBookingRulesOrDefault,
  isBookingTimeAllowedByRules,
} from "@/lib/queries/branch-booking-rules";
import {
  resolveScheduleForStaffDay,
  type IndividualScheduleSourceRow,
  type ResolvedStaffScheduleWindow,
  type ScheduleOverrideSourceRow,
} from "@/lib/schedule/resolve-staff-schedule";
import { getScheduleWindowAbsoluteRange } from "@/lib/schedule/schedule-coverage";
import { isOperationalStaff } from "@/lib/staff/operational-staff";
import { canActAsBookingServiceProvider } from "@/lib/staff/service-providers";
import { createAdminClient } from "@/lib/supabase/admin";

const DAY_MINUTES = 24 * 60;

export type ExactCrmBookingMode = "walkin" | "phone" | "standard_future" | "home_service";
export type ExactCrmDeliveryType = "in_spa" | "home_service";

export type ExactCrmScheduleMatch = {
  window: ResolvedStaffScheduleWindow;
  scheduleStartMinutes: number;
  scheduleEndMinutes: number;
  serviceStartMinutes: number;
  serviceEndMinutes: number;
  operationalStartMinutes: number;
  operationalEndMinutes: number;
  overtimeMinutes: number;
  operationalOvertimeMinutes: number;
  operationalStartsBeforeShift: boolean;
  serviceCrossesDateBoundary: boolean;
  operationalCrossesDateBoundary: boolean;
};

export type ExactCrmProviderReasonCode =
  | "checked_in_available"
  | "scheduled_available_not_checked_in"
  | "scheduled_available_checked_out"
  | "booking_conflict"
  | "blocked_by_override"
  | "not_scheduled_at_start"
  | "outside_booking_hours"
  | "past_time"
  | "date_boundary_unsupported";

export type ExactCrmProviderAvailability = {
  staffId: string;
  fullName: string;
  nickname: string | null;
  checkedIn: boolean;
  checkedOut: boolean;
  scheduledForDay: boolean;
  scheduledAtTime: boolean;
  availableAtTime: boolean;
  selectable: boolean;
  recommended: boolean;
  scheduleStartTime: string | null;
  scheduleEndTime: string | null;
  serviceEndTime: string | null;
  operationalStartTime: string | null;
  operationalEndTime: string | null;
  overtimeMinutes: number;
  operationalOvertimeMinutes: number;
  operationalStartsBeforeShift: boolean;
  nextAvailableAt: string | null;
  reasonCode: ExactCrmProviderReasonCode;
  statusLabel: string;
  warning: string | null;
};

export type ExactCrmBookingTimeResult = {
  available: boolean;
  message: string | null;
  warning: string | null;
  reasonCode: CrmAvailabilityReasonCode | "past_time" | "date_boundary_unsupported" | null;
  totalBlockMinutes: number;
  travelBufferMinutes: number;
  serviceEndTime: string | null;
  operationalStartTime: string | null;
  operationalEndTime: string | null;
  availableStaffIds: string[];
  providers: ExactCrmProviderAvailability[];
  rejectedTherapists?: CrmRejectedTherapistReason[];
};

type StaffRow = {
  id: string;
  full_name: string;
  nickname: string | null;
  branch_id: string | null;
  is_active: boolean | null;
  staff_type: string | null;
  system_role: string | null;
  tier: string | null;
  archived_at: string | null;
  merged_into_staff_id: string | null;
  metadata: Record<string, unknown> | null;
};

type StaffServiceRow = {
  staff_id: string;
  service_id: string;
};

type CheckinRow = {
  staff_id: string;
  status: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
};

type CategoryRelation = { name: string | null } | { name: string | null }[] | null;

type ServiceTimingRow = {
  id: string;
  name: string;
  duration_minutes: number;
  buffer_before: number;
  buffer_after: number;
  service_categories: CategoryRelation;
};

type BranchServiceTimingRow = {
  service_id: string;
  custom_duration_minutes: number | null;
};

type StaffScheduleRow = {
  id: string;
  staff_id: string;
  shift_type: string | null;
  start_time: string | null;
  end_time: string | null;
  is_active: boolean | null;
  window_order: number | null;
  ends_next_day: boolean | null;
};

type OverrideRow = {
  id: string;
  staff_id: string;
  shift_type: string | null;
  start_time: string | null;
  end_time: string | null;
  is_day_off: boolean | null;
  ends_next_day: boolean | null;
};

type BookingRow = {
  staff_id: string | null;
  start_time: string;
  end_time: string | null;
  status: string | null;
  hold_expires_at: string | null;
  delivery_type: string | null;
  travel_buffer_mins: number | null;
};

type OperationalConflict = {
  nextAvailableAt: string;
};

function firstCategoryName(value: CategoryRelation): string | null {
  if (!value) return null;
  const category = Array.isArray(value) ? value[0] : value;
  return category?.name ?? null;
}

function formatCanonicalTime(minutes: number): string {
  const normalized = ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:00`;
}

function formatDurationCompact(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} hr${hours === 1 ? "" : "s"}`;
  return `${hours} hr${hours === 1 ? "" : "s"} ${mins} min`;
}

function combineWarnings(...warnings: Array<string | null | undefined>): string | null {
  const unique = Array.from(
    new Set(
      warnings
        .map((warning) => warning?.trim())
        .filter((warning): warning is string => Boolean(warning))
    )
  );
  return unique.length > 0 ? unique.join(" ") : null;
}

export function resolveExactCrmScheduleMatch(params: {
  requestedStartTime: string;
  durationMinutes: number;
  windows: ResolvedStaffScheduleWindow[];
  operationalStartOffsetMinutes?: number;
  operationalEndOffsetMinutes?: number;
}): ExactCrmScheduleMatch | null {
  const requestedStartRaw = timeToMinutes(params.requestedStartTime);
  if (!Number.isFinite(requestedStartRaw) || params.durationMinutes <= 0) return null;

  const startOffset = Math.max(0, params.operationalStartOffsetMinutes ?? 0);
  const endOffset = Math.max(0, params.operationalEndOffsetMinutes ?? 0);
  const matches: ExactCrmScheduleMatch[] = [];

  for (const window of params.windows) {
    const range = getScheduleWindowAbsoluteRange(window);
    if (!range) continue;

    for (const serviceStartMinutes of [requestedStartRaw, requestedStartRaw + DAY_MINUTES]) {
      if (serviceStartMinutes < range.start || serviceStartMinutes > range.end) continue;

      const serviceEndMinutes = serviceStartMinutes + params.durationMinutes;
      const operationalStartMinutes = serviceStartMinutes - startOffset;
      const operationalEndMinutes = serviceEndMinutes + endOffset;
      const canonicalServiceEnd = requestedStartRaw + params.durationMinutes;
      const canonicalOperationalStart = requestedStartRaw - startOffset;
      const canonicalOperationalEnd = canonicalServiceEnd + endOffset;

      matches.push({
        window,
        scheduleStartMinutes: range.start,
        scheduleEndMinutes: range.end,
        serviceStartMinutes,
        serviceEndMinutes,
        operationalStartMinutes,
        operationalEndMinutes,
        overtimeMinutes: Math.max(0, serviceEndMinutes - range.end),
        operationalOvertimeMinutes: Math.max(0, operationalEndMinutes - range.end),
        operationalStartsBeforeShift: operationalStartMinutes < range.start,
        serviceCrossesDateBoundary: canonicalServiceEnd >= DAY_MINUTES,
        operationalCrossesDateBoundary:
          canonicalOperationalStart < 0 || canonicalOperationalEnd >= DAY_MINUTES,
      });
    }
  }

  return (
    matches.sort(
      (left, right) =>
        Number(left.serviceCrossesDateBoundary) - Number(right.serviceCrossesDateBoundary) ||
        left.overtimeMinutes - right.overtimeMinutes ||
        left.operationalOvertimeMinutes - right.operationalOvertimeMinutes ||
        left.scheduleEndMinutes - right.scheduleEndMinutes
    )[0] ?? null
  );
}

function bookingOperationalRange(booking: BookingRow): { start: number; end: number } {
  let start = timeToMinutes(booking.start_time);
  let end = timeToMinutes(booking.end_time ?? booking.start_time);
  if (end <= start) end += DAY_MINUTES;

  const travelBuffer =
    booking.delivery_type === "home_service" ? Math.max(0, booking.travel_buffer_mins ?? 0) : 0;

  start -= travelBuffer;
  end += travelBuffer;
  return { start, end };
}

function findOperationalConflict(params: {
  requestedStartMinutes: number;
  requestedEndMinutes: number;
  bookings: BookingRow[];
  now?: Date;
}): OperationalConflict | null {
  const now = params.now ?? new Date();
  const overlapping = params.bookings
    .filter((booking) => bookingBlocksAvailability(booking, now))
    .map(bookingOperationalRange)
    .filter((booking) =>
      rangesOverlap(
        params.requestedStartMinutes,
        params.requestedEndMinutes,
        booking.start,
        booking.end
      )
    )
    .sort((left, right) => left.end - right.end);

  if (overlapping.length === 0) return null;
  const latestEnd = overlapping.reduce(
    (latest, booking) => Math.max(latest, booking.end),
    overlapping[0]!.end
  );
  return { nextAvailableAt: formatMinutesAsClock(latestEnd) };
}

function isSameDayWalkin(params: {
  bookingMode: ExactCrmBookingMode;
  deliveryType: ExactCrmDeliveryType;
  date: string;
}): boolean {
  return (
    params.bookingMode === "walkin" &&
    params.deliveryType !== "home_service" &&
    params.date === getBranchBusinessDate()
  );
}

function reasonForStaff(params: {
  staff: StaffRow;
  branchId: string;
  serviceCapable: boolean;
  scheduleAvailable: boolean;
  overrideBlocked: boolean;
  bookingOverlap: boolean;
  outsideHoursReason: CrmAvailabilityReasonCode | null;
  attendancePreferenceOnly: boolean;
}): CrmAvailabilityReasonCode {
  if (params.staff.is_active === false) return "inactive_staff";
  if (params.staff.branch_id !== params.branchId) return "wrong_branch";
  if (!params.serviceCapable) return "missing_service_capability";
  if (params.outsideHoursReason) return params.outsideHoursReason;
  if (params.overrideBlocked) return "blocked_by_override";
  if (!params.scheduleAvailable) return "no_schedule_for_time";
  if (params.bookingOverlap) return "blocked_by_booking";
  if (params.attendancePreferenceOnly) return "attendance_not_checked_in_preference_only";
  return "eligible";
}

export async function resolveExactCrmBookingTime(params: {
  branchId: string;
  serviceIds: string[];
  date: string;
  startTime: string;
  bookingMode: ExactCrmBookingMode;
  deliveryType: ExactCrmDeliveryType;
  staffId?: string | null;
  travelBufferMins?: number;
  includeDebug?: boolean;
}): Promise<ExactCrmBookingTimeResult> {
  const parsedTime = parseBookingTime(params.startTime);
  if (!parsedTime.ok) {
    throw new Error(parsedTime.error);
  }

  const canonicalTime = parsedTime.value.canonicalTime;
  const admin = createAdminClient();
  const dayOfWeek = getDayOfWeekFromYmd(params.date);
  const rules = await getBranchBookingRulesOrDefault(params.branchId);
  const travelBufferMinutes =
    params.deliveryType === "home_service"
      ? Math.max(0, params.travelBufferMins ?? rules.travelBufferMins)
      : 0;

  const [
    staffResult,
    staffServicesResult,
    serviceDetailsResult,
    branchServiceTimingsResult,
    checkinsResult,
    schedulesResult,
    overridesResult,
    bookingsResult,
  ] = await Promise.all([
    admin
      .from("staff")
      .select(
        "id, full_name, nickname, branch_id, is_active, staff_type, system_role, tier, archived_at, merged_into_staff_id, metadata"
      )
      .order("full_name", { ascending: true }),
    admin.from("staff_services").select("staff_id, service_id").in("service_id", params.serviceIds),
    admin
      .from("services")
      .select("id, name, duration_minutes, buffer_before, buffer_after, service_categories(name)")
      .in("id", params.serviceIds),
    admin
      .from("branch_services")
      .select("service_id, custom_duration_minutes")
      .eq("branch_id", params.branchId)
      .eq("is_active", true)
      .in("service_id", params.serviceIds),
    admin
      .from("staff_shift_checkins")
      .select("staff_id, status, checked_in_at, checked_out_at")
      .eq("branch_id", params.branchId)
      .eq("shift_date", params.date)
      .eq("is_test", false),
    admin
      .from("staff_schedules")
      .select(
        "id, staff_id, shift_type, start_time, end_time, is_active, window_order, ends_next_day"
      )
      .eq("day_of_week", dayOfWeek)
      .eq("is_active", true),
    admin
      .from("schedule_overrides")
      .select("id, staff_id, shift_type, start_time, end_time, is_day_off, ends_next_day")
      .eq("override_date", params.date),
    admin
      .from("bookings")
      .select(
        "staff_id, start_time, end_time, status, hold_expires_at, delivery_type, travel_buffer_mins"
      )
      .eq("branch_id", params.branchId)
      .eq("booking_date", params.date)
      .not("staff_id", "is", null),
  ]);

  const firstError = [
    staffResult.error,
    staffServicesResult.error,
    serviceDetailsResult.error,
    branchServiceTimingsResult.error,
    checkinsResult.error,
    schedulesResult.error,
    overridesResult.error,
    bookingsResult.error,
  ].find(Boolean);
  if (firstError) {
    throw new Error(`Could not load exact CRM availability: ${firstError.message}`);
  }

  const branchStaff = ((staffResult.data ?? []) as StaffRow[]).filter(
    (staff) => staff.branch_id === params.branchId && isOperationalStaff(staff)
  );
  const branchStaffIds = new Set(branchStaff.map((staff) => staff.id));
  const staffServiceRows = (staffServicesResult.data ?? []) as StaffServiceRow[];
  const serviceRows = (serviceDetailsResult.data ?? []) as ServiceTimingRow[];
  const requestedServiceCount = new Set(params.serviceIds).size;

  if (serviceRows.length !== requestedServiceCount) {
    return {
      available: false,
      message: "One or more selected services are unavailable.",
      warning: null,
      reasonCode: "missing_service_capability",
      totalBlockMinutes: 0,
      travelBufferMinutes,
      serviceEndTime: null,
      operationalStartTime: null,
      operationalEndTime: null,
      availableStaffIds: [],
      providers: [],
    };
  }

  const selectedServices = serviceRows.map(
    (service): ScheduledProviderService => ({
      id: service.id,
      name: service.name,
      categoryName: firstCategoryName(service.service_categories),
    })
  );
  const customDurationByServiceId = new Map(
    ((branchServiceTimingsResult.data ?? []) as BranchServiceTimingRow[]).map((row) => [
      row.service_id,
      row.custom_duration_minutes,
    ])
  );
  const totalBlockMinutes = serviceRows.reduce(
    (sum, service) =>
      sum +
      Number(customDurationByServiceId.get(service.id) ?? service.duration_minutes) +
      Number(service.buffer_before) +
      Number(service.buffer_after),
    0
  );
  const canonicalStartMinutes = parsedTime.value.minutesIntoDay;
  const canonicalServiceEndMinutes = canonicalStartMinutes + Math.max(totalBlockMinutes, 1);
  const canonicalOperationalStartMinutes = canonicalStartMinutes - travelBufferMinutes;
  const canonicalOperationalEndMinutes = canonicalServiceEndMinutes + travelBufferMinutes;
  const serviceEndTime = formatCanonicalTime(canonicalServiceEndMinutes);
  const operationalStartTime = formatCanonicalTime(canonicalOperationalStartMinutes);
  const operationalEndTime = formatCanonicalTime(canonicalOperationalEndMinutes);

  const explicitServiceIdsByStaff = new Map<string, Set<string>>();
  for (const row of staffServiceRows) {
    const assigned = explicitServiceIdsByStaff.get(row.staff_id) ?? new Set<string>();
    assigned.add(row.service_id);
    explicitServiceIdsByStaff.set(row.staff_id, assigned);
  }

  const capableStaffIds = new Set(
    branchStaff
      .filter((staff) => {
        const explicitServiceIds = explicitServiceIdsByStaff.get(staff.id) ?? new Set<string>();
        if (!canActAsBookingServiceProvider(staff, explicitServiceIds.size > 0)) return false;
        if (params.deliveryType === "home_service") {
          return params.serviceIds.every((serviceId) => explicitServiceIds.has(serviceId));
        }
        return canScheduledProviderPerformServices({
          staffType: staff.staff_type,
          explicitlyAssignedServiceIds: explicitServiceIds,
          selectedServices,
        });
      })
      .map((staff) => staff.id)
  );

  const selectedScopeHasServiceCapability = params.staffId
    ? capableStaffIds.has(params.staffId)
    : capableStaffIds.size > 0;
  const outsideHoursReason: CrmAvailabilityReasonCode | null = isBookingTimeAllowedByRules({
    bookingType: params.deliveryType === "home_service" ? "home_service" : "walkin",
    startTime: canonicalTime,
    rules,
  })
    ? null
    : params.deliveryType === "home_service"
      ? "outside_home_service_hours"
      : "outside_in_spa_hours";
  const pastTime = isPastSlot({
    selectedDate: params.date,
    slotStartTime: canonicalTime,
    timezone: BRANCH_TIMEZONE,
  });

  const scheduleRowsByStaff = new Map<string, IndividualScheduleSourceRow[]>();
  for (const row of (schedulesResult.data ?? []) as StaffScheduleRow[]) {
    if (!branchStaffIds.has(row.staff_id)) continue;
    const rows = scheduleRowsByStaff.get(row.staff_id) ?? [];
    rows.push({
      id: row.id,
      shift_type: row.shift_type,
      start_time: row.start_time,
      end_time: row.end_time,
      is_active: row.is_active,
      window_order: row.window_order,
      ends_next_day: row.ends_next_day,
    });
    scheduleRowsByStaff.set(row.staff_id, rows);
  }

  const overridesByStaff = new Map<string, ScheduleOverrideSourceRow>();
  for (const row of (overridesResult.data ?? []) as OverrideRow[]) {
    if (!branchStaffIds.has(row.staff_id)) continue;
    overridesByStaff.set(row.staff_id, {
      id: row.id,
      shift_type: row.shift_type,
      start_time: row.start_time,
      end_time: row.end_time,
      is_day_off: row.is_day_off,
      ends_next_day: row.ends_next_day,
    });
  }

  const checkinsByStaff = new Map<string, CheckinRow[]>();
  for (const row of (checkinsResult.data ?? []) as CheckinRow[]) {
    const rows = checkinsByStaff.get(row.staff_id) ?? [];
    rows.push(row);
    checkinsByStaff.set(row.staff_id, rows);
  }

  const bookingsByStaff = new Map<string, BookingRow[]>();
  for (const booking of (bookingsResult.data ?? []) as BookingRow[]) {
    if (!booking.staff_id) continue;
    const rows = bookingsByStaff.get(booking.staff_id) ?? [];
    rows.push(booking);
    bookingsByStaff.set(booking.staff_id, rows);
  }

  const sameDayWalkin = isSameDayWalkin(params);
  const tierOrder: Record<string, number> = { senior: 0, mid: 1, junior: 2 };
  const providers = branchStaff
    .filter((staff) => capableStaffIds.has(staff.id))
    .map<ExactCrmProviderAvailability>((staff) => {
      const resolvedSchedule = resolveScheduleForStaffDay({
        override: overridesByStaff.get(staff.id) ?? null,
        individualRows: scheduleRowsByStaff.get(staff.id) ?? [],
        staff,
      });
      const scheduledForDay = resolvedSchedule.isWorking;
      const scheduleMatch = scheduledForDay
        ? resolveExactCrmScheduleMatch({
            requestedStartTime: canonicalTime,
            durationMinutes: Math.max(totalBlockMinutes, 1),
            windows: resolvedSchedule.windows,
            operationalStartOffsetMinutes: travelBufferMinutes,
            operationalEndOffsetMinutes: travelBufferMinutes,
          })
        : null;
      const scheduledAtTime = scheduleMatch !== null;
      const overrideBlocked = resolvedSchedule.isDayOff || resolvedSchedule.status === "conflict";
      const conflict = scheduleMatch
        ? findOperationalConflict({
            requestedStartMinutes: scheduleMatch.operationalStartMinutes,
            requestedEndMinutes: scheduleMatch.operationalEndMinutes,
            bookings: bookingsByStaff.get(staff.id) ?? [],
          })
        : null;
      const dateBoundaryUnsupported = Boolean(
        scheduleMatch?.serviceCrossesDateBoundary || scheduleMatch?.operationalCrossesDateBoundary
      );
      const staffCheckins = checkinsByStaff.get(staff.id) ?? [];
      const checkedIn = staffCheckins.some(
        (row) => row.status === "checked_in" && !row.checked_out_at
      );
      const checkedOut = !checkedIn && staffCheckins.some((row) => Boolean(row.checked_out_at));
      const availableAtTime =
        !outsideHoursReason &&
        !pastTime &&
        !overrideBlocked &&
        scheduledAtTime &&
        !dateBoundaryUnsupported &&
        conflict === null;
      const selectable = availableAtTime;

      let reasonCode: ExactCrmProviderReasonCode;
      let statusLabel: string;
      let warning: string | null = null;

      if (outsideHoursReason) {
        reasonCode = "outside_booking_hours";
        statusLabel = "Outside branch booking hours";
      } else if (pastTime) {
        reasonCode = "past_time";
        statusLabel = "The selected time has already passed";
      } else if (overrideBlocked) {
        reasonCode = "blocked_by_override";
        statusLabel = resolvedSchedule.isDayOff
          ? "Not scheduled today"
          : "Unavailable due to schedule adjustment";
      } else if (!scheduledAtTime) {
        reasonCode = "not_scheduled_at_start";
        statusLabel = `Not scheduled at ${parsedTime.value.displayTime}`;
      } else if (dateBoundaryUnsupported) {
        reasonCode = "date_boundary_unsupported";
        statusLabel = "Booking or Home Service travel crosses midnight";
      } else if (conflict) {
        reasonCode = "booking_conflict";
        statusLabel = `Busy until ${conflict.nextAvailableAt}`;
      } else {
        const overtimeWarning =
          scheduleMatch && scheduleMatch.overtimeMinutes > 0
            ? `Service may finish ${formatDurationCompact(scheduleMatch.overtimeMinutes)} after shift. This is allowed because the booking starts during scheduled time.`
            : null;
        const travelBeforeWarning =
          params.deliveryType === "home_service" && scheduleMatch?.operationalStartsBeforeShift
            ? `The appointment starts during the shift, but travel begins ${formatDurationCompact(scheduleMatch.scheduleStartMinutes - scheduleMatch.operationalStartMinutes)} before shift. CRM confirmation is required.`
            : null;
        const travelAfterWarning =
          params.deliveryType === "home_service" &&
          scheduleMatch &&
          scheduleMatch.operationalOvertimeMinutes > scheduleMatch.overtimeMinutes
            ? `Home Service return and wrap-up may finish ${formatDurationCompact(scheduleMatch.operationalOvertimeMinutes)} after shift.`
            : null;
        warning = combineWarnings(overtimeWarning, travelBeforeWarning, travelAfterWarning);

        if (sameDayWalkin && checkedIn) {
          reasonCode = "checked_in_available";
          statusLabel = scheduleMatch?.overtimeMinutes
            ? `Checked in · Exact time available · ${formatDurationCompact(scheduleMatch.overtimeMinutes)} overtime`
            : "Checked in · Exact time available";
        } else if (sameDayWalkin && checkedOut) {
          reasonCode = "scheduled_available_checked_out";
          statusLabel = scheduleMatch?.overtimeMinutes
            ? `Scheduled · Checked out · ${formatDurationCompact(scheduleMatch.overtimeMinutes)} overtime`
            : "Scheduled · Checked out · Exact time available";
          warning = combineWarnings(
            warning,
            "This staff member has checked out. Confirm that they are present and ready before continuing."
          );
        } else {
          reasonCode = "scheduled_available_not_checked_in";
          statusLabel = scheduleMatch?.overtimeMinutes
            ? `Exact time available · Ends ${formatDurationCompact(scheduleMatch.overtimeMinutes)} after shift`
            : "Exact time available";
          if (sameDayWalkin && !checkedIn) {
            warning = combineWarnings(
              warning,
              "Scheduled today, but not checked in yet. You may continue after confirming that the staff member is present and ready."
            );
          }
        }
      }

      return {
        staffId: staff.id,
        fullName: staff.full_name,
        nickname: staff.nickname,
        checkedIn,
        checkedOut,
        scheduledForDay,
        scheduledAtTime,
        availableAtTime,
        selectable,
        recommended: sameDayWalkin && checkedIn && selectable,
        scheduleStartTime: scheduleMatch?.window.startTime ?? null,
        scheduleEndTime: scheduleMatch?.window.endTime ?? null,
        serviceEndTime: scheduleMatch ? formatCanonicalTime(scheduleMatch.serviceEndMinutes) : null,
        operationalStartTime: scheduleMatch
          ? formatCanonicalTime(scheduleMatch.operationalStartMinutes)
          : null,
        operationalEndTime: scheduleMatch
          ? formatCanonicalTime(scheduleMatch.operationalEndMinutes)
          : null,
        overtimeMinutes: scheduleMatch?.overtimeMinutes ?? 0,
        operationalOvertimeMinutes: scheduleMatch?.operationalOvertimeMinutes ?? 0,
        operationalStartsBeforeShift: scheduleMatch?.operationalStartsBeforeShift ?? false,
        nextAvailableAt: conflict?.nextAvailableAt ?? null,
        reasonCode,
        statusLabel,
        warning,
      };
    })
    .sort((left, right) => {
      const leftStaff = branchStaff.find((staff) => staff.id === left.staffId);
      const rightStaff = branchStaff.find((staff) => staff.id === right.staffId);
      const leftRank = left.recommended ? 0 : left.selectable ? 1 : 2;
      const rightRank = right.recommended ? 0 : right.selectable ? 1 : 2;
      return (
        leftRank - rightRank ||
        Number(left.overtimeMinutes > 0) - Number(right.overtimeMinutes > 0) ||
        left.overtimeMinutes - right.overtimeMinutes ||
        Number(left.operationalStartsBeforeShift) - Number(right.operationalStartsBeforeShift) ||
        left.operationalOvertimeMinutes - right.operationalOvertimeMinutes ||
        (tierOrder[leftStaff?.tier ?? ""] ?? 9) - (tierOrder[rightStaff?.tier ?? ""] ?? 9) ||
        left.fullName.localeCompare(right.fullName)
      );
    });

  const scopedProviders = params.staffId
    ? providers.filter((provider) => provider.staffId === params.staffId)
    : providers;
  const availableProviders = scopedProviders.filter((provider) => provider.selectable);
  const available = availableProviders.length > 0;
  const topProvider = availableProviders[0] ?? null;
  const warning = combineWarnings(
    available && sameDayWalkin && availableProviders.every((provider) => !provider.checkedIn)
      ? NO_CHECKED_IN_STAFF_WARNING
      : null,
    topProvider?.warning
  );

  const reasonCode: ExactCrmBookingTimeResult["reasonCode"] = available
    ? null
    : !selectedScopeHasServiceCapability
      ? "missing_service_capability"
      : outsideHoursReason
        ? outsideHoursReason
        : pastTime
          ? "past_time"
          : scopedProviders.some((provider) => provider.reasonCode === "date_boundary_unsupported")
            ? "date_boundary_unsupported"
            : scopedProviders.length === 0 ||
                scopedProviders.every((provider) => !provider.scheduledAtTime)
              ? "no_schedule_for_time"
              : "blocked_by_booking";
  const message = available
    ? null
    : reasonCode === "missing_service_capability"
      ? CRM_AVAILABILITY_MESSAGES.noServiceCapability
      : reasonCode === "outside_home_service_hours"
        ? CRM_AVAILABILITY_MESSAGES.outsideHomeServiceHours
        : reasonCode === "outside_in_spa_hours"
          ? CRM_AVAILABILITY_MESSAGES.outsideInSpaHours
          : reasonCode === "past_time"
            ? "The selected time has already passed. Choose a future time."
            : reasonCode === "date_boundary_unsupported"
              ? "This booking or Home Service travel crosses midnight. Choose an earlier time until date-aware overnight booking is enabled."
              : reasonCode === "no_schedule_for_time"
                ? "No qualified therapist is scheduled at the requested start time."
                : "All qualified therapists conflict with another booking or operational block at this exact time.";

  const rejectedTherapists: CrmRejectedTherapistReason[] | undefined = params.includeDebug
    ? branchStaff.map((staff) => {
        const provider = providers.find((candidate) => candidate.staffId === staff.id);
        const serviceCapable = capableStaffIds.has(staff.id);
        const scheduleAvailable = provider?.scheduledAtTime ?? false;
        const overrideBlocked = provider?.reasonCode === "blocked_by_override";
        const bookingOverlap = provider?.reasonCode === "booking_conflict";
        const attendancePreferenceOnly =
          Boolean(provider?.selectable) && sameDayWalkin && !provider?.checkedIn;

        return {
          staff_id: staff.id,
          full_name: staff.full_name,
          active: staff.is_active !== false,
          branch_match: staff.branch_id === params.branchId,
          service_capability: serviceCapable,
          schedule_available: scheduleAvailable,
          override_blocked: overrideBlocked,
          booking_overlap: bookingOverlap,
          attendance_ignored_or_preferred: attendancePreferenceOnly,
          reason_code: reasonForStaff({
            staff,
            branchId: params.branchId,
            serviceCapable,
            scheduleAvailable,
            overrideBlocked,
            bookingOverlap,
            outsideHoursReason,
            attendancePreferenceOnly,
          }),
        };
      })
    : undefined;

  return {
    available,
    message,
    warning,
    reasonCode,
    totalBlockMinutes,
    travelBufferMinutes,
    serviceEndTime,
    operationalStartTime,
    operationalEndTime,
    availableStaffIds: availableProviders.map((provider) => provider.staffId),
    providers,
    rejectedTherapists,
  };
}
