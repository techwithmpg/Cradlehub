import { describe, expect, it } from "vitest";

import { attendanceTabHref, parseAttendanceTab } from "@/lib/attendance/tabs";

describe("attendance tabs", () => {
  it("accepts known tab values", () => {
    expect(parseAttendanceTab("qr")).toBe("qr");
    expect(parseAttendanceTab("sessions")).toBe("sessions");
  });

  it("falls back to overview for missing or unknown values", () => {
    expect(parseAttendanceTab(undefined)).toBe("overview");
    expect(parseAttendanceTab(null)).toBe("overview");
    expect(parseAttendanceTab("slow-old-tab")).toBe("overview");
  });

  it("uses the first value from URL arrays", () => {
    expect(parseAttendanceTab(["devices", "records"])).toBe("devices");
  });

  it("builds stable replaceState-friendly URLs", () => {
    expect(attendanceTabHref("reports")).toBe("/crm/attendance?tab=reports");
    expect(
      attendanceTabHref("records", {
        basePath: "/owner/attendance",
        branchId: "branch-1",
      })
    ).toBe("/owner/attendance?tab=records&branchId=branch-1");
  });
});
