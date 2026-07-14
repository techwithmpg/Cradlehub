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

describe("public attendance scan route", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a non-200 structured failure when the backend transaction fails", async () => {
    processQrScanMock.mockRejectedValueOnce(
      createAttendanceScanError("ATTENDANCE_CONSTRAINT_FAILED", "constraint failed", {
        operationId: "scan-op-1",
        dbCode: "23514",
      })
    );

    const response = await POST(request({ publicCode: "qr-code", requestId: "scan-op-1" }));
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json).toMatchObject({
      ok: false,
      outcome: "error",
      reasonCode: "ATTENDANCE_CONSTRAINT_FAILED",
      operationId: "scan-op-1",
      securityNote: "No attendance change was confirmed from this attempt.",
    });
    expect(json.message).not.toContain("constraint failed");
  });

  it("maps a missing production device secret to the safe configuration code", async () => {
    processQrScanMock.mockRejectedValueOnce(
      new Error("ATTENDANCE_DEVICE_SECRET is required in production.")
    );

    const response = await POST(request({ publicCode: "qr-code", requestId: "scan-op-2" }));
    const json = await response.json();

    expect(response.status).toBe(503);
    expect(json).toMatchObject({
      ok: false,
      outcome: "error",
      reasonCode: "ATTENDANCE_CONFIGURATION_MISSING",
      operationId: "scan-op-2",
      message:
        "Attendance is temporarily unavailable because its secure device configuration is incomplete. Please contact the administrator.",
      recoverable: false,
    });
    expect(json.message).not.toContain("ATTENDANCE_DEVICE_SECRET");
    expect(console.error).toHaveBeenCalledWith(
      "[public-attendance-scan-route] attendance scan failed",
      expect.objectContaining({
        operationId: "scan-op-2",
        safeCode: "ATTENDANCE_CONFIGURATION_MISSING",
        safeDetails: { missingVariable: "ATTENDANCE_DEVICE_SECRET" },
      })
    );
  });

  it("issues temporary HttpOnly registration and signed continuation cookies for an unknown phone", async () => {
    processQrScanMock.mockResolvedValueOnce({
      ok: false,
      outcome: "blocked",
      reasonCode: "unknown_device",
      title: "Device not registered",
      message: "Sign in to connect this phone.",
      operationId: "scan-op-3",
    });

    const response = await POST(request({ publicCode: "qr-code", requestId: "scan-op-3" }));
    const setCookies = response.headers.getSetCookie().join("\n");

    expect(response.status).toBe(200);
    expect(setCookies).toContain("cradle_attendance_registration=");
    expect(setCookies).toContain("cradle_attendance_scan_intent=");
    expect(setCookies).toContain("HttpOnly");
    expect(setCookies).toContain("SameSite=lax");
  });
});
