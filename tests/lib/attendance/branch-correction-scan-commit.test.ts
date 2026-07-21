import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildAttendanceScanCommitRpcArgs,
  type AttendanceScanCommitInput,
} from "@/lib/attendance/scan-engine";
import { isAttendanceScanError } from "@/lib/attendance/scan-errors";

const input: AttendanceScanCommitInput = {
  event: {
    requestId: "branch-correction:00000000-0000-0000-0000-000000000901",
    branchId: "00000000-0000-0000-0000-000000000902",
    qrPointId: "00000000-0000-0000-0000-000000000903",
    staffId: "00000000-0000-0000-0000-000000000904",
    deviceId: "00000000-0000-0000-0000-000000000905",
    scanType: "attendance",
    action: "clock_in",
    outcome: "success",
    reasonCode: "on_time",
    message: "Clock-in recorded.",
    isTest: true,
  },
  result: {
    ok: true,
    outcome: "success",
    severity: "success",
    title: "Clocked in",
    message: "Clock-in recorded.",
  },
  checkinInsert: {
    shift_date: "2026-07-15",
    shift_type: "single",
    shift_instance_key: "qa-branch-correction-shift",
    status: "checked_in",
    attendance_business_date: "2026-07-15",
    branch_timezone: "Asia/Manila",
    is_test: true,
  },
  deviceScanType: "attendance",
};

describe("branch correction Attendance commit payload", () => {
  it("builds the exact snake-case identity and commit envelope used by the live RPC", () => {
    const args = buildAttendanceScanCommitRpcArgs(input);

    expect(args).toMatchObject({
      p_request_id: input.event.requestId,
      p_branch_id: input.event.branchId,
      p_qr_point_id: input.event.qrPointId,
      p_staff_id: input.event.staffId,
      p_device_id: input.event.deviceId,
      p_scan_type: "attendance",
      p_action: "clock_in",
      p_outcome: "success",
      p_reason_code: "on_time",
      p_is_test: true,
      p_device_scan_type: "attendance",
      p_checkin_insert: expect.objectContaining({
        shift_date: "2026-07-15",
        shift_instance_key: "qa-branch-correction-shift",
      }),
    });
  });

  it("does not construct a continuation when the registered device identity is absent", () => {
    try {
      buildAttendanceScanCommitRpcArgs({
        ...input,
        event: { ...input.event, deviceId: null },
      });
      throw new Error("Expected the missing device to be rejected.");
    } catch (error) {
      expect(isAttendanceScanError(error)).toBe(true);
      if (!isAttendanceScanError(error)) return;
      expect(error.code).toBe("ATTENDANCE_TRANSACTION_FAILED");
      expect(error.details).toMatchObject({ hasDeviceId: false });
    }
  });
});
