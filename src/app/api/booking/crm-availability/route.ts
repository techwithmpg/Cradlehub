import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canonicalizeSystemRole } from "@/constants/staff";
import { canAccessCrmWorkspace } from "@/lib/auth/crm-permissions";
import { bookingBlocksAvailability } from "@/lib/bookings/hold-status";
import { isBookingTimeAllowedByRules, getBranchBookingRulesOrDefault } from "@/lib/queries/branch-booking-rules";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import {
  CRM_AVAILABILITY_MESSAGES,
  getAvailableSlotsMulti,
  type CrmAvailabilityReasonCode,
  type CrmRejectedTherapistReason,
} from "@/lib/engine/availability";
import { getBranchBusinessDate, rangesOverlap, timeToMinutes } from "@/lib/engine/slot-time";
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
};

type OverrideRow = {
  staff_id: string;
  is_day_off: boolean | null;
};

type BookingRow = {
  staff_id: string | null;
  start_time: string;
  end_time: string | null;
  status: string | null;
  hold_expires_at: string | null;
};

function timePrefix(time: string): string {
  return time.slice(0, 5);
}

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

function hasAllServiceAssignments(
  staffId: string,
  serviceIds: string[],
  rows: StaffServiceRow[]
): boolean {
  return serviceIds.every((serviceId) =>
    rows.some((row) => row.staff_id === staffId && row.service_id === serviceId)
  );
}

function hasBookingOverlap(params: {
  staffId: string;
  startTime: string;
  bookings: BookingRow[];
}): boolean {
  const start = timeToMinutes(params.startTime);
  const end = start + 1;
  const now = new Date();

  return params.bookings.some((booking) => {
    if (booking.staff_id !== params.staffId) return false;
    if (!bookingBlocksAvailability(booking, now)) return false;
    return rangesOverlap(
      start,
      end,
      timeToMinutes(booking.start_time),
      timeToMinutes(booking.end_time ?? booking.start_time)
    );
  });
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

  const admin = createAdminClient();
  const [rules, slots, staffResult, servicesResult, checkinsResult, overridesResult, bookingsResult] =
    await Promise.all([
      getBranchBookingRulesOrDefault(parsed.data.branchId),
      getAvailableSlotsMulti({
        branchId: parsed.data.branchId,
        serviceIds: parsed.data.serviceIds,
        date: parsed.data.date,
        requireStaffServiceAssignment: true,
      }),
      admin
        .from("staff")
        .select("id, full_name, branch_id, is_active, staff_type, system_role")
        .order("full_name", { ascending: true }),
      admin
        .from("staff_services")
        .select("staff_id, service_id")
        .in("service_id", parsed.data.serviceIds),
      admin
        .from("staff_shift_checkins")
        .select("staff_id")
        .eq("branch_id", parsed.data.branchId)
        .eq("shift_date", parsed.data.date)
        .eq("status", "checked_in")
        .eq("is_test", false)
        .is("checked_out_at", null),
      admin
        .from("schedule_overrides")
        .select("staff_id, is_day_off")
        .eq("override_date", parsed.data.date),
      admin
        .from("bookings")
        .select("staff_id, start_time, end_time, status, hold_expires_at")
        .eq("branch_id", parsed.data.branchId)
        .eq("booking_date", parsed.data.date)
        .not("staff_id", "is", null),
    ]);

  if (staffResult.error || servicesResult.error || checkinsResult.error || overridesResult.error || bookingsResult.error) {
    return NextResponse.json(
      { error: "Could not load CRM availability details." },
      { status: 500 }
    );
  }

  const branchStaff = ((staffResult.data ?? []) as StaffDiagnosticRow[]).filter(
    (staff) => staff.branch_id === parsed.data.branchId && staff.is_active !== false
  );
  const serviceRows = (servicesResult.data ?? []) as StaffServiceRow[];
  const capableStaffIds = new Set(
    branchStaff
      .filter((staff) =>
        canActAsBookingServiceProvider(
          staff,
          hasAllServiceAssignments(staff.id, parsed.data.serviceIds, serviceRows)
        )
      )
      .filter((staff) => hasAllServiceAssignments(staff.id, parsed.data.serviceIds, serviceRows))
      .map((staff) => staff.id)
  );
  const hasServiceCapability = capableStaffIds.size > 0;

  const normalizedTime = timePrefix(parsed.data.time);
  const slotsAtTime = slots.filter((slot) => slot.slot_time.startsWith(normalizedTime));
  const scopedSlotsAtTime = parsed.data.staffId
    ? slotsAtTime.filter((slot) => slot.staff_id === parsed.data.staffId)
    : slotsAtTime;
  const availableSlotsAtTime = scopedSlotsAtTime.filter((slot) => slot.available);
  const available = availableSlotsAtTime.length > 0;

  const outsideHoursReason: CrmAvailabilityReasonCode | null =
    isBookingTimeAllowedByRules({
      bookingType: parsed.data.deliveryType === "home_service" ? "home_service" : "walkin",
      startTime: parsed.data.time,
      rules,
    })
      ? null
      : parsed.data.deliveryType === "home_service"
        ? "outside_home_service_hours"
        : "outside_in_spa_hours";

  const checkedInStaffIds = new Set(
    ((checkinsResult.data ?? []) as CheckinRow[]).map((row) => row.staff_id)
  );
  const sameDayWalkin = isSameDayWalkin(parsed.data);
  const warning =
    available &&
    sameDayWalkin &&
    availableSlotsAtTime.every((slot) => !checkedInStaffIds.has(slot.staff_id))
      ? CRM_AVAILABILITY_MESSAGES.noClockInWarning
      : null;

  const reasonCode: CrmAvailabilityReasonCode | null = available
    ? null
    : !hasServiceCapability
      ? "missing_service_capability"
      : outsideHoursReason
        ? outsideHoursReason
        : slotsAtTime.length === 0
          ? "no_schedule_for_time"
          : "blocked_by_booking";
  const message = available
    ? null
    : reasonCode === "missing_service_capability"
      ? CRM_AVAILABILITY_MESSAGES.noServiceCapability
      : reasonCode === "no_schedule_for_time" ||
          reasonCode === "outside_home_service_hours" ||
          reasonCode === "outside_in_spa_hours"
        ? CRM_AVAILABILITY_MESSAGES.noSchedule
        : CRM_AVAILABILITY_MESSAGES.noScheduledTherapist;

  const canSeeDebug =
    process.env.NODE_ENV !== "production" ||
    ["owner", "manager", "assistant_manager", "store_manager"].includes(access.role);
  const debugRequested = Boolean(parsed.data.includeDebug && canSeeDebug);
  const overrides = (overridesResult.data ?? []) as OverrideRow[];
  const bookings = (bookingsResult.data ?? []) as BookingRow[];
  const rejectedTherapists: CrmRejectedTherapistReason[] | undefined = debugRequested
    ? ((staffResult.data ?? []) as StaffDiagnosticRow[]).map((staff) => {
        const serviceCapable =
          staff.branch_id === parsed.data.branchId &&
          hasAllServiceAssignments(staff.id, parsed.data.serviceIds, serviceRows) &&
          canActAsBookingServiceProvider(staff, true);
        const staffSlots = slotsAtTime.filter((slot) => slot.staff_id === staff.id);
        const scheduleAvailable = staffSlots.length > 0;
        const overrideBlocked = overrides.some(
          (override) => override.staff_id === staff.id && override.is_day_off === true
        );
        const bookingOverlap = hasBookingOverlap({
          staffId: staff.id,
          startTime: parsed.data.time,
          bookings,
        }) || staffSlots.some((slot) => !slot.available);
        const attendancePreferenceOnly =
          sameDayWalkin &&
          scheduleAvailable &&
          !checkedInStaffIds.has(staff.id);

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
    availableStaffIds: availableSlotsAtTime.map((slot) => slot.staff_id),
    rejectedTherapists,
  });
}
