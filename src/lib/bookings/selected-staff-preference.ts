import { bookingBlocksAvailability } from "@/lib/bookings/hold-status";
import type { StaffScheduleExceptionReasonCode } from "@/lib/bookings/staff-schedule-exception";
import {
  doesDurationFitWithinScheduleWindows,
  type ResolvedStaffSchedule,
} from "@/lib/schedule/resolve-staff-schedule";
import { rangesOverlap, timeToMinutes } from "@/lib/engine/slot-time";

export type SelectedStaffHardBlockCode =
  | "selected_staff_not_found"
  | "selected_staff_inactive"
  | "selected_staff_archived"
  | "selected_staff_wrong_branch"
  | "selected_staff_not_qualified";

export type SelectedStaffPreferenceInput = {
  branchId: string;
  serviceIds: string[];
  startTime: string;
  endTime: string;
  staff: {
    id: string;
    branchId: string;
    isActive: boolean;
    archivedAt: string | null;
    mergedIntoStaffId: string | null;
    isServiceProvider: boolean;
    qualifiedServiceIds: string[];
  } | null;
  schedule: ResolvedStaffSchedule;
  blockedPeriods: Array<{
    startTime: string;
    endTime: string;
    reason: string | null;
  }>;
  bookings: Array<{
    startTime: string;
    endTime: string;
    status: string;
    holdExpiresAt: string | null;
  }>;
  now?: Date;
};

export type SelectedStaffPreferenceAssessment =
  | {
      kind: "hard_block";
      code: SelectedStaffHardBlockCode;
      message: string;
    }
  | {
      kind: "allowed";
      exceptionReason: StaffScheduleExceptionReasonCode | null;
    };

const SAFE_STAFF_PREFERENCE_MESSAGE =
  "That staff preference is unavailable. Please choose another provider or Any available staff.";

function hardBlock(
  code: SelectedStaffHardBlockCode
): Extract<SelectedStaffPreferenceAssessment, { kind: "hard_block" }> {
  return { kind: "hard_block", code, message: SAFE_STAFF_PREFERENCE_MESSAGE };
}

export function assessSelectedStaffHardEligibility(
  input: Pick<SelectedStaffPreferenceInput, "branchId" | "serviceIds" | "staff">
): Extract<SelectedStaffPreferenceAssessment, { kind: "hard_block" }> | null {
  if (!input.staff) return hardBlock("selected_staff_not_found");
  if (!input.staff.isActive) return hardBlock("selected_staff_inactive");
  if (input.staff.archivedAt || input.staff.mergedIntoStaffId) {
    return hardBlock("selected_staff_archived");
  }
  if (input.staff.branchId !== input.branchId) {
    return hardBlock("selected_staff_wrong_branch");
  }
  if (
    !input.staff.isServiceProvider ||
    input.serviceIds.some(
      (serviceId) => !input.staff!.qualifiedServiceIds.includes(serviceId)
    )
  ) {
    return hardBlock("selected_staff_not_qualified");
  }
  return null;
}

function absoluteRange(startTime: string, endTime: string): {
  start: number;
  end: number;
} | null {
  const start = timeToMinutes(startTime);
  const rawEnd = timeToMinutes(endTime);
  if (start === null || rawEnd === null) return null;
  return { start, end: rawEnd <= start ? rawEnd + 24 * 60 : rawEnd };
}

function overlapsBookingRange(
  bookingStartTime: string,
  bookingEndTime: string,
  selectedRange: { start: number; end: number }
): boolean {
  const range = absoluteRange(bookingStartTime, bookingEndTime);
  return Boolean(
    range && rangesOverlap(selectedRange.start, selectedRange.end, range.start, range.end)
  );
}

export function assessSelectedStaffPreference(
  input: SelectedStaffPreferenceInput
): SelectedStaffPreferenceAssessment {
  const hardEligibility = assessSelectedStaffHardEligibility(input);
  if (hardEligibility) return hardEligibility;

  if (input.schedule.status === "day_off") {
    return { kind: "allowed", exceptionReason: "selected_staff_off_day" };
  }
  if (
    input.schedule.status === "missing" ||
    input.schedule.status === "not_operational"
  ) {
    return {
      kind: "allowed",
      exceptionReason: "selected_staff_missing_schedule",
    };
  }
  if (input.schedule.status === "conflict") {
    return {
      kind: "allowed",
      exceptionReason:
        input.schedule.source === "override"
          ? "selected_staff_schedule_override"
          : "selected_staff_missing_schedule",
    };
  }

  const selectedRange = absoluteRange(input.startTime, input.endTime);
  if (!selectedRange) {
    return {
      kind: "allowed",
      exceptionReason: "selected_staff_outside_shift",
    };
  }

  const overlappingBlock = input.blockedPeriods.find((block) =>
    overlapsBookingRange(block.startTime, block.endTime, selectedRange)
  );
  if (overlappingBlock) {
    return {
      kind: "allowed",
      exceptionReason: overlappingBlock.reason?.toLowerCase().includes("leave")
        ? "selected_staff_on_leave"
        : "selected_staff_blocked",
    };
  }

  const now = input.now ?? new Date();
  const hasBookingOverlap = input.bookings.some(
    (booking) =>
      bookingBlocksAvailability(
        { status: booking.status, hold_expires_at: booking.holdExpiresAt },
        now
      ) &&
      overlapsBookingRange(booking.startTime, booking.endTime, selectedRange)
  );
  if (hasBookingOverlap) {
    return {
      kind: "allowed",
      exceptionReason: "selected_staff_booking_overlap",
    };
  }

  if (input.schedule.source === "override") {
    return {
      kind: "allowed",
      exceptionReason: "selected_staff_schedule_override",
    };
  }

  const durationMinutes = selectedRange.end - selectedRange.start;
  const fitsSchedule = doesDurationFitWithinScheduleWindows({
    slotStartTime: input.startTime,
    durationMinutes,
    windows: input.schedule.windows,
  });

  return {
    kind: "allowed",
    exceptionReason: fitsSchedule ? null : "selected_staff_outside_shift",
  };
}
