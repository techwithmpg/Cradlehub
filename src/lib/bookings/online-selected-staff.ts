import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getDayOfWeekFromYmd } from "@/lib/engine/slot-time";
import {
  assessSelectedStaffHardEligibility,
  assessSelectedStaffPreference,
} from "@/lib/bookings/selected-staff-preference";
import type { StaffScheduleExceptionReasonCode } from "@/lib/bookings/staff-schedule-exception";
import { resolveScheduleForStaffDay } from "@/lib/schedule/resolve-staff-schedule";
import { canActAsBookingServiceProvider } from "@/lib/staff/service-providers";
import { isOperationalStaff } from "@/lib/staff/operational-staff";
import { logError } from "@/lib/logger";

type OnlineSelectedStaffResult =
  | {
      ok: false;
      code:
        | "STAFF_PREFERENCE_INVALID"
        | "STAFF_PREFERENCE_CHECK_FAILED";
      message: string;
    }
  | {
      ok: true;
      staffId: string;
      staffName: string;
      exceptionReason: StaffScheduleExceptionReasonCode | null;
    };

function recordMetadata(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export async function evaluateOnlineSelectedStaff(params: {
  branchId: string;
  serviceIds: string[];
  staffId: string;
  date: string;
  startTime: string;
  endTime: string;
}): Promise<OnlineSelectedStaffResult> {
  const admin = createAdminClient();
  const [staffResult, qualificationsResult] = await Promise.all([
    admin
      .from("staff")
      .select(
        "id, branch_id, full_name, is_active, archived_at, merged_into_staff_id, metadata, staff_type, system_role"
      )
      .eq("id", params.staffId)
      .maybeSingle(),
    admin
      .from("staff_services")
      .select("service_id")
      .eq("staff_id", params.staffId)
      .in("service_id", params.serviceIds),
  ]);

  if (staffResult.error || qualificationsResult.error) {
    logError("booking.online.staff_hard_eligibility_failed", {
      branchId: params.branchId,
      staffId: params.staffId,
      staffError: staffResult.error,
      qualificationError: qualificationsResult.error,
    });
    return {
      ok: false,
      code: "STAFF_PREFERENCE_INVALID",
      message:
        "That staff preference is unavailable. Please choose another provider or Any available staff.",
    };
  }

  const staff = staffResult.data;
  const qualifiedServiceIds = (qualificationsResult.data ?? []).map(
    (row) => row.service_id
  );
  const operational = staff
    ? isOperationalStaff({
        is_active: staff.is_active,
        archived_at: staff.archived_at,
        merged_into_staff_id: staff.merged_into_staff_id,
        metadata: recordMetadata(staff.metadata),
      })
    : false;
  const hardStaff = staff
    ? {
        id: staff.id,
        branchId: staff.branch_id,
        isActive: staff.is_active && operational,
        archivedAt: staff.archived_at,
        mergedIntoStaffId: staff.merged_into_staff_id,
        isServiceProvider: canActAsBookingServiceProvider(
          staff,
          qualifiedServiceIds.length > 0
        ),
        qualifiedServiceIds,
      }
    : null;
  const hardEligibility = assessSelectedStaffHardEligibility({
    branchId: params.branchId,
    serviceIds: params.serviceIds,
    staff: hardStaff,
  });
  if (hardEligibility) {
    return {
      ok: false,
      code: "STAFF_PREFERENCE_INVALID",
      message: hardEligibility.message,
    };
  }

  const dayOfWeek = getDayOfWeekFromYmd(params.date);
  const [schedulesResult, overrideResult, blocksResult, bookingsResult] =
    await Promise.all([
      admin
        .from("staff_schedules")
        .select(
          "id, shift_type, start_time, end_time, is_active, window_order, ends_next_day"
        )
        .eq("staff_id", params.staffId)
        .eq("day_of_week", dayOfWeek),
      admin
        .from("schedule_overrides")
        .select(
          "id, shift_type, start_time, end_time, is_day_off, ends_next_day"
        )
        .eq("staff_id", params.staffId)
        .eq("override_date", params.date)
        .maybeSingle(),
      admin
        .from("blocked_times")
        .select("start_time, end_time, reason")
        .eq("staff_id", params.staffId)
        .eq("block_date", params.date),
      admin
        .from("bookings")
        .select("start_time, end_time, status, hold_expires_at")
        .eq("branch_id", params.branchId)
        .eq("staff_id", params.staffId)
        .eq("booking_date", params.date),
    ]);

  if (
    schedulesResult.error ||
    overrideResult.error ||
    blocksResult.error ||
    bookingsResult.error
  ) {
    logError("booking.online.staff_schedule_evaluation_failed", {
      branchId: params.branchId,
      staffId: params.staffId,
      date: params.date,
      scheduleError: schedulesResult.error,
      overrideError: overrideResult.error,
      blockError: blocksResult.error,
      bookingError: bookingsResult.error,
    });
    return {
      ok: false,
      code: "STAFF_PREFERENCE_CHECK_FAILED",
      message:
        "We couldn't confirm that staff preference. Please choose Any available staff or try again.",
    };
  }

  const schedule = resolveScheduleForStaffDay({
    override: overrideResult.data,
    individualRows: schedulesResult.data ?? [],
    staff: {
      staff_type: staff!.staff_type,
      system_role: staff!.system_role,
    },
    operational: true,
  });
  const assessment = assessSelectedStaffPreference({
    branchId: params.branchId,
    serviceIds: params.serviceIds,
    startTime: params.startTime,
    endTime: params.endTime,
    staff: hardStaff,
    schedule,
    blockedPeriods: (blocksResult.data ?? []).map((row) => ({
      startTime: row.start_time,
      endTime: row.end_time,
      reason: row.reason,
    })),
    bookings: (bookingsResult.data ?? []).map((row) => ({
      startTime: row.start_time,
      endTime: row.end_time,
      status: row.status,
      holdExpiresAt: row.hold_expires_at,
    })),
  });

  if (assessment.kind === "hard_block") {
    return {
      ok: false,
      code: "STAFF_PREFERENCE_INVALID",
      message: assessment.message,
    };
  }

  return {
    ok: true,
    staffId: params.staffId,
    staffName: staff!.full_name,
    exceptionReason: assessment.exceptionReason,
  };
}
