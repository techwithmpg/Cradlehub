import { describe, expect, it } from "vitest";
import { crmAttendanceHref, parseCrmAttendanceNavigation } from "@/lib/attendance/crm-navigation";

describe("CRM Attendance navigation", () => {
  it("supports exactly four primary workspaces", () => {
    expect(parseCrmAttendanceNavigation({ view: "today" }).view).toBe("today");
    expect(parseCrmAttendanceNavigation({ view: "review" }).view).toBe("review");
    expect(parseCrmAttendanceNavigation({ view: "history" }).view).toBe("history");
    expect(parseCrmAttendanceNavigation({ view: "setup", section: "phones" })).toEqual({
      view: "setup",
      section: "phones",
    });
  });

  it("maps legacy links without exposing legacy tabs", () => {
    expect(parseCrmAttendanceNavigation({ tab: "exceptions" }).view).toBe("review");
    expect(parseCrmAttendanceNavigation({ tab: "devices" })).toEqual({
      view: "setup",
      section: "phones",
    });
  });

  it("preserves useful filter context", () => {
    const preserve = new URLSearchParams({
      staffId: "staff-1",
      date: "2026-07-22",
      tab: "records",
    });
    expect(crmAttendanceHref({ view: "history", section: "qr" }, preserve)).toBe(
      "/crm/attendance?view=history&staffId=staff-1&date=2026-07-22"
    );
  });
});
