import type { StaffScheduleItem } from "@/components/features/staff-schedule/staff-schedule-list";
import type { DailyScheduleStaffRow } from "@/lib/queries/schedule";
import type {
  LiveScheduleConflict,
  LiveScheduleConflictQuickAction,
} from "@/lib/schedule/live-schedule-conflict-types";
import type { AvailabilityTab } from "@/components/features/crm/schedule/edit-availability-types";

type Notify = (title: string, description?: string) => void;

type ConflictActionContext = {
  conflict: LiveScheduleConflict;
  action: LiveScheduleConflictQuickAction;
  visibleRows: DailyScheduleStaffRow[];
  availabilityItems: StaffScheduleItem[];
  selectStaff: (staffId: string | null) => void;
  selectBooking: (bookingId: string | null) => void;
  openScheduleSetup: () => void;
  openFullSchedule: (staffId: string) => void;
  openAvailabilityEditor: (staffId: string, initialTab: AvailabilityTab) => void;
  openCheckAvailability: () => void;
  notify: Notify;
  notifyError: Notify;
};

function resolveConflictTarget(context: ConflictActionContext): {
  staffId: string | null;
  bookingId: string | null;
} {
  const bookingId =
    context.action.bookingId ?? context.conflict.affected_booking_ids[0] ?? null;
  const staffId =
    context.action.staffId ??
    context.conflict.affected_staff_ids[0] ??
    (bookingId
      ? context.visibleRows.find((row) =>
          row.bookings.some((booking) => booking.id === bookingId)
        )?.staff_id ?? null
      : null);

  return { staffId, bookingId };
}

export function runDailyTimelineConflictAction(context: ConflictActionContext) {
  const { staffId, bookingId } = resolveConflictTarget(context);

  if (staffId) context.selectStaff(staffId);
  context.selectBooking(bookingId);

  if (context.action.intent === "open_schedule_setup") {
    context.openScheduleSetup();
    return;
  }

  if (context.action.intent === "open_full_schedule") {
    if (staffId) context.openFullSchedule(staffId);
    else context.openScheduleSetup();
    return;
  }

  if (context.action.intent === "edit_staff_schedule" || context.action.intent === "edit_blocked_time") {
    if (!staffId) {
      context.openScheduleSetup();
      return;
    }

    const hasAvailabilityItem = context.availabilityItems.some((item) => item.staff.id === staffId);
    if (!hasAvailabilityItem) {
      context.notifyError("Schedule editor is not available for this staff member.");
      context.openScheduleSetup();
      return;
    }

    context.openAvailabilityEditor(
      staffId,
      context.action.intent === "edit_blocked_time" ? "blocks" : "weekly"
    );
    return;
  }

  if (
    context.action.intent === "move_booking" ||
    context.action.intent === "assign_staff" ||
    context.action.intent === "review_travel_timing"
  ) {
    context.openCheckAvailability();
    context.notify(
      "Check available options",
      "The affected booking is selected. Choose a safer time or staff from availability."
    );
    return;
  }

  if (context.action.intent === "assign_resource") {
    context.notify(
      "Booking selected",
      "Use the existing booking room controls to assign an available room."
    );
    return;
  }

  context.notify("Booking selected in the timeline", context.conflict.plain_language_message);
}
