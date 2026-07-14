import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  attendanceReviewLabel,
  buildAttendanceGreeting,
  getAttendanceGreetingName,
} from "@/lib/attendance/greetings";

const baseInput = {
  staffId: "staff-1",
  nickname: "Nikki",
  fullName: "Nicole Santos",
  branchLocalTime: "09:52:00",
  action: "clock_in" as const,
  reasonCode: "clock_in",
  requestId: "request-1",
  businessDate: "2026-07-15",
};

describe("attendance greetings", () => {
  it("prefers nickname, then useful first name, then the generic fallback", () => {
    expect(getAttendanceGreetingName({ nickname: "Nikki", fullName: "Nicole Santos" })).toBe("Nikki");
    expect(getAttendanceGreetingName({ nickname: null, fullName: "Nicole Santos" })).toBe("Nicole");
    expect(getAttendanceGreetingName({ nickname: null, fullName: "Staff member" })).toBe("there");
  });

  it.each([
    ["09:52:00", ["Good morning", "Welcome in", "Ready for a great day", "You’re all set"]],
    ["14:14:00", ["Good afternoon", "Welcome to your shift", "You’re ready to go", "Have a great shift"]],
    ["19:06:00", ["Good evening", "Welcome in", "You’re all set for the evening", "Have a smooth shift"]],
    ["01:10:00", ["Welcome in", "You’re ready to go", "Have a smooth shift", "You’re all set"]],
  ])("uses the branch-local greeting period at %s", (branchLocalTime, expectedStarts) => {
    const greeting = buildAttendanceGreeting({ ...baseInput, branchLocalTime });
    expect(expectedStarts.some((start) => greeting.title.startsWith(start))).toBe(true);
    expect(greeting.title).toContain("Nikki");
  });

  it("formats the recorded time from branch-local time", () => {
    expect(buildAttendanceGreeting(baseInput).message).toContain("9:52 AM");
    expect(buildAttendanceGreeting({
      ...baseInput,
      action: "clock_out",
      branchLocalTime: "19:06:00",
      reasonCode: "clock_out",
    }).message).toContain("7:06 PM");
  });

  it("returns the fixed friendly outside-schedule and captured copy", () => {
    expect(buildAttendanceGreeting({ ...baseInput, reasonCode: "ambiguous_scan" })).toMatchObject({
      title: "You’re clocked in, Nikki 🌿",
      message: "This scan was outside your schedule, so the front desk will review it.",
    });
    expect(buildAttendanceGreeting({
      ...baseInput,
      action: "captured",
      reasonCode: "likely_closing_scan_without_clock_in",
    })).toMatchObject({
      title: "Scan captured, Nikki",
      message: "The front desk will confirm today’s attendance. You may continue normally.",
    });
  });

  it("is stable for the same scan and rotates across stable request inputs", () => {
    expect(buildAttendanceGreeting(baseInput)).toEqual(buildAttendanceGreeting(baseInput));
    const titles = new Set(
      Array.from({ length: 24 }, (_, index) =>
        buildAttendanceGreeting({ ...baseInput, requestId: `request-${index}` }).title
      )
    );
    expect(titles.size).toBeGreaterThan(1);
  });

  it("does not use random selection", () => {
    const source = readFileSync(join(process.cwd(), "src/lib/attendance/greetings.ts"), "utf8");
    expect(source).not.toContain("Math.random");
  });
});

describe("attendance review labels", () => {
  it.each([
    ["early_clock_in", "Recorded · Early clock-in"],
    ["late_clock_in", "Recorded · Late clock-in"],
    ["ambiguous_scan", "Recorded · Outside schedule"],
    ["missing_schedule", "Recorded · No schedule found"],
    ["off_day_exception", "Recorded · Scheduled off day"],
    ["early_clock_out", "Recorded · Early clock-out"],
    ["overtime_clock_out", "Recorded · Overtime"],
    ["stale_open_checkin", "Recorded · Review required"],
  ])("maps %s", (reasonCode, label) => {
    expect(attendanceReviewLabel(reasonCode, true)).toBe(label);
  });

  it("omits the label when no review is required", () => {
    expect(attendanceReviewLabel("clock_in", false)).toBeUndefined();
  });
});
