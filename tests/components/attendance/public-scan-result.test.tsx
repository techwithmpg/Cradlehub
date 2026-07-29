/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PublicScanResultView } from "@/components/features/attendance/public-scan-result";
import {
  formatAttendanceDate,
  formatAttendanceTime,
} from "@/components/features/attendance/public-scan-format";
import type { PublicScanResult } from "@/lib/attendance/types";

vi.mock("@/components/shared/brand-logo", () => ({
  BrandLogo: () => <div data-testid="brand-logo" />,
}));

const successResult: PublicScanResult = {
  ok: true,
  outcome: "success",
  reasonCode: "clock_in",
  severity: "success",
  title: "Good morning, Nikki 🌿",
  message: "You’re clocked in at 9:52 AM. Have a lovely day!",
  operationId: "internal-operation-id",
  securityNote: "This device is recognized and ready for future scans.",
  attendance: {
    action: "clock_in",
    staffName: "Nicole Santos",
    branchName: "Cradle Main",
    branchTimezone: "Asia/Manila",
    shiftLabel: "single",
    occurredAt: "2026-07-15T01:52:00.000Z",
    sessionStartedAt: "2026-07-15T01:52:00.000Z",
  },
};

afterEach(() => cleanup());

describe("PublicScanResultView Attendance success", () => {
  it("formats the authoritative timestamp in the server-provided branch timezone", () => {
    expect(formatAttendanceTime("2026-07-15T01:52:00.000Z", "Pacific/Auckland")).toBe("1:52 PM");
    expect(formatAttendanceDate("2026-07-15T01:52:00.000Z", "America/New_York")).toContain(
      "Jul 14"
    );
  });

  it("shows the simplified clock-in result and staff identity", () => {
    const { container } = render(<PublicScanResultView result={successResult} />);

    expect(screen.getByRole("heading", { name: "Clocked in" })).toBeTruthy();
    expect(screen.getByText("Nicole Santos")).toBeTruthy();
    expect(screen.getByText("Cradle Main")).toBeTruthy();
    expect(screen.getByText("You may close this page.")).toBeTruthy();
    expect(container.querySelector("section")?.className).toContain("attendanceSuccess");
    expect(container.textContent).not.toContain(successResult.title);
    expect(container.textContent).not.toContain(successResult.message);
    expect(container.textContent).not.toContain("internal-operation-id");
  });

  it("shows the simplified clock-out result with worked duration", () => {
    render(
      <PublicScanResultView
        result={{
          ...successResult,
          reasonCode: "clock_out",
          attendance: {
            ...successResult.attendance!,
            action: "clock_out",
            workedMinutes: 545,
          },
        }}
      />
    );

    expect(screen.getByRole("heading", { name: "Clocked out" })).toBeTruthy();
    expect(screen.getByText("Nicole Santos")).toBeTruthy();
    expect(screen.getByText("9h 05m")).toBeTruthy();
    expect(screen.getByText("You may close this page.")).toBeTruthy();
  });

  it.each([
    "Recorded · Late clock-in",
    "Recorded · Early clock-out",
    "Recorded · Overtime",
    "Recorded · Outside schedule",
  ])("shows the accessible secondary review badge %s without replacing success", (reviewLabel) => {
    const { container } = render(
      <PublicScanResultView result={{ ...successResult, severity: "warning", reviewLabel }} />
    );

    expect(screen.getByRole("status", { name: reviewLabel })).toBeTruthy();
    expect(container.querySelector("section")?.className).toContain("attendanceSuccess");
    expect(container.textContent?.toLowerCase()).not.toContain("scan again");
  });

  it("shows a clear non-live indicator for a committed Training Mode result", () => {
    const { container } = render(
      <PublicScanResultView result={{ ...successResult, isTest: true }} />
    );

    expect(screen.getByRole("status", { name: "Training Mode" }).textContent).toBe(
      "Training Mode · Not live Attendance"
    );
    expect(screen.getByRole("heading", { name: "Clocked in" })).toBeTruthy();
    expect(container.querySelector("section")?.className).toContain("attendanceSuccess");
  });
});

describe("PublicScanResultView reviewable scan", () => {
  it("shows Scan saved, no Attendance change, and no technical ownership", () => {
    const { container } = render(
      <PublicScanResultView
        result={{
          ok: true,
          outcome: "exception",
          reasonCode: "likely_closing_scan_without_clock_in",
          severity: "warning",
          title: "Scan captured, Nikki",
          message: "The front desk will confirm today’s attendance. You may continue normally.",
          reviewLabel: "Captured · For review",
          operationId: "internal-captured-operation",
        }}
      />
    );

    expect(screen.getByRole("heading", { name: "Scan saved" })).toBeTruthy();
    expect(
      screen.getByText("The front desk will review your Attendance. Do not scan again.")
    ).toBeTruthy();
    expect(screen.getByText("Attendance changed: No")).toBeTruthy();
    expect(container.querySelector("section")?.className).toContain("resultInfo");
    expect(container.textContent).not.toContain("internal-captured-operation");
    expect(container.textContent).not.toMatch(/CRM owner|root cause|RPC|database policy/i);
  });
});

describe("PublicScanResultView duplicate scan", () => {
  it("states that Attendance is already recorded and no further action is needed", () => {
    render(
      <PublicScanResultView
        result={{
          ok: true,
          outcome: "noop",
          reasonCode: "duplicate_scan",
          severity: "info",
          title: "Attendance already recorded",
          message: "No further action is needed.",
        }}
      />
    );

    expect(screen.getByRole("heading", { name: "Attendance already recorded" })).toBeTruthy();
    expect(screen.getByText("No further action is needed.")).toBeTruthy();
    expect(document.body.textContent?.toLowerCase()).not.toContain("scan repeatedly");
  });
});
