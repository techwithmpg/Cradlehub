import type {
  StaffPortalBooking,
  StaffPortalStaff,
} from "@/components/features/staff-portal/types";
import type {
  TodayOverrideInfo,
  TodayScheduleInfo,
} from "@/app/(dashboard)/staff-portal/actions";
import type { StaffAttendanceData } from "@/lib/staff-portal/attendance";

export type ResolvedShift =
  | {
      kind: "shift";
      startTime: string;
      endTime: string;
      label: string;
    }
  | {
      kind: "day_off";
    }
  | {
      kind: "none";
    }
  | {
      kind: "load_error";
      error: string;
    };

export type ProviderPrimaryWork =
  | {
      kind: "home_service";
      booking: StaffPortalBooking;
      badgeLabel: string;
      stateLabel: string;
      isHome: true;
      active: true;
    }
  | {
      kind: "onsite_service";
      booking: StaffPortalBooking;
      badgeLabel: string;
      stateLabel: string;
      isHome: false;
      active: true;
    }
  | {
      kind: "next_service";
      booking: StaffPortalBooking;
      badgeLabel: string;
      stateLabel: string;
      isHome: boolean;
      active: false;
    }
  | {
      kind: "clear";
      booking: null;
      badgeLabel: string;
      stateLabel: string;
      isHome: false;
      active: false;
    }
  | {
      kind: "load_error";
      booking: null;
      badgeLabel: string;
      stateLabel: string;
      isHome: false;
      active: false;
      error: string;
    };

export type ProviderScheduleSummary = {
  totalAssigned: number;
  completedCount: number;
  remainingCount: number;
};

export type ProviderProgressSummary = {
  completedToday: number;
  activeToday: number;
  upcomingToday: number;
  homeServicesToday: number;
};

export type ProviderRuntimeErrors = {
  attendance?: string;
  schedule?: string;
  work?: string;
};

export type ProviderWorkspaceRuntime = {
  staff: StaffPortalStaff;
  attendance: StaffAttendanceData | null;
  shift: ResolvedShift;
  primaryWork: ProviderPrimaryWork;
  todaySchedule: TodayScheduleInfo | null;
  todayOverride: TodayOverrideInfo | null;
  bookings: StaffPortalBooking[];
  scheduleSummary: ProviderScheduleSummary;
  progressSummary: ProviderProgressSummary;
  errors?: ProviderRuntimeErrors;
};

export type ProviderRuntimeResult =
  | {
      ok: true;
      runtime: ProviderWorkspaceRuntime;
    }
  | {
      ok: false;
      error: string;
      code: "UNAUTHORIZED" | "FORBIDDEN" | "LOAD_ERROR";
    };

export function isClosedBooking(booking: StaffPortalBooking): boolean {
  return (
    booking.status === "completed" ||
    booking.status === "cancelled" ||
    booking.status === "no_show" ||
    booking.booking_progress_status === "completed"
  );
}

export function isOperationallyActive(booking: StaffPortalBooking): boolean {
  return (
    booking.status === "in_progress" ||
    [
      "checked_in",
      "travel_started",
      "arrived",
      "session_started",
    ].includes(booking.booking_progress_status)
  );
}

export function serviceStateLabel(booking: StaffPortalBooking): string {
  switch (booking.booking_progress_status) {
    case "checked_in":
      return "Checked In";
    case "travel_started":
      return "Traveling";
    case "arrived":
      return "Arrived";
    case "session_started":
      return "In Progress";
    case "completed":
      return "Completed";
    default:
      return "Upcoming";
  }
}

function shiftTypeLabel(value: string): string {
  if (value === "opening") return "Opening Shift";
  if (value === "closing") return "Closing Shift";
  return "Regular Shift";
}

export function resolveProviderShift(
  schedule: TodayScheduleInfo | null,
  override: TodayOverrideInfo | null
): ResolvedShift {
  if (override?.is_day_off) return { kind: "day_off" };

  if (override && !override.is_day_off) {
    const start = override.start_time ?? schedule?.start_time ?? null;
    const end = override.end_time ?? schedule?.end_time ?? null;

    if (start && end) {
      return {
        kind: "shift",
        startTime: start,
        endTime: end,
        label: schedule ? shiftTypeLabel(schedule.shift_type) : "Regular Shift",
      };
    }
  }

  if (schedule) {
    return {
      kind: "shift",
      startTime: schedule.start_time,
      endTime: schedule.end_time,
      label: shiftTypeLabel(schedule.shift_type),
    };
  }

  return { kind: "none" };
}

/**
 * Section 7 Priority Rule:
 * 1. Active Home Service (delivery_type === 'home_service' && isOperationallyActive)
 * 2. Active onsite service (delivery_type !== 'home_service' && isOperationallyActive)
 * 3. Next assigned service (earliest upcoming open service)
 * 4. Clear / no immediate work
 */
export function resolveProviderPrimaryWork(
  bookings: StaffPortalBooking[]
): ProviderPrimaryWork {
  const open = bookings.filter((b) => !isClosedBooking(b));

  // 1. Active Home Service
  const homeActive = open.find(
    (b) => b.delivery_type === "home_service" && isOperationallyActive(b)
  );
  if (homeActive) {
    return {
      kind: "home_service",
      booking: homeActive,
      badgeLabel: "Home Service Active",
      stateLabel: serviceStateLabel(homeActive),
      isHome: true,
      active: true,
    };
  }

  // 2. Active Onsite Service
  const onsiteActive = open.find(
    (b) => b.delivery_type !== "home_service" && isOperationallyActive(b)
  );
  if (onsiteActive) {
    return {
      kind: "onsite_service",
      booking: onsiteActive,
      badgeLabel: "Active Service",
      stateLabel: serviceStateLabel(onsiteActive),
      isHome: false,
      active: true,
    };
  }

  // 3. Next Assigned Service (earliest upcoming open service)
  const upcoming = [...open].sort((a, b) => {
    const timeCmp = a.start_time.localeCompare(b.start_time);
    if (timeCmp !== 0) return timeCmp;
    return a.id.localeCompare(b.id);
  });

  const nextBooking = upcoming[0];
  if (nextBooking) {
    const isHome = nextBooking.delivery_type === "home_service";
    return {
      kind: "next_service",
      booking: nextBooking,
      badgeLabel: isHome ? "Next Home Service" : "Next Service",
      stateLabel: serviceStateLabel(nextBooking),
      isHome,
      active: false,
    };
  }

  // 4. Clear / No immediate work
  return {
    kind: "clear",
    booking: null,
    badgeLabel: "No assigned service",
    stateLabel: "Clear",
    isHome: false,
    active: false,
  };
}
