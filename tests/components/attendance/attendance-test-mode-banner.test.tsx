/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AttendanceTestModeBanner } from "@/components/features/attendance/attendance-test-mode-banner";

afterEach(() => cleanup());

describe("AttendanceTestModeBanner", () => {
  it("clearly labels database-backed training scans without blocking Attendance", () => {
    render(<AttendanceTestModeBanner reason="Staff training" />);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Attendance Test Mode is active");
    expect(status).toHaveTextContent(
      "Scans are recorded as test data and do not affect live Attendance."
    );
    expect(status).toHaveTextContent("Reason: Staff training");
  });
});
