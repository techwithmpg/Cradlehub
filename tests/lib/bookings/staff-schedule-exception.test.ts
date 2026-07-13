import { describe, expect, it } from "vitest";
import {
  createOpenStaffScheduleException,
  readStaffScheduleException,
  resolveStaffScheduleExceptionMetadata,
} from "@/lib/bookings/staff-schedule-exception";

const baseParams = {
  reasonCode: "selected_staff_outside_shift" as const,
  selectedStaffId: "00000000-0000-4000-8000-000000000021",
  selectedStaffName: "Maria Santos",
  customerName: "Ana Cruz",
  branchId: "00000000-0000-4000-8000-000000000031",
  bookingDate: "2026-07-14",
  startTime: "17:30:00",
  endTime: "18:30:00",
  createdAt: "2026-07-13T02:00:00.000Z",
};

describe("staff schedule exception metadata", () => {
  it("stores a stable open exception without changing the booking status", () => {
    const metadata = createOpenStaffScheduleException({ price_paid: 900 }, baseParams);

    expect(metadata.price_paid).toBe(900);
    expect(metadata.staff_assignment_review_required).toBe(true);
    expect(readStaffScheduleException(metadata)).toMatchObject({
      status: "open",
      reasonCode: "selected_staff_outside_shift",
      reasonLabel: "Outside scheduled shift",
      selectedStaffId: baseParams.selectedStaffId,
    });
    expect(metadata).not.toHaveProperty("status");
  });

  it("resolves exactly once, records actor and time, and preserves the original reason", () => {
    const open = createOpenStaffScheduleException({}, baseParams);
    const resolved = resolveStaffScheduleExceptionMetadata(open, {
      resolution: "kept_selected_staff",
      resolvedAt: "2026-07-13T03:00:00.000Z",
      resolvedByStaffId: "00000000-0000-4000-8000-000000000041",
    });
    const retried = resolveStaffScheduleExceptionMetadata(resolved, {
      resolution: "marked_resolved",
      resolvedAt: "2026-07-13T04:00:00.000Z",
      resolvedByStaffId: "00000000-0000-4000-8000-000000000042",
    });

    expect(resolved.staff_assignment_review_required).toBe(false);
    expect(readStaffScheduleException(resolved)).toMatchObject({
      status: "resolved",
      reasonCode: baseParams.reasonCode,
      resolution: "kept_selected_staff",
      resolvedAt: "2026-07-13T03:00:00.000Z",
      resolvedByStaffId: "00000000-0000-4000-8000-000000000041",
    });
    expect(resolved.staff_schedule_exception_history).toHaveLength(1);
    expect(retried).toEqual(resolved);
  });

  it("records reassignment details while keeping the original selected staff in history", () => {
    const open = createOpenStaffScheduleException({}, baseParams);
    const resolved = resolveStaffScheduleExceptionMetadata(open, {
      resolution: "reassigned_staff",
      resolvedAt: "2026-07-13T03:00:00.000Z",
      resolvedByStaffId: "00000000-0000-4000-8000-000000000041",
      previousStaffId: baseParams.selectedStaffId,
      newStaffId: "00000000-0000-4000-8000-000000000051",
    });

    expect(readStaffScheduleException(resolved)).toMatchObject({
      selectedStaffId: baseParams.selectedStaffId,
      previousStaffId: baseParams.selectedStaffId,
      newStaffId: "00000000-0000-4000-8000-000000000051",
    });
  });
});
