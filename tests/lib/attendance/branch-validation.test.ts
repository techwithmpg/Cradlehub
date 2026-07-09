import { describe, expect, it } from "vitest";

import { getAttendanceDeviceBranchDecision } from "@/lib/attendance/branch-validation";

describe("attendance QR branch validation", () => {
  it("allows a returning scan when staff, device, and QR branch all match", () => {
    expect(
      getAttendanceDeviceBranchDecision({
        qrBranchId: "main",
        staffBranchId: "main",
        deviceBranchId: "main",
        staffIsActive: true,
      })
    ).toBe("allowed");
  });

  it("repairs a stale device branch when the current staff branch matches the scanned QR branch", () => {
    expect(
      getAttendanceDeviceBranchDecision({
        qrBranchId: "main",
        staffBranchId: "main",
        deviceBranchId: "old-branch",
        staffIsActive: true,
      })
    ).toBe("sync_device_branch");
  });

  it("blocks wrong branch when the current staff branch does not match the scanned QR branch", () => {
    expect(
      getAttendanceDeviceBranchDecision({
        qrBranchId: "main",
        staffBranchId: "sm",
        deviceBranchId: "main",
        staffIsActive: true,
      })
    ).toBe("wrong_branch");
  });

  it("allows cross-branch staff while still repairing stale device branch metadata", () => {
    expect(
      getAttendanceDeviceBranchDecision({
        qrBranchId: "main",
        staffBranchId: "sm",
        deviceBranchId: "sm",
        staffIsActive: true,
        isCrossBranch: true,
      })
    ).toBe("sync_device_branch");
  });
});
