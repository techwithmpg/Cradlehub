/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AttendanceScanFeedRow } from "@/components/features/attendance/attendance-scan-feed-row";
import type { RecentAttendanceScan } from "@/lib/attendance/types";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function scan(overrides: Partial<RecentAttendanceScan> = {}): RecentAttendanceScan {
  return {
    eventId: "scan-1",
    staffId: "staff-1",
    staffName: "Virgilio Balatayo",
    staffNickname: null,
    staffAvatarUrl: null,
    branchId: "branch-1",
    branchName: "Main Branch",
    eventType: "clock_out",
    occurredAt: "2026-07-03T10:05:00.000Z",
    shiftType: "opening",
    attendanceStatus: "present",
    workedMinutes: 545,
    clockInAt: "2026-07-03T01:00:00.000Z",
    clockOutAt: "2026-07-03T10:05:00.000Z",
    sourceLabel: "Main Attendance",
    ...overrides,
  };
}

afterEach(() => cleanup());

describe("AttendanceScanFeedRow", () => {
  it("renders completed status with duration only as secondary detail", () => {
    render(
      <AttendanceScanFeedRow
        scan={scan()}
        workspace="crm"
        selectedDate="2026-07-03"
      />
    );

    expect(screen.getByText("Completed")).toBeTruthy();
    expect(screen.getByText(/Opening shift - Main Branch - 9h 05m/)).toBeTruthy();
  });

  it("renders anomalous completed duration as Needs review without the raw duration", () => {
    render(
      <AttendanceScanFeedRow
        scan={scan({
          workedMinutes: 4220,
          clockOutAt: "2026-07-05T23:20:00.000Z",
        })}
        workspace="crm"
        selectedDate="2026-07-03"
      />
    );

    expect(screen.getByText("Needs review")).toBeTruthy();
    expect(screen.queryByText("70h 20m")).toBeNull();
  });
});
