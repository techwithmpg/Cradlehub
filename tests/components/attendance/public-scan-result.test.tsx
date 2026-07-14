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

describe("PublicScanResultView attendance success", () => {
  it("formats the authoritative timestamp in the server-provided branch timezone", () => {
    expect(formatAttendanceTime("2026-07-15T01:52:00.000Z", "Pacific/Auckland")).toBe(
      "1:52 PM"
    );
    expect(formatAttendanceDate("2026-07-15T01:52:00.000Z", "America/New_York")).toContain(
      "Jul 14"
    );
  });

  it("keeps the green success card and renders authoritative backend copy", () => {
    const { container } = render(<PublicScanResultView result={successResult} />);

    expect(screen.getByRole("heading", { name: successResult.title })).toBeTruthy();
    expect(screen.getByText(successResult.message)).toBeTruthy();
    expect(container.querySelector("section")?.className).toContain("attendanceSuccess");
    expect(screen.queryByText(/internal-operation-id/i)).toBeNull();
    expect(screen.queryByText(/^Recorded ·/)).toBeNull();
  });

  it.each([
    "Recorded · Late clock-in",
    "Recorded · Early clock-out",
    "Recorded · Overtime",
    "Recorded · Outside schedule",
  ])("shows the secondary review badge %s without replacing success", (reviewLabel) => {
    const { container } = render(
      <PublicScanResultView
        result={{ ...successResult, severity: "warning", reviewLabel }}
      />
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
      "Training Mode · Not live attendance"
    );
    expect(container.querySelector("section")?.className).toContain("attendanceSuccess");
  });
});

describe("PublicScanResultView captured closing scan", () => {
  it("shows a calm captured result with review ownership and no technical details", () => {
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

    expect(screen.getByRole("heading", { name: "Scan captured, Nikki" })).toBeTruthy();
    expect(screen.getByText("The front desk will confirm today’s attendance. You may continue normally.")).toBeTruthy();
    expect(screen.getByRole("status", { name: "Captured · For review" })).toBeTruthy();
    expect(container.querySelector("section")?.className).toContain("resultInfo");
    expect(container.querySelector("section")?.className).not.toContain("attendanceSuccess");
    expect(container.textContent).not.toContain("internal-captured-operation");
    expect(container.textContent?.toLowerCase()).not.toContain("no attendance change");
    expect(container.textContent?.toLowerCase()).not.toContain("scan again");
  });
});
