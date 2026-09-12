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
  type ProviderRuntimeResult,
  type ProviderScheduleSummary,
  type ProviderWorkspaceRuntime,
} from "./provider-model";

export * from "./provider-model";

/**
 * Assembles the authoritative server presentation adapter for Provider Today.
 * Gated strictly to authenticated provider-family staff.
 */
export async function getProviderWorkspaceRuntime(
  date?: string
): Promise<ProviderRuntimeResult> {
  const targetDate = date ?? new Date().toISOString().split("T")[0]!;

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

  const [attendance, scheduleResult, todayResult] = await Promise.all([
    getPureAttendanceSnapshot(30).catch(() => null),
    getMyTodayScheduleAction(targetDate).catch(() => null),
    getMyTodayAction(targetDate).catch(() => null),
  ]);

  const todaySchedule =
    scheduleResult && !("error" in scheduleResult)
      ? scheduleResult.todaySchedule
      : null;

  const todayOverride =
    scheduleResult && !("error" in scheduleResult)
      ? scheduleResult.todayOverride
      : null;

  const bookings: StaffPortalBooking[] =
    todayResult && !("error" in todayResult) ? todayResult.bookings : [];

  const shift = resolveProviderShift(todaySchedule, todayOverride);
  const primaryWork = resolveProviderPrimaryWork(bookings);

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
    },
  };
}
