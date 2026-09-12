import {
  getMyProfileAction,
  getMyTodayAction,
  getMyTodayScheduleAction,
} from "@/app/(dashboard)/staff-portal/actions";
import { getPureAttendanceSnapshot } from "@/lib/staff-portal/attendance";
import { resolveStaffPwaOperationalGroup } from "@/lib/auth/workspace-access";
import type {
  StaffPortalBooking,
  StaffPortalStaff,
} from "@/components/features/staff-portal/types";
import {
  isClosedBooking,
  isOperationallyActive,
  resolveProviderPrimaryWork,
  resolveProviderShift,
  type ProviderProgressSummary,
  type ProviderRuntimeErrors,
  type ProviderRuntimeResult,
  type ProviderScheduleSummary,
  type ProviderWorkspaceRuntime,
  type ResolvedShift,
  type ProviderPrimaryWork,
} from "./provider-model";
import { getProviderBusinessDate } from "./provider-date";

export * from "./provider-model";
export { getProviderBusinessDate } from "./provider-date";

/**
 * Assembles the authoritative server presentation adapter for Provider Today.
 * Gated strictly to authenticated provider-family staff.
 */
export async function getProviderWorkspaceRuntime(
  date?: string,
  now?: Date
): Promise<ProviderRuntimeResult> {
  const profileResult = await getMyProfileAction().catch(() => null);
  const me =
    profileResult && !("error" in profileResult)
      ? (profileResult.staff as StaffPortalStaff)
      : null;

  if (!me) {
    return {
      ok: false,
      error: "Unauthorized",
      code: "UNAUTHORIZED",
    };
  }

  const operationalGroup = resolveStaffPwaOperationalGroup(
    me.system_role,
    me.staff_type
  );

  if (operationalGroup !== "provider") {
    return {
      ok: false,
      error: "Forbidden: Authenticated staff is not a provider",
      code: "FORBIDDEN",
    };
  }

  const targetDate = date ?? (await getProviderBusinessDate(me.branch_id, now));
  const errors: ProviderRuntimeErrors = {};

  const [attendanceOutcome, scheduleOutcome, todayOutcome] = await Promise.allSettled([
    getPureAttendanceSnapshot(30),
    getMyTodayScheduleAction(targetDate),
    getMyTodayAction(targetDate),
  ]);

  let attendance = null;
  if (attendanceOutcome.status === "fulfilled") {
    attendance = attendanceOutcome.value;
  } else {
    errors.attendance =
      attendanceOutcome.reason instanceof Error
        ? attendanceOutcome.reason.message
        : "Failed to load attendance";
  }

  let todaySchedule = null;
  let todayOverride = null;
  let shift: ResolvedShift;

  if (scheduleOutcome.status === "fulfilled") {
    const res = scheduleOutcome.value;
    if (res && "error" in res && res.error) {
      errors.schedule = res.error;
      shift = { kind: "load_error", error: res.error };
    } else if (res && !("error" in res)) {
      todaySchedule = res.todaySchedule;
      todayOverride = res.todayOverride;
      shift = resolveProviderShift(todaySchedule, todayOverride);
    } else {
      shift = { kind: "none" };
    }
  } else {
    const errMsg =
      scheduleOutcome.reason instanceof Error
        ? scheduleOutcome.reason.message
        : "Failed to load schedule";
    errors.schedule = errMsg;
    shift = { kind: "load_error", error: errMsg };
  }

  let bookings: StaffPortalBooking[] = [];
  let primaryWork: ProviderPrimaryWork;

  if (todayOutcome.status === "fulfilled") {
    const res = todayOutcome.value;
    if (res && "error" in res && res.error) {
      errors.work = res.error;
      primaryWork = {
        kind: "load_error",
        booking: null,
        badgeLabel: "Work unavailable",
        stateLabel: "Error",
        isHome: false,
        active: false,
        error: res.error,
      };
    } else if (res && "bookings" in res && res.bookings) {
      bookings = res.bookings;
      primaryWork = resolveProviderPrimaryWork(bookings);
    } else {
      primaryWork = {
        kind: "clear",
        booking: null,
        badgeLabel: "No assigned service",
        stateLabel: "Clear",
        isHome: false,
        active: false,
      };
    }
  } else {
    const errMsg =
      todayOutcome.reason instanceof Error
        ? todayOutcome.reason.message
        : "Failed to load work";
    errors.work = errMsg;
    primaryWork = {
      kind: "load_error",
      booking: null,
      badgeLabel: "Work unavailable",
      stateLabel: "Error",
      isHome: false,
      active: false,
      error: errMsg,
    };
  }

  const totalAssigned = bookings.length;
  const completedCount = bookings.filter(isClosedBooking).length;
  const remainingCount = totalAssigned - completedCount;

  const scheduleSummary: ProviderScheduleSummary = {
    totalAssigned,
    completedCount,
    remainingCount,
  };

  const progressSummary: ProviderProgressSummary = {
    completedToday: bookings.filter(
      (b) => b.status === "completed" || b.booking_progress_status === "completed"
    ).length,
    activeToday: bookings.filter(isOperationallyActive).length,
    upcomingToday: bookings.filter(
      (b) => !isClosedBooking(b) && !isOperationallyActive(b)
    ).length,
    homeServicesToday: bookings.filter(
      (b) => b.delivery_type === "home_service"
    ).length,
  };

  const hasErrors = Object.keys(errors).length > 0;

  return {
    ok: true,
    runtime: {
      staff: me,
      attendance,
      shift,
      primaryWork,
      todaySchedule,
      todayOverride,
      bookings,
      scheduleSummary,
      progressSummary,
      errors: hasErrors ? errors : undefined,
    },
  };
}
