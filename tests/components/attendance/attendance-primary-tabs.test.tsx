/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AttendancePrimaryTabs } from "@/components/features/attendance/attendance-primary-tabs";

afterEach(cleanup);

describe("AttendancePrimaryTabs", () => {
  it("renders exactly the three task-focused areas", () => {
    render(<AttendancePrimaryTabs activeView="today" onViewChange={() => undefined} />);
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getByRole("tab", { name: "Today" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "Fix a Scan" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Tools & History" })).toBeTruthy();
  });

  it("supports arrow-key navigation", () => {
    const onViewChange = vi.fn();
    render(<AttendancePrimaryTabs activeView="today" onViewChange={onViewChange} />);
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowRight" });
    expect(onViewChange).toHaveBeenCalledWith("fix-scan");
  });
});
