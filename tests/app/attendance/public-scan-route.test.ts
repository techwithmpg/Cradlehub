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
});
