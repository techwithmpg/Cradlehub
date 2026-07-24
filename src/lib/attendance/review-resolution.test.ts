import { describe, expect, it } from "vitest";
import {
  attendanceReviewPrimaryAction,
  attendanceReviewResolutionKind,
} from "@/lib/attendance/review-resolution";
import type { AttendanceReviewItem } from "@/lib/attendance/crm-review";
import type {
  AttendanceException,
  AttendanceRecord,
  AttendanceScanEvent,
} from "@/lib/attendance/types";

function exception(overrides: Partial<AttendanceException> = {}): AttendanceException {
  return {
    id: "exception-1",
    branch_id: "branch-1",
    staff_id: "staff-1",
    checkin_id: null,
    scan_event_id: null,
    staff_name: "Nikki",
    exception_type: "manual",
    severity: "warning",
    status: "open",
    message: "Attendance requires review.",
    metadata: {},
    detected_at: "2026-07-23T02:00:00.000Z",
    resolved_at: null,
    ...overrides,
  };
}

function item(
  category: AttendanceReviewItem["category"],
  overrides: Partial<AttendanceException> = {}
): AttendanceReviewItem {
  const current = exception(overrides);
  return {
    id: "item-1",
    exception: current,
    relatedExceptionIds: [current.id],
    category,
    priority: "high",
    title: "Attendance issue",
    recommendedAction: "Review",
  };
}

it("routes a saved scan without attendance to the scan resolver", () => {
  const current = item("clock", { scan_event_id: "scan-1" });
  const kind = attendanceReviewResolutionKind({
    item: current,
    record: null,
    scanEvent: {
      id: "scan-1",
      staff_id: "staff-1",
      scan_type: "attendance",
      action: "review_required",
      outcome: "exception",
      reason_code: "ambiguous_scan",
      message: "Saved for review",
      created_at: "2026-07-23T02:00:00.000Z",
      staff_name: "Nikki",
      point_label: "Main Spa Attendance",
      booking_id: null,
    } satisfies AttendanceScanEvent,
  });
  expect(kind).toBe("resolve_scan");
  expect(attendanceReviewPrimaryAction(kind)).toBe("Resolve saved scan");
});

it("routes linked attendance to the correction dialog", () => {
  const current = item("clock", { checkin_id: "checkin-1" });
  const record = {
    id: "checkin-1",
  } as AttendanceRecord;
  expect(
    attendanceReviewResolutionKind({
      item: current,
      record,
      scanEvent: null,
    })
  ).toBe("correct_record");
});

describe("non-clock issue routing", () => {
  it.each([
    ["schedule", "schedule"],
    ["branch", "branch"],
    ["phone", "phone"],
    ["technical", "technical"],
  ] as const)("routes %s incidents to %s", (category, expected) => {
    expect(
      attendanceReviewResolutionKind({
        item: item(category),
        record: null,
        scanEvent: null,
      })
    ).toBe(expected);
  });
});
