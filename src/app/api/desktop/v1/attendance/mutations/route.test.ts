import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth/desktop-bearer-auth", () => ({
  verifyDesktopBearerAuth: vi.fn(),
}));

vi.mock("@/lib/attendance/queries", () => ({
  ensureBranchAttendanceQrPoint: vi.fn(),
  ensureRoomQrPoints: vi.fn(),
  replaceBranchAttendanceQrPoint: vi.fn(),
  reviewAttendanceException: vi.fn(),
  resolveAttendanceException: vi.fn(),
}));

vi.mock("@/lib/attendance/attendance-correction-service", () => ({
  applyAttendanceCorrection: vi.fn(),
  updateAttendanceRules: vi.fn(),
}));

vi.mock("@/lib/attendance/device-recovery", () => ({
  renameAttendanceDevice: vi.fn(),
  revokeAttendanceDeviceWithReason: vi.fn(),
  revokeDeviceRecoveryLink: vi.fn(),
}));

vi.mock("@/lib/attendance/device-recovery-operation", () => ({
  generateAttendanceDeviceRecoveryOperation: vi.fn(),
}));

vi.mock("@/lib/attendance/device-registration", () => ({
  reviewStaffDeviceRegistrationRequest: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
}));

import { verifyDesktopBearerAuth } from "@/lib/auth/desktop-bearer-auth";
import {
  ensureBranchAttendanceQrPoint,
  ensureRoomQrPoints,
  replaceBranchAttendanceQrPoint,
  reviewAttendanceException,
  resolveAttendanceException,
} from "@/lib/attendance/queries";
import {
  applyAttendanceCorrection,
  updateAttendanceRules,
} from "@/lib/attendance/attendance-correction-service";
import {
  renameAttendanceDevice,
  revokeAttendanceDeviceWithReason,
  revokeDeviceRecoveryLink,
} from "@/lib/attendance/device-recovery";
import { generateAttendanceDeviceRecoveryOperation } from "@/lib/attendance/device-recovery-operation";
import { reviewStaffDeviceRegistrationRequest } from "@/lib/attendance/device-registration";
import { POST } from "./route";

const mockedAuth = vi.mocked(verifyDesktopBearerAuth);
const mockedEnsureAttendanceQr = vi.mocked(ensureBranchAttendanceQrPoint);
const mockedEnsureRoomQrs = vi.mocked(ensureRoomQrPoints);
const mockedReplaceAttendanceQr = vi.mocked(replaceBranchAttendanceQrPoint);
const mockedReview = vi.mocked(reviewAttendanceException);
const mockedResolve = vi.mocked(resolveAttendanceException);
const mockedCorrection = vi.mocked(applyAttendanceCorrection);
const mockedRules = vi.mocked(updateAttendanceRules);
const mockedGenerateRecovery = vi.mocked(generateAttendanceDeviceRecoveryOperation);
const mockedRename = vi.mocked(renameAttendanceDevice);
const mockedRevoke = vi.mocked(revokeAttendanceDeviceWithReason);
const mockedRevokeLink = vi.mocked(revokeDeviceRecoveryLink);
const mockedReviewRegistration = vi.mocked(reviewStaffDeviceRegistrationRequest);

function createClient(branchName = "Main Spa") {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: "branch-main",
              name: branchName,
            },
            error: null,
          }),
        }),
      }),
    }),
  };
}

function authenticatedResult(branchId: string | null = "branch-main") {
  return {
    ok: true as const,
    operator: {
      authUserId: "user-1",
      staff: {
        id: "staff-1",
        branch_id: branchId,
        system_role: "crm",
      },
      staffRole: "crm",
      isDevBypass: false,
    },
    user: {
      id: "user-1",
      email: "crm@example.test",
    },
    client: createClient(),
  };
}

function request(body: unknown): NextRequest {
  return new NextRequest("https://example.test/api/desktop/v1/attendance/mutations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/desktop/v1/attendance/mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns bearer auth failures unchanged", async () => {
    mockedAuth.mockResolvedValue({
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      message: "Invalid or expired access token.",
    });

    const response = await POST(
      request({
        action: "review_exception",
        payload: {
          exceptionId: "exception-1",
        },
      })
    );

    expect(response.status).toBe(401);
  });

  it("rejects staff without an authoritative branch", async () => {
    mockedAuth.mockResolvedValue(authenticatedResult(null) as never);

    const response = await POST(
      request({
        action: "review_exception",
        payload: {
          exceptionId: "exception-1",
        },
      })
    );

    expect(response.status).toBe(403);

    expect(await response.json()).toMatchObject({
      ok: false,
      code: "STAFF_NOT_FOUND",
    });
  });

  it("rejects unknown mutation actions", async () => {
    mockedAuth.mockResolvedValue(authenticatedResult() as never);

    const response = await POST(
      request({
        action: "delete_everything",
        payload: {},
      })
    );

    expect(response.status).toBe(400);
  });

  it("generates the official Attendance QR with authoritative branch context", async () => {
    mockedAuth.mockResolvedValue(authenticatedResult() as never);

    mockedEnsureAttendanceQr.mockResolvedValue({
      id: "qr-new",
    } as never);

    const response = await POST(
      request({
        action: "ensure_attendance_qr",
        payload: {
          branchId: "branch-attacker",
        },
      })
    );

    expect(response.status).toBe(200);

    expect(mockedEnsureAttendanceQr).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId: "branch-main",
        actorStaffId: "staff-1",
      })
    );

    expect(await response.json()).toMatchObject({
      ok: true,
      action: "ensure_attendance_qr",
      qrPointId: "qr-new",
    });
  });

  it("creates missing room QRs with authoritative branch context", async () => {
    mockedAuth.mockResolvedValue(authenticatedResult() as never);

    mockedEnsureRoomQrs.mockResolvedValue({
      createdCount: 2,
      qrPoints: [{ id: "room-qr-1" }, { id: "room-qr-2" }],
    } as never);

    const response = await POST(
      request({
        action: "ensure_room_qrs",
        payload: {
          branchId: "branch-attacker",
        },
      })
    );

    expect(response.status).toBe(200);

    expect(mockedEnsureRoomQrs).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId: "branch-main",
        actorStaffId: "staff-1",
      })
    );

    expect(await response.json()).toMatchObject({
      ok: true,
      action: "ensure_room_qrs",
      createdCount: 2,
      qrPointIds: ["room-qr-1", "room-qr-2"],
    });
  });

  it("replaces only the authenticated branch official Attendance QR", async () => {
    mockedAuth.mockResolvedValue(authenticatedResult() as never);

    mockedReplaceAttendanceQr.mockResolvedValue({
      id: "qr-replacement",
    } as never);

    const response = await POST(
      request({
        action: "replace_attendance_qr",
        payload: {
          branchId: "branch-attacker",
          qrPointId: "qr-current",
        },
      })
    );

    expect(response.status).toBe(200);

    expect(mockedReplaceAttendanceQr).toHaveBeenCalledWith({
      ctx: expect.objectContaining({
        branchId: "branch-main",
        actorStaffId: "staff-1",
      }),
      qrPointId: "qr-current",
    });

    expect(await response.json()).toMatchObject({
      ok: true,
      action: "replace_attendance_qr",
      replacedQrPointId: "qr-current",
      qrPointId: "qr-replacement",
    });
  });

  it("reviews an exception with authoritative context", async () => {
    mockedAuth.mockResolvedValue(authenticatedResult() as never);

    mockedReview.mockResolvedValue(undefined);

    const response = await POST(
      request({
        action: "review_exception",
        payload: {
          exceptionId: "exception-1",
          branchId: "branch-attacker",
        },
      })
    );

    expect(response.status).toBe(200);

    expect(mockedReview).toHaveBeenCalledWith({
      ctx: {
        branchId: "branch-main",
        branchName: "Main Spa",
        actorStaffId: "staff-1",
        role: "crm",
        canSwitchBranch: false,
      },
      exceptionId: "exception-1",
    });
  });

  it("resolves an exception with authoritative context", async () => {
    mockedAuth.mockResolvedValue(authenticatedResult() as never);

    mockedResolve.mockResolvedValue(undefined);

    const response = await POST(
      request({
        action: "resolve_exception",
        payload: {
          exceptionId: "exception-2",
          resolutionNote: "Verified.",
        },
      })
    );

    expect(response.status).toBe(200);
  });

  it("overrides correction branchId", async () => {
    mockedAuth.mockResolvedValue(authenticatedResult() as never);

    mockedCorrection.mockResolvedValue({
      message: "Attendance corrected.",
    });

    const response = await POST(
      request({
        action: "apply_correction",
        payload: {
          branchId: "branch-attacker",
          actionType: "ignore_scan",
          exceptionId: "exception-1",
          reason: "Duplicate.",
        },
      })
    );

    expect(response.status).toBe(200);

    expect(mockedCorrection).toHaveBeenCalledWith({
      ctx: expect.objectContaining({
        branchId: "branch-main",
        actorStaffId: "staff-1",
      }),
      input: expect.objectContaining({
        branchId: "branch-main",
      }),
    });
  });

  it("overrides rules branchId", async () => {
    mockedAuth.mockResolvedValue(authenticatedResult() as never);

    mockedRules.mockResolvedValue({
      settings: {
        branch_id: "branch-main",
      },
    } as never);

    const response = await POST(
      request({
        action: "update_rules",
        payload: {
          branchId: "branch-attacker",
          reason: "Rule update",
          settings: {
            late_grace_minutes: 10,
          },
        },
      })
    );

    expect(response.status).toBe(200);

    expect(mockedRules).toHaveBeenCalledWith({
      ctx: expect.objectContaining({
        branchId: "branch-main",
      }),
      input: expect.objectContaining({
        branchId: "branch-main",
      }),
    });
  });

  it("generates phone recovery with server branch authority", async () => {
    mockedAuth.mockResolvedValue(authenticatedResult() as never);

    mockedGenerateRecovery.mockResolvedValue({
      tokenId: "token-1",
      recoveryUrl: null,
      expiresAt: "2026-09-09T20:30:00.000Z",
      staffName: "Alice",
      branchName: "Main Spa",
      reason: "browser_data_cleared",
      deliveryMethod: "staff_profile",
    });

    const response = await POST(
      request({
        action: "generate_device_recovery",
        payload: {
          staffId: "staff-target",
          branchId: "branch-attacker",
          reason: "browser_data_cleared",
          expiresInMinutes: 30,
          deliveryMethod: "staff_profile",
        },
      })
    );

    expect(response.status).toBe(200);

    expect(mockedGenerateRecovery).toHaveBeenCalledWith({
      ctx: expect.objectContaining({
        branchId: "branch-main",
        actorStaffId: "staff-1",
      }),
      input: {
        staffId: "staff-target",
        branchId: "branch-main",
        reason: "browser_data_cleared",
        expiresInMinutes: 30,
        deliveryMethod: "staff_profile",
        revokePreviousDeviceId: null,
      },
      origin: "https://example.test",
    });
  });

  it("renames a device only inside authenticated branch context", async () => {
    mockedAuth.mockResolvedValue(authenticatedResult() as never);

    mockedRename.mockResolvedValue({
      deviceId: "device-1",
      label: "Front phone",
    });

    const response = await POST(
      request({
        action: "rename_device",
        payload: {
          branchId: "branch-attacker",
          deviceId: "device-1",
          label: "Front phone",
        },
      })
    );

    expect(response.status).toBe(200);

    expect(mockedRename).toHaveBeenCalledWith({
      ctx: expect.objectContaining({
        branchId: "branch-main",
      }),
      deviceId: "device-1",
      label: "Front phone",
    });
  });

  it("revokes a device only inside authenticated branch context", async () => {
    mockedAuth.mockResolvedValue(authenticatedResult() as never);

    mockedRevoke.mockResolvedValue({
      deviceId: "device-1",
      reason: "replacement_phone",
    });

    const response = await POST(
      request({
        action: "revoke_device",
        payload: {
          deviceId: "device-1",
          reason: "replacement_phone",
        },
      })
    );

    expect(response.status).toBe(200);

    expect(mockedRevoke).toHaveBeenCalledWith({
      ctx: expect.objectContaining({
        branchId: "branch-main",
      }),
      deviceId: "device-1",
      reason: "replacement_phone",
    });
  });

  it("revokes a pending recovery link inside authenticated branch", async () => {
    mockedAuth.mockResolvedValue(authenticatedResult() as never);

    mockedRevokeLink.mockResolvedValue({
      tokenId: "token-1",
    });

    const response = await POST(
      request({
        action: "revoke_recovery_link",
        payload: {
          tokenId: "token-1",
        },
      })
    );

    expect(response.status).toBe(200);

    expect(mockedRevokeLink).toHaveBeenCalledWith({
      ctx: expect.objectContaining({
        branchId: "branch-main",
      }),
      tokenId: "token-1",
    });
  });

  it("reviews phone request with bearer reviewer identity", async () => {
    mockedAuth.mockResolvedValue(authenticatedResult() as never);

    mockedReviewRegistration.mockResolvedValue({
      id: "request-1",
      staffId: "staff-target",
      staffName: "Alice",
      branchId: "branch-main",
      requestType: "new_phone",
      status: "approved",
      deviceLabel: "Attendance phone",
      browserName: null,
      platformName: null,
      existingDeviceId: null,
      replacementDeviceId: null,
      completedDeviceId: null,
      requestedAt: "2026-09-09T10:00:00.000Z",
      reviewedAt: "2026-09-09T11:00:00.000Z",
      reviewerNote: null,
      rejectionReason: null,
      expiresAt: "2026-09-10T11:00:00.000Z",
    });

    const response = await POST(
      request({
        action: "review_device_registration_request",
        payload: {
          branchId: "branch-attacker",
          requestId: "request-1",
          decision: "approved",
        },
      })
    );

    expect(response.status).toBe(200);

    expect(mockedReviewRegistration).toHaveBeenCalledWith({
      ctx: expect.objectContaining({
        branchId: "branch-main",
        actorStaffId: "staff-1",
      }),
      requestId: "request-1",
      decision: "approved",
      reviewerNote: null,
      rejectionReason: null,
      replacementDeviceId: null,
      reviewerAuthUserId: "user-1",
    });
  });

  it("rejects invalid recovery TTL before calling domain operation", async () => {
    mockedAuth.mockResolvedValue(authenticatedResult() as never);

    const response = await POST(
      request({
        action: "generate_device_recovery",
        payload: {
          staffId: "staff-target",
          reason: "other",
          expiresInMinutes: 999,
          deliveryMethod: "copy_link",
        },
      })
    );

    expect(response.status).toBe(400);
    expect(mockedGenerateRecovery).not.toHaveBeenCalled();
  });

  it("does not expose PostgREST implementation errors", async () => {
    mockedAuth.mockResolvedValue(authenticatedResult() as never);

    mockedCorrection.mockRejectedValue(new Error("PostgrestError: private details"));

    const response = await POST(
      request({
        action: "apply_correction",
        payload: {
          actionType: "ignore_scan",
          exceptionId: "exception-1",
          reason: "Duplicate.",
        },
      })
    );

    expect(response.status).toBe(422);

    expect(await response.json()).toEqual({
      ok: false,
      code: "ATTENDANCE_ACTION_FAILED",
      message: "The Attendance action could not be completed. Please try again.",
    });
  });
});
