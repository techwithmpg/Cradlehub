import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAttendanceScanError } from "@/lib/attendance/scan-errors";
import { processQrScan } from "@/lib/attendance/scan-engine";
import { POST } from "@/app/api/attendance/public-scan/route";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/attendance/scan-engine", () => ({
  processQrScan: vi.fn(),
}));

vi.mock("@/lib/attendance/queries", () => ({
  revalidateAttendanceSurfaces: vi.fn(),
}));

const processQrScanMock = vi.mocked(processQrScan);

function request(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/attendance/public-scan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function successfulScan(isTest = false) {
  return {
    ok: true as const,
    outcome: "success" as const,
    reasonCode: "clock_in",
    severity: "success" as const,
    title: "Clocked in",
    message: "Attendance recorded.",
    operationId: isTest ? "scan-op-test" : "scan-op-live",
    isTest,
    attendance: {
      action: "clock_in" as const,
      staffName: "Nicole Santos",
      branchName: "Cradle Main",
      branchTimezone: "Asia/Manila",
      shiftLabel: "single",
      occurredAt: "2026-07-29T01:52:00.000Z",
      sessionStartedAt: "2026-07-29T01:52:00.000Z",
    },
  };
}

describe("public attendance scan route", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a normal successful Attendance scan", async () => {
    processQrScanMock.mockResolvedValueOnce(successfulScan());

    const response = await POST(request({ publicCode: "qr-code", requestId: "scan-op-live" }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      ok: true,
      outcome: "success",
      reasonCode: "clock_in",
      operationId: "scan-op-live",
      attendance: {
        action: "clock_in",
        staffName: "Nicole Santos",
        branchName: "Cradle Main",
      },
    });
    expect(json.isTest).toBe(false);
  });

  it("returns a successful Test Mode scan with an explicit non-live indicator", async () => {
    processQrScanMock.mockResolvedValueOnce(successfulScan(true));

    const response = await POST(request({ publicCode: "qr-code", requestId: "scan-op-test" }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      ok: true,
      reasonCode: "clock_in",
      operationId: "scan-op-test",
      isTest: true,
      attendance: { action: "clock_in" },
    });
  });

  it("issues safe temporary continuation cookies for an unknown phone", async () => {
    processQrScanMock.mockResolvedValueOnce({
      ok: false,
      outcome: "blocked",
      reasonCode: "unknown_device",
      title: "Device not registered",
      message: "Sign in to connect this phone.",
      operationId: "scan-op-unknown",
    });

    const response = await POST(request({ publicCode: "qr-code", requestId: "scan-op-unknown" }));
    const json = await response.json();
    const setCookies = response.headers.getSetCookie().join("\n");

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      ok: false,
      reasonCode: "unknown_device",
      operationId: "scan-op-unknown",
    });
    expect(setCookies).toContain("cradle_attendance_registration=");
    expect(setCookies).toContain("cradle_attendance_scan_intent=");
    expect(setCookies).toContain("HttpOnly");
    expect(setCookies).toContain("SameSite=lax");
  });

  it("returns a safe wrong-branch result without changing Attendance", async () => {
    processQrScanMock.mockResolvedValueOnce({
      ok: false,
      outcome: "blocked",
      reasonCode: "wrong_branch",
      title: "Wrong branch",
      message: "No Attendance change was made.",
      securityNote: "Attendance changed: No",
      scanEventId: "scan-event-1",
      branchCorrection: {
        staffId: "staff-1",
        staffName: "Nicole Santos",
        currentBranchId: "branch-sm",
        currentBranchName: "Cradle Wellness Living SM",
        requestedBranchId: "branch-main",
        requestedBranchName: "Cradle Wellness Main Spa",
        qrPointId: "qr-1",
        scanEventId: "scan-event-1",
        deviceId: "internal-device-id",
        canRequestBranchCorrection: true,
      },
    });

    const response = await POST(request({ publicCode: "qr-code", requestId: "scan-op-branch" }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      ok: false,
      reasonCode: "wrong_branch",
      securityNote: "Attendance changed: No",
      branchCorrection: {
        currentBranchName: "Cradle Wellness Living SM",
        requestedBranchName: "Cradle Wellness Main Spa",
      },
    });
    expect(json.branchCorrection).not.toHaveProperty("deviceId");
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it("returns a non-200 structured failure when the backend transaction fails", async () => {
    processQrScanMock.mockRejectedValueOnce(
      createAttendanceScanError("ATTENDANCE_CONSTRAINT_FAILED", "constraint failed", {
        operationId: "scan-op-failure",
        dbCode: "23514",
      })
    );

    const response = await POST(request({ publicCode: "qr-code", requestId: "scan-op-failure" }));
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json).toMatchObject({
      ok: false,
      outcome: "error",
      reasonCode: "ATTENDANCE_CONSTRAINT_FAILED",
      operationId: "scan-op-failure",
      securityNote: "No attendance change was confirmed from this attempt.",
    });
    expect(json.message).not.toContain("constraint failed");
  });

  it("does not expose internal resolution or diagnostic details", async () => {
    processQrScanMock.mockResolvedValueOnce({
      ...successfulScan(),
      detail: "RPC commit_attendance_scan_transaction failed.",
      resolution: {
        rootCause: "Internal database policy detail",
        crmSummary: "Assign this to the CRM owner",
        suggestedActions: ["Run internal RPC"],
      } as never,
    });

    const response = await POST(request({ publicCode: "qr-code", requestId: "scan-op-live" }));
    const json = await response.json();
    const serialized = JSON.stringify(json);

    expect(json).not.toHaveProperty("resolution");
    expect(json).not.toHaveProperty("detail");
    expect(serialized).not.toMatch(/rootCause|crmSummary|suggestedActions|commit_attendance|RPC/i);
  });

  it("maps a missing production device secret to the safe configuration code", async () => {
    processQrScanMock.mockRejectedValueOnce(
      new Error("ATTENDANCE_DEVICE_SECRET is required in production.")
    );

    const response = await POST(request({ publicCode: "qr-code", requestId: "scan-op-config" }));
    const json = await response.json();

    expect(response.status).toBe(503);
    expect(json).toMatchObject({
      ok: false,
      outcome: "error",
      reasonCode: "ATTENDANCE_CONFIGURATION_MISSING",
      operationId: "scan-op-config",
      recoverable: false,
    });
    expect(json.message).not.toContain("ATTENDANCE_DEVICE_SECRET");
  });
});
