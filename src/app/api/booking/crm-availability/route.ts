import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canonicalizeSystemRole } from "@/constants/staff";
import { canAccessCrmWorkspace } from "@/lib/auth/crm-permissions";
import {
  canScheduledProviderPerformServices,
  findScheduledProviderConflict,
  type ScheduledProviderService,
} from "@/lib/bookings/scheduled-provider-roster";
import { parseBookingTime } from "@/lib/bookings/booking-clock-time";
import {
  isBookingTimeAllowedByRules,
  getBranchBookingRulesOrDefault,
} from "@/lib/queries/branch-booking-rules";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import {
  CRM_AVAILABILITY_MESSAGES,
  getAvailableSlotsMulti,
  type CrmAvailabilityReasonCode,
  type CrmRejectedTherapistReason,
} from "@/lib/engine/availability";
import { getBranchBusinessDate, getDayOfWeekFromYmd } from "@/lib/engine/slot-time";
import {
  doesDurationFitWithinScheduleWindows,
  resolveScheduleForStaffDay,
  type IndividualScheduleSourceRow,
  type ScheduleOverrideSourceRow,
} from "@/lib/schedule/resolve-staff-schedule";
import { canActAsBookingServiceProvider } from "@/lib/staff/service-providers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const crmAvailabilitySchema = z.object({
  branchId: z.guid("Invalid branch ID"),
  serviceIds: z.array(z.guid("Invalid service ID")).min(1).max(5),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  staffId: z.guid("Invalid staff ID").optional(),
  bookingMode: z.enum(["walkin", "phone", "home_service", "standard_future"]),
  deliveryType: z.enum(["in_spa", "home_service"]),
  includeDebug: z.boolean().optional(),
});

type StaffDiagnosticRow = {
  id: string;
  full_name: string;
  nickname: string | null;
  branch_id: string | null;
  is_active: boolean | null;
  staff_type: string | null;
  system_role: string | null;
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

type ServiceTimingRow = {
  id: string;
  name: string;
  duration_minutes: number;
  buffer_before: number;
  buffer_after: number;
  service_categories: { name: string | null } | { name: string | null }[] | null;
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
};

type CrmProviderAvailability = {
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
  nextAvailableAt: string | null;
  reasonCode:
    | "checked_in_available"
    | "scheduled_available_not_checked_in"
    | "scheduled_available_checked_out"
    | "booking_conflict"
    | "blocked_by_override"
    | "service_exceeds_shift"
    | "outside_booking_hours";
  statusLabel: string;
  warning: string | null;
};

function isSameDayWalkin(params: {
  bookingMode: string;
  deliveryType: string;
  date: string;
}): boolean {
  return (
    params.bookingMode === "walkin" &&
    params.deliveryType !== "home_service" &&
    params.date === getBranchBusinessDate()
  );
}

function firstCategoryName(value: ServiceTimingRow["service_categories"]): string | null {
  if (!value) return null;
  const category = Array.isArray(value) ? value[0] : value;
  return category?.name ?? null;
}

function reasonForStaff(params: {
  staff: StaffDiagnosticRow;
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

async function assertCrmAccess(branchId: string) {
  if (isDevAuthBypassEnabled()) return { ok: true as const, role: "owner" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, status: 401, error: "Please sign in and try again." };
  }

  const { data: staff } = await supabase
    .from("staff")
    .select("branch_id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  const role = canonicalizeSystemRole(staff?.system_role ?? "");
  if (!staff || !canAccessCrmWorkspace(role)) {
    return {
      ok: false as const,
      status: 403,
      error: "You do not have permission to check CRM availability.",
    };
  }

  if (role !== "owner" && staff.branch_id !== branchId) {
    return {
      ok: false as const,
      status: 403,
      error: "You can only check availability for your assigned branch.",
    };
  }

  return { ok: true as const, role };
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = crmAvailabilitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid availability request.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const access = await assertCrmAccess(parsed.data.branchId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const parsedTime = parseBookingTime(parsed.data.time);
  if (!parsedTime.ok) {
    return NextResponse.json(
      { error: parsedTime.error, reasonCode: "invalid_time" },
      { status: 400 }
    );
  }
  const canonicalTime = parsedTime.value.canonicalTime;

  const admin = createAdminClient();
  const dayOfWeek = getDayOfWeekFromYmd(parsed.data.date);
  const [
    rules,
    slots,
    staffResult,
    staffServicesResult,
    serviceDetailsResult,
    branchServiceTimingsResult,
    checkinsResult,
    schedulesResult,
    overridesResult,
    bookingsResult,
  ] = await Promise.all([
    getBranchBookingRulesOrDefault(parsed.data.branchId),
    getAvailableSlotsMulti({
      branchId: parsed.data.branchId,
      serviceIds: parsed.data.serviceIds,
      date: parsed.data.date,
      requireStaffServiceAssignment: parsed.data.deliveryType === "home_service",
      allowStaffTypeFallbackAlongsideAssignments: parsed.data.deliveryType !== "home_service",
    }),
    admin
      .from("staff")
      .select("id, full_name, nickname, branch_id, is_active, staff_type, system_role")
      .order("full_name", { ascending: true }),
    admin
      .from("staff_services")
      .select("staff_id, service_id")
      .in("service_id", parsed.data.serviceIds),
    admin
      .from("services")
      .select("id, name, duration_minutes, buffer_before, buffer_after, service_categories(name)")
      .in("id", parsed.data.serviceIds),
    admin
      .from("branch_services")
      .select("service_id, custom_duration_minutes")
      .eq("branch_id", parsed.data.branchId)
      .in("service_id", parsed.data.serviceIds),
    admin
      .from("staff_shift_checkins")
      .select("staff_id, status, checked_in_at, checked_out_at")
      .eq("branch_id", parsed.data.branchId)
      .eq("shift_date", parsed.data.date)
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
      .eq("override_date", parsed.data.date),
    admin
      .from("bookings")
      .select("staff_id, start_time, end_time, status, hold_expires_at")
      .eq("branch_id", parsed.data.branchId)
      .eq("booking_date", parsed.data.date)
      .not("staff_id", "is", null),
  ]);

  if (
    staffResult.error ||
    staffServicesResult.error ||
    serviceDetailsResult.error ||
    branchServiceTimingsResult.error ||
    checkinsResult.error ||
    schedulesResult.error ||
    overridesResult.error ||
    bookingsResult.error
  ) {
    return NextResponse.json(
      { error: "Could not load CRM availability details." },
      { status: 500 }
    );
  }

  const branchStaff = ((staffResult.data ?? []) as StaffDiagnosticRow[]).filter(
    (staff) => staff.branch_id === parsed.data.branchId && staff.is_active !== false
  );
  const branchStaffIds = new Set(branchStaff.map((staff) => staff.id));
  const staffServiceRows = (staffServicesResult.data ?? []) as StaffServiceRow[];
  const selectedServices = ((serviceDetailsResult.data ?? []) as ServiceTimingRow[]).map(
    (service): ScheduledProviderService => ({
      id: service.id,
      name: service.name,
      categoryName: firstCategoryName(service.service_categories),
    })
  );
  if (selectedServices.length !== new Set(parsed.data.serviceIds).size) {
    return NextResponse.json(
      { error: "One or more selected services are unavailable." },
      { status: 400 }
    );
  }
  const customDurationByServiceId = new Map(
    ((branchServiceTimingsResult.data ?? []) as BranchServiceTimingRow[]).map((row) => [
      row.service_id,
      row.custom_duration_minutes,
    ])
  );
  const totalBlockMinutes = ((serviceDetailsResult.data ?? []) as ServiceTimingRow[]).reduce(
    (sum, service) =>
      sum +
      Number(customDurationByServiceId.get(service.id) ?? service.duration_minutes) +
      Number(service.buffer_before) +
      Number(service.buffer_after),
    0
  );

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
        if (parsed.data.deliveryType === "home_service") {
          return parsed.data.serviceIds.every((serviceId) => explicitServiceIds.has(serviceId));
        }
        return canScheduledProviderPerformServices({
          staffType: staff.staff_type,
          explicitlyAssignedServiceIds: explicitServiceIds,
          selectedServices,
        });
      })
      .map((staff) => staff.id)
  );
  const hasServiceCapability = capableStaffIds.size > 0;
  const selectedScopeHasServiceCapability = parsed.data.staffId
    ? capableStaffIds.has(parsed.data.staffId)
    : hasServiceCapability;

  const outsideHoursReason: CrmAvailabilityReasonCode | null = isBookingTimeAllowedByRules({
    bookingType: parsed.data.deliveryType === "home_service" ? "home_service" : "walkin",
    startTime: canonicalTime,
    rules,
  })
    ? null
    : parsed.data.deliveryType === "home_service"
      ? "outside_home_service_hours"
      : "outside_in_spa_hours";

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

  const sameDayWalkin = isSameDayWalkin(parsed.data);
  const providers = branchStaff
    .filter((staff) => capableStaffIds.has(staff.id))
    .flatMap<CrmProviderAvailability>((staff) => {
      const resolvedSchedule = resolveScheduleForStaffDay({
        override: overridesByStaff.get(staff.id) ?? null,
        individualRows: scheduleRowsByStaff.get(staff.id) ?? [],
        staff,
      });
      const scheduledForDay = resolvedSchedule.isWorking;
      if (!scheduledForDay) return [];

      const scheduledAtTime = doesDurationFitWithinScheduleWindows({
        slotStartTime: canonicalTime,
        durationMinutes: Math.max(totalBlockMinutes, 1),
        windows: resolvedSchedule.windows,
      });
      const staffCheckins = checkinsByStaff.get(staff.id) ?? [];
      const checkedIn = staffCheckins.some(
        (row) => row.status === "checked_in" && !row.checked_out_at
      );
      const checkedOut = !checkedIn && staffCheckins.some((row) => Boolean(row.checked_out_at));
      const conflict = findScheduledProviderConflict({
        requestedStartTime: canonicalTime,
        requestedDurationMinutes: Math.max(totalBlockMinutes, 1),
        bookings: bookingsByStaff.get(staff.id) ?? [],
      });
      const overrideBlocked = resolvedSchedule.isDayOff || resolvedSchedule.status === "conflict";
      const availableAtTime =
        !outsideHoursReason && !overrideBlocked && scheduledAtTime && conflict === null;
      const selectable = availableAtTime;

      let providerReason: CrmProviderAvailability["reasonCode"];
      let statusLabel: string;
      let providerWarning: string | null = null;

      if (outsideHoursReason) {
        providerReason = "outside_booking_hours";
        statusLabel = "Outside branch booking hours";
      } else if (overrideBlocked) {
        providerReason = "blocked_by_override";
        statusLabel = "Unavailable due to schedule adjustment";
      } else if (!scheduledAtTime) {
        providerReason = "service_exceeds_shift";
        statusLabel = `Scheduled today, but the full service does not fit at ${parsedTime.value.displayTime}`;
      } else if (conflict) {
        providerReason = "booking_conflict";
        statusLabel = `Busy until ${conflict.nextAvailableAt}`;
      } else if (sameDayWalkin && checkedIn) {
        providerReason = "checked_in_available";
        statusLabel = "Checked in · Available now";
      } else if (sameDayWalkin && checkedOut) {
        providerReason = "scheduled_available_checked_out";
        statusLabel = "Scheduled · Checked out · Available";
        providerWarning =
          "This staff member has checked out. Confirm that they are present and ready before continuing.";
      } else {
        providerReason = "scheduled_available_not_checked_in";
        statusLabel = sameDayWalkin
          ? "Scheduled today · Not checked in · Available"
          : "Scheduled · Available";
        providerWarning = sameDayWalkin
          ? "Scheduled today, but not checked in yet. You may continue, but confirm that the staff member is present and ready."
          : null;
      }

      const provider: CrmProviderAvailability = {
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
        scheduleStartTime: resolvedSchedule.windows[0]?.startTime ?? null,
        scheduleEndTime: resolvedSchedule.windows.at(-1)?.endTime ?? null,
        nextAvailableAt: conflict?.nextAvailableAt ?? null,
        reasonCode: providerReason,
        statusLabel,
        warning: providerWarning,
      };

      return [provider];
    })
    .sort((left, right) => {
      const leftRank = left.recommended ? 0 : left.selectable ? 1 : 2;
      const rightRank = right.recommended ? 0 : right.selectable ? 1 : 2;
      return leftRank - rightRank || left.fullName.localeCompare(right.fullName);
    });

  const scopedProviders = parsed.data.staffId
    ? providers.filter((provider) => provider.staffId === parsed.data.staffId)
    : providers;
  const availableProviders = scopedProviders.filter((provider) => provider.selectable);
  const available = availableProviders.length > 0;
  const warning =
    available && sameDayWalkin && availableProviders.every((provider) => !provider.checkedIn)
      ? CRM_AVAILABILITY_MESSAGES.noClockInWarning
      : null;

  const reasonCode: CrmAvailabilityReasonCode | null = available
    ? null
    : !selectedScopeHasServiceCapability
      ? "missing_service_capability"
      : outsideHoursReason
        ? outsideHoursReason
        : scopedProviders.length === 0
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
          : reasonCode === "no_schedule_for_time"
            ? CRM_AVAILABILITY_MESSAGES.noSchedule
            : CRM_AVAILABILITY_MESSAGES.noScheduledTherapist;

  const canSeeDebug =
    process.env.NODE_ENV !== "production" ||
    ["owner", "manager", "assistant_manager", "store_manager"].includes(access.role);
  const debugRequested = Boolean(parsed.data.includeDebug && canSeeDebug);
  const rejectedTherapists: CrmRejectedTherapistReason[] | undefined = debugRequested
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
          branch_match: staff.branch_id === parsed.data.branchId,
          service_capability: serviceCapable,
          schedule_available: scheduleAvailable,
          override_blocked: overrideBlocked,
          booking_overlap: bookingOverlap,
          attendance_ignored_or_preferred: attendancePreferenceOnly,
          reason_code: reasonForStaff({
            staff,
            branchId: parsed.data.branchId,
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

  return NextResponse.json({
    available,
    message,
    warning,
    reasonCode,
    slots,
    availableStaffIds: availableProviders.map((provider) => provider.staffId),
    providers,
    rejectedTherapists,
  });
}
