import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/attendance/device-recovery", () => ({
  generateDeviceRecoveryLink: vi.fn(),
}));

vi.mock("@/lib/notifications/workflow-notifications-store", () => ({
  createOrUpdateNotification: vi.fn(),
}));

import { generateDeviceRecoveryLink } from "@/lib/attendance/device-recovery";
import { createOrUpdateNotification } from "@/lib/notifications/workflow-notifications-store";
import { generateAttendanceDeviceRecoveryOperation } from "@/lib/attendance/device-recovery-operation";

const mockedGenerate = vi.mocked(generateDeviceRecoveryLink);
const mockedNotification = vi.mocked(createOrUpdateNotification);

const ctx = {
  branchId: "branch-main",
  branchName: "Main Spa",
  actorStaffId: "staff-crm",
  role: "crm",
  canSwitchBranch: false,
};

describe("generateAttendanceDeviceRecoveryOperation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forces the authoritative branch and sends Staff Profile notification", async () => {
    mockedGenerate.mockResolvedValue({
      tokenId: "token-1",
      recoveryUrl: null,
      expiresAt: "2026-09-09T12:30:00.000Z",
      staffName: "Alice Therapist",
      branchName: "Main Spa",
      reason: "browser_data_cleared",
      deliveryMethod: "staff_profile",
    });

    const result = await generateAttendanceDeviceRecoveryOperation({
      ctx,
      origin: "https://example.test",
      input: {
        staffId: "staff-1",
        branchId: "branch-attacker",
        reason: "browser_data_cleared",
        expiresInMinutes: 30,
        deliveryMethod: "staff_profile",
      },
    });

    expect(mockedGenerate).toHaveBeenCalledWith({
      ctx,
      origin: "https://example.test",
      input: {
        staffId: "staff-1",
        branchId: "branch-main",
        reason: "browser_data_cleared",
        expiresInMinutes: 30,
        deliveryMethod: "staff_profile",
      },
    });

    expect(mockedNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId: "branch-main",
        recipientStaffId: "staff-1",
        actorStaffId: "staff-crm",
        type: "attendance_device_recovery_ready",
        entityId: "token-1",
        actionHref: "/staff-portal/profile#attendance-phone",
      })
    );

    expect(result.tokenId).toBe("token-1");
  });

  it("does not create Staff Profile notification for copy-link delivery", async () => {
    mockedGenerate.mockResolvedValue({
      tokenId: "token-2",
      recoveryUrl: "https://example.test/attendance/device/abc",
      expiresAt: "2026-09-09T12:30:00.000Z",
      staffName: "Alice Therapist",
      branchName: "Main Spa",
      reason: "replacement_phone",
      deliveryMethod: "copy_link",
    });

    await generateAttendanceDeviceRecoveryOperation({
      ctx,
      origin: "https://example.test",
      input: {
        staffId: "staff-1",
        branchId: "branch-main",
        reason: "replacement_phone",
        expiresInMinutes: 30,
        deliveryMethod: "copy_link",
      },
    });

    expect(mockedNotification).not.toHaveBeenCalled();
  });
});
