import { describe, expect, it } from "vitest";
import {
  attendanceWorkspaceHref,
  navigationFromAttendanceTab,
  parseAttendanceNavigation,
} from "@/lib/attendance/workspace-navigation";

describe("Attendance workspace navigation", () => {
  it("uses Today by default", () => {
    expect(parseAttendanceNavigation({})).toEqual({ view: "today", tool: "history" });
  });

  it.each([
    ["overview", { view: "today", tool: "history" }],
    ["records", { view: "tools", tool: "history" }],
    ["sessions", { view: "tools", tool: "sessions" }],
    ["qr-codes", { view: "tools", tool: "qr" }],
    ["devices", { view: "tools", tool: "phones" }],
    ["review-queue", { view: "fix-scan", tool: "history" }],
    ["reports", { view: "tools", tool: "reports" }],
  ])("maps the legacy %s tab", (tab, expected) => {
    expect(parseAttendanceNavigation({ tab })).toEqual(expected);
  });

  it("prefers canonical view and tool parameters", () => {
    expect(parseAttendanceNavigation({ view: "fix-scan", tab: "reports" })).toEqual({
      view: "fix-scan",
      tool: "history",
    });
    expect(parseAttendanceNavigation({ view: "tools", tool: "phones" })).toEqual({
      view: "tools",
      tool: "phones",
    });
  });

  it("builds canonical links while preserving scoped deep-link filters", () => {
    const preserve = new URLSearchParams(
      "tab=records&staffId=staff-1&date=2026-07-22&message=Ready"
    );
    expect(
      attendanceWorkspaceHref(
        { view: "tools", tool: "history" },
        { basePath: "/owner/attendance", branchId: "branch-1", preserve }
      )
    ).toBe(
      "/owner/attendance?view=tools&tool=history&branchId=branch-1&message=Ready&staffId=staff-1&date=2026-07-22"
    );
  });

  it("maps every internal action tab into the new information architecture", () => {
    expect(navigationFromAttendanceTab("exceptions").view).toBe("fix-scan");
    expect(navigationFromAttendanceTab("qr")).toEqual({ view: "tools", tool: "qr" });
  });
});
