import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  ATTENDANCE_SCAN_INTENT_TTL_SECONDS,
  createAttendanceScanIntent,
  verifyAttendanceScanIntent,
} from "@/lib/attendance/scan-continuation";

describe("attendance first-scan continuation", () => {
  const now = new Date("2026-07-14T05:00:00.000Z");

  it("binds the continuation to the QR and original operation", () => {
    const token = createAttendanceScanIntent({ publicCode: "att_main", operationId: "operation-1", now });
    expect(verifyAttendanceScanIntent(token, { publicCode: "att_main", operationId: "operation-1", now })).toMatchObject({ ok: true });
    expect(verifyAttendanceScanIntent(token, { publicCode: "att_other", operationId: "operation-1", now })).toEqual({ ok: false, code: "mismatch" });
    expect(verifyAttendanceScanIntent(token, { publicCode: "att_main", operationId: "operation-2", now })).toEqual({ ok: false, code: "mismatch" });
  });

  it("rejects tampered and expired continuations", () => {
    const token = createAttendanceScanIntent({ publicCode: "att_main", operationId: "operation-1", now });
    expect(verifyAttendanceScanIntent(`${token}tampered`, { publicCode: "att_main", operationId: "operation-1", now })).toEqual({ ok: false, code: "invalid" });
    const expiredAt = new Date(now.getTime() + (ATTENDANCE_SCAN_INTENT_TTL_SECONDS + 1) * 1000);
    expect(verifyAttendanceScanIntent(token, { publicCode: "att_main", operationId: "operation-1", now: expiredAt })).toEqual({ ok: false, code: "expired" });
  });
});
